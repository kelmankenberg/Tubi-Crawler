const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'https://tubitv.com/series/300005112/the-rifleman';
  console.log('Inspecting DOM for carousel controls on', url);
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  // Attempt to find carousel containers and controls
  const info = await page.evaluate(() => {
    const results = [];
    const carousels = Array.from(document.querySelectorAll('[class*="carousel"], [data-test-id="web-ui-grid-item"]')).slice(0,50);
    carousels.forEach((c, idx) => {
      const cls = c.className || c.getAttribute('class') || '';
      const dataTest = c.getAttribute('data-test-id') || '';
      const buttons = Array.from(c.querySelectorAll('button, a[role="button"], [role="button"]'))
        .map(b => ({ tag: b.tagName, class: b.className, text: b.innerText && b.innerText.trim(), ariaLabel: b.getAttribute('aria-label') }));
      results.push({ idx, cls, dataTest, buttonsCount: buttons.length, buttons });
    });

    // Also look for global carousel controls
    const globalButtons = Array.from(document.querySelectorAll('button, [role="button"]'))
      .filter(b => (b.className || '').toLowerCase().includes('carousel') || (b.getAttribute('aria-label') || '').toLowerCase().includes('carousel') || (b.getAttribute('aria-label') || '').toLowerCase().includes('next') || (b.getAttribute('aria-label') || '').toLowerCase().includes('previous'))
      .slice(0,50)
      .map(b => ({ tag: b.tagName, class: b.className, ariaLabel: b.getAttribute('aria-label'), text: b.innerText && b.innerText.trim() }));

    return { carouselsCount: carousels.length, carousels: results, globalButtons: globalButtons };
  });

  // Also try to find any elements that look like next/prev controls by class name
  const controls = await page.evaluate(() => {
    const sels = ['[class*="next"]', '[class*="prev"]', '[class*="arrow"]', '[class*="chev"]', '[class*="chevron"]', '[class*="slick"]', '[class*="control"]'];
    const elems = [];
    sels.forEach(s => {
      const found = Array.from(document.querySelectorAll(s));
      found.forEach(e => elems.push({ tag: e.tagName, class: e.className, aria: e.getAttribute('aria-label'), text: e.innerText && e.innerText.trim() }));
    });
    return elems.slice(0,50);
  });

  console.log('\nCandidate control elements (by class heuristics):', controls.length);
  controls.forEach((c, i) => console.log(` ${i+1}. tag=${c.tag} class=${c.class} aria=${c.aria} text="${c.text}"`));

  console.log('Found carousels:', info.carouselsCount);
  info.carousels.slice(0,10).forEach(c => {
    console.log('\nCarousel idx', c.idx, 'class:', c.cls, 'data-test-id:', c.dataTest, 'buttons:', c.buttonsCount);
    c.buttons.forEach((b, i) => console.log('  btn', i, b));
  });

  console.log('\nGlobal candidate buttons (next/prev/carousel):', info.globalButtons.length);
  info.globalButtons.forEach((b, i) => console.log(` ${i+1}. tag=${b.tag} class=${b.class} aria=${b.ariaLabel} text="${b.text}"`));

  await browser.close();
})();
