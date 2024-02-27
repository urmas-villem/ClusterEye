'use strict';

const express = require('express');
const path = require('path');
const promClient = require('prom-client');
const { getRunningPodImages } = require('./getRunningPodImages');

const PORT = 9191;
const HOST = '0.0.0.0';
const UPDATE_INTERVAL = 60 * 60 * 1000; // 1 hour

const app = express();
let cache = null;
let lastUpdated = Date.now();

app.use(express.static(path.join(__dirname, 'public')));

// Prometheus metrics setup
const register = new promClient.Registry();
const containerInfoGauge = new promClient.Gauge({
    name: 'clustereye_container_status',
    help: 'Status information about containers monitored by ClusterEye',
    labelNames: ['container_name', 'image_repository', 'image_version', 'newest_image'],
    registers: [register],
});

// Function to update the cache
async function updateCache() {
    try {
        cache = await getRunningPodImages();
        lastUpdated = Date.now();
        updateMetricsFromCache();
        await sendSlackNotification();
    } catch (error) {
        console.error('Error updating cache:', error);
    }
}

function updateMetricsFromCache() {
    if (cache) {
        cache.forEach(pod => {
            containerInfoGauge.labels(pod.containerName, pod.imageRepository, pod.imageVersionUsedInCluster, pod.newestImageAvailable).set(1);
        });
    }
}

async function sendSlackNotification() {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    const environmentMapping = {
        '115304599867': 'dev',
        // more here later
    };

    const accountNumberRegex = /(\d+)\.dkr\.ecr\..*\.amazonaws\.com/;
    let env = 'unknown environment';

    // Determine environment
    for (const item of cache) {
        const match = item.imageRepository.match(accountNumberRegex);
        if (match && match[1] && environmentMapping[match[1]]) {
            env = environmentMapping[match[1]];
            break; // Break after first match
        }
    }

    // Send notifications to environment
    for (const item of cache) {
        if (item.sendToSlack) {
            //apply formating
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const payload = {
                attachments: [
                    {
                        color: "#f2c744",
                        blocks: [
                            {
                                type: "section",
                                text: {
                                    type: "mrkdwn",
                                    text: `*${item.containerName} for* \`${env}\` *can be upgraded to a newer version*`
                                }
                            },
                            {
                                type: "context",
                                elements: [
                                    {
                                        type: "mrkdwn",
                                        text: `Version used: \`${item.imageVersionUsedInCluster}\`, newest image: \`${item.newestImageAvailable}\``
                                    }
                                ]
                            },
                            {
                                type: "context",
                                elements: [
                                    {
                                        type: "mrkdwn",
                                        text: `_<!date^${currentTimestamp}^{date} at {time}|{date} at {time}>_`
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };

            try {
                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });
            } catch (error) {
                console.error(`Error sending Slack notification for ${item.containerName}:`, error);
            }
        }
    }
}

// Endpoint to trigger cache and Prometheus metrics updates
app.post('/trigger-update', async (req, res) => {
    await updateCache();
    res.status(200).send('Cache updated');
});

// Endpoint to get pod images data
app.get('/pod-images', (req, res) => {
    res.json({ data: cache, lastUpdated });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});

// Start server and initialize cache update and metrics update
app.listen(PORT, HOST, () => {
    console.log(`Running on http://${HOST}:${PORT}`);
    updateCache();
    setInterval(updateCache, UPDATE_INTERVAL);
});