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
  const softwares = await fetchSoftwareConfig();
  const res = await coreV1Api.listPodForAllNamespaces();
  const containerObjects = [];

  for (const pod of res.body.items) {
      const appName = pod.metadata.labels?.app;
      const software = softwares.find(s => s.name === appName);
      if (!software) continue;

      for (const status of pod.status.containerStatuses) {
          const containerNameToMatch = software.nameexception && software.nameexception !== "" ? software.nameexception : appName;
          if (status.name !== containerNameToMatch) continue;

          const imageDetails = status.imageID || status.image; // Use imageID if available, otherwise fallback to image
          const imageParts = imageDetails.split('@');
          const imageRepository = imageParts[0].replace('docker-pullable://', '').split(':')[0];
          let imageVersionUsedInCluster = 'latest';

          if (imageParts.length > 1 && imageParts[1].startsWith('sha256:')) {
              imageVersionUsedInCluster = imageParts[1];
          } else {
              const tagParts = imageDetails.split(':');
              if (tagParts.length > 1 && !tagParts[1].includes('sha256')) {
                  imageVersionUsedInCluster = tagParts[1];
              }
          }

          let eolDate = 'EOL information not available';
          let newestImageAvailable = 'Latest tag not available';
          if (software.eolUrl) {
              eolDate = await fetchEOLDate(appName, imageVersionUsedInCluster, software.eolUrl);
          }
          if (software.command) {
              newestImageAvailable = await fetchLatestImageTag(software.command.split(' '));
          }

          const isVersionMismatch = (imageVersionUsedInCluster !== newestImageAvailable);
          const eolPassed = isDatePassed(eolDate);

          containerObjects.push({
              containerName: containerNameToMatch,
              imageRepository,
              imageVersionUsedInCluster,
              appName,
              command: software.command,
              note: software.note || '',
              eolDate,
              newestImageAvailable,
              daysUntilEOL: eolDays(eolDate),
              sendToSlack: isVersionMismatch && eolPassed
          });
      }
  }

  console.log(containerObjects);
  return containerObjects;
}

module.exports.getRunningPodImages = getRunningPodImages;