const k8s = require('@kubernetes/client-node');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const kubeConfig = new k8s.KubeConfig();
kubeConfig.loadFromDefault();
const coreV1Api = kubeConfig.makeApiClient(k8s.CoreV1Api);

async function fetchSoftwareConfig() {
  try {
    const configMap = await coreV1Api.readNamespacedConfigMap('clustereye-config', 'default');
    const softwareConfig = configMap.body.data;
    return Object.entries(softwareConfig).map(([key, value]) => ({ name: key, ...JSON.parse(value) }));
  } catch (error) {
    console.error('Error fetching software config:', error);
    throw error;
  }
}

async function fetchLatestImageTag(commandArray) {
  const networkErrorMessage = 'Network error occurred with getting latest version, try again in a few minutes';
  try {
    const command = commandArray.join(' ');

    const { stdout, stderr } = await exec(command);
    if (stderr || !stdout || stdout.trim() === 'null') {
      console.error(`Error in command execution: ${stderr}`);
      return networkErrorMessage;
    }
    return stdout.trim();
  } catch (error) {
    console.error('Error fetching latest tag:', error.message);
    return networkErrorMessage;
  }
}

async function fetchEOLDate(appName, version, eolUrl) {

  if (!eolUrl) {
    return 'EOL URL not provided';
  }

  try {
    const { stdout, stderr } = await exec(`curl -s "${eolUrl}"`);
    if (stderr) {
      console.error('Error fetching EOL data:', stderr);
      return 'Error fetching data';
    }

    const eolData = JSON.parse(stdout);

    // Function to check the version format in EOL data
    const isMajorMinorFormat = (eolData) => {
      return eolData.some(entry => entry.cycle && entry.cycle.includes('.'));
    };

    // Determine the format of the versioning in the EOL data
    const versionFormatIsMajorMinor = isMajorMinorFormat(eolData);

    // Extract major and minor version numbers
    const versionParts = version.match(/^v?(\d+)(?:\.(\d+))?/);
    const major = versionParts[1];
    const minor = versionParts[2];

    // Find the matching EOL entry based on the versioning format
    let eolEntry;
    if (versionFormatIsMajorMinor) {
      eolEntry = eolData.find(entry => entry.cycle === `${major}.${minor || '0'}`);
    } else {
      eolEntry = eolData.find(entry => entry.cycle === major);
    }

    return eolEntry && eolEntry.eol ? eolEntry.eol : 'Not found';
  } catch (error) {
    console.error('Error executing curl:', error);
    return 'Error executing curl';
  }
}

async function getRunningPodImages() {
  try {
    const softwares = await fetchSoftwareConfig();
    const res = await coreV1Api.listPodForAllNamespaces();
    const containerObjects = res.body.items.flatMap(pod => {
      const appName = pod.metadata.labels?.app;
      const software = softwares.find(s => s.name === appName);

      if (software && pod.status.containerStatuses) {
        return pod.status.containerStatuses
          .filter(status => {
            const containerNameToMatch = software.nameexception && software.nameexception !== "" ? software.nameexception : appName;
            return status.name === containerNameToMatch;
          })
          .map(status => ({
            containerName: software.nameexception && software.nameexception !== "" ? appName : status.name,
            imageRepository: status.image.split(':')[0],
            imageVersionUsedInCluster: status.image.split(':')[1],
            appName: appName,
            command: software.command,
            note: software.note || ''
          }));
      }
      return [];
    });

    for (const containerObj of containerObjects) {
      if (containerObj.command) {
        containerObj.newestImageAvailable = await fetchLatestImageTag(containerObj.command);
      }
      const softwareConfig = softwares.find(s => s.name === containerObj.appName);

      if (softwareConfig && softwareConfig.eolUrl) {
        containerObj.eolDate = await fetchEOLDate(containerObj.appName, containerObj.imageVersionUsedInCluster, softwareConfig.eolUrl);
      } else {
        containerObj.eolDate = 'EOL information not available';
      }
    }

    console.log(containerObjects);
    return containerObjects;
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
}

module.exports.getRunningPodImages = getRunningPodImages;