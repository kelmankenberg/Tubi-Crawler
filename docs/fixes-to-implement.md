# Code Fixes and Performance Enhancements Implementation Plan

## Overview
This document outlines identified issues in the Tubi Crawler codebase and prioritized fixes to address security vulnerabilities, memory leaks, performance bottlenecks, and code quality improvements.

---

## Priority 1: Security Vulnerabilities (CRITICAL)

### 1.1 Fix Insecure IPC Context in Main Window (app/main.js, lines 36-39)

**Issue:**
```javascript
webPreferences: {
  nodeIntegration: true,
  contextIsolation: false
}
```
This allows the renderer process direct access to Node.js APIs, bypassing security boundaries. Any XSS vulnerability in the UI becomes a full code execution vulnerability.

**Impact:** CRITICAL - Arbitrary code execution risk

**Fix Steps:**
1. Change configuration to secure defaults:
   ```javascript
   webPreferences: {
     nodeIntegration: false,
     contextIsolation: true,
     preload: path.join(__dirname, 'preload.js')
   }
   ```

2. Update `preload.js` to expose only required IPC methods:
   ```javascript
   const { contextBridge, ipcRenderer } = require('electron');

   contextBridge.exposeInMainWorld('electron', {
     invoke: ipcRenderer.invoke,
     on: ipcRenderer.on,
     send: ipcRenderer.send,
     // List each specific handler needed instead of exposing all
   });
   ```

3. Update `renderer.js` to use the exposed API:
   - Replace all `ipcRenderer.invoke()` calls with `window.electron.invoke()`
   - Replace all `ipcRenderer.on()` calls with `window.electron.on()`
   - Replace all `ipcRenderer.send()` calls with `window.electron.send()`

**File Changes Required:**
- `app/main.js` - lines 36-39
- `app/preload.js` - rewrite with context bridge
- `app/renderer.js` - update all ipcRenderer calls (lines 1, 174, 188, 234, 248, 252, 256, 269, 272, 306-309, 358, 364, 407-420)

**Testing:**
- Verify app still launches
- Test all buttons: Crawl, Open, Save, Copy, Paste, Delete
- Test window controls: Minimize, Maximize, Close
- Test settings modal interactions
- Verify browser opens correctly

**Estimated Effort:** 45 minutes

---

## Priority 2: Memory Leaks & Resource Cleanup (HIGH)

### 2.1 Add Timeout and Cleanup to Puppeteer Browser Instance (app/main.js, lines 136-305)

**Issue:**
- Browser instance created with no timeout protection (line 140)
- If `page.goto()` hangs, browser remains open indefinitely
- No error recovery between scroll attempts

**Impact:** HIGH - Accumulating zombie processes, resource exhaustion

**Fix Steps:**
1. Add constants at top of `crawl` handler:
   ```javascript
   const BROWSER_TIMEOUT = 60000; // 60 seconds
   const GOTO_TIMEOUT = 30000;    // 30 seconds
   const PAGE_LOAD_TIMEOUT = 30000; // 30 seconds
   ```

2. Wrap entire handler in try-finally:
   ```javascript
   ipcMain.handle('crawl', async (event, url) => {
     let browser;
     try {
       browser = await puppeteer.launch();
       // ... existing crawl logic ...
     } catch (error) {
       console.error('Crawl error:', error);
       throw error;
     } finally {
       if (browser) {
         try {
           await browser.close();
         } catch (e) {
           console.error('Failed to close browser:', e);
         }
       }
     }
   });
   ```

3. Update `page.goto()` call (line 144):
   ```javascript
   await page.goto(url, { 
     waitUntil: 'networkidle2',
     timeout: GOTO_TIMEOUT
   });
   ```

4. Add timeouts to page operations:
   ```javascript
   page.setDefaultTimeout(PAGE_LOAD_TIMEOUT);
   page.setDefaultNavigationTimeout(PAGE_LOAD_TIMEOUT);
   ```

