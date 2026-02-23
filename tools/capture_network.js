const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'https://tubitv.com/series/300005112/the-rifleman';
  console.log('Capturing network activity for', url);
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const hits = [];
  page.on('response', async (res) => {
    try {
      const u = res.url();
      if (/uapi|episodes|series|oz\/videos|videos\//i.test(u)) {
        let info = { url: u, status: res.status() };
        try {
          const ct = res.headers()['content-type'] || res.headers()['Content-Type'] || '';
          if (ct.includes('application/json')) {
            const json = await res.json();
            info.bodyType = 'json';
            // Don't store huge body, just keys/length
            if (Array.isArray(json)) info.json_summary = { length: json.length };
            else if (json && typeof json === 'object') info.json_summary = { keys: Object.keys(json).slice(0,10) };
          }
        } catch (e) {
          info.bodyFetchError = e.message;
        }
        hits.push(info);
        console.log('Captured:', u, 'status', res.status());
      }
    } catch (e) { /* ignore */ }
  });

  await page.goto(url, { waitUntil: 'networkidle2' });
  // allow extra time for dynamic loads
  await new Promise(res => setTimeout(res, 5000));

  console.log('\nCaptured hits:');
  hits.forEach((h, i) => console.log(`${i+1}. ${h.url}  status:${h.status}  ${h.json_summary ? JSON.stringify(h.json_summary) : ''}`));

  await browser.close();
})();
