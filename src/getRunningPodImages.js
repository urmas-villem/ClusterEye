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
    let expectedApps = new Set();
    const configObjects = Object.entries(softwareConfig).map(([key, value]) => {
      expectedApps.add(key);
      return { name: key, ...JSON.parse(value) };
    });
    return { configObjects, expectedApps };
  } catch (error) {
    console.error('Error fetching software config:', error);
    throw error;
  }
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
  const command = commandArray.join(' ');
  console.log(`Executing command: ${command}`);

  try {
    const { stdout, stderr } = await exec(command);

    if (stderr || !stdout || stdout.trim() === 'null') {
      console.error(`Error in command execution: ${stderr}`);
      console.log(`Standard output received: ${stdout}`);
      return await fetchRateLimitInfo();
    }

    console.log(`Command executed successfully. Output: ${stdout.trim()}`);
    return stdout.trim();
  } catch (error) {
    console.error(`Error fetching latest tag: ${error.message}`);
    console.error(`Full error stack: ${error.stack}`);
    return await fetchRateLimitInfo();
  }
}

async function fetchRateLimitInfo() {
  try {
    const rateLimitCommand = `curl -s https://api.github.com/rate_limit | jq '.rate.reset' | xargs -I{} sh -c 'echo $(({} - $(date +%s)))' | awk '{printf "Time until rate limit reset: %d hours, %d minutes, %d seconds\\n", $1/3600, ($1%3600)/60, $1%60}'`;
    const { stdout, stderr } = await exec(rateLimitCommand);
    if (stderr) {
      console.error(`Error fetching rate limit info: ${stderr}`);
      return 'Unable to fetch rate limit reset time due to an error.';
    }
    return `Rate limit will reset in: ${stdout.trim()}`;
  } catch (error) {
    console.error(`Error in fetching rate limit: ${error.message}`);
    return 'Unable to fetch rate limit reset time due to an error.';
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

async function preProcess(containerObjects) {
  const repositoryMap = {
      'alertmanager': 'alertmanager',
      'prometheus': 'prometheus',
      'blackbox': 'blackbox-exporter',
      'node-exporter': 'node-exporter',
      'kafka-exporter': 'kafka-exporter',
      'cloudwatch-exporter': 'cloudwatch-exporter',
      'opentelemetry-collector': 'opentelemetry-collector-contrib',
      'jaeger': 'all-in-one',
      'redis-exporter': 'redis-exporter'
  };

  for (const containerObj of containerObjects) {
      if (containerObj.imageVersionUsedInCluster.startsWith('sha256:')) {
          const sha = containerObj.imageVersionUsedInCluster;
          let repository = repositoryMap[containerObj.appName];
          if (!repository) {
              console.error('Repository not defined for application:', containerObj.appName);
              continue;
          }

          let namespace = 'prom';
          if (containerObj.appName === 'kafka-exporter') {
              namespace = 'danielqsj';
          } else if (containerObj.appName === 'opentelemetry-collector') {
              namespace = 'otel';
          } else if (containerObj.appName === 'jaeger') {
              namespace = 'jaegertracing';
          } else if (containerObj.appName === 'redis-exporter') {
              namespace = 'bitnami';
          }

          console.log(`Finding image tag in dockerhub for ${sha}`);

          const pageCheckCommand = `curl -s "https://hub.docker.com/v2/namespaces/${namespace}/repositories/${repository}/tags?page_size=10" | jq '.count / 10 | ceil'`;
          let maxPages = 7; // Default if fetching fails
          try {
              const { stdout: totalPageOutput } = await exec(pageCheckCommand);
              maxPages = Number(totalPageOutput.trim());
          } catch (error) {
              console.error('Error fetching total pages:', error);
          }

          for (let page = 1; page <= maxPages; page++) {
            const curlCommand = `curl -s "https://hub.docker.com/v2/namespaces/${namespace}/repositories/${repository}/tags?page=${page}" | jq -r '[.results[] | select(.images[].digest == "${sha}" and .name != "latest" and (.name | tostring | test("-amd64$") | not) and (.name | test("-debian") | not)).name] | last'`;
            //console.log('Executing CURL to dockerhub command:', curlCommand);
              try {
                  const { stdout, stderr } = await exec(curlCommand);
                  if (stderr) {
                      console.error('Error fetching image version:', stderr);
                      continue;
                  }
                  if (stdout.trim() && stdout.trim() !== 'null') {
                      console.log(`Image tag found on page ${page}`);
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

function normalizeVersion(clusterVersion, onlineVersion) {
  const hasVPrefixOnline = onlineVersion.startsWith('v');
  const hasVPrefixCluster = clusterVersion.startsWith('v');

  if (hasVPrefixOnline && !hasVPrefixCluster) {
    return 'v' + clusterVersion;
  } else if (!hasVPrefixOnline && hasVPrefixCluster) {
    return clusterVersion.slice(1);
  }
  return clusterVersion;
}

async function getRunningPodImages() {
  try {
    const { configObjects, expectedApps } = await fetchSoftwareConfig();
    console.log('Fetched software config successfully.');

    const res = await coreV1Api.listPodForAllNamespaces();
    console.log('Fetched list of all pods across all namespaces.');

    const processedApps = new Set();
    const containerObjects = [];
    const missingApps = new Set(expectedApps);
    let foundApps = [];
    let warnings = [];

    console.log('Processing pods...');
    for (const pod of res.body.items) {
      const appName = pod.metadata.labels?.['app.kubernetes.io/name'] || pod.metadata.labels?.app;
      //console.log('Processing pod:', pod.metadata.name, 'with app name:', appName);

      if (!expectedApps.has(appName)) {
        //console.log(`Skipping pod ${pod.metadata.name} as ${appName} is not an expected app.`);
        continue;
      }

      missingApps.delete(appName);
      if (processedApps.has(appName)) {
        //console.log(`Skipping pod ${pod.metadata.name} for ${appName} as it has already been processed successfully.`);
        continue;
      }

      const software = configObjects.find(s => s.name === appName);
      if (software) {
        const expectedContainerName = software.nameexception && software.nameexception.trim() !== "" ? software.nameexception : appName;
        //console.log(`Expected container name for ${appName}: ${expectedContainerName}`);
        //console.log(`Available containers in the pod:`, pod.status.containerStatuses.map(s => s.name).join(', '));

        const containerFound = pod.status.containerStatuses.some(status => status.name === expectedContainerName);

        if (containerFound) {
          const statusObjects = pod.status.containerStatuses.filter(status => status.name === expectedContainerName).map(status => ({
            containerName: appName,
            imageRepository: status.image.includes('sha256') ? status.imageID.split('@')[0] : status.image.split(':')[0],
            imageVersionUsedInCluster: status.image.includes('sha256') ? status.imageID.split('@')[1] : status.image.split(':')[1],
            appName: appName,
            command: software.command,
            note: software.note || ''
          }));

          //console.log(`Found app: ${appName} processed`);
          containerObjects.push(...statusObjects);
          foundApps.push(appName);
          processedApps.add(appName);
        } else {
          //console.log(`No container named ${expectedContainerName} found in pod for ${appName}. Continuing to check other pods.`);
        }
      } else {
        console.log(`No software configuration found for app ${appName}, skipping.`);
      }
    }

    console.log('Processing complete. Apps found:', foundApps.join(', '));
    console.log('Apps that are listed in configmap but not found:', Array.from(missingApps).join(', '));
    warnings.forEach(warning => console.warn(warning));

    await preProcess(containerObjects);

    for (const containerObj of containerObjects) {
      if (containerObj.command) {
        const newestImageAvailable = await fetchLatestImageTag(containerObj.command);
        containerObj.newestImageAvailable = newestImageAvailable;
        containerObj.imageVersionUsedInCluster = normalizeVersion(containerObj.imageVersionUsedInCluster, newestImageAvailable);
      }
      const softwareConfig = configObjects.find(s => s.name === containerObj.appName);

      if (softwareConfig && softwareConfig.eolUrl) {
        containerObj.eolDate = await fetchEOLDate(containerObj.appName, containerObj.imageVersionUsedInCluster, softwareConfig.eolUrl);
      } else {
        containerObj.eolDate = 'EOL information not available';
      }
      containerObj.daysUntilEOL = eolDays(containerObj.eolDate);
    }

    console.log('Final container objects:', containerObjects);
    return { containerObjects, missingApps: Array.from(missingApps) };
  } catch (error) {
    console.error('Error during processing:', error);
    return { containerObjects: [], missingApps: [] };
  }
}

module.exports.getRunningPodImages = getRunningPodImages;