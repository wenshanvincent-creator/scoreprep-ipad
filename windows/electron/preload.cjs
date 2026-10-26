const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  list: () => ipcRenderer.invoke('library:list'),
  importScore: (instrument) => ipcRenderer.invoke('library:import', instrument),
  exercise: (instrument) => ipcRenderer.invoke('library:exercise', instrument),
  save: (project) => ipcRenderer.invoke('library:save', project),
  recognize: (id) => ipcRenderer.invoke('library:recognize', id),
  microphone: (armed) => ipcRenderer.invoke('microphone:arm', armed),
  onAudioInterrupted: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('audio:interrupted', handler);
    return () => ipcRenderer.removeListener('audio:interrupted', handler);
  },
});
