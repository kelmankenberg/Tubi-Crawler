const { ipcRenderer } = require('electron');

const crawlBtn = document.getElementById('crawl');
const urlInput = document.getElementById('url');
const log = document.getElementById('log');
const outputUrls = document.getElementById('outputUrls'); // Get reference to the new textarea

crawlBtn.addEventListener('click', async () => {
  const url = urlInput.value;
  if (!url) {
    log.textContent = 'Please enter a URL.';
    return;
  }
  log.textContent = `Crawling ${url}...
`;
  // outputUrls.value = ''; // Clear previous output - REMOVED as per user request
  try {
    const urls = await ipcRenderer.invoke('crawl', url);
    if (outputUrls.value) {
      outputUrls.value += ' '; // Add a space if there's existing content
    }
    outputUrls.value += urls.join(' '); // Append new URLs, space-separated
    log.textContent += 'Crawling complete. URLs appended to the text control.';
    // ipcRenderer.send('close-browser');
  } catch (error) {
    log.textContent += `Error: ${error.message}\n`;
    // ipcRenderer.send('close-browser');
  }
});

ipcRenderer.on('log', (event, message) => {
  if (message.startsWith('Crawling')) {
    log.textContent = `${message}\n`;
  } else {
    log.textContent += `${message}\n`;
  }
});

