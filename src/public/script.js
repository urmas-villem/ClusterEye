import { formatDate, isDatePassed, getTimeDifferenceMessage } from './utility.js';

import { sendSlackNotification } from '../server.js';

export async function fetchAndDisplayPodImages(resetTimer = true) {
    document.getElementById('loadingMessage').style.display = 'block';

    try {
        const response = await fetch('/pod-images');
        const { data, lastUpdated } = await response.json();

        await new Promise(resolve => setTimeout(resolve, 500));

        const container = document.getElementById('podImagesContainer');
        container.innerHTML = '<h2>Images:</h2>';

        let table = '<table border="1"><tr>';
        table += '<th>Container name</th>';
        table += '<th>Image repository</th>';
        table += '<th>Image version used in cluster</th>';
        table += '<th>EOL of used version</th>';
        table += '<th>Newest image available</th>';
        table += '<th>Notes</th>';
        table += '</tr>';

        data.forEach(item => {
            const versionMismatch = item.imageVersionUsedInCluster !== item.newestImageAvailable;
            const versionCellClass = versionMismatch ? 'version-mismatch' : '';
            const eolDatePassed = isDatePassed(item.eolDate);
            let eolDateClass = '';

            if (eolDatePassed === true) {
                eolDateClass = 'date-passed';
            } else if (eolDatePassed === false) {
                eolDateClass = 'date-valid';
            }

            const formattedEolDate = formatDate(item.eolDate);
            const timeDiffMessage = getTimeDifferenceMessage(item.eolDate);

            const daysMatch = timeDiffMessage.match(/(\d+) day/);
            const daysRemaining = daysMatch ? parseInt(daysMatch[1], 10) : null;

            if (versionMismatch && !eolDatePassed && daysRemaining !== null && daysRemaining <= 167) {
                const message = `Version mismatch found for ${item.containerName}. EOL in ${daysRemaining} days.`;
                sendSlackNotification(message);
            }

            table += `<tr>
                        <td>${item.containerName}</td>
                        <td>${item.imageRepository}</td>
                        <td class="${versionCellClass}">${item.imageVersionUsedInCluster}</td>
                        <td class="${eolDateClass}">${formattedEolDate} ${timeDiffMessage}</td>
                        <td>${item.newestImageAvailable}</td>
                        <td>${item.note}</td>
                      </tr>`;
        });

        table += '</table>';
        container.innerHTML += table;

        document.getElementById('loadingMessage').style.display = 'none';

        const lastUpdatedDate = new Date(lastUpdated);
        document.getElementById('lastUpdated').innerText = `Last Updated: ${lastUpdatedDate.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

    } catch (error) {
        console.error('Error fetching pod images:', error);
        document.getElementById('loadingMessage').innerText = 'Failed to load pod images.';
    }
}

// Initial fetch and display
fetchAndDisplayPodImages();