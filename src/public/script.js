import { formatDate, isDatePassed, getTimeDifferenceMessage } from './utility.js';

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
        table += '<th>Newest image available</th>';
        table += '<th>EOL of used version</th>';
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

            table += `<tr>
                        <td>${item.containerName}</td>
                        <td>${item.imageRepository}</td>
                        <td class="${versionCellClass}">${item.imageVersionUsedInCluster}</td>
                        <td>${item.newestImageAvailable}</td>
                        <td class="${eolDateClass}">${formattedEolDate} ${timeDiffMessage}</td>
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

document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const updateTheme = () => {
        document.body.classList.toggle('dark-mode', themeToggle.checked);
        localStorage.setItem('theme', themeToggle.checked ? 'dark' : 'light');
    };

    themeToggle.checked = localStorage.getItem('theme') === 'dark';
    updateTheme();
    themeToggle.addEventListener('change', updateTheme);
});

document.addEventListener('DOMContentLoaded', () => {
    var modal = document.getElementById("missingAppsModal");
    var btn = document.getElementById("missingAppsBtn");
    var span = document.getElementsByClassName("close")[0];
  
    btn.onclick = function() {
        modal.style.display = "block";
        fetch('/api/missing-apps')
            .then(response => response.json())
            .then(data => {
                const missingAppsList = document.getElementById('missingAppsList');
                missingAppsList.innerHTML = '';
                if (data.missingApps && data.missingApps.length > 0) {
                    data.missingApps.forEach((app, index) => {
                        let li = document.createElement('li');
                        li.textContent = app;
                        missingAppsList.appendChild(li);
                    });
                } else {
                    let li = document.createElement('li');
                    li.textContent = 'All applications listed in configmap were found - nothing to display ';
                    missingAppsList.appendChild(li);
                }
            })
            .catch(error => {
                console.error('Error loading missing apps:', error);
                document.getElementById('missingAppsList').innerHTML = '<li>Error loading data.</li>';
            });
    }
  
    span.onclick = function() {
        modal.style.display = "none";
    }
  
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
});

document.addEventListener('DOMContentLoaded', function () {
    fetch('/api/missing-apps')
      .then(response => response.json())
      .then(data => {
        const failIcon = document.querySelector('.software-container .fail');
        const passIcon = document.querySelector('.software-container .pass');
        const alertBox = document.getElementById('alertBox');
        if (data.missingApps && data.missingApps.length > 0) {
          failIcon.style.display = 'block';
          passIcon.style.display = 'none';
          alertBox.style.display = 'block';
        } else {
          failIcon.style.display = 'none';
          passIcon.style.display = 'block';
          alertBox.style.display = 'none';
        }
      })
      .catch(error => {
        console.error('Error loading application status:', error);
        const failIcon = document.querySelector('.software-container .fail');
        const passIcon = document.querySelector('.software-container .pass');
        failIcon.style.display = 'none';
        passIcon.style.display = 'block';
        document.getElementById('alertBox').style.display = 'none';
      });
  });

// Initial fetch and display
fetchAndDisplayPodImages();