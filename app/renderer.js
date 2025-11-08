const { ipcRenderer } = require('electron');

const crawlBtn = document.getElementById('crawl');
const urlInput = document.getElementById('url');
const log = document.getElementById('log');

crawlBtn.addEventListener('click', () => {
  const url = urlInput.value;
  if (!url) {
    log.textContent = 'Please enter a URL.';
    return;
  }
  log.textContent = `Crawling ${url}...
`;
  ipcRenderer.send('crawl', url);
});

ipcRenderer.on('log', (event, message) => {
  if (message.startsWith('Crawling')) {
    log.textContent = `${message}\n`;
  } else {
    log.textContent += `${message}\n`;
  }
});

