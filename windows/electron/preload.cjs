const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  list: () => ipcRenderer.invoke('library:list'),
  importScore: () => ipcRenderer.invoke('library:import'),
  exercise: () => ipcRenderer.invoke('library:exercise'),
  save: (project) => ipcRenderer.invoke('library:save', project),
  settings: () => ipcRenderer.invoke('worker:settings'),
  saveSettings: (url, token) => ipcRenderer.invoke('worker:settings-save', url, token),
  recognize: (id, submit) => ipcRenderer.invoke('worker:recognize', id, submit),
  review: (id, accept) => ipcRenderer.invoke('worker:review', id, accept),
  microphone: (armed) => ipcRenderer.invoke('microphone:arm', armed),
  onAudioInterrupted: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('audio:interrupted', handler);
    return () => ipcRenderer.removeListener('audio:interrupted', handler);
  },
});
