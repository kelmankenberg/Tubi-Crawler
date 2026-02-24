// Using preload script to access electron APIs via context bridge

// Function to update maximize/restore icon
function updateMaximizeRestoreIcon(isMaximized) {
  const maximizeRestoreBtn = document.getElementById('maximizeRestoreBtn');
  const maximizeIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4">
      <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9m5.25 11.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
    </svg>
  `;
  const restoreIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15L3.75 20.25M15 9V4.5M15 9H19.5M15 9L20.25 3.75M15 15v4.5M15 15H19.5M15 15L20.25 20.25" />
    </svg>
  `;
  maximizeRestoreBtn.innerHTML = isMaximized ? restoreIcon : maximizeIcon;
  maximizeRestoreBtn.title = isMaximized ? 'Restore' : 'Maximize';
}

// Function to update theme buttons
function updateThemeButtons(activeBtn) {
  const lightThemeBtn = document.getElementById('lightThemeBtn');
  const darkThemeBtn = document.getElementById('darkThemeBtn');
  const systemThemeBtn = document.getElementById('systemThemeBtn');

  [lightThemeBtn, darkThemeBtn, systemThemeBtn].forEach(btn => {
    if (btn) btn.classList.remove('active');
  });
  if (activeBtn) activeBtn.classList.add('active');
}

// Function to show toast notifications
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = document.createElement('div');
  icon.className = 'toast-icon';
  
  const messageEl = document.createElement('div');
  messageEl.className = 'toast-message';
  messageEl.textContent = message;
  
  toast.appendChild(icon);
  toast.appendChild(messageEl);
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

