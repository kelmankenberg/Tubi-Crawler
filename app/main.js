console.log('MAIN PROCESS IS ALIVE'); // Aggressive diagnostic log
console.log('app/main.js started loading.'); // Diagnostic log at the very top
const { app, BrowserWindow, ipcMain, dialog, nativeTheme, shell } = require('electron');
const path = require('path');
const puppeteer = require('puppeteer');

let Store;
import('electron-store').then((module) => {
  Store = module.default;
  const store = new Store();

  ipcMain.on('get-system-theme', (event) => {
    event.reply('system-theme', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
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

  function createWindow () {
    const defaultWidth = 1024;
    const defaultHeight = 768;

    let { width, height, x, y, isMaximized } = store.get('windowState', {
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
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    if (isMaximized) {
      win.maximize();
    }

    win.loadFile(path.join(__dirname, 'index.html'));

    // Save window state on resize, move, and close
    win.on('resize', () => {
      const { width, height } = win.getBounds();
      store.set('windowState', { width, height, x: win.getPosition()[0], y: win.getPosition()[1], isMaximized: win.isMaximized() });
    });

    win.on('move', () => {
      const { x, y } = win.getBounds();
      store.set('windowState', { width: win.getBounds().width, height: win.getBounds().height, x, y, isMaximized: win.isMaximized() });
    });

    win.on('close', () => {
      store.set('windowState', { width: win.getBounds().width, height: win.getBounds().height, x: win.getPosition()[0], y: win.getPosition()[1], isMaximized: win.isMaximized() });
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
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
});

const fs = require('fs');
const { spawn } = require('child_process');

ipcMain.handle('crawl', async (event, url) => {

  console.log(`Crawling ${url}`);

  const browser = await puppeteer.launch();

  const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle2' });

  

    // Scroll down to load all lazy-loaded content

    let previousHeight;

    while (true) {

      previousHeight = await page.evaluate('document.body.scrollHeight');

      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');

      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds for content to load

      let newHeight = await page.evaluate('document.body.scrollHeight');

      if (newHeight === previousHeight) {

        break; // No more scrolling possible, reached the end

      }

    }

  

    const episodeData = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href^="/tv-shows/"]'));
    const urls = [];
    links.forEach(link => {
      const relativeHref = link.getAttribute('href');
      const fullUrl = `https://tubitv.com${relativeHref}`;
      urls.push(fullUrl);
    });
    return urls;
  });
  await browser.close();
  return episodeData; // Return the array of URLs directly

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

ipcMain.handle('open-internal-browser', async (event, url) => {
  console.log('Main process received open-internal-browser request for URL:', url); // New diagnostic log
  try {
    const newWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        // webviewTag: true // No longer needed, using iframe
      }
    });
    newWindow.loadFile(path.join(__dirname, 'browser.html'), { query: { url: url } }); // Load browser.html again
    return { success: true };
  } catch (error) {
    console.error('Failed to open internal browser:', error);
    return { success: false, error: error.message };
  }
});
console.log('open-internal-browser handler registered.'); // Diagnostic log after registration

// ipcMain.on('close-browser', () => {
//   app.quit();
// });


app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
