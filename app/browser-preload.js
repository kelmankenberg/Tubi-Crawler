const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('internalBrowser', {
  sendCommand: (cmd, payload) => ipcRenderer.send('internal-browser-command', cmd, payload),
  onUrlUpdate: (fn) => ipcRenderer.on('browser-url-updated', (event, url) => fn(url)),
  insertCss: async (css) => {
    return ipcRenderer.invoke('browser-insert-css', css);
  },
  removeCss: async (key) => {
    return ipcRenderer.invoke('browser-remove-css', key);
  }
  ,
  onSetTheme: (fn) => ipcRenderer.on('set-theme', (event, theme) => fn(theme))
});
