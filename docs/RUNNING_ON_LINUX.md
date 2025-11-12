# Running / Building the App for Linux (from Windows)

This document explains how to develop, test, and produce Linux builds of the Tubi-Crawler Electron app from a Windows machine. You do not need a dedicated Linux machine — use WSL2, Docker, or CI. The guide covers quick local testing, packaging recommendations, and a sample GitHub Actions workflow.

## Recommended Approaches

- **WSL2 (recommended)**: Use WSL2 (Ubuntu) for local development and testing. On Windows 11, WSLg can display GUI apps directly. On Windows 10 use an X server (e.g., VcXsrv).
- **CI builds (recommended for releases)**: Use GitHub Actions (or another CI) to build AppImage/.deb artifacts on a Linux runner for consistent, reproducible releases.
- **Docker / VM**: Useful for headless or reproducible environments but GUI testing is more work.

## Quick Local Test With WSL (Ubuntu)

1. Install and enable WSL2 (one-time):

```powershell
# Run in an elevated PowerShell on Windows
wsl --install -d ubuntu
# Reboot if prompted
```

2. Open a WSL shell (Windows Terminal → Ubuntu) and cd into your project (Windows files are available under `/mnt/c/...`):

```bash
cd /mnt/c/dev/Tubi-Crawler
```

3. Install Node.js (recommended with nvm):

```bash
# Install nvm (if not already installed)
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.6/install.sh | bash
# Restart your shell or source nvm, then:
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install --lts
node -v
npm -v
```

4. Install dependencies and run the app in WSL:

```bash
npm install
npm start
```

- On **Windows 11 (WSLg)**: GUI windows from the Linux process should appear automatically on your desktop.
- On **Windows 10**: install an X server (e.g., VcXsrv) and set DISPLAY before `npm start`:

```bash
# Find Windows host IP from WSL and export DISPLAY
export DISPLAY=$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}'):0
npm start
```

## Packaging for Linux

To create distributables (AppImage, .deb, etc.), you must run the packager on Linux (WSL or CI). Recommended approaches:

- Build locally inside WSL and call your electron packager/electron-builder scripts.
- Or configure GitHub Actions to build artifacts on `ubuntu-latest` (preferred for releases).

### Example `package.json` script

Add an npm script to call `electron-builder`:

```json
"scripts": {
  "build-linux": "electron-builder --linux"
}
```

Make sure you have `electron-builder` configured in `package.json` or an `electron-builder.yml` file.

## Sample GitHub Actions Workflow (AppImage)

Create `.github/workflows/build-linux.yml` with this minimal example to build on tag push:

```yaml
name: Build Linux Electron App
on:
  push:
    tags:
      - 'v*'
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Build app
        run: npm run build-linux
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: linux-artifacts
          path: dist/*.AppImage
```

This will produce artifacts in `dist/` (configure `electron-builder` targets to match).

## Platform Differences & Gotchas

- `process.platform` checks: Your app already handles `win32` and `linux` branches; test the Linux branches to ensure they call available terminals (e.g., `gnome-terminal` may not be available on all systems).
- Path handling: Use Node's `path` utilities (already used in the repo). Avoid hard-coded Windows paths when possible.
- Native modules: If you use native Node modules they must be rebuilt for Linux — running `npm ci` inside WSL or CI avoids platform mismatch.
- GUI availability: WSLg on Windows 11 provides a smooth GUI experience. On Windows 10 you'll need an X server for desktop windows.

## Quick Diagnostics / Smoke Tests to Run in WSL

- Run `node -v` and `npm -v` in WSL
- Run `npm ci` and `npm start` — check for runtime errors in terminal
- Try the internal browser path and the BrowserView toolbar navigation

## Next Steps I Can Do For You

- (A) Add a GitHub Actions workflow to this repo (`.github/workflows/build-linux.yml`) to produce AppImage artifacts automatically.
- (B) Add `package.json` `electron-builder` config snippet or complete config for AppImage/DEB targets.
- (C) Add a `README` section describing how to run in WSL and build on CI.
- (D) Run automated checks in WSL to find Windows-only code paths and suggest fixes.

Tell me which of the above you'd like me to implement next and I will add the files and scripts in the repo.
