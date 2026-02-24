const { app, BrowserWindow, ipcMain, dialog, nativeTheme, shell } = require('electron');
const path = require('path');
const puppeteer = require('puppeteer');
const packageJson = require('../package.json');

let Store;
let store;

function createWindow() {
  const defaultWidth = 1024;
  const defaultHeight = 768;

  let {
    width,
    height,
    x,
    y,
    isMaximized
  } = store.get('windowState', {
    width: defaultWidth,
    height: defaultHeight,
    x: undefined,
    y: undefined,
    isMaximized: false
  });

  const win = new BrowserWindow({
    width: width,
    height: height,
    x: x,
    y: y,
    frame: false, // Remove default title bar
    autoHideMenuBar: true, // Hide menu bar
    titleBarStyle: 'hidden', // For macOS, makes title bar hidden but still draggable
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (isMaximized) {
    win.maximize();
  }

  win.loadFile(path.join(__dirname, 'index.html'));

  // Save window state on resize, move, and close
  win.on('resize', () => {
    const {
      width,
      height
    } = win.getBounds();
    store.set('windowState', {
      width,
      height,
      x: win.getPosition()[0],
      y: win.getPosition()[1],
      isMaximized: win.isMaximized()
    });
  });

  win.on('move', () => {
    const {
      x,
      y
    } = win.getBounds();
    store.set('windowState', {
      width: win.getBounds().width,
      height: win.getBounds().height,
      x,
      y,
      isMaximized: win.isMaximized()
    });
  });

  win.on('close', () => {
    store.set('windowState', {
      width: win.getBounds().width,
      height: win.getBounds().height,
      x: win.getPosition()[0],
      y: win.getPosition()[1],
      isMaximized: win.isMaximized()
    });
  });

  // Send messages to renderer process when window is maximized/unmaximized
  win.on('maximize', () => {
    win.webContents.send('window-maximized');
    store.set('windowState.isMaximized', true);
  });

  win.on('unmaximize', () => {
    win.webContents.send('window-unmaximized');
    store.set('windowState.isMaximized', false);
  });
}

app.whenReady().then(() => {
  import('electron-store').then((module) => {
    const Store = module.default;
    store = new Store();

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
});


const fs = require('fs');
const {
  spawn
} = require('child_process');

ipcMain.on('get-system-theme', (event) => {
  event.reply('system-theme', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
});

ipcMain.handle('get-app-version', () => {
  return packageJson.version;
});

ipcMain.on('restart-app', () => {
  app.relaunch();
  app.quit();
});

ipcMain.on('open-dev-tools', () => {
  const window = BrowserWindow.getFocusedWindow();
  if (window) {
    window.webContents.openDevTools();
  }
});

ipcMain.handle('crawl', async (event, url) => {
  // Timeout constants
  const BROWSER_TIMEOUT = 60000;     // 60 seconds
  const GOTO_TIMEOUT = 30000;        // 30 seconds
  const PAGE_LOAD_TIMEOUT = 30000;   // 30 seconds
  const SCROLL_WAIT = 500;           // 500ms between scrolls (reduced from 2000ms)
  const SCROLL_MAX_ATTEMPTS = 20;    // Hard limit on scroll attempts
  const SCROLL_TIMEOUT = 30000;      // Total timeout for scrolling

  let browser;
  try {
    console.log(`Crawling: ${url}`);

    browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set default timeouts for page operations
    page.setDefaultTimeout(PAGE_LOAD_TIMEOUT);
    page.setDefaultNavigationTimeout(PAGE_LOAD_TIMEOUT);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: GOTO_TIMEOUT
    });

    // Scroll down to load all lazy-loaded content with optimized timing
    let previousHeight = 0;
    let scrollAttempts = 0;
    const scrollStartTime = Date.now();

    while (scrollAttempts < SCROLL_MAX_ATTEMPTS) {
      // Check if we've exceeded total scroll timeout
      if (Date.now() - scrollStartTime > SCROLL_TIMEOUT) {
        console.warn('Scroll timeout reached, stopping scroll attempts');
        break;
      }

      previousHeight = await page.evaluate('document.body.scrollHeight');
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await new Promise(resolve => setTimeout(resolve, SCROLL_WAIT));

      const newHeight = await page.evaluate('document.body.scrollHeight');
      if (newHeight === previousHeight) {
        break; // No new content loaded, reached the end
      }
      scrollAttempts++;
    }

    // Helper function: Try to extract episodes via API (fast, reliable)
    async function tryApiExtraction(page) {
      try {
        // Try to infer series id from the page URL first
        let seriesId = (page.url().match(/tv-shows\/(\d+)/) || page.url().match(/series\/(\d+)/))?.[1] || null;

        if (!seriesId) {
          // Fallback: try to find a canonical/meta URL or script blob containing the id
          seriesId = await page.evaluate(() => {
            try {
              const meta = document.querySelector('link[rel="canonical"][href]') || document.querySelector('meta[property="og:url"][content]');
              const url = meta ? (meta.getAttribute('href') || meta.getAttribute('content')) : window.location.href;
              const m = url.match(/tv-shows\/(\d+)/) || url.match(/series\/(\d+)/);
              if (m) return m[1];

              // Last resort: look for any element with a data-id-like attribute
              const attrEl = document.querySelector('[data-series-id], [data-show-id]');
              if (attrEl) return attrEl.getAttribute('data-series-id') || attrEl.getAttribute('data-show-id');
            } catch (e) {
              return null;
            }
            return null;
          });
        }

        if (!seriesId) return [];

        const apiPath = `/uapi/series/${seriesId}/episodes`;
        // Use page.fetch via browser context so cookies/headers are preserved
        const apiData = await page.evaluate(async (apiPath) => {
          try {
            const resp = await fetch(apiPath, { credentials: 'same-origin' });
            if (!resp.ok) return null;
            return await resp.json();
          } catch (e) {
            return null;
          }
        }, apiPath);

        if (!apiData) return [];

        // API may return an array or an object with an `episodes`/`items` property
        let items = Array.isArray(apiData) ? apiData : (apiData.episodes || apiData.items || []);
        if (Array.isArray(items) && items.length > 0) {
          const episodeUrls = items.map(it => {
            if (!it) return null;
            if (it.path) return `https://tubitv.com${it.path}`;
            if (it.id) return `https://tubitv.com/watch/${it.id}`;
            // sometimes API objects include a `url` or `link`
            if (it.url) return it.url.startsWith('http') ? it.url : `https://tubitv.com${it.url}`;
            return null;
          }).filter(u => !!u);
          
          if (episodeUrls.length > 0) {
            console.log(`Found ${episodeUrls.length} episodes via API`);
            return episodeUrls;
          }
        }
        return [];
      } catch (e) {
        console.warn('API extraction failed:', e && e.message ? e.message : e);
        return [];
      }
    }

    // Helper function: Interact with carousels to load more items
    async function interactWithCarousels(page) {
      try {
        let prevCount = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a[href^="/tv-shows/"]')).length;
        });
        
        for (let i = 0; i < 10; i++) {
          const clicked = await page.evaluate(() => {
            const sel = document.querySelector('[class*="web-carousel-shell__next"], [class*="web-carousel-shell__control--next"], [aria-label="Next"], [data-test-id="web-carousel-next"]');
            if (sel) {
              try { sel.click(); } catch (e) { try { sel.dispatchEvent(new MouseEvent('click', { bubbles: true })); } catch (e) {} }
              return true;
            }
            return false;
          });
          await new Promise(r => setTimeout(r, 1000));
          
          const newCount = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a[href^="/tv-shows/"]'));
            const seen = new Set();
            anchors.forEach(a => {
              const h = a.getAttribute('href');
              if (!h) return;
              const full = h.startsWith('http') ? h : `https://tubitv.com${h}`;
              seen.add(full);
            });
            return seen.size;
          });
          
          if (newCount > prevCount) {
            prevCount = newCount;
          } else {
            if (!clicked) break;
          }
        }
      } catch (e) {
        console.warn('Carousel interaction failed:', e && e.message ? e.message : e);
      }
    }

    // Helper function: Extract episodes from DOM with consolidated queries
    async function tryDomExtraction(page) {
      try {
        // Interact with carousels first to load more items
        await interactWithCarousels(page);

        // Single consolidated DOM query for all episode URLs
        const domUrls = await page.evaluate(() => {
          const selectors = [
            'div[data-test-id="web-ui-grid-item"] a[href^="/tv-shows/"]',
            'a[href^="/tv-shows/"]'  // Fallback to broader selector
          ];

          const seen = new Set();
          const urls = [];

          for (const selector of selectors) {
            const anchors = Array.from(document.querySelectorAll(selector));
            anchors.forEach(a => {
              try {
                const href = a.getAttribute('href');
                if (!href) return;
                const full = href.startsWith('http') ? href : `https://tubitv.com${href}`;
                if (!seen.has(full)) {
                  seen.add(full);
                  urls.push(full);
                }
              } catch (e) { /* ignore */ }
            });
          }
          return urls;
        });

        if (domUrls.length > 0) {
          console.log(`Found ${domUrls.length} episodes via DOM extraction`);
          return domUrls;
        }
        return [];
      } catch (e) {
        console.warn('DOM extraction failed:', e && e.message ? e.message : e);
        return [];
      }
    }

    // Extract episodes: API first (faster), then DOM (fallback)
    let episodeUrls = [];
    
    // Try 1: API extraction (fastest, most reliable)
    episodeUrls = await tryApiExtraction(page);
    if (episodeUrls && episodeUrls.length > 0) {
      return episodeUrls;
    }

    // Try 2: DOM extraction (fallback)
    episodeUrls = await tryDomExtraction(page);
    if (episodeUrls && episodeUrls.length > 0) {
      return episodeUrls;
    }

    // As a final measure, collect any remaining tv-shows anchors on the page
    const otherUrls = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href^="/tv-shows/"]'));
      return anchors.map(a => {
        const h = a.getAttribute('href');
        return h ? (h.startsWith('http') ? h : `https://tubitv.com${h}`) : null;
      }).filter(Boolean);
    });

    const all = Array.from(new Set([...(episodeUrls || []), ...otherUrls]));
    return all;

  } catch (error) {
    console.error('Crawl error:', error && error.message ? error.message : error);
    throw error;
  } finally {
    // Always close the browser, even if an error occurred
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error('Failed to close browser:', e && e.message ? e.message : e);
      }
    }
  }
});

