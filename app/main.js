const { app, BrowserWindow, ipcMain, dialog, nativeTheme, shell } = require('electron');
const path = require('path');
const puppeteer = require('puppeteer');
const packageJson = require('../package.json');

// Auto-reload on file changes (development only)
// Wrap in try-catch to prevent errors in production builds
try {
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    require('electron-reload')(__dirname);
  }
} catch (error) {
  // Module not available (production build), silently ignore
}

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

ipcMain.handle('restart-app', () => {
  app.relaunch();
  app.quit();
});

ipcMain.handle('open-dev-tools', () => {
  console.log('open-dev-tools handler called');
  const window = BrowserWindow.getFocusedWindow();
  if (window) {
    window.webContents.toggleDevTools();
  }
});

ipcMain.handle('crawl', async (event, url) => {
  // Timeout constants
  const BROWSER_TIMEOUT = 60000;     // 60 seconds
  const GOTO_TIMEOUT = 30000;        // 30 seconds

  // Content CDN helper values captured from page network requests
  let contentCdnToken = null;
  let contentCdnCapability = null;
  let contentCdnSampleUrl = null;
  const PAGE_LOAD_TIMEOUT = 30000;   // 30 seconds
  const SCROLL_WAIT = 500;           // 500ms between scrolls (reduced from 2000ms)
  const SCROLL_MAX_ATTEMPTS = 20;    // Hard limit on scroll attempts
  const SCROLL_TIMEOUT = 30000;      // Total timeout for scrolling

  function parseDurationValue(value) {
    if (value == null) return null;

    if (typeof value === 'number' && !Number.isNaN(value)) {
      return Math.round(value);
    }

    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    if (trimmed === '') return null;

    // If value is numeric text (seconds)
    if (/^\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }

    // HH:MM:SS or MM:SS
    const parts = trimmed.split(':').map(part => parseInt(part, 10));
    if (parts.every(p => !Number.isNaN(p))) {
      if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
      }
    }

    // human format examples like "1h 23m" or "42m"
    const match = trimmed.match(/(?:(\d+)\s*h(?:ours?)?)?\s*(?:(\d+)\s*m(?:inutes?)?)?\s*(?:(\d+)\s*s(?:econds?)?)?/i);
    if (match) {
      const h = Number(match[1] || 0);
      const m = Number(match[2] || 0);
      const s = Number(match[3] || 0);
      if (h || m || s) {
        return h * 3600 + m * 60 + s;
      }
    }

    return null;
  }

  function formatDuration(seconds) {
    const sec = Number(seconds);
    if (!Number.isFinite(sec) || Number.isNaN(sec) || sec <= 0) {
      return null;
    }
    const totalSeconds = Math.round(sec);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }

  function extractEpisodeNumberFromTitle(title) {
    if (!title || typeof title !== 'string') return null;
    // Try to extract from format like "S01:E21 - Title" or "S01E21 - Title"
    const match = title.match(/(?:S\d+)?[:\s]*E(\d+)/i);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  async function fetchEpisodeDetails(page, episodeId) {
    if (!episodeId) return null;

    try {
      const apiPath = `/oz/videos/${episodeId}`;
      const data = await page.evaluate(async (apiPath) => {
        try {
          const res = await fetch(apiPath, { credentials: 'same-origin' });
          if (!res.ok) return null;
          return await res.json();
        } catch (err) {
          return null;
        }
      }, apiPath);
      return data;
    } catch (error) {
      console.warn('Failed fetching episode details for id', episodeId, error && error.message ? error.message : error);
      return null;
    }
  }

  async function fetchEpisodesFromContentCdn(seriesId) {
    if (!seriesId) return [];

    try {
      console.log('fetchEpisodesFromContentCdn called with seriesId:', seriesId);
      console.log('Available headers - Token:', !!contentCdnToken, 'Capability:', !!contentCdnCapability);

      // If we don't have auth headers, try to get them by making a test request to the series page
      if (!contentCdnToken || !contentCdnCapability) {
        console.log('No auth headers captured, trying to fetch series data to get headers...');
        try {
          const seriesUrl = `https://content-cdn.production-public.tubi.io/api/v2/content?app_id=tubitv&platform=web&content_id=${seriesId}`;
          const seriesResp = await fetch(seriesUrl, {
            headers: {
              'accept': 'application/json, text/plain, */*',
              'accept-version': '~5.0.0',
              'referer': 'https://tubitv.com/',
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36'
            }
          });
          console.log('Series request status:', seriesResp.status);
          if (seriesResp.status === 401) {
            console.log('Series request requires auth, cannot proceed without headers');
            return [];
          }
          // If it succeeds, we might not need auth for episodes either
        } catch (e) {
          console.log('Failed to test series request:', e.message);
        }
      }

      // Construct a clean base URL for episode fetching
      const baseUrl = new URL('https://content-cdn.production-public.tubi.io/api/v2/content');
      baseUrl.searchParams.set('app_id', 'tubitv');
      baseUrl.searchParams.set('platform', 'web');
      baseUrl.searchParams.set('content_id', String(seriesId));

      // Use captured headers if available, otherwise use defaults
      const headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-version': '~5.0.0',
        'referer': 'https://tubitv.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36'
      };
      if (contentCdnToken) headers.authorization = contentCdnToken;
      if (contentCdnCapability) headers['x-capability'] = contentCdnCapability;

      const episodes = [];
      const pageSize = 100;
      const maxSeasons = 10;
      const maxPagesPerSeason = 10;

      for (let season = 1; season <= maxSeasons; season++) {
        let seasonHasEpisodes = false;

        for (let pageInSeason = 1; pageInSeason <= maxPagesPerSeason; pageInSeason++) {
          const requestUrl = new URL(baseUrl.toString());
          requestUrl.searchParams.set('pagination[season]', String(season));
          requestUrl.searchParams.set('pagination[page_in_season]', String(pageInSeason));
          requestUrl.searchParams.set('pagination[page_size_in_season]', String(pageSize));

          const result = await page.evaluate(async (fetchUrl, headers) => {
            try {
              const resp = await fetch(fetchUrl, { headers });
              if (!resp.ok) return { status: resp.status };
              return { status: 200, data: await resp.json() };
            } catch (err) {
              return { status: 0 };
            }
          }, requestUrl.toString(), headers);

          if (!result || result.status !== 200 || !result.data || !Array.isArray(result.data.children)) {
            break;
          }

          const seasonBlock = result.data.children.find(child => String(child.id) === String(season) || child.type === 'a');
          if (!seasonBlock || !Array.isArray(seasonBlock.children) || seasonBlock.children.length === 0) {
            if (pageInSeason === 1) {
              // If first page of this season yields no episodes, we assume no further seasons.
              seasonHasEpisodes = false;
            }
            break;
          }

          seasonHasEpisodes = true;

          for (const ep of seasonBlock.children) {
            if (!ep || !ep.id) continue;
            const rawDuration = ep.duration ?? ep.valid_duration ?? ep.runtime ?? ep.length ?? ep.video_length;
            const durationSeconds = parseDurationValue(rawDuration);
            const duration = durationSeconds ? formatDuration(durationSeconds) : null;

            episodes.push({
              id: String(ep.id),
              url: `https://tubitv.com/watch/${ep.id}`,
              title: ep.title || null,
              season: season,
              episodeNumber: ep.display_episode_number || ep.episode_number || extractEpisodeNumberFromTitle(ep.title) || null,
              duration,
              rawDuration: durationSeconds || null,
              thumbnail: ep.posterarts || (ep.images && ep.images.posterarts) || null
            });
          }

          if (seasonBlock.children.length < pageSize) {
            break; // no further pages in this season
          }
        }

        if (!seasonHasEpisodes) {
          break; // no more seasons
        }
      }

      return episodes;
    } catch (err) {
      console.warn('fetchEpisodesFromContentCdn failed for seriesId', seriesId, err && err.message ? err.message : err);
      return [];
    }
  }

  let browser;
  try {
    console.log(`Crawling: ${url}`);

    browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Capture content-cdn request headers (authorization, x-capability, device_id, etc.) for improved cooldown metadata extraction
    page.on('request', (req) => {
      const reqUrl = req.url();
      if (reqUrl.includes('content-cdn.production-public.tubi.io/api/v2/content')) {
        console.log('Content-CDN request detected in app:', reqUrl.substring(0, 100) + '...');
        if (!contentCdnSampleUrl) {
          contentCdnSampleUrl = reqUrl;
          console.log('Captured content-cdn URL in app');
        }
        const headers = req.headers();
        if (headers.authorization && !contentCdnToken) {
          contentCdnToken = headers.authorization;
          console.log('Captured auth token in app');
        }
        if (headers['x-capability'] && !contentCdnCapability) {
          contentCdnCapability = headers['x-capability'];
          console.log('Captured x-capability in app');
        }
      }
    });

    // Set default timeouts for page operations
    page.setDefaultTimeout(PAGE_LOAD_TIMEOUT);
    page.setDefaultNavigationTimeout(PAGE_LOAD_TIMEOUT);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: GOTO_TIMEOUT
    });

    // Wait for content-cdn requests to be captured
    console.log('Waiting for content-cdn requests to be captured...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('Headers after page load - URL:', !!contentCdnSampleUrl, 'Token:', !!contentCdnToken, 'Capability:', !!contentCdnCapability);

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
        console.log('Extracted seriesId from URL:', seriesId);

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
          console.log('Extracted seriesId from page evaluation:', seriesId);
        }

        if (!seriesId) return [];

        const apiPath = `/uapi/series/${seriesId}/episodes`;
        console.log('Trying uapi path:', apiPath);
        // Use page.fetch via browser context so cookies/headers are preserved
        const apiData = await page.evaluate(async (apiPath) => {
          try {
            const resp = await fetch(apiPath, { credentials: 'same-origin' });
            console.log('UAPI response status:', resp.status);
            if (!resp.ok) return null;
            return await resp.json();
          } catch (e) {
            console.log('UAPI fetch error:', e.message);
            return null;
          }
        }, apiPath);

        if (!apiData) {
          console.log('No API data from uapi, trying content-cdn fallback');
          console.log('Content-CDN headers available - URL:', !!contentCdnSampleUrl, 'Token:', !!contentCdnToken, 'Capability:', !!contentCdnCapability);
          const contentCdnEpisodes = await fetchEpisodesFromContentCdn(seriesId);
          if (contentCdnEpisodes.length > 0) {
            console.log(`Found ${contentCdnEpisodes.length} episodes via content-cdn fallback`);
            return contentCdnEpisodes.map(ep => ({
              url: ep.url,
              title: ep.title,
              season: ep.season,
              episodeNumber: ep.episodeNumber,
              duration: ep.duration,
              thumbnail: ep.thumbnail
            }));
          }
          return [];
        }

        // API may return an array or an object with an `episodes`/`items` property
        let items = Array.isArray(apiData) ? apiData : (apiData.episodes || apiData.items || []);
        if (Array.isArray(items) && items.length > 0) {
          const episodes = [];

          for (const it of items) {
            if (!it) continue;

            let url = null;
            if (it.path) {
              url = it.path.startsWith('http') ? it.path : `https://tubitv.com${it.path}`;
            } else if (it.id) {
              url = `https://tubitv.com/watch/${it.id}`;
            } else if (it.url) {
              url = it.url.startsWith('http') ? it.url : `https://tubitv.com${it.url}`;
            } else if (it.link) {
              url = it.link.startsWith('http') ? it.link : `https://tubitv.com${it.link}`;
            }

            if (!url) continue;

            const episode = {
              url,
              title: it.title || null,
              season: it.season_number || it.season || null,
              episodeNumber: it.episode_number || it.episode || extractEpisodeNumberFromTitle(it.title) || null,
              duration: null,
              thumbnail: it.thumbnail || it.image || it.thumb || null,
              id: it.id || null
            };

            const rawDuration = it.duration || it.runtime || it.length || it.duration_seconds || it.runtime_seconds || it.duration_ms || it.length_seconds;
            const durationSeconds = parseDurationValue(rawDuration);
            if (durationSeconds) {
              episode.duration = formatDuration(durationSeconds);
            }

            episodes.push(episode);
          }

          if (episodes.length > 0) {
            // Try to enrich durations and episode numbers from content-cdn first if possible
            const contentCdnEpisodes = await fetchEpisodesFromContentCdn(seriesId);
            const contentCdnMap = new Map(contentCdnEpisodes.map(ep => [ep.id, ep]));
            for (const ep of episodes) {
              if (ep.id && contentCdnMap.has(ep.id)) {
                const cdnData = contentCdnMap.get(ep.id);
                if (!ep.duration) {
                  ep.duration = cdnData.duration;
                }
                if (!ep.episodeNumber && cdnData.episodeNumber) {
                  ep.episodeNumber = cdnData.episodeNumber;
                }
              }
            }

            // Fill missing duration by fetching individual video API metadata if available
            for (const ep of episodes) {
              if (!ep.duration && ep.id) {
                const details = await fetchEpisodeDetails(page, ep.id);
                if (details) {
                  const rawDetailDuration = details.duration || details.runtime || details.video_length || details.length || details.duration_seconds || details.runtime_seconds;
                  const detailSeconds = parseDurationValue(rawDetailDuration);
                  if (detailSeconds) {
                    ep.duration = formatDuration(detailSeconds);
                  }
                }
              }
            }

            // Clean the final results to return normalized metadata objects
            const finalResults = episodes.map(ep => ({
              url: ep.url,
              title: ep.title,
              season: ep.season,
              episodeNumber: ep.episodeNumber,
              duration: ep.duration,
              thumbnail: ep.thumbnail
            }));

            console.log(`Found ${finalResults.length} episodes via API`);
            if (finalResults.length > 0) {
              console.log('Sample episode:', { title: finalResults[0].title, episodeNumber: finalResults[0].episodeNumber });
            }
            return finalResults;
          }
        }

        // If uapi extraction didn't return any episodes or didn't contain enough detail, try content-cdn endpoint as a backup.
        const contentCdnEpisodes = await fetchEpisodesFromContentCdn(seriesId);
        if (contentCdnEpisodes.length > 0) {
          console.log(`Found ${contentCdnEpisodes.length} episodes via content-cdn fallback`);
          if (contentCdnEpisodes.length > 0) {
            console.log('Sample from CDN:', { title: contentCdnEpisodes[0].title, episodeNumber: contentCdnEpisodes[0].episodeNumber });
          }
          return contentCdnEpisodes.map(ep => ({
            url: ep.url,
            title: ep.title,
            season: ep.season,
            episodeNumber: ep.episodeNumber,
            duration: ep.duration,
            thumbnail: ep.thumbnail
          }));
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
          return domUrls.map(u => ({ url: u }));
        }
        return [];
      } catch (e) {
        console.warn('DOM extraction failed:', e && e.message ? e.message : e);
        return [];
      }
    }

    // Extract episodes: API first (faster), then DOM (fallback)
    let episodes = [];
    
    // Try 1: API extraction (fastest, most reliable)
    console.log('Attempting API extraction...');
    episodes = await tryApiExtraction(page);
    console.log(`API extraction returned ${episodes.length} episodes`);
    if (episodes && episodes.length > 0) {
      return episodes;
    }

    // Try 2: DOM extraction (fallback)
    console.log('API extraction failed, trying DOM extraction...');
    episodes = await tryDomExtraction(page);
    console.log(`DOM extraction returned ${episodes.length} episodes`);
    if (episodes && episodes.length > 0) {
      return episodes;
    }

    // As a final measure, collect any remaining tv-shows anchors on the page
    const otherUrls = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href^="/tv-shows/"]'));
      return anchors.map(a => {
        const h = a.getAttribute('href');
        return h ? (h.startsWith('http') ? h : `https://tubitv.com${h}`) : null;
      }).filter(Boolean);
    });

    const allUrlStrings = Array.from(new Set([...(episodes || []).map(e => (typeof e === 'string' ? e : e.url)), ...otherUrls]));
    const all = allUrlStrings.map(u => ({ url: u }));
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

