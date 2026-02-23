const puppeteer = require('puppeteer');

async function run(url) {
  console.log('Crawling with carousel clicks:', url);
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  // initial anchors
  const getAnchors = async () => page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href^="/tv-shows/"]'));
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

  let anchors = await getAnchors();
  console.log('Initial anchors count:', anchors.length);

  // find carousel next controls
  const controlSelectors = [
    'div.web-carousel-shell__next',
    'div[class*="web-carousel-shell__next"]',
    '[class*="web-carousel-shell__next"]',
    '[class*="web-carousel-shell__control"]',
    '[class*="carousel"] [class*="next"]'
  ];

  const seenControls = await page.evaluate((controlSelectors) => {
    const found = new Set();
    controlSelectors.forEach(sel => {
      const els = Array.from(document.querySelectorAll(sel));
      els.forEach(e => found.add(sel));
    });
    return Array.from(found);
  }, controlSelectors);

  console.log('Control selectors that exist:', seenControls);

  // Now try clicking on an element that looks like "next"
  let clickedAny = false;
  for (let sel of ['div.web-carousel-shell__next', 'div[class*="web-carousel-shell__next"]', '[class*="web-carousel-shell__next"]', '[aria-label="Next"]', '[data-test-id="web-carousel-next"]', '.web-carousel-shell__next']) {
    const exists = await page.$(sel);
    if (exists) {
      console.log('Using selector to click:', sel);
      // Click repeatedly until anchors stop increasing
      for (let i = 0; i < 10; i++) {
        try {
          await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) el.click();
          }, sel);
        } catch (e) { /* ignore */ }
        await new Promise(r => setTimeout(r, 1000));
        const newAnchors = await getAnchors();
        if (newAnchors.length > anchors.length) {
          console.log('Anchors grew:', anchors.length, '->', newAnchors.length);
          anchors = newAnchors;
          clickedAny = true;
        } else {
          console.log('No increase after click iteration', i+1);
          break;
        }
      }
      if (clickedAny) break;
    }
  }

  console.log('Final anchors count:', anchors.length);
  anchors.slice(0, 100).forEach((u, i) => console.log(`${i+1}. ${u}`));

  await browser.close();
  return anchors;
}

if (require.main === module) {
  const url = process.argv[2] || 'https://tubitv.com/series/300005112/the-rifleman';
  run(url).then(()=>process.exit(0)).catch(e=>{console.error(e); process.exit(2);});
}
