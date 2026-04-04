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
  const toggleQuickActionsBtn = document.getElementById('toggleQuickActionsBtn');
  const quickActions = document.getElementById('quickActions');
  const urlInput = document.getElementById('url');
  const log = document.getElementById('log');
  const urlInputContextMenu = document.getElementById('urlInputContextMenu');
  
  // Initialize URL Table Manager (replaces outputUrls textarea)
  const urlTableManager = new UrlTableManager(urlInputContextMenu);

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

  // Function to update stats display (now handled by UrlTableManager)
  function updateStats() {
    // UrlTableManager handles this automatically
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

  // Helper functions to extract metadata from URLs
  function extractTitleFromUrl(url) {
    // Extract title from URL path
    const match = url.match(/\/(?:s\d+-e\d+|season-\d+|episode-\d+)-(.+?)(?:\?|$)/i);
    if (match) {
      return decodeURIComponent(match[1]).replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    // Fallback: use last part of URL
    const parts = url.split('/');
    return decodeURIComponent(parts[parts.length - 1]).replace(/-/g, ' ');
  }

  function extractSeriesFromUrl(url) {
    // Extract series ID or name from URL
    const match = url.match(/\/(?:tv-shows|series)\/(\d+)/i);
    if (match) {
      return `Series ${match[1]}`;
    }
    return 'Unknown Series';
  }

  function extractSeasonFromUrl(url) {
    // Extract season number from URL
    const match = url.match(/s(\d+)(?:-e|_|\s)/i);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  function extractEpisodeFromUrl(url) {
    // Extract episode number from URL if pattern contains sNN-eNN or -eNN
    const match = url.match(/(?:s\d+-e|-e|episode-)(\d+)/i);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null;
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
    console.log('executeYtDlpCommand called with URLs:', urlsToDownload);
    const ytDlpPath = ytDlpPathInput.value;
    const downloadPath = downloadPathInput.value;
    const formatString = formatStringInput.value;
    const mergeOutputFormat = mergeOutputFormatSelect.value;
    const videoQuality = videoQualitySelect.value;
    const audioFormat = audioFormatSelect.value;
    const embedSubs = embedSubsCheckbox.checked;
    const subLangs = subLangsInput.value;
    const embedThumbnail = embedThumbnailCheckbox.checked;
    const embedMetadata = embedMetadataCheckbox.checked;
    const playlistStart = playlistStartInput.value;
    const playlistEnd = playlistEndInput.value;
    const ffmpegPath = ffmpegPathInput.value;
    const keepTerminalOpen = keepTerminalOpenCheckbox.checked;

    console.log('YT-DLP path:', ytDlpPath);
    console.log('Download path:', downloadPath);
    console.log('FFmpeg path:', ffmpegPath);
    console.log('Keep terminal open:', keepTerminalOpen);

    if (!downloadPath) {
      clearLog();
      appendLog('Please set a download location in settings.', 'warning');
      return;
    }

    clearLog();
    appendLog(`Initiating YT-DLP download for ${urlsToDownload.length} URLs...`, 'info');
    try {
      console.log('Invoking run-yt-dlp IPC...');
      const result = await window.electron.invoke('run-yt-dlp', {
        urls: urlsToDownload,
        downloadPath: downloadPath,
        format: formatString,
        mergeFormat: mergeOutputFormat,
        videoQuality: videoQuality,
        audioFormat: audioFormat,
        embedSubs: embedSubs,
        subLangs: subLangs,
        embedThumbnail: embedThumbnail,
        embedMetadata: embedMetadata,
        playlistStart: playlistStart,
        playlistEnd: playlistEnd,
        ffmpegPath: ffmpegPath,
        ytDlpPath: ytDlpPath,
        keepTerminalOpen: keepTerminalOpen
      });
      console.log('run-yt-dlp result:', result);
      if (result.success) {
        appendLog(`YT-DLP command executed successfully. Check external terminal.`, 'success');
      } else {
        appendLog(`Error executing YT-DLP command: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error in executeYtDlpCommand:', error);
      appendLog(`Error invoking YT-DLP: ${error.message}`, 'error');
    }
  }

  // YT-DLP menu item event listeners
  downloadSelectedBtn.addEventListener('click', () => {
    console.log('Download Selected clicked');
    const selectedUrls = urlTableManager.getSelectedUrls();
    console.log('Selected URLs:', selectedUrls);
    if (selectedUrls.length > 0) {
      executeYtDlpCommand(selectedUrls);
    } else {
      clearLog();
      appendLog('No episodes selected for download. Click on episodes to select them.', 'warning');
    }
    ytDlpMenu.classList.remove('show');
  });

  downloadAllBtn.addEventListener('click', () => {
    console.log('Download All clicked');
    const allUrls = urlTableManager.getAllUrls();
    console.log('All URLs:', allUrls);
    if (allUrls.length > 0) {
      executeYtDlpCommand(allUrls);
    } else {
      clearLog();
      appendLog('No episodes to download.', 'warning');
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
  const ytDlpPathInput = document.getElementById('yt-dlp-path');
  const browseYtDlpPathBtn = document.getElementById('browse-yt-dlp-path');
  const downloadPathInput = document.getElementById('download-path');
  const browseDownloadPathBtn = document.getElementById('browse-download-path');
  const formatStringInput = document.getElementById('format-string');
  const mergeOutputFormatSelect = document.getElementById('merge-output-format');
  const preferredBrowserSelect = document.getElementById('preferred-browser');
  const keepTerminalOpenCheckbox = document.getElementById('keep-terminal-open');
  const videoQualitySelect = document.getElementById('video-quality');
  const audioFormatSelect = document.getElementById('audio-format');
  const embedSubsCheckbox = document.getElementById('embed-subs');
  const subLangsInput = document.getElementById('sub-langs');
  const embedThumbnailCheckbox = document.getElementById('embed-thumbnail');
  const embedMetadataCheckbox = document.getElementById('embed-metadata');
  const playlistStartInput = document.getElementById('playlist-start');
  const playlistEndInput = document.getElementById('playlist-end');

  // Get references to FFmpeg settings elements
  const ffmpegPathInput = document.getElementById('ffmpeg-path');
  const browseFfmpegPathBtn = document.getElementById('browse-ffmpeg-path');

  // Initial icon state (assuming window is not maximized on start)
  updateMaximizeRestoreIcon(false);

  // Listen for window maximize/unmaximize events (from main process)
  window.electron.on('window-maximized', () => updateMaximizeRestoreIcon(true));
  window.electron.on('window-unmaximized', () => updateMaximizeRestoreIcon(false));

  // Listen for app before-quit to ensure content is saved
  window.electron.on('app-before-quit', () => {
    // UrlTableManager handles auto-save to localStorage
  });

  // Load content from localStorage on startup (handled by UrlTableManager)
  // Save content to localStorage whenever it changes (handled by UrlTableManager)
  // Save content before app closes (handled by UrlTableManager)

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

    // Context menu for URL input
    urlInput.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showUrlInputContextMenu(e.clientX, e.clientY);
    });
  }

  // Function to show URL input context menu
  function showUrlInputContextMenu(x, y) {
    urlTableManager.hideContextMenu(); // Hide table context menu
    urlInputContextMenu.style.left = `${x}px`;
    urlInputContextMenu.style.top = `${y}px`;
    urlInputContextMenu.classList.add('show');
  }

  // Function to hide URL input context menu
  function hideUrlInputContextMenu() {
    urlInputContextMenu.classList.remove('show');
  }

  // Hide context menu when clicking elsewhere
  document.addEventListener('click', hideUrlInputContextMenu);

  // Context menu item handlers
  document.getElementById('ctxCopyUrl').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(urlInput.value);
      showToast('📋 URL copied to clipboard', 'info');
      hideUrlInputContextMenu();
    } catch (err) {
      // Fallback to execCommand
      urlInput.select();
      document.execCommand('copy');
      showToast('📋 URL copied to clipboard', 'info');
      hideUrlInputContextMenu();
    }
  });

  document.getElementById('ctxPasteUrl').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      urlInput.value = text.trim();
      validateUrl(urlInput.value);
      showToast('📋 URL pasted from clipboard', 'info');
      hideUrlInputContextMenu();
    } catch (err) {
      appendLog('Failed to read clipboard', 'error');
      showToast('Failed to read clipboard', 'error');
      hideUrlInputContextMenu();
    }
  });

  document.getElementById('ctxPasteAndCrawl').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      urlInput.value = text.trim();
      validateUrl(urlInput.value);
      showToast('📋 URL pasted from clipboard', 'info');
      hideUrlInputContextMenu();
      // Auto-crawl after a short delay
      setTimeout(() => crawlBtn.click(), 200);
    } catch (err) {
      appendLog('Failed to read clipboard', 'error');
      showToast('Failed to read clipboard', 'error');
      hideUrlInputContextMenu();
    }
  });

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
      const results = await window.electron.invoke('crawl', url);
      console.log('Crawl results:', results.slice(0, 2));
      // Clear old rows to avoid stale data from previous crawls
      urlTableManager.deleteAll();
      // Convert results to row objects and add to table
      const newRows = (results || []).map(item => {
        if (typeof item === 'string') {
          const url = item;
          return {
            url,
            title: extractTitleFromUrl(url),
            duration: '--:--',
            thumbnail: null,
            series: extractSeriesFromUrl(url),
            season: extractSeasonFromUrl(url),
            episodeNumber: extractEpisodeFromUrl(url)
          };
        }

        const rowUrl = item.url || '';
        const candidateEpisode = item.episodeNumber || item.episode_number || extractEpisodeFromUrl(rowUrl) || extractEpisodeFromUrl(item.title) || null;
        return {
          url: rowUrl,
          title: item.title || extractTitleFromUrl(rowUrl),
          duration: item.duration || '--:--',
          thumbnail: item.thumbnail || null,
          series: item.series || extractSeriesFromUrl(rowUrl),
          season: item.season || extractSeasonFromUrl(rowUrl),
          episodeNumber: candidateEpisode
        };
      });
      console.log('New rows:', newRows.slice(0, 2));
      const addedCount = urlTableManager.addRows(newRows);
      console.log('Sample row added:', newRows[0]);
      appendLog(`Crawling complete. ${addedCount} episode(s) added to the table.`, 'success');

      // Update statistics
      const crawlTime = Math.round((Date.now() - lastCrawlStartTime) / 1000);
      const stats = getStats();
      stats.totalUrls += addedCount;
      stats.uniqueUrls += addedCount;
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

  // Toggle quick actions
  // Load saved state from localStorage
  const quickActionsExpanded = localStorage.getItem('quick-actions-expanded') === 'true';
  if (quickActionsExpanded) {
    quickActions.classList.remove('collapsed');
    quickActions.style.display = 'flex';
    toggleQuickActionsBtn.classList.remove('collapsed');
  }

  toggleQuickActionsBtn.addEventListener('click', () => {
    quickActions.classList.toggle('collapsed');
    toggleQuickActionsBtn.classList.toggle('collapsed');
    
    // Toggle display property
    if (quickActions.style.display === 'none') {
      quickActions.style.display = 'flex';
      localStorage.setItem('quick-actions-expanded', 'true');
    } else {
      quickActions.style.display = 'none';
      localStorage.setItem('quick-actions-expanded', 'false');
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
    urlTableManager.deleteAll();
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

  // Close recent URLs menu when clicking outside
  document.addEventListener('click', (event) => {
    if (!recentUrlsBtn.contains(event.target) && !recentUrlsMenu.contains(event.target)) {
      recentUrlsMenu.classList.remove('show');
    }
  });

  clearHistoryBtn.addEventListener('click', () => {
    localStorage.removeItem('recentUrls');
    updateRecentUrlsList();
    showToast('✓ History cleared', 'info');
    recentUrlsMenu.classList.remove('show');
  });

  // Context menu handlers
  const ctxSelectAll = document.getElementById('ctxSelectAll');
  const ctxDownloadSelection = document.getElementById('ctxDownloadSelection');
  const ctxExportSelection = document.getElementById('ctxExportSelection');
  const ctxExportAll = document.getElementById('ctxExportAll');
  const ctxDeleteSelection = document.getElementById('ctxDeleteSelection');
  const ctxDeleteAll = document.getElementById('ctxDeleteAll');

  ctxSelectAll.addEventListener('click', () => {
    urlTableManager.selectAll();
    showToast('✓ All rows selected', 'info');
    urlTableManager.hideContextMenu();
  });

  ctxDownloadSelection.addEventListener('click', () => {
    const selectedUrls = urlTableManager.getSelectedUrls();
    if (selectedUrls.length > 0) {
      executeYtDlpCommand(selectedUrls);
    }
    urlTableManager.hideContextMenu();
  });

  ctxExportSelection.addEventListener('click', async () => {
    try {
      const downloadPath = localStorage.getItem('download-path');
      if (!downloadPath) {
        showToast('Please set a download location in settings first', 'warning');
        urlTableManager.hideContextMenu();
        return;
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filePath = `${downloadPath}/episodes-export-${timestamp}.json`;
      
      const result = await window.electron.invoke('save-file-dialog', {
        defaultPath: filePath,
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      });
      
      if (result && !result.canceled) {
        await urlTableManager.exportSelectedToJson(result.filePath);
        showToast(`✓ Exported ${urlTableManager.selectedRowIds.size} episode(s)`, 'success');
      }
    } catch (error) {
      showToast(`Export failed: ${error.message}`, 'error');
    }
    urlTableManager.hideContextMenu();
  });

  ctxExportAll.addEventListener('click', async () => {
    try {
      const downloadPath = localStorage.getItem('download-path');
      if (!downloadPath) {
        showToast('Please set a download location in settings first', 'warning');
        urlTableManager.hideContextMenu();
        return;
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filePath = `${downloadPath}/episodes-export-${timestamp}.json`;
      
      const result = await window.electron.invoke('save-file-dialog', {
        defaultPath: filePath,
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      });
      
      if (result && !result.canceled) {
        await urlTableManager.exportToJson(result.filePath);
        showToast(`✓ Exported ${urlTableManager.rows.length} episode(s)`, 'success');
      }
    } catch (error) {
      showToast(`Export failed: ${error.message}`, 'error');
    }
    urlTableManager.hideContextMenu();
  });

  ctxDeleteSelection.addEventListener('click', () => {
    const count = urlTableManager.selectedRowIds.size;
    if (count > 0) {
      urlTableManager.deleteSelected();
      showToast(`✓ Deleted ${count} episode(s)`, 'success');
    }
    urlTableManager.hideContextMenu();
  });

  ctxDeleteAll.addEventListener('click', () => {
    if (urlTableManager.rows.length > 0) {
      urlTableManager.deleteAll();
      showToast('✓ Deleted all episodes', 'success');
    }
    urlTableManager.hideContextMenu();
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
    try {
      const result = await window.electron.invoke('open-file-dialog', {
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      });
      
      if (result && !result.canceled && result.filePaths.length > 0) {
        const addedCount = await urlTableManager.importFromJson(result.filePaths[0]);
        addStatusLog(`Imported ${addedCount} episode(s) from file.`, 'success');
        showToast(`✓ Imported ${addedCount} episode(s)`, 'success');
      }
    } catch (error) {
      addStatusLog(`Failed to open file: ${error.message}`, 'error');
      showToast('Failed to open file', 'error');
    }
  });

  copyBtn.addEventListener('click', async () => {
    try {
      const urls = urlTableManager.getSelectedUrls();
      if (urls.length === 0) {
        showToast('No episodes selected', 'warning');
        return;
      }
      await navigator.clipboard.writeText(urls.join('\n'));
      addStatusLog(`Copied ${urls.length} URL(s) to clipboard!`, 'success');
      showToast(`✓ Copied ${urls.length} URL(s)`, 'success');
    } catch (err) {
      addStatusLog('Failed to copy URLs.', 'error');
      showToast('Failed to copy to clipboard', 'error');
      console.error('Failed to copy: ', err);
    }
  });

  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      const urls = text.trim().split(/\n+/).filter(u => u.length > 0);
      if (urls.length === 0) {
        showToast('No URLs found in clipboard', 'warning');
        return;
      }
      
      const newRows = urls.map(url => ({
        url: url,
        title: extractTitleFromUrl(url),
        duration: '--:--',
        thumbnail: null,
        series: extractSeriesFromUrl(url),
        season: extractSeasonFromUrl(url)
      }));
      
      const addedCount = urlTableManager.addRows(newRows);
      addStatusLog(`Added ${addedCount} URL(s) from clipboard!`, 'success');
      showToast(`✓ Added ${addedCount} URL(s)`, 'success');
    } catch (err) {
      addStatusLog('Failed to paste URLs.', 'error');
      showToast('Failed to paste from clipboard', 'error');
      console.error('Failed to paste: ', err);
    }
  });

  deleteBtn.addEventListener('click', () => {
    if (urlTableManager.selectedRowIds.size > 0) {
      const count = urlTableManager.selectedRowIds.size;
      urlTableManager.deleteSelected();
      addStatusLog(`Deleted ${count} episode(s).`, 'success');
      showToast(`✓ Deleted ${count} episode(s)`, 'success');
    } else {
      showToast('No episodes selected', 'warning');
    }
  });

  saveAsBtn.addEventListener('click', async () => {
    const allUrls = urlTableManager.getAllUrls();
    if (allUrls.length === 0) {
      addStatusLog('No episodes to save.', 'warning');
      showToast('No episodes to save', 'warning');
      return;
    }
    
    try {
      const downloadPath = localStorage.getItem('download-path');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const defaultPath = downloadPath 
        ? `${downloadPath}/episodes-${timestamp}.json`
        : `episodes-${timestamp}.json`;
      
      const result = await window.electron.invoke('save-file-dialog', {
        defaultPath: defaultPath,
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      });
      
      if (result && !result.canceled) {
        await urlTableManager.exportToJson(result.filePath);
        addStatusLog(`Saved ${allUrls.length} episode(s) to: ${result.filePath}`, 'success');
        showToast(`✓ Saved ${allUrls.length} episode(s)`, 'success');
      }
    } catch (error) {
      addStatusLog(`Error saving: ${error.message}`, 'error');
      showToast('Failed to save', 'error');
      console.error('Error saving:', error);
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
    window.electron.invoke('open-dev-tools');
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

  // Close YT-DLP menu when clicking outside
  document.addEventListener('click', (event) => {
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

  // Keep terminal open setting
  keepTerminalOpenCheckbox.addEventListener('change', () => {
    localStorage.setItem('keep-terminal-open', keepTerminalOpenCheckbox.checked);
  });
  // Load saved keep terminal open setting on startup
  if (localStorage.getItem('keep-terminal-open') === 'true') {
    keepTerminalOpenCheckbox.checked = true;
  }

  // YT-DLP additional settings event listeners
  // Video Quality
  videoQualitySelect.addEventListener('change', () => {
    localStorage.setItem('yt-dlp-video-quality', videoQualitySelect.value);
  });
  if (localStorage.getItem('yt-dlp-video-quality')) {
    videoQualitySelect.value = localStorage.getItem('yt-dlp-video-quality');
  }

  // Audio Format
  audioFormatSelect.addEventListener('change', () => {
    localStorage.setItem('yt-dlp-audio-format', audioFormatSelect.value);
  });
  if (localStorage.getItem('yt-dlp-audio-format')) {
    audioFormatSelect.value = localStorage.getItem('yt-dlp-audio-format');
  }

  // Embed Subtitles
  embedSubsCheckbox.addEventListener('change', () => {
    localStorage.setItem('yt-dlp-embed-subs', embedSubsCheckbox.checked);
  });
  if (localStorage.getItem('yt-dlp-embed-subs') === 'true') {
    embedSubsCheckbox.checked = true;
  }

  // Subtitle Languages
  subLangsInput.addEventListener('input', () => {
    localStorage.setItem('yt-dlp-sub-langs', subLangsInput.value);
  });
  if (localStorage.getItem('yt-dlp-sub-langs')) {
    subLangsInput.value = localStorage.getItem('yt-dlp-sub-langs');
  }

  // Embed Thumbnail
  embedThumbnailCheckbox.addEventListener('change', () => {
    localStorage.setItem('yt-dlp-embed-thumbnail', embedThumbnailCheckbox.checked);
  });
  if (localStorage.getItem('yt-dlp-embed-thumbnail') === 'true') {
    embedThumbnailCheckbox.checked = true;
  }

  // Embed Metadata
  embedMetadataCheckbox.addEventListener('change', () => {
    localStorage.setItem('yt-dlp-embed-metadata', embedMetadataCheckbox.checked);
  });
  if (localStorage.getItem('yt-dlp-embed-metadata') === 'true') {
    embedMetadataCheckbox.checked = true;
  }

  // Playlist Start
  playlistStartInput.addEventListener('input', () => {
    localStorage.setItem('yt-dlp-playlist-start', playlistStartInput.value);
  });
  if (localStorage.getItem('yt-dlp-playlist-start')) {
    playlistStartInput.value = localStorage.getItem('yt-dlp-playlist-start');
  }

  // Playlist End
  playlistEndInput.addEventListener('input', () => {
    localStorage.setItem('yt-dlp-playlist-end', playlistEndInput.value);
  });
  if (localStorage.getItem('yt-dlp-playlist-end')) {
    playlistEndInput.value = localStorage.getItem('yt-dlp-playlist-end');
  }

  // YT-DLP folder path event listeners
  browseYtDlpPathBtn.addEventListener('click', async () => {
    const result = await window.electron.invoke('open-directory-dialog');
    if (result && !result.canceled && result.filePaths.length > 0) {
      ytDlpPathInput.value = result.filePaths[0];
      localStorage.setItem('yt-dlp-path', result.filePaths[0]);
    }
  });

  // Load saved yt-dlp path on startup
  if (localStorage.getItem('yt-dlp-path')) {
    ytDlpPathInput.value = localStorage.getItem('yt-dlp-path');
  }

  // FFmpeg settings event listeners
  browseFfmpegPathBtn.addEventListener('click', async () => {
    const result = await window.electron.invoke('open-directory-dialog');
    if (result && !result.canceled && result.filePaths.length > 0) {
      ffmpegPathInput.value = result.filePaths[0];
      localStorage.setItem('ffmpeg-path', result.filePaths[0]);
    }
  });

  // Load saved ffmpeg path on startup
  if (localStorage.getItem('ffmpeg-path')) {
    ffmpegPathInput.value = localStorage.getItem('ffmpeg-path');
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

  // Theme buttons - Settings page
  const lightThemeBtn = document.getElementById('lightThemeBtn');
  const darkThemeBtn = document.getElementById('darkThemeBtn');
  const systemThemeBtn = document.getElementById('systemThemeBtn');

  function setTheme(theme, isSystemTheme = false) {
    document.body.setAttribute('data-theme', theme);
    const modeToSave = isSystemTheme ? 'system' : theme;
    localStorage.setItem('app-theme', modeToSave);

    // Update settings page buttons
    if (lightThemeBtn) lightThemeBtn.classList.toggle('active', theme === 'light' && !isSystemTheme);
    if (darkThemeBtn) darkThemeBtn.classList.toggle('active', theme === 'dark' && !isSystemTheme);
    if (systemThemeBtn) systemThemeBtn.classList.toggle('active', isSystemTheme);

    // Update more menu buttons
    document.querySelectorAll('.more-menu-theme-btn').forEach(btn => {
      if (btn.dataset.theme === 'system') {
        btn.classList.toggle('active', isSystemTheme);
      } else {
        btn.classList.toggle('active', btn.dataset.theme === theme && !isSystemTheme);
      }
    });
  }

  // Settings page theme buttons
  if (lightThemeBtn) {
    lightThemeBtn.addEventListener('click', () => setTheme('light'));
  }
  if (darkThemeBtn) {
    darkThemeBtn.addEventListener('click', () => setTheme('dark'));
  }
  if (systemThemeBtn) {
    systemThemeBtn.addEventListener('click', () => {
      localStorage.setItem('app-theme', 'system');
      window.electron.send('get-system-theme');
    });
  }

  // More menu theme buttons
  document.querySelectorAll('.more-menu-theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      if (theme === 'system') {
        localStorage.setItem('app-theme', 'system');
        window.electron.send('get-system-theme');
      } else {
        setTheme(theme);
      }
    });
  });

  // Load saved theme or use system theme
  const savedTheme = localStorage.getItem('app-theme') || 'system';
  if (savedTheme === 'system') {
    window.electron.send('get-system-theme');
  } else {
    setTheme(savedTheme);
  }

  // Set initial theme from system
  window.electron.on('system-theme', (event, theme) => {
    const savedTheme = localStorage.getItem('app-theme') || 'system';
    if (savedTheme === 'system') {
      setTheme(theme, true);
    }
  });
});
