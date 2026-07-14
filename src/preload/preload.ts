import { contextBridge, ipcRenderer } from 'electron';
import type { AppApi, EncodeJob, EncodeLog, ShortcutAction } from '../shared/types.js';

const api: AppApi = {
  openVideo: () => ipcRenderer.invoke('media:open-video'),
  startBatch: (jobs: EncodeJob[]) => ipcRenderer.invoke('encoder:start-batch', jobs),
  onEncodeLog: (callback: (log: EncodeLog) => void) => {
    const listener = (_: Electron.IpcRendererEvent, log: EncodeLog) => callback(log);
    ipcRenderer.on('encoder:log', listener);
    return () => ipcRenderer.off('encoder:log', listener);
  },
  onShortcut: (callback: (action: ShortcutAction) => void) => {
    const listener = (_: Electron.IpcRendererEvent, action: ShortcutAction) => callback(action);
    ipcRenderer.on('app:shortcut', listener);
    return () => ipcRenderer.off('app:shortcut', listener);
  },
  setZoom: (delta: 1 | -1) => ipcRenderer.invoke('app:set-zoom', delta)
};

contextBridge.exposeInMainWorld('appApi', api);