**File Changes Required:**
- `app/main.js` - lines 136-145, 303-305

**Testing:**
- Test with valid Tubi URL
- Test with unreachable URL (should timeout gracefully)
- Test with slow network (should not hang indefinitely)
- Monitor process count before/after crawl

**Estimated Effort:** 30 minutes

---

### 2.2 Prevent Memory Accumulation in Scroll Loop (app/main.js, lines 150-168)

**Issue:**
- 2-second wait between scrolls is excessive and multiplies with page size
- No early exit condition if scroll height stops changing
- Can take minutes for large pages

**Impact:** MEDIUM - Poor UX for large series

**Fix Steps:**
1. Add tuning constants:
   ```javascript
   const SCROLL_WAIT = 500; // Reduce from 2000ms
   const SCROLL_MAX_ATTEMPTS = 20; // Hard limit
   const SCROLL_TIMEOUT = 30000; // Total timeout for scrolling
   ```

2. Rewrite scroll loop:
   ```javascript
   let previousHeight = 0;
   let scrollAttempts = 0;
   const scrollStartTime = Date.now();

   while (scrollAttempts < SCROLL_MAX_ATTEMPTS) {
     if (Date.now() - scrollStartTime > SCROLL_TIMEOUT) {
       console.warn('Scroll timeout reached');
       break;
     }

     previousHeight = await page.evaluate(() => document.body.scrollHeight);
     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
     await new Promise(r => setTimeout(r, SCROLL_WAIT));

     const newHeight = await page.evaluate(() => document.body.scrollHeight);
     if (newHeight === previousHeight) {
       break; // No new content loaded
     }
     scrollAttempts++;
   }
   ```

**File Changes Required:**
- `app/main.js` - lines 150-168

**Testing:**
- Test with series having few episodes (should exit quickly)
- Test with series having many episodes (should complete in <10s)
- Verify all episodes are still loaded

**Estimated Effort:** 20 minutes

---

## Priority 3: Performance Optimizations (MEDIUM)

### 3.1 Optimize Episode Data Extraction Strategy (app/main.js, lines 176-230)

**Issue:**
- API call attempted after DOM scraping (inefficient ordering)
- Multiple overlapping DOM queries (lines 271-300)
- Better to try API-first since it's faster and more reliable

**Impact:** MEDIUM - 1-3 second speedup per crawl

**Fix Steps:**
1. Reorder extraction attempts: API first, then DOM:
   ```javascript
   let episodeUrls = [];

   // Try 1: API first (fastest, most reliable)
   try {
     episodeUrls = await tryApiExtraction(page);
     if (episodeUrls && episodeUrls.length > 0) {
       console.log(`Found ${episodeUrls.length} episodes via API`);
       return episodeUrls;
     }
   } catch (e) {
     console.warn('API extraction failed:', e.message);
   }

   // Try 2: DOM extraction (fallback)
   try {
     episodeUrls = await tryDomExtraction(page);
     if (episodeUrls && episodeUrls.length > 0) {
       console.log(`Found ${episodeUrls.length} episodes via DOM`);
       return episodeUrls;
     }
   } catch (e) {
     console.warn('DOM extraction failed:', e.message);
   }

   return episodeUrls;
   ```

2. Extract API logic into helper function `tryApiExtraction()`:
   ```javascript
   async function tryApiExtraction(page) {
     let seriesId = // ... existing code from lines 178-197 ...
     if (!seriesId) return [];
     
     const apiData = await page.evaluate(async (apiPath) => {
       // ... existing code from lines 202-210 ...
     }, `/uapi/series/${seriesId}/episodes`);

     if (!apiData) return [];
     // ... existing code from lines 214-224 ...
     return episodeUrls;
   }
   ```

3. Extract DOM logic into helper function `tryDomExtraction()`:
   - Move carousel interaction (lines 235-269)
   - Move DOM selector queries (lines 271-300)
   - Move other URL collection (lines 294-300)

