const { ipcRenderer } = require('electron');

const crawlBtn = document.getElementById('crawl');
const urlInput = document.getElementById('url');
const log = document.getElementById('log');
const outputUrls = document.getElementById('outputUrls');

// Get references to the new toolbar buttons
const saveAsBtn = document.getElementById('saveAsBtn');
const copyBtn = document.getElementById('copyBtn');
const pasteBtn = document.getElementById('pasteBtn');
const deleteBtn = document.getElementById('deleteBtn');

// Get references to the window control buttons
const minimizeBtn = document.getElementById('minimizeBtn');
const maximizeRestoreBtn = document.getElementById('maximizeRestoreBtn');
const closeBtn = document.getElementById('closeBtn');

// SVG for Maximize icon (arrows pointing out)
const maximizeIcon = `
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9m5.25 11.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
  </svg>
`;

// SVG for Restore icon (arrows pointing in)
const restoreIcon = `
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15L3.75 20.25M15 9V4.5M15 9H19.5M15 9L20.25 3.75M15 15v4.5M15 15H19.5M15 15L20.25 20.25" />
  </svg>
`;

// Function to update maximize/restore icon
function updateMaximizeRestoreIcon(isMaximized) {
  maximizeRestoreBtn.innerHTML = isMaximized ? restoreIcon : maximizeIcon;
  maximizeRestoreBtn.title = isMaximized ? 'Restore' : 'Maximize';
}

// Initial icon state (assuming window is not maximized on start)
updateMaximizeRestoreIcon(false);

// Listen for window maximize/unmaximize events (from main process)
ipcRenderer.on('window-maximized', () => updateMaximizeRestoreIcon(true));
ipcRenderer.on('window-unmaximized', () => updateMaximizeRestoreIcon(false));


crawlBtn.addEventListener('click', async () => {
  const url = urlInput.value;
  if (!url) {
    log.textContent = 'Please enter a URL.';
    return;
  }
  log.textContent = `Crawling ${url}...
`;
  try {
    const urls = await ipcRenderer.invoke('crawl', url);
    if (outputUrls.value) {
      outputUrls.value += ' '; // Add a space if there's existing content
    }
    outputUrls.value += urls.join(' '); // Append new URLs, space-separated
    log.textContent += 'Crawling complete. URLs appended to the text control.';
  } catch (error) {
    log.textContent += `Error: ${error.message}\n`;
  }
});

// Toolbar button event listeners
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(outputUrls.value);
    log.textContent = 'Content copied to clipboard!';
  } catch (err) {
    log.textContent = 'Failed to copy content.';
    console.error('Failed to copy: ', err);
  }
});

pasteBtn.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    const start = outputUrls.selectionStart;
    const end = outputUrls.selectionEnd;
    outputUrls.value = outputUrls.value.substring(0, start) + text + outputUrls.value.substring(end);
    outputUrls.selectionStart = outputUrls.selectionEnd = start + text.length;
    log.textContent = 'Content pasted from clipboard!';
  } catch (err) {
    log.textContent = 'Failed to paste content.';
    console.error('Failed to paste: ', err);
  }
});

deleteBtn.addEventListener('click', () => {
  outputUrls.value = '';
  log.textContent = 'Content cleared.';
});

saveAsBtn.addEventListener('click', async () => {
  const content = outputUrls.value;
  if (!content) {
    log.textContent = 'No content to save.';
    return;
  }
  log.textContent = 'Saving content...';
  try {
    const result = await ipcRenderer.invoke('save-file', content);
    if (result.filePath) {
      log.textContent = `Content saved to: ${result.filePath}`;
    } else {
      log.textContent = 'Save operation cancelled or failed.';
    }
  } catch (error) {
    log.textContent = `Error saving file: ${error.message}`;
    console.error('Error saving file:', error);
  }
});

// Window control button event listeners
minimizeBtn.addEventListener('click', () => {
  ipcRenderer.invoke('minimize-window');
});

maximizeRestoreBtn.addEventListener('click', () => {
  ipcRenderer.invoke('maximize-restore-window');
});

closeBtn.addEventListener('click', () => {
  ipcRenderer.invoke('close-window');
});

// More button event listener
const moreBtn = document.getElementById('moreBtn');
moreBtn.addEventListener('click', () => {
  console.log('More button clicked!');
  log.textContent = 'More button clicked! (Menu functionality to be added)';
});

ipcRenderer.on('log', (event, message) => {
  if (message.startsWith('Crawling')) {
    log.textContent = `${message}\n`;
  } else {
    log.textContent += `${message}\n`;
  }
});