window.addEventListener('DOMContentLoaded', () => {
  const crawlBtn = document.getElementById('crawl');
  const urlInput = document.getElementById('url');
  const log = document.getElementById('log');
  const outputUrls = document.getElementById('outputUrls');

  // Load and display app version
  window.electron.invoke('get-app-version').then((version) => {
    const versionLabel = document.getElementById('versionLabel');
    if (versionLabel) {
      versionLabel.textContent = `v${version}`;
    }
  }).catch((error) => {
    console.error('Failed to load app version:', error);
  });

  // Get references to the new toolbar buttons
  const openBtn = document.getElementById('openBtn');
  const saveAsBtn = document.getElementById('saveAsBtn');
  const copyBtn = document.getElementById('copyBtn');
  const pasteBtn = document.getElementById('pasteBtn');
  const deleteBtn = document.getElementById('deleteBtn');

  // Get references to stats elements
  const urlCountEl = document.getElementById('urlCount');
  const lastCrawlTimeEl = document.getElementById('lastCrawlTime');
  let lastCrawlStartTime = null;

  // Get references to URL validation elements
  const urlValidation = document.getElementById('urlValidation');
  const validationIcon = document.getElementById('validationIcon');
  const validationText = document.getElementById('validationText');

  // Function to validate Tubi URL
  function validateUrl(url) {
    if (!url || url.trim() === '') {
      urlValidation.style.display = 'none';
      return false;
    }

    // Check if it's a valid Tubi URL format
    const tubiPatterns = [
      /tubitv\.com\/series/i,
      /tubitv\.com\/\d+\/series/i
    ];

    const isValid = tubiPatterns.some(pattern => pattern.test(url));
    
    urlValidation.style.display = 'flex';
    if (isValid) {
      urlValidation.className = 'url-validation valid';
      validationIcon.textContent = '✓';
      validationText.textContent = 'Valid Tubi URL';
    } else {
      urlValidation.className = 'url-validation invalid';
      validationIcon.textContent = '✗';
      validationText.textContent = 'Invalid format';
    }

    return isValid;
  }

  // Function to update stats display
  function updateStats() {
    const urlText = outputUrls.value.trim();
    const urlCount = urlText ? urlText.split(/\s+/).length : 0;
    if (urlCountEl) {
      urlCountEl.textContent = urlCount;
    }
  }

  // Function to update crawl time display
  function updateCrawlTime() {
    if (lastCrawlStartTime && lastCrawlTimeEl) {
      const elapsedMs = Date.now() - lastCrawlStartTime;
      const seconds = Math.floor(elapsedMs / 1000);
      const minutes = Math.floor(seconds / 60);
      if (minutes > 0) {
        lastCrawlTimeEl.textContent = `${minutes}m ${seconds % 60}s`;
      } else {
        lastCrawlTimeEl.textContent = `${seconds}s`;
      }
    }
  }

  // Get references to the window control buttons
  const minimizeBtn = document.getElementById('minimizeBtn');
  const maximizeRestoreBtn = document.getElementById('maximizeRestoreBtn');
  const closeBtn = document.getElementById('closeBtn');

  // Get references to More menu elements
  const moreBtn = document.getElementById('moreBtn');
  const moreMenu = document.getElementById('moreMenu');
  const openBrowserBtn = document.getElementById('openBrowserBtn');

  // Get references to YT-DLP menu elements
  const ytDlpBtn = document.getElementById('ytDlpBtn');
  const ytDlpMenu = document.getElementById('ytDlpMenu');
  const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
  const downloadAllBtn = document.getElementById('downloadAllBtn');
  const restartBtn = document.getElementById('restartBtn');
  const devToolsBtn = document.getElementById('devToolsBtn');

  // Get references to quick action buttons
  const clipboardBtn = document.getElementById('clipboardBtn');
  const clearCrawlBtn = document.getElementById('clearCrawlBtn');
  const recentUrlsBtn = document.getElementById('recentUrlsBtn');
  const recentUrlsMenu = document.getElementById('recentUrlsMenu');
  const recentUrlsList = document.getElementById('recentUrlsList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  // Recent URLs management
  const MAX_RECENT_URLS = 10;
  
  function loadRecentUrls() {
    const recent = localStorage.getItem('recentUrls');
    return recent ? JSON.parse(recent) : [];
  }

  function saveRecentUrls(urls) {
    localStorage.setItem('recentUrls', JSON.stringify(urls.slice(0, MAX_RECENT_URLS)));
    updateRecentUrlsList();
  }

  function addRecentUrl(url) {
    if (!url || url.trim() === '') return;
    const recent = loadRecentUrls();
    const cleaned = url.trim();
    const filtered = recent.filter(u => u !== cleaned);
    filtered.unshift(cleaned);
    saveRecentUrls(filtered);
  }

  function updateRecentUrlsList() {
    const recent = loadRecentUrls();
    recentUrlsList.innerHTML = '';
    
    if (recent.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = 'padding: 12px; font-size: 12px; color: var(--text-secondary); text-align: center;';
      emptyMsg.textContent = 'No recent URLs';
      recentUrlsList.appendChild(emptyMsg);
      return;
    }

    recent.forEach((url, index) => {
      const item = document.createElement('button');
      item.className = 'recent-url-item';
      const displayUrl = url.length > 50 ? url.substring(0, 47) + '...' : url;
      item.innerHTML = `<span class="recent-url-item-text">${displayUrl}</span>`;
      
      item.addEventListener('click', () => {
        urlInput.value = url;
        validateUrl(url);
        recentUrlsMenu.classList.remove('show');
        crawlBtn.click();
      });

      recentUrlsList.appendChild(item);
    });
  }

  // Initialize recent URLs display
  updateRecentUrlsList();

  // Statistics management
  const STATS_KEY = 'crawlerStats';
  
  function getStats() {
    const stored = localStorage.getItem(STATS_KEY);
    if (!stored) {
      return {
        totalUrls: 0,
        uniqueUrls: 0,
        totalCrawlTime: 0,
        seriesCrawled: 0
      };
    }
    return JSON.parse(stored);
  }

  function saveStats(stats) {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }

  function updateStatisticsPanelDisplay() {
    const stats = getStats();
    document.getElementById('totalUrlsStat').textContent = stats.totalUrls;
    document.getElementById('uniqueUrlsStat').textContent = stats.uniqueUrls;
    document.getElementById('totalCrawlTimeStat').textContent = stats.totalCrawlTime + 's';
    document.getElementById('seriesCrawledStat').textContent = stats.seriesCrawled;
  }

  async function executeYtDlpCommand(urlsToDownload) {
    const downloadPath = downloadPathInput.value;
    const formatString = formatStringInput.value;
    const mergeOutputFormat = mergeOutputFormatSelect.value;

    if (!downloadPath) {
      clearLog();
      appendLog('Please set a download location in settings.', 'warning');
      return;
    }

    clearLog();
    appendLog(`Initiating YT-DLP download for ${urlsToDownload.length} URLs...`, 'info');
    try {
      const result = await window.electron.invoke('run-yt-dlp', {
        urls: urlsToDownload,
        downloadPath: downloadPath,
        format: formatString,
        mergeFormat: mergeOutputFormat
      });
      if (result.success) {
        appendLog(`YT-DLP command executed successfully. Check external terminal.`, 'success');
      } else {
        appendLog(`Error executing YT-DLP command: ${result.error}`, 'error');
      }
    } catch (error) {
      appendLog(`Error invoking YT-DLP: ${error.message}`, 'error');
    }
  }

  // YT-DLP menu item event listeners
  downloadSelectedBtn.addEventListener('click', () => {
    const selectedUrls = outputUrls.value.substring(outputUrls.selectionStart, outputUrls.selectionEnd).trim();
    if (selectedUrls) {
      executeYtDlpCommand(selectedUrls.split(/\s+/));
    } else {
      clearLog();
      appendLog('No URLs selected for download.', 'warning');
    }
    ytDlpMenu.classList.remove('show');
  });

  downloadAllBtn.addEventListener('click', () => {
    const allUrls = outputUrls.value.trim();
    if (allUrls) {
      executeYtDlpCommand(allUrls.split(/\s+/));
    }
    else {
      clearLog();
      appendLog('No URLs to download.', 'warning');
    }
    ytDlpMenu.classList.remove('show');
  });
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPage = document.getElementById('settingsPage');
  const mainContent = document.getElementById('mainContent');
  const backFromSettingsBtn = document.getElementById('backFromSettingsBtn');

  function openSettings() {
    settingsPage.style.display = 'flex';
    mainContent.style.display = 'none';
    moreMenu.classList.remove('show');
  }

  function closeSettings() {
    settingsPage.style.display = 'none';
    mainContent.style.display = 'flex';
  }

  backFromSettingsBtn.addEventListener('click', closeSettings);

  // Keyboard shortcut: Ctrl+, to open settings
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === ',') {
      e.preventDefault();
      if (settingsPage.style.display === 'none' || settingsPage.style.display === '') {
        openSettings();
      }
    }
    // Escape key to close settings
    if (e.key === 'Escape' && settingsPage.style.display === 'flex') {
      closeSettings();
    }
  });

  // Get references to YT-DLP settings elements
  const downloadPathInput = document.getElementById('download-path');
  const browseDownloadPathBtn = document.getElementById('browse-download-path');
  const formatStringInput = document.getElementById('format-string');
  const mergeOutputFormatSelect = document.getElementById('merge-output-format');
  const preferredBrowserSelect = document.getElementById('preferred-browser');

  // Initial icon state (assuming window is not maximized on start)
  updateMaximizeRestoreIcon(false);

  // Listen for window maximize/unmaximize events (from main process)
  window.electron.on('window-maximized', () => updateMaximizeRestoreIcon(true));
  window.electron.on('window-unmaximized', () => updateMaximizeRestoreIcon(false));

  // Load content from localStorage on startup
  if (localStorage.getItem('savedContent')) {
    outputUrls.value = localStorage.getItem('savedContent');
    updateStats();
  }

  // Save content to localStorage whenever it changes
  outputUrls.addEventListener('input', () => {
    if (outputUrls.value) {
      localStorage.setItem('savedContent', outputUrls.value);
    } else {
      localStorage.removeItem('savedContent');
    }
    updateStats();
  });

  urlInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      crawlBtn.click();
    }
  });

  // Add URL validation on input
  urlInput.addEventListener('input', (event) => {
    validateUrl(event.target.value);
  });

  // Select all text when the URL input receives focus; prevent mouseup
  // from clearing that selection immediately after clicking.
  if (urlInput) {
    urlInput.addEventListener('focus', () => {
      urlInput.select();
    });
    urlInput.addEventListener('mouseup', (e) => {
      e.preventDefault();
    });
  }

  crawlBtn.addEventListener('click', async () => {
    const url = urlInput.value;
    if (!url) {
      clearLog();
      appendLog('Please enter a URL.', 'warning');
      return;
    }
    
    // Add to recent URLs
    addRecentUrl(url);
    
    // Set loading state and track time
    crawlBtn.classList.add('loading');
    crawlBtn.disabled = true;
    lastCrawlStartTime = Date.now();
    clearLog();
    appendLog(`Crawling ${url}...`, 'info');
    
    try {
      const urls = await window.electron.invoke('crawl', url);
      outputUrls.value += urls.join(' ');
      appendLog('Crawling complete. URLs appended to the text control.', 'success');
      
      // Update statistics
      const crawlTime = Math.round((Date.now() - lastCrawlStartTime) / 1000);
      const stats = getStats();
      stats.totalUrls += urls.length;
      stats.uniqueUrls = new Set(outputUrls.value.trim().split(/\s+/).filter(u => u.length > 0)).size;
      stats.totalCrawlTime += crawlTime;
      stats.seriesCrawled += 1;
      saveStats(stats);
      
      updateStats();
      updateCrawlTime();
    } catch (error) {
      appendLog(`Error: ${error.message}`, 'error');
    } finally {
      // Clear loading state
      crawlBtn.classList.remove('loading');
      crawlBtn.disabled = false;
    }
  });

  // Quick action button handlers
  clipboardBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      urlInput.value = text.trim();
      validateUrl(urlInput.value);
      showToast('📋 URL pasted from clipboard', 'info');
      // Auto-crawl after a short delay
      setTimeout(() => crawlBtn.click(), 200);
    } catch (err) {
      appendLog('Failed to read clipboard', 'error');
      showToast('Failed to read clipboard', 'error');
    }
  });

  clearCrawlBtn.addEventListener('click', () => {
    outputUrls.value = '';
    localStorage.removeItem('savedContent');
    updateStats();
    showToast('✓ Cleared, ready to crawl', 'info');
    crawlBtn.click();
  });

  // Recent URLs menu handlers
  recentUrlsBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    recentUrlsMenu.classList.toggle('show');
    moreMenu.classList.remove('show');
    ytDlpMenu.classList.remove('show');
  });

  clearHistoryBtn.addEventListener('click', () => {
    localStorage.removeItem('recentUrls');
    updateRecentUrlsList();
    showToast('✓ History cleared', 'info');
    recentUrlsMenu.classList.remove('show');
  });

  // Helper function to add log lines with status indicators
  function addStatusLog(message, status = 'info') {
    const statusEmojis = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ'
    };
    
    const emoji = statusEmojis[status] || statusEmojis.info;
    const timestamp = new Date().toLocaleTimeString();
    
    if (message.startsWith('Crawling')) {
      log.innerHTML = '';
    }
    
    const logLine = document.createElement('div');
    logLine.className = `log-line log-${status}`;
    logLine.innerHTML = `<span class="log-icon">${emoji}</span><span class="log-timestamp">[${timestamp}]</span><span class="log-text">${message}</span>`;
    log.appendChild(logLine);
  }

  // Helper function to clear log
  function clearLog() {
    log.innerHTML = '';
  }

  // Helper function to append simple log message (for backwards compatibility)
  function appendLog(message, status = 'info') {
    const statusEmojis = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ'
    };
    
    const emoji = statusEmojis[status] || statusEmojis.info;
    const timestamp = new Date().toLocaleTimeString();
    
    const logLine = document.createElement('div');
    logLine.className = `log-line log-${status}`;
    logLine.innerHTML = `<span class="log-icon">${emoji}</span><span class="log-timestamp">[${timestamp}]</span><span class="log-text">${message}</span>`;
    log.appendChild(logLine);
  }

  // Toolbar button event listeners
  openBtn.addEventListener('click', async () => {
    const content = await window.electron.invoke('open-file');
    if (content !== null) {
      outputUrls.value = content;
      localStorage.setItem('savedContent', content);
      addStatusLog('File opened successfully.', 'success');
      showToast('✓ File opened', 'success');
      updateStats();
    }
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(outputUrls.value);
      addStatusLog('Content copied to clipboard!', 'success');
      showToast('✓ Copied to clipboard', 'success');
    } catch (err) {
      addStatusLog('Failed to copy content.', 'error');
      showToast('Failed to copy to clipboard', 'error');
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
      addStatusLog('Content pasted from clipboard!', 'success');
      showToast('✓ Pasted from clipboard', 'success');
      updateStats();
    } catch (err) {
      addStatusLog('Failed to paste content.', 'error');
      showToast('Failed to paste from clipboard', 'error');
      console.error('Failed to paste: ', err);
    }
  });

  deleteBtn.addEventListener('click', () => {
    outputUrls.value = '';
    localStorage.removeItem('savedContent');
    addStatusLog('Content cleared.', 'success');
    showToast('✓ Content cleared', 'success');
    updateStats();
  });

  saveAsBtn.addEventListener('click', async () => {
    const content = outputUrls.value;
    if (!content) {
      addStatusLog('No content to save.', 'warning');
      showToast('No content to save', 'warning');
      return;
    }
    addStatusLog('Saving content...', 'info');
    try {
      const result = await window.electron.invoke('save-file', content);
      if (result.filePath) {
        addStatusLog(`Content saved to: ${result.filePath}`, 'success');
        showToast('✓ File saved successfully', 'success');
      } else {
        addStatusLog('Save operation cancelled or failed.', 'warning');
        showToast('Save operation cancelled', 'warning');
      }
    } catch (error) {
      addStatusLog(`Error saving file: ${error.message}`, 'error');
      showToast('Failed to save file', 'error');
      console.error('Error saving file:', error);
    }
  });

  // Window control button event listeners
  minimizeBtn.addEventListener('click', () => {
    window.electron.invoke('minimize-window');
  });

  maximizeRestoreBtn.addEventListener('click', () => {
    window.electron.invoke('maximize-restore-window');
  });

  closeBtn.addEventListener('click', () => {
    window.electron.invoke('close-window');
  });

  // More menu button event listeners
  restartBtn.addEventListener('click', () => {
    window.electron.invoke('restart-app');
    moreMenu.classList.remove('show');
  });

  devToolsBtn.addEventListener('click', () => {
    window.electron.invoke('toggle-dev-tools');
    moreMenu.classList.remove('show');
  });

  openBrowserBtn.addEventListener('click', async () => {
    console.log('Open Browser button clicked.'); // Diagnostic log
    const url = 'https://www.tubitv.com/'; // Hardcoded canonical URL for this button
    // No need for a check if (!url) as it's hardcoded

    const preferredBrowser = localStorage.getItem('preferred-browser') || 'external';
    console.log('Preferred Browser setting:', preferredBrowser); // Diagnostic log

    const currentTheme = document.body.getAttribute('data-theme') || 'light';
    if (preferredBrowser === 'external') {
      window.electron.invoke('open-external-browser', url);
      clearLog();
      appendLog(`Opening ${url} in external browser.`, 'info');
    } else {
      window.electron.invoke('open-internal-browser', { theme: currentTheme });
      clearLog();
      appendLog(`Opening ${url} in internal browser.`, 'info');
    }
  });

  // More menu event listeners
  moreBtn.addEventListener('click', (event) => {
    event.stopPropagation(); // Prevent immediate closing by global listener
    moreMenu.classList.toggle('show');
    ytDlpMenu.classList.remove('show'); // Close YT-DLP menu if open
  });

  // YT-DLP menu event listeners
  ytDlpBtn.addEventListener('click', (event) => {
    event.stopPropagation(); // Prevent immediate closing by global listener
    ytDlpMenu.classList.toggle('show');
    moreMenu.classList.remove('show'); // Close More menu if open
  });

  // Close menus if click is outside
  window.addEventListener('click', (event) => {
    if (event.target === settingsModal) {
      settingsModal.classList.remove('show');
    }
    if (!moreBtn.contains(event.target) && !moreMenu.contains(event.target)) {
      moreMenu.classList.remove('show');
    }
    if (!ytDlpBtn.contains(event.target) && !ytDlpMenu.contains(event.target)) {
      ytDlpMenu.classList.remove('show');
    }
  });

  // YT-DLP settings event listeners
  browseDownloadPathBtn.addEventListener('click', async () => {
    const result = await window.electron.invoke('open-directory-dialog');
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

  // Save preferred browser to localStorage whenever it changes
  preferredBrowserSelect.addEventListener('change', () => {
    localStorage.setItem('preferred-browser', preferredBrowserSelect.value);
  });

  // Load saved preferred browser on startup, or set default
  if (localStorage.getItem('preferred-browser')) {
    preferredBrowserSelect.value = localStorage.getItem('preferred-browser');
  } else {
    // Set default value if not found in localStorage
    preferredBrowserSelect.value = "external";
  }

  settingsBtn.addEventListener('click', openSettings);

  // Changelog panel handlers
  const changelogBtn = document.getElementById('changelogBtn');
  const changelogPanel = document.getElementById('changelogPanel');
  const closeChangelogBtn = document.getElementById('closeChangelogBtn');
  const changelogContent = document.getElementById('changelogContent');

  async function loadChangelog() {
    try {
      const response = await fetch('../CHANGELOG.md');
      const markdown = await response.text();
      const html = markdownToHtml(markdown);
      changelogContent.innerHTML = html;
      attachCollapseListeners();
    } catch (error) {
      changelogContent.innerHTML = '<p>Error loading changelog. Please try again.</p>';
      console.error('Error loading changelog:', error);
    }
  }

  function attachCollapseListeners() {
    const collapsibleHeaders = document.querySelectorAll('.changelog-content .collapsible-header');
    
    collapsibleHeaders.forEach((header) => {
      header.addEventListener('click', () => {
        const section = header.closest('.changelog-section');
        const isOpen = section.classList.contains('open');
        
        if (isOpen) {
          section.classList.remove('open');
        } else {
          section.classList.add('open');
        }
      });
    });
  }

  function markdownToHtml(markdown) {
    // Split by main version headings (##)
    const versionBlocks = markdown.split(/(?=^## )/gm);
    let html = '<div class="changelog-container">';

    versionBlocks.forEach((block) => {
      if (!block.trim()) return;

      // Check if this is a version block (starts with ##)
      if (block.trim().startsWith('##')) {
        const lines = block.split('\n');
        const versionHeader = lines[0]; // e.g., "## v1.3.0 (Current)"
        const versionContent = lines.slice(1).join('\n');

        // Extract version for section ID
        const versionMatch = versionHeader.match(/##\s+(.*)/);
        const versionText = versionMatch ? versionMatch[1] : 'Version';
        const versionId = versionText.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        // Create collapsible version section
        html += `<div class="changelog-section">`;
        html += `<div class="collapsible-header" data-section="${versionId}">`;
        html += `<svg class="collapse-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">`;
        html += `<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />`;
        html += `</svg>`;
        html += `<h2>${versionText}</h2>`;
        html += `</div>`;
        html += `<div class="section-content">`;

        // Process subsections within this version
        const subsections = versionContent.split(/(?=^### )/gm);
        
        subsections.forEach((subsection) => {
          if (!subsection.trim()) return;

          if (subsection.trim().startsWith('###')) {
            const subLines = subsection.split('\n');
            const subHeader = subLines[0]; // e.g., "### 🔒 Security"
            const subContent = subLines.slice(1).join('\n');

            const subMatch = subHeader.match(/###\s+(.*)/);
            const subText = subMatch ? subMatch[1] : 'Section';

            html += `<div class="changelog-subsection">`;
            html += `<h3>${subText}</h3>`;
            html += `<div class="subsection-content">`;
            html += convertContentToHtml(subContent);
            html += `</div>`;
            html += `</div>`;
          } else {
            html += convertContentToHtml(subsection);
          }
        });

        html += `</div>`;
        html += `</div>`;
      } else {
        html += convertContentToHtml(block);
      }
    });

    html += '</div>';
    return html;
  }

  function convertContentToHtml(content) {
    let html = content
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Inline code
      .replace(/`(.*?)`/g, '<code style="background-color: var(--log-background); padding: 2px 4px; border-radius: 3px; font-size: 12px;">$1</code>')
      // Horizontal rule
      .replace(/^---$/gm, '<hr>')
      // Unordered lists - convert to proper ul/li
      .split('\n')
      .map((line) => {
        if (line.trim().startsWith('-')) {
          return '<li>' + line.replace(/^\s*-\s*/, '') + '</li>';
        }
        return line;
      })
      .join('\n');

    // Wrap consecutive li items in ul
    html = html.replace(/(<li>.*<\/li>)/s, (match) => {
      if (match.includes('<li>')) {
        return '<ul>' + match + '</ul>';
      }
      return match;
    });

    // Remove empty lines and wrap in paragraphs
    const lines = html.split('\n').filter((line) => line.trim());
    html = lines
      .map((line) => {
        if (line.trim().startsWith('<') || line.trim() === '') {
          return line;
        }
        return '<p>' + line + '</p>';
      })
      .join('\n');

    return html;
  }

  function openChangelog() {
    loadChangelog();
    changelogPanel.classList.add('show');
    document.body.classList.add('changelog-open');
    moreMenu.classList.remove('show');
  }

  function closeChangelog() {
    changelogPanel.classList.remove('show');
    document.body.classList.remove('changelog-open');
  }

  changelogBtn.addEventListener('click', openChangelog);
  closeChangelogBtn.addEventListener('click', closeChangelog);

  // Close changelog on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && changelogPanel.classList.contains('show')) {
      closeChangelog();
    }
  });

  // Close changelog when clicking outside
  changelogPanel.addEventListener('click', (e) => {
    if (e.target === changelogPanel) {
      closeChangelog();
    }
  });

  // Keyboard Shortcuts Panel handlers
  const keyboardShortcutsBtn = document.getElementById('keyboardShortcutsBtn');
  const shortcutsPanel = document.getElementById('keyboardShortcutsPanel');
  const closeShortcutsBtn = document.getElementById('closeShortcutsBtn');

  function openShortcuts() {
    shortcutsPanel.style.display = 'flex';
    moreMenu.classList.remove('show');
  }

  function closeShortcuts() {
    shortcutsPanel.style.display = 'none';
  }

  keyboardShortcutsBtn.addEventListener('click', openShortcuts);
  closeShortcutsBtn.addEventListener('click', closeShortcuts);

  // Close shortcuts on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && shortcutsPanel.style.display !== 'none') {
      closeShortcuts();
    }
  });

  // Close shortcuts when clicking outside
  shortcutsPanel.addEventListener('click', (e) => {
    if (e.target === shortcutsPanel) {
      closeShortcuts();
    }
  });

  // Help Panel handlers
  const helpBtn = document.getElementById('helpBtn');
  const helpPanel = document.getElementById('helpPanel');
  const closeHelpBtn = document.getElementById('closeHelpBtn');

  function openHelp() {
    helpPanel.style.display = 'flex';
    moreMenu.classList.remove('show');
  }

  function closeHelp() {
    helpPanel.style.display = 'none';
  }

  helpBtn.addEventListener('click', openHelp);
  closeHelpBtn.addEventListener('click', closeHelp);

  // Close help on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpPanel.style.display !== 'none') {
      closeHelp();
    }
  });

  // Close help when clicking outside
  helpPanel.addEventListener('click', (e) => {
    if (e.target === helpPanel) {
      closeHelp();
    }
  });

  // Statistics Panel handlers
  const statsBtn = document.getElementById('statsBtn');
  const statsPanel = document.getElementById('statsPanel');
  const closeStatsBtn = document.getElementById('closeStatsBtn');
  const resetStatsBtn = document.getElementById('resetStatsBtn');

  function openStats() {
    updateStatisticsPanelDisplay();
    statsPanel.style.display = 'flex';
    moreMenu.classList.remove('show');
  }

  function closeStats() {
    statsPanel.style.display = 'none';
  }

  statsBtn.addEventListener('click', openStats);
  closeStatsBtn.addEventListener('click', closeStats);

  resetStatsBtn.addEventListener('click', () => {
    saveStats({
      totalUrls: 0,
      uniqueUrls: 0,
      totalCrawlTime: 0,
      seriesCrawled: 0
    });
    updateStatisticsPanelDisplay();
    showToast('📊 Statistics reset', 'success');
  });

  // Close stats on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && statsPanel.style.display !== 'none') {
      closeStats();
    }
  });

  // Close stats when clicking outside
  statsPanel.addEventListener('click', (e) => {
    if (e.target === statsPanel) {
      closeStats();
    }
  });

  window.electron.on('log', (event, message) => {
    if (message.startsWith('Crawling')) {
      clearLog();
      appendLog(message, 'info');
    } else {
      appendLog(message, 'info');
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

  // Theme buttons and logic (now inside DOMContentLoaded)
  const lightThemeBtn = document.getElementById('lightThemeBtn');
  const darkThemeBtn = document.getElementById('darkThemeBtn');
  const systemThemeBtn = document.getElementById('systemThemeBtn');

  lightThemeBtn.addEventListener('click', () => {
    document.body.setAttribute('data-theme', 'light');
    updateThemeButtons(lightThemeBtn);
  });

  darkThemeBtn.addEventListener('click', () => {
    document.body.setAttribute('data-theme', 'dark');
    updateThemeButtons(darkThemeBtn);
  });

  systemThemeBtn.addEventListener('click', () => {
  window.electron.send('get-system-theme');
    updateThemeButtons(systemThemeBtn);
  });

  // Set initial theme
  window.electron.on('system-theme', (event, theme) => {
    document.body.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      updateThemeButtons(darkThemeBtn);
    } else {
      updateThemeButtons(lightThemeBtn);
    }
  });
  window.electron.send('get-system-theme');
});
