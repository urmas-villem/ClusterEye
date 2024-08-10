'use strict';

const express = require('express');
const path = require('path');
const promClient = require('prom-client');
const { getRunningPodImages } = require('./getRunningPodImages');

const PORT = 9191;
const HOST = '0.0.0.0';
const UPDATE_INTERVAL = 4 * 60 * 60 * 4000; // 4 hours

const app = express();
let cache = null;
let cacheModal = null;
let lastUpdated = Date.now();

const debugMode = process.env.DEBUG === 'true';

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
        const result = await getRunningPodImages();
        cache = result.containerObjects;
        cacheModal = result.missingApps;
        lastUpdated = Date.now();
        updateMetricsFromCache();
    } catch (error) {
        console.error('Error updating cache:', error);
    }
}

function updateMetricsFromCache() {
    // remove the previous data
    containerInfoGauge.reset();

    if (cache) {
        cache.forEach(pod => {
            containerInfoGauge.labels(pod.containerName, pod.imageRepository, pod.imageVersionUsedInCluster, pod.newestImageAvailable).set(1);
        });
    }
}

// Endpoint for missing apps
app.get('/api/missing-apps', (req, res) => {
    res.json({ missingApps: cacheModal });
});

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
