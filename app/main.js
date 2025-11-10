const { app, BrowserWindow, ipcMain, dialog, nativeTheme } = require('electron');
const path = require('path');
const puppeteer = require('puppeteer');

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
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    frame: false, // Remove default title bar
    autoHideMenuBar: true, // Hide menu bar
    titleBarStyle: 'hidden', // For macOS, makes title bar hidden but still draggable
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  // Send messages to renderer process when window is maximized/unmaximized
  win.on('maximize', () => {
    win.webContents.send('window-maximized');
  });

  win.on('unmaximize', () => {
    win.webContents.send('window-unmaximized');
  });
}

const fs = require('fs');

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
