const puppeteer = require('puppeteer');

async function crawl(url) {
  console.log('Crawling:', url);
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  // Scroll to attempt lazy load
  try {
    let previousHeight;
    while (true) {
      previousHeight = await page.evaluate('document.body.scrollHeight');
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForTimeout(1500);
      const newHeight = await page.evaluate('document.body.scrollHeight');
      if (newHeight === previousHeight) break;
    }
  } catch (e) {
    console.warn('Scrolling failed:', e && e.message);
  }

  // Try API
  let apiList = [];
  try {
    const seriesIdMatch = url.match(/series\/(\d+)/) || url.match(/tv-shows\/(\d+)/);
    const seriesId = seriesIdMatch ? seriesIdMatch[1] : null;
    if (seriesId) {
      const apiPath = `/uapi/series/${seriesId}/episodes`;
      const apiData = await page.evaluate(async (apiPath) => {
        try {
          const r = await fetch(apiPath, { credentials: 'same-origin' });
          if (!r.ok) return null;
          return await r.json();
        } catch (e) {
          return null;
        }
      }, apiPath);
      if (apiData) {
        const items = Array.isArray(apiData) ? apiData : (apiData.episodes || apiData.items || []);
        if (Array.isArray(items)) {
          apiList = items.map(it => {
            if (!it) return null;
            if (it.path) return it.path.startsWith('http') ? it.path : `https://tubitv.com${it.path}`;
            if (it.id) return `https://tubitv.com/watch/${it.id}`;
            if (it.url) return it.url.startsWith('http') ? it.url : `https://tubitv.com${it.url}`;
            return null;
          }).filter(Boolean);
        }
      }
    }
  } catch (e) {
    console.warn('API attempt failed:', e && e.message);
  }

  // Carousel selector
  const carousel = await page.evaluate(() => {
    const selector = 'div[data-test-id="web-ui-grid-item"] a[href^="/tv-shows/"]';
    const anchors = Array.from(document.querySelectorAll(selector));
    const seen = new Set();
    const out = [];
    anchors.forEach(a => {
      const h = a.getAttribute('href');
      if (!h) return;
      const full = h.startsWith('http') ? h : `https://tubitv.com${h}`;
      if (!seen.has(full)) {
        seen.add(full);
        out.push(full);
      }
    });
    return out;
  });

  // Generic anchors
  const anchors = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href^="/tv-shows/"]'));
    return anchors.map(a => {
      const h = a.getAttribute('href');
      return h ? (h.startsWith('http') ? h : `https://tubitv.com${h}`) : null;
    }).filter(Boolean);
  });

  await browser.close();

  const apiSet = new Set(apiList);
  const carouselSet = new Set(carousel);
  const anchorsSet = new Set(anchors);

  console.log('Counts:');
  console.log(' - API items:', apiList.length);
  console.log(' - Carousel items:', carousel.length);
  console.log(' - All anchor tv-shows items:', anchors.length);

  // Show some diffs
  const union = new Set([...apiSet, ...carouselSet, ...anchorsSet]);
  console.log(' - Union total unique items:', union.size);

  // List items if small
  const list = Array.from(union);
  console.log('\nSample URLs (first 50):');
  list.slice(0, 50).forEach((u, i) => console.log(`${i + 1}. ${u}`));

  return { apiList, carousel, anchors, unionCount: union.size };
}

if (require.main === module) {
  const url = process.argv[2] || 'https://tubitv.com/series/300005112/the-rifleman';
  crawl(url).then(res => {
    console.log('\nDone.');
    process.exit(0);
  }).catch(err => {
    console.error('Crawl failed:', err);
    process.exit(2);
  });
}