ipcMain.handle('open-file-dialog', async (event, options = {}) => {
  const window = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(window, {
    properties: ['openFile'],
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }]
  });
  return result;
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

ipcMain.handle('open-executable-dialog', async () => {
  const window = BrowserWindow.getFocusedWindow();
  const { filePaths } = await dialog.showOpenDialog(window, {
    title: 'Select FFmpeg Executable',
    properties: ['openFile'],
    filters: [
      { name: 'Executable Files', extensions: ['exe'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (filePaths && filePaths.length > 0) {
    return filePaths[0];
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

ipcMain.handle('save-file-dialog', async (event, options = {}) => {
  const window = BrowserWindow.getFocusedWindow();
  const result = await dialog.showSaveDialog(window, {
    defaultPath: options.defaultPath,
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }]
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

ipcMain.handle('toggle-dev-tools', (event) => {
  const window = BrowserWindow.getFocusedWindow();
  if (window) {
    window.webContents.toggleDevTools();
  }
});

ipcMain.handle('run-yt-dlp', async (event, options) => {
  const {
    urls,
    downloadPath,
    format,
    mergeFormat,
    videoQuality,
    audioFormat,
    embedSubs,
    subLangs,
    embedThumbnail,
    embedMetadata,
    playlistStart,
    playlistEnd,
    ffmpegPath: ffmpegFolderPath,
    ytDlpPath: ytDlpFolderPath
  } = options;

  // Convert folder paths to full executable paths
  const ytDlpPath = ytDlpFolderPath ? path.join(ytDlpFolderPath, 'yt-dlp.exe') : 'yt-dlp';
  const ffmpegPath = ffmpegFolderPath ? path.join(ffmpegFolderPath, 'ffmpeg.exe') : null;

  console.log('Received options:', { downloadPath, ffmpegPath, ytDlpPath });
  console.log('YT-DLP folder path:', ytDlpFolderPath);
  console.log('YT-DLP full path:', ytDlpPath);
  console.log('FFmpeg folder path:', ffmpegFolderPath);
  console.log('FFmpeg full path:', ffmpegPath);

  let args = [];

  // Build format string based on video quality or custom format
  if (videoQuality && videoQuality !== 'best') {
    // Use video quality limit
    args.push('-f', `bestvideo[height<=${videoQuality}]+bestaudio/best[height<=${videoQuality}]/best`);
  } else if (format) {
    // Use custom format string
    args.push('-f', format);
  }

  // Add audio format conversion
  if (audioFormat && audioFormat !== 'none') {
    args.push('--audio-format', audioFormat);
  }

  // Add merge format
  if (mergeFormat) {
    args.push('--merge-output-format', mergeFormat);
  }

  // Add embed subtitles
  if (embedSubs) {
    args.push('--embed-subs');
    if (subLangs) {
      args.push('--sub-langs', subLangs);
    }
  }

  // Add embed thumbnail
  if (embedThumbnail) {
    args.push('--embed-thumbnail');
  }

  // Add embed metadata
  if (embedMetadata) {
    args.push('--embed-metadata');
  }

  // Add playlist start
  if (playlistStart && parseInt(playlistStart) > 0) {
    args.push('--playlist-start', playlistStart);
  }

  // Add playlist end
  if (playlistEnd && parseInt(playlistEnd) > 0) {
    args.push('--playlist-end', playlistEnd);
  }

  // Add ffmpeg location
  if (ffmpegPath) {
    console.log('Adding ffmpeg-location:', ffmpegPath);
    args.push('--ffmpeg-location', ffmpegPath);
  } else {
    console.log('No ffmpeg path provided');
  }

  // Add output directory
  if (downloadPath) {
    args.push('-o', path.join(downloadPath, '%(title)s.%(ext)s'));
  }

  // Add URLs
  args = args.concat(urls);

  console.log('YT-DLP command:', ytDlpPath, args.join(' '));
  console.log('Full ffmpeg path being used:', ffmpegPath || 'NOT SET');

  // Platform-specific terminal commands
  if (process.platform === 'win32') {
    // On Windows, create a temporary batch file and run it in a new console window
    // Only quote arguments that contain spaces
    const ytDlpCommand = `${ytDlpPath} ${args.map(arg => arg.includes(' ') || arg.includes('[') || arg.includes(']') ? `"${arg}"` : arg).join(' ')}`;
    // Escape % as %% for batch files
    // Use cd /d to change drive and directory, then run yt-dlp
    const batchContent = `@echo off\necho Starting YT-DLP...\ncd /d "${downloadPath}"\necho.\n${ytDlpCommand}\necho.\npause`.replace(/%/g, '%%');

    // Write batch file to temp directory
    const tempBatchPath = path.join(require('os').tmpdir(), 'yt-dlp-download.bat');
    fs.writeFileSync(tempBatchPath, batchContent, 'utf8');

    console.log('Batch file path:', tempBatchPath);
    console.log('Batch content:', batchContent);

    try {
      // Open the batch file in a new console window
      const child = spawn('cmd.exe', ['/c', 'start', 'YT-DLP Download', tempBatchPath], {
        cwd: downloadPath,
        shell: false,
        detached: true,
        stdio: 'ignore'
      });

      child.on('error', (err) => {
        console.error('YT-DLP child process error:', err);
      });

      child.unref();

      return { success: true };
    } catch (error) {
      console.error('Failed to spawn yt-dlp:', error);
      return { success: false, error: error.message };
    }
  } else if (process.platform === 'linux') {
    const command = 'gnome-terminal';
    const commandArgs = ['--', ytDlpPath].concat(args);
    
    try {
      const child = spawn(command, commandArgs, {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      return { success: true };
    } catch (error) {
      console.error('Failed to spawn yt-dlp:', error);
      return { success: false, error: error.message };
    }
  } else if (process.platform === 'darwin') {
    // On macOS, open Terminal.app
    const script = `tell application "Terminal" to do script "${ytDlpPath} ${args.join(' ')}"`;
    
    try {
      const child = spawn('osascript', ['-e', script], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      return { success: true };
    } catch (error) {
      console.error('Failed to spawn yt-dlp:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Fallback
  return { success: false, error: 'Unsupported platform' };
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

// Handle app before-quit to ensure data is saved
app.on('before-quit', (event) => {
  // Notify renderer to save any pending data
  const windows = BrowserWindow.getAllWindows();
  windows.forEach((win) => {
    win.webContents.send('app-before-quit');
  });
  // Note: We don't prevent default here as localStorage saves synchronously
});
