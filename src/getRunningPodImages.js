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

function isDatePassed(eolDate) {
  if (eolDate === 'EOL information not available') {
      return true;
  }

  if (!eolDate || isNaN(Date.parse(eolDate))) {
      return false;
  }
  const today = new Date();
  const eol = new Date(eolDate);
  return today > eol;
}

function eolDays(eolDate) {
  if (!eolDate || isNaN(Date.parse(eolDate))) {
      return '';
  }

  const today = new Date();
  const eol = new Date(eolDate);

  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const eolStart = new Date(eol.getFullYear(), eol.getMonth(), eol.getDate());

  const timeDifference = eolStart - todayStart;
  const days = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));

  return days;
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

  if (version.startsWith('sha256:')) {
    return "Can't find EOL for SHA values";
  }

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

async function preProcess(containerObjects, maxPages = 5) {
  const repositoryMap = {
      'alertmanager': 'alertmanager',
      'prometheus': 'prometheus',
      'blackbox': 'blackbox-exporter',
      'node-exporter': 'node-exporter',
      'kafka-exporter': 'kafka-exporter'
      // Additional mappings if necessary
  };

  for (const containerObj of containerObjects) {
      if (containerObj.imageVersionUsedInCluster.startsWith('sha256:')) {
          const sha = containerObj.imageVersionUsedInCluster;
          const repository = repositoryMap[containerObj.appName];

          if (!repository) {
              console.error('Repository not defined for application:', containerObj.appName);
              continue;
          }

          // Determine the correct namespace based on the repository
          let namespace = 'prom';
          if (containerObj.appName === 'kafka-exporter') {
              namespace = 'danielqsj';
          }

          for (let page = 1; page <= maxPages; page++) {
              const curlCommand = `curl -s "https://hub.docker.com/v2/namespaces/${namespace}/repositories/${repository}/tags?page=${page}" | jq -r '.results[] | select(.images[].digest == "${sha}" and .name != "latest").name'`;
              try {
                  const { stdout, stderr } = await exec(curlCommand);
                  if (stderr) {
                      console.error('Error fetching image version:', stderr);
                      continue;
                  }
                  if (stdout.trim()) {
                      containerObj.imageVersionUsedInCluster = stdout.trim();
                      break;
                  }
              } catch (error) {
                  console.error('Error executing curl command:', error);
              }
          }
      }
  }
}

async function getRunningPodImages() {
  try {
    const softwares = await fetchSoftwareConfig();
    const res = await coreV1Api.listPodForAllNamespaces();
    const processedApps = new Set();
    const containerObjects = res.body.items.flatMap(pod => {
      const appName = pod.metadata.labels?.app;
      if (processedApps.has(appName)) {
        return [];
      }
      const software = softwares.find(s => s.name === appName);

      if (software && pod.status.containerStatuses) {
        processedApps.add(appName);
        return pod.status.containerStatuses
          .filter(status => {
            const containerNameToMatch = software.nameexception && software.nameexception !== "" ? software.nameexception : appName;
            return status.name === containerNameToMatch;
          })
          .map(status => ({
            containerName: software.nameexception && software.nameexception !== "" ? appName : status.name,
            imageRepository: status.image.includes('sha256') ? status.imageID.split('@')[0] : status.image.split(':')[0],
            imageVersionUsedInCluster: status.image.includes('sha256') ? status.imageID.split('@')[1] : status.image.split(':')[1],
            appName: appName,
            command: software.command,
            note: software.note || ''
          }));
      }
      return [];
    });

    await preProcess(containerObjects);

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
      containerObj.daysUntilEOL = eolDays(containerObj.eolDate);
      const isVersionMismatch = containerObj.imageVersionUsedInCluster !== containerObj.newestImageAvailable;
      const eolPassed = isDatePassed(containerObj.eolDate);
      containerObj.sendToSlack = isVersionMismatch && eolPassed;
    }

    console.log(containerObjects);
    return containerObjects;
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
}

module.exports.getRunningPodImages = getRunningPodImages;