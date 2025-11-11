const { ipcRenderer } = require('electron');

const crawlBtn = document.getElementById('crawl');
const urlInput = document.getElementById('url');
const log = document.getElementById('log');
const outputUrls = document.getElementById('outputUrls');

// Get references to the new toolbar buttons
const openBtn = document.getElementById('openBtn');
const saveAsBtn = document.getElementById('saveAsBtn');
const copyBtn = document.getElementById('copyBtn');
const pasteBtn = document.getElementById('pasteBtn');
const deleteBtn = document.getElementById('deleteBtn');

// Get references to the window control buttons
const minimizeBtn = document.getElementById('minimizeBtn');
const maximizeRestoreBtn = document.getElementById('maximizeRestoreBtn');
const closeBtn = document.getElementById('closeBtn');

// Get references to More menu elements
const moreBtn = document.getElementById('moreBtn');
const moreMenu = document.getElementById('moreMenu');
const lightThemeBtn = document.getElementById('lightThemeBtn');
const darkThemeBtn = document.getElementById('darkThemeBtn');
const systemThemeBtn = document.getElementById('systemThemeBtn');
const restartBtn = document.getElementById('restartBtn');
const devToolsBtn = document.getElementById('devToolsBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeModalBtn = settingsModal.querySelector('.close-button');

// Get references to YT-DLP settings elements
const downloadPathInput = document.getElementById('download-path');
const browseDownloadPathBtn = document.getElementById('browse-download-path');
const formatStringInput = document.getElementById('format-string');
const mergeOutputFormatSelect = document.getElementById('merge-output-format');

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

// Function to update theme buttons
function updateThemeButtons(activeBtn) {
  [lightThemeBtn, darkThemeBtn, systemThemeBtn].forEach(btn => {
    btn.classList.remove('active');
  });
  activeBtn.classList.add('active');
}

// Initial icon state (assuming window is not maximized on start)
updateMaximizeRestoreIcon(false);

// Listen for window maximize/unmaximize events (from main process)
ipcRenderer.on('window-maximized', () => updateMaximizeRestoreIcon(true));
ipcRenderer.on('window-unmaximized', () => updateMaximizeRestoreIcon(false));

// Load content from localStorage on startup
if (localStorage.getItem('savedContent')) {
  outputUrls.value = localStorage.getItem('savedContent');
}

// Save content to localStorage whenever it changes
outputUrls.addEventListener('input', () => {
  if (outputUrls.value) {
    localStorage.setItem('savedContent', outputUrls.value);
  } else {
    localStorage.removeItem('savedContent');
  }
});

urlInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    crawlBtn.click();
  }
});

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
    // if (outputUrls.value && !outputUrls.value.endsWith(' ')) {
    //   outputUrls.value += ' '; // Add a space if there's existing content and it doesn't end with a space
    // }
    outputUrls.value += urls.join(' '); // Append new URLs, space-separated
    log.textContent += 'Crawling complete. URLs appended to the text control.';
  } catch (error) {
    log.textContent = `Error: ${error.message}\n`;
  }
});

// Toolbar button event listeners
openBtn.addEventListener('click', async () => {
  const content = await ipcRenderer.invoke('open-file');
  if (content !== null) {
    outputUrls.value = content;
    localStorage.setItem('savedContent', content);
    log.textContent = 'File opened successfully.';
  }
});

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
  localStorage.removeItem('savedContent');
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

// More menu event listeners
moreBtn.addEventListener('click', () => {
  moreMenu.classList.toggle('show');
});

restartBtn.addEventListener('click', () => {
  ipcRenderer.send('restart-app');
});

devToolsBtn.addEventListener('click', () => {
  ipcRenderer.send('open-dev-tools');
});

settingsBtn.addEventListener('click', () => {
  settingsModal.classList.add('show');
  moreMenu.classList.remove('show'); // Close the more menu when settings opens
});

closeModalBtn.addEventListener('click', () => {
  settingsModal.classList.remove('show');
});

window.addEventListener('click', (event) => {
  if (event.target === settingsModal) {
    settingsModal.classList.remove('show');
  }
});

// YT-DLP settings event listeners
browseDownloadPathBtn.addEventListener('click', async () => {
  const result = await ipcRenderer.invoke('open-directory-dialog');
  if (result && !result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];
    downloadPathInput.value = selectedPath;
    localStorage.setItem('yt-dlp-download-path', selectedPath);
  }
});

// Load saved download path on startup
if (localStorage.getItem('yt-dlp-download-path')) {
  downloadPathInput.value = localStorage.getItem('yt-dlp-download-path');
}

// Save format string to localStorage whenever it changes
formatStringInput.addEventListener('input', () => {
  localStorage.setItem('yt-dlp-format-string', formatStringInput.value);
});

// Load saved format string on startup, or set default
if (localStorage.getItem('yt-dlp-format-string')) {
  formatStringInput.value = localStorage.getItem('yt-dlp-format-string');
} else {
  // Set default value if not found in localStorage
  formatStringInput.value = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best";
}

// Save merge output format to localStorage whenever it changes
mergeOutputFormatSelect.addEventListener('change', () => {
  localStorage.setItem('yt-dlp-merge-output-format', mergeOutputFormatSelect.value);
});

// Load saved merge output format on startup, or set default
if (localStorage.getItem('yt-dlp-merge-output-format')) {
  mergeOutputFormatSelect.value = localStorage.getItem('yt-dlp-merge-output-format');
} else {
  // Set default value if not found in localStorage
  mergeOutputFormatSelect.value = "mp4";
}

lightThemeBtn.addEventListener('click', () => {
  document.body.setAttribute('data-theme', 'light');
  updateThemeButtons(lightThemeBtn);
  moreMenu.classList.remove('show');
});

darkThemeBtn.addEventListener('click', () => {
  document.body.setAttribute('data-theme', 'dark');
  updateThemeButtons(darkThemeBtn);
  moreMenu.classList.remove('show');
});

systemThemeBtn.addEventListener('click', () => {
  ipcRenderer.send('get-system-theme');
  updateThemeButtons(systemThemeBtn);
  moreMenu.classList.remove('show');
});

// Set initial theme
ipcRenderer.on('system-theme', (event, theme) => {
  document.body.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    updateThemeButtons(darkThemeBtn);
  } else {
    updateThemeButtons(lightThemeBtn);
  }
});
ipcRenderer.send('get-system-theme');

ipcRenderer.on('log', (event, message) => {
  if (message.startsWith('Crawling')) {
    log.textContent = `${message}\n`;
  } else {
    log.textContent += `${message}\n`;
  }
});

// Settings modal navigation
const navItems = document.querySelectorAll('.settings-nav .nav-item');
const settingsSections = document.querySelectorAll('.settings-content .settings-section');

navItems.forEach(item => {
  item.addEventListener('click', () => {
    // Remove active class from all nav items and sections
    navItems.forEach(nav => nav.classList.remove('active'));
    settingsSections.forEach(section => section.classList.remove('active'));

    // Add active class to the clicked nav item
    item.classList.add('active');

    // Show the corresponding settings section
    const targetSectionId = item.dataset.section + '-settings';
    document.getElementById(targetSectionId).classList.add('active');
  });
});


