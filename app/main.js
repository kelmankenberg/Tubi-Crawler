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

ipcMain.on('crawl', async (event, url) => {
  event.sender.send('log', `Crawling ${url}`);
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  const reactQueryStateJSON = await page.evaluate(() => {
    return JSON.stringify(window.__REACT_QUERY_STATE__);
  });

  await browser.close();

  const reactQueryState = JSON.parse(reactQueryStateJSON);

  const paginatedContent = reactQueryState.queries.find(q => q.queryHash.includes('paginated'));
  const seriesTitle = paginatedContent.state.data.pages[0].title;

  const seriesPaginationInfo = reactQueryState.queries.find(q => q.queryHash.includes('seriesPaginationInfo'));
  if (seriesPaginationInfo) {
    const seasons = seriesPaginationInfo.state.data.seasons;
    let output = '';
    for (const season of seasons) {
      for (const episode of season.episodes) {
        const contentQuery = reactQueryState.queries.find(q => q.queryHash.includes(episode.id));
        if (contentQuery) {
          const episodeData = contentQuery.state.data.pages[0];
          const episodeTitle = episodeData.title.replace(/S\d+:E\d+ - /, '');
          const sanitizedTitle = episodeTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const episodeUrl = `https://tubitv.com/tv-shows/${episode.id}/s${season.number}-e${episode.num}-${sanitizedTitle}`;
          const line = `Season ${season.number}, Episode ${episode.num}: ${episodeData.title} - ${episodeUrl}\n`;
          output += line;
          event.sender.send('log', line);
        }
      }
    }
    const sanitizedSeriesTitle = seriesTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const filePath = path.join('output', `${sanitizedSeriesTitle}.txt`);
    fs.writeFileSync(filePath, output);
    event.sender.send('log', `Finished crawling. Output saved to ${filePath}`);
  } else {
    event.sender.send('log', 'Could not find episode data.');
  }
});


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
