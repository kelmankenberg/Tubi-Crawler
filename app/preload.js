const { contextBridge, ipcRenderer } = require('electron');

// Expose safe IPC methods to renderer process
contextBridge.exposeInMainWorld('electron', {
  // Invoke methods (request-response pattern)
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  
  // Send methods (fire-and-forget)
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  
  // On methods (listen for events)
  on: (channel, listener) => ipcRenderer.on(channel, listener),
  
  // Once method (listen for single event)
  once: (channel, listener) => ipcRenderer.once(channel, listener),
  
  // Remove listener
  removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener),
});
