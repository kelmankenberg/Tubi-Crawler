# Tech Stack & Architecture

## Core
- **Electron** for cross-platform desktop packaging
- **Node.js** for backend logic and filesystem access
- **Puppeteer** for headless web crawling and data extraction

## Modules
- `axios` for direct HTTP/JSON API access (fallback mode)
- `fs` and `path` for output handling
- `chalk` for colored CLI logging (dev only)

## Folder Structure
```
/app
  ├── main.js
  ├── renderer.js
  ├── package.json
/docs
  ├── *.md
/output
  ├── *.txt
```