**File Changes Required:**
- `app/main.js` - refactor lines 176-230 into separate functions

**Testing:**
- Test with series that has API data (should return quickly)
- Test with series that requires DOM fallback
- Verify episode counts match between methods
- Measure time difference

**Estimated Effort:** 60 minutes

---

### 3.2 Consolidate Redundant DOM Queries (app/main.js, lines 271-300)

**Issue:**
- Same DOM selectors queried multiple times
- Carousel navigation queries run after DOM extraction already found items
- Multiple passes over the same elements

**Impact:** MEDIUM - 500ms-2s speedup

**Fix Steps:**
1. Perform carousel interaction BEFORE DOM extraction:
   ```javascript
   // First, interact with carousels to load more items
   await interactWithCarousels(page);
   
   // Then do a single comprehensive DOM extraction
   const episodeUrls = await extractEpisodesFromDom(page);
   ```

2. Create single consolidated selector query:
   ```javascript
   async function extractEpisodesFromDom(page) {
     const allUrls = await page.evaluate(() => {
       const selectors = [
         'div[data-test-id="web-ui-grid-item"] a[href^="/tv-shows/"]',
         'a[href^="/tv-shows/"]', // Broader fallback
         'a[href^="/series/"]'    // Alternative path
       ];

       const seen = new Set();
       const urls = [];

       for (const selector of selectors) {
         document.querySelectorAll(selector).forEach(a => {
           try {
             const href = a.getAttribute('href');
             if (!href) return;
             const full = href.startsWith('http') ? href : `https://tubitv.com${href}`;
             if (!seen.has(full)) {
               seen.add(full);
               urls.push(full);
             }
           } catch (e) {}
         });
       }
       return urls;
     });
     return allUrls;
   }
   ```

**File Changes Required:**
- `app/main.js` - refactor lines 235-300

**Testing:**
- Test with multi-carousel series
- Verify all episodes captured
- Measure DOM query time reduction

**Estimated Effort:** 40 minutes

---

## Priority 4: Code Quality & Maintainability (LOW)

### 4.1 Remove Debug Logging (app/main.js, multiple lines)

**Issue:**
- Lines 1-2: Aggressive startup logs
- Line 138: "Crawling" log (can stay, but reduce verbosity)
- Lines 260-265, 482: Diagnostic console logs

**Impact:** LOW - Cleaner output, easier debugging

**Fix Steps:**
1. Remove lines 1-2:
   ```javascript
   console.log('MAIN PROCESS IS ALIVE');
   console.log('app/main.js started loading.');
   ```

2. Keep line 138 but simplify:
   ```javascript
   console.log(`Crawling: ${url}`);
   ```

3. Remove lines 260-265 in renderer.js:
   ```javascript
   console.log('Open Browser button clicked.');
   console.log('Preferred Browser setting:', preferredBrowser);
   ```

4. Remove line 482 in main.js

**File Changes Required:**
- `app/main.js` - lines 1-2, 138, 482
- `app/renderer.js` - lines 260-265

**Testing:**
- Launch app, verify console is clean
- Crawl URL, verify only essential logs appear

**Estimated Effort:** 5 minutes

---

### 4.2 Fix Variable Shadowing in yt-dlp Handler (app/main.js, line 408)

**Issue:**
```javascript
const { shell } = require('electron'); // line 3
// ...
ipcMain.handle('run-yt-dlp', async (event, options) => {
  // ...
  let shell = true; // line 408 - shadows the require'd shell module!
```

**Impact:** LOW - Potential bug if shell module needs to be used in this handler

**Fix Steps:**
1. Rename local variable:
   ```javascript
   let useShell = true; // Renamed from `shell`
   // ...
   const child = spawn(command, commandArgs, {
     cwd: downloadPath,
     detached: true,
     shell: useShell,  // Updated reference
     stdio: 'ignore'
   });
   ```

2. Update all references to `shell` variable in handler (lines 408, 429, 439, 445, 453)

**File Changes Required:**
- `app/main.js` - lines 408, 429, 439, 445, 453

**Testing:**
- Test yt-dlp download on all platforms (Windows, Linux, macOS)
- Verify commands execute correctly

**Estimated Effort:** 15 minutes

---

### 4.3 Improve Windows yt-dlp Command Construction (app/main.js, lines 410-429)

**Issue:**
- Complex, fragile quoting for Windows PowerShell
- Comments suggest multiple attempts without clear solution
- Could break with spaces or special characters in paths

**Impact:** LOW - Edge cases may fail on Windows

**Fix Steps:**
1. Simplify Windows handling by building argument list properly:
   ```javascript
   if (process.platform === 'win32') {
     // On Windows, spawn yt-dlp directly with properly quoted arguments
     command = 'yt-dlp';
     commandArgs = args;
     shell = false; // Let Node handle escaping
   } else if (process.platform === 'linux') {
     // Try common terminal emulators in order
     const terminals = ['gnome-terminal', 'xterm', 'konsole'];
     let found = false;
     for (const terminal of terminals) {
       try {
         command = terminal;
         commandArgs = ['--', ytDlpPath].concat(args);
         found = true;
         break;
       } catch (e) {}
     }
     if (!found) {
       // Fallback to direct spawn
       command = ytDlpPath;
       commandArgs = args;
     }
   } else if (process.platform === 'darwin') {
     command = ytDlpPath;
     commandArgs = args;
   }
   ```

2. Remove confusing comments (lines 411-426)

**File Changes Required:**
- `app/main.js` - lines 410-446

**Testing:**
- Test on Windows with paths containing spaces
- Test on Linux with various terminal emulators
- Test on macOS

**Estimated Effort:** 25 minutes

---

## Implementation Order & Timeline

| Phase | Priority | Tasks | Est. Time | Blocking |
|-------|----------|-------|-----------|----------|
| 1 | CRITICAL | 1.1 (Security) | 45 min | Yes - do first |
| 2 | HIGH | 2.1 + 2.2 (Memory) | 50 min | Yes - resource stability |
| 3 | MEDIUM | 3.1 + 3.2 (Performance) | 100 min | No - nice to have |
| 4 | LOW | 4.1 + 4.2 + 4.3 (Quality) | 45 min | No - polish |

**Suggested Execution:**
1. Start with Priority 1 (Security) - must be done
2. Complete Priority 2 (Memory) - prevents production issues
3. Tackle Priority 3 (Performance) if user experience matters
4. Polish with Priority 4 (Quality) at end

**Total Estimated Effort:** ~240 minutes (~4 hours)

---

## Testing Checklist

After implementing each fix, verify:

### Core Functionality
- [ ] App launches without errors
- [ ] Crawl button works with valid Tubi URL
- [ ] Episode data extraction succeeds
- [ ] Save file functionality works
- [ ] Copy/paste clipboard operations work
- [ ] Window controls (minimize, maximize, close) work

### Security
- [ ] App functions without `nodeIntegration: true`
- [ ] No console errors related to IPC
- [ ] Preload script properly restricts API

### Performance
- [ ] Crawl completes in <15 seconds for typical series
- [ ] No zombie browser processes after crawl
- [ ] Memory usage returns to baseline after crawl
- [ ] Large series (100+ episodes) complete in <30 seconds

### Cross-Platform
- [ ] Windows: yt-dlp download works
- [ ] Linux: Terminal opens correctly for downloads
- [ ] macOS: Terminal handling works

---

## Rollback Plan

Each fix is self-contained and can be reverted independently:
- Commit each Priority level separately
- Tag checkpoint after Priority 1 (security)
- Tag checkpoint after Priority 2 (stability)

---

## Notes

- Prioritization based on: Security > Stability > Performance > Code Quality
- All fixes maintain backward compatibility with current API/UI
- No breaking changes to IPC interfaces (after security fix, will need preload rewrite)
- Consider adding integration tests for crawl handler to prevent regression
