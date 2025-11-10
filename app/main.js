const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const puppeteer = require('puppeteer');

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
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