ipcMain.handle('save-file', async (event, content) => {
  const window = BrowserWindow.getFocusedWindow();
  const { filePath } = await dialog.showSaveDialog(window, {
    title: 'Save Crawled URLs',
    defaultPath: path.join(app.getPath('documents'), 'crawled_urls.txt'),
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (filePath) {
    fs.writeFileSync(filePath, content);
    return { filePath };
  }
  return { filePath: null };
});

ipcMain.handle('open-file', async () => {
  const window = BrowserWindow.getFocusedWindow();
  const { filePaths } = await dialog.showOpenDialog(window, {
    title: 'Open Text File',
    properties: ['openFile'],
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (filePaths && filePaths.length > 0) {
    try {
      const content = fs.readFileSync(filePaths[0], 'utf-8');
      return content;
    } catch (error) {
      console.error('Failed to read file:', error);
      return null;
    }
  }
  return null;
});

ipcMain.handle('open-directory-dialog', async () => {
  const window = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(window, {
    properties: ['openDirectory']
  });
  return result;
});

ipcMain.handle('minimize-window', (event) => {
  const window = BrowserWindow.getFocusedWindow();
  if (window) {
    window.minimize();
  }
});

ipcMain.handle('maximize-restore-window', (event) => {
  const window = BrowserWindow.getFocusedWindow();
  if (window) {
    if (window.isMaximized()) {
      window.restore();
    } else {
      window.maximize();
    }
  }
});

ipcMain.handle('close-window', (event) => {
  const window = BrowserWindow.getFocusedWindow();
  if (window) {
    window.close();
  }
});

ipcMain.handle('run-yt-dlp', async (event, options) => {
  const { urls, downloadPath, format, mergeFormat } = options;
  const ytDlpPath = 'yt-dlp'; // Assuming yt-dlp is in PATH or globally installed

  let args = [];

  // Add format string
  if (format) {
    args.push('-f', format);
  }

  // Add merge format
  if (mergeFormat) {
    args.push('--merge-output-format', mergeFormat);
  }

  // Add output directory
  if (downloadPath) {
    args.push('-o', path.join(downloadPath, '%(title)s.%(ext)s'));
  }

  // Add URLs
  args = args.concat(urls);

  let command = ytDlpPath;
  let commandArgs = args;
  let shell = true; // Use shell to allow command to be found in PATH

  // Platform-specific terminal commands
  if (process.platform === 'win32') {
    // On Windows, use cmd.exe /c start "" to open a new window
    // or powershell.exe -NoExit -Command to keep it open
    command = 'powershell.exe';
    commandArgs = ['-NoExit', '-Command', `& {${ytDlpPath} ${args.map(arg => `'${arg}'`).join(' ')}}`];
    // Note: The above powershell command might need adjustment for complex arguments or spaces.
    // A simpler approach for now is to just run yt-dlp directly and let it open its own console if it's a console app.
    // Or, if we want a new window, it gets more complex. Let's try direct spawn first.
    // For opening a new terminal window:
    // command = 'cmd.exe';
    // commandArgs = ['/c', 'start', 'cmd.exe', '/k', `"${ytDlpPath} ${args.map(arg => `"${arg}"`).join(' ')}"`];
    // This is tricky with quoting. Let's simplify for now and just spawn yt-dlp directly.
    // If yt-dlp is a console app, it will open a console.
    // If not, we might need to wrap it.
    // For now, let's just spawn yt-dlp directly.
    // If it doesn't open a window, we'll revisit.
    command = ytDlpPath;
    commandArgs = args;
    shell = true; // Let the shell handle finding yt-dlp and opening a window if it's a console app.
  } else if (process.platform === 'linux') {
    // On Linux, common terminal emulators: xterm, gnome-terminal, konsole, etc.
    // This assumes one of these is installed.
    // For simplicity, let's try to open a new gnome-terminal or xterm.
    // This is highly dependent on user's setup.
    // A more robust solution would be to let the user configure their preferred terminal.
    // For now, let's try gnome-terminal.
    command = 'gnome-terminal';
    commandArgs = ['--', ytDlpPath].concat(args);
    shell = false; // gnome-terminal expects the command as separate arguments
  } else if (process.platform === 'darwin') {
    // On macOS, can use osascript to open a new Terminal.app window
    // This is more complex. For now, let's just spawn directly.
    command = ytDlpPath;
    commandArgs = args;
    shell = true;
  }


  try {
    const child = spawn(command, commandArgs, {
      cwd: downloadPath, // Run yt-dlp in the specified download directory
      detached: true, // Detach the child process from the parent
      shell: shell,
      stdio: 'ignore' // Ignore stdio to prevent it from blocking the main process
    });

    child.unref(); // Allow the parent process to exit independently of the child

    return { success: true };
  } catch (error) {
    console.error('Failed to spawn yt-dlp:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-external-browser', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Failed to open external browser:', error);
    return { success: false, error: error.message };
  }
});

const browserViews = new Map(); // Map windowId -> BrowserView

ipcMain.handle('open-internal-browser', async (event, options = {}) => {
  // Always open Tubi's main site regardless of the caller-provided URL.
  const target = 'https://www.tubitv.com/';
  const theme = options.theme || 'light';
  console.log('Main process opening internal browser for:', target, 'theme:', theme);
  try {
    const newWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'browser-preload.js')
      }
    });

    // Create a BrowserView to host the remote site (not an iframe)
    const { BrowserView } = require('electron');
    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    newWindow.setBrowserView(view);

    // Set initial bounds: leave room at top for the toolbar (60px)
    const [w, h] = newWindow.getSize();
    view.setBounds({ x: 0, y: 60, width: w, height: h - 60 });
    view.setAutoResize({ width: true, height: true });

    // Load the wrapper UI (toolbar) into the window

    await newWindow.loadFile(path.join(__dirname, 'browser.html'));

    // Once the wrapper UI has loaded, set its theme
    newWindow.webContents.once('did-finish-load', () => {
      try {
        newWindow.webContents.send('set-theme', theme);
      } catch (e) {
        console.warn('Failed to send theme to browser window:', e);
      }
    });

    // Load the target URL in the BrowserView
    await view.webContents.loadURL(target);

    // Store mapping so IPC handlers can find the view for this window
    browserViews.set(newWindow.id, view);

    // Forward URL updates from the view to the renderer (toolbar)
    const sendUrlUpdate = () => {
      try {
        const current = view.webContents.getURL();
        newWindow.webContents.send('browser-url-updated', current);
      } catch (e) {
        console.warn('Could not send URL update:', e);
      }
    };

    view.webContents.on('did-navigate', sendUrlUpdate);
    view.webContents.on('did-navigate-in-page', sendUrlUpdate);
    view.webContents.on('did-finish-load', sendUrlUpdate);

    // Adjust view bounds when window is resized
    newWindow.on('resize', () => {
      const [width, height] = newWindow.getSize();
      const toolbarHeight = 60;
      const view = browserViews.get(newWindow.id);
      if (view) view.setBounds({ x: 0, y: toolbarHeight, width, height: height - toolbarHeight });
    });

    // Clean up when closed
    newWindow.on('closed', () => {
      const view = browserViews.get(newWindow.id);
      if (view) {
        try { view.webContents.destroy(); } catch (e) {}
        browserViews.delete(newWindow.id);
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to open internal browser:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.on('internal-browser-command', (event, cmd, payload) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (!senderWindow) {
    console.warn('Could not find window for internal browser command');
    return;
  }

  const view = browserViews.get(senderWindow.id);
  if (!view) {
    console.warn('No BrowserView found for window:', senderWindow.id);
    return;
  }

  switch (cmd) {
    case 'back':
      if (view.webContents.canGoBack()) {
        view.webContents.goBack();
      }
      break;
    case 'forward':
      if (view.webContents.canGoForward()) {
        view.webContents.goForward();
      }
      break;
    case 'reload':
      view.webContents.reload();
      break;
    case 'go':
      if (payload && payload.url) {
        view.webContents.loadURL(payload.url).catch(err => {
          console.error('Failed to load URL:', err);
        });
      }
      break;
    case 'copy-url':
      try {
        const { clipboard } = require('electron');
        const url = view.webContents.getURL();
        clipboard.writeText(url);
      } catch (err) {
        console.error('Failed to copy URL:', err);
      }
      break;
    case 'get-url':
      try {
        const url = view.webContents.getURL();
        senderWindow.webContents.send('browser-url-updated', url);
      } catch (err) {
        console.error('Failed to get URL:', err);
      }
      break;
    default:
      console.warn('Unknown internal-browser-command:', cmd);
  }
});

ipcMain.handle('browser-insert-css', async (event, css) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (!senderWindow) throw new Error('Could not find window');

  const view = browserViews.get(senderWindow.id);
  if (!view) throw new Error('No BrowserView found');

  try {
    const key = await view.webContents.insertCSS(css);
    return key;
  } catch (err) {
    throw new Error('Failed to insert CSS: ' + err.message);
  }
});

ipcMain.handle('browser-remove-css', async (event, key) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (!senderWindow) throw new Error('Could not find window');

  const view = browserViews.get(senderWindow.id);
  if (!view) throw new Error('No BrowserView found');

  try {
    await view.webContents.removeInsertedCSS(key);
  } catch (err) {
    throw new Error('Failed to remove CSS: ' + err.message);
  }
});





app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
