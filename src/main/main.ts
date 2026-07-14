import { BrowserWindow, app, dialog, globalShortcut, ipcMain } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EncodeJob, ShortcutAction } from '../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const isDev = devServerUrl !== undefined;
let mainWindow: BrowserWindow | null = null;
let zoomFactor = 1;

function zigEncoderPath(): string {
  const exe = process.platform === 'win32' ? 'zig-webm.exe' : 'zig-webm';
  return app.isPackaged
    ? path.join(process.resourcesPath, 'zig-webm', exe)
    : path.join(process.cwd(), 'zig-webm', 'zig-out', 'bin', exe);
}

function sendShortcut(action: ShortcutAction): void {
  mainWindow?.webContents.send('app:shortcut', action);
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 950,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0b1020',
    title: 'Cut and Convert Videos',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.webContents.setZoomFactor(zoomFactor);

  if (isDev) {
    await mainWindow.loadURL(devServerUrl!);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../render/index.html'));
  }
}

function registerShortcuts(): void {
  const shortcuts: Array<[string, ShortcutAction]> = [
    ['Space', 'toggle-playback'],
    ['Left', 'seek-backward'],
    ['Right', 'seek-forward'],
    ['CommandOrControl+N', 'open-video'],
    ['CommandOrControl+Q', 'queue-current'],
    ['CommandOrControl+E', 'start-encode'],
    ['CommandOrControl+=', 'zoom-in'],
    ['CommandOrControl+Plus', 'zoom-in'],
    ['CommandOrControl+-', 'zoom-out']
  ];

  for (const [accelerator, action] of shortcuts) {
    globalShortcut.register(accelerator, () => sendShortcut(action));
  }
}

ipcMain.handle('app:set-zoom', (event, delta: 1 | -1) => {
  zoomFactor = Math.min(2.5, Math.max(0.6, Number((zoomFactor + delta * 0.1).toFixed(2))));
  BrowserWindow.fromWebContents(event.sender)?.webContents.setZoomFactor(zoomFactor);
  return zoomFactor;
});

ipcMain.handle('media:open-video', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Adicionar vídeo',
    properties: ['openFile'],
    filters: [{ name: 'MP4', extensions: ['mp4'] }]
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  const inputPath = result.filePaths[0];
  return { path: inputPath, fileName: path.basename(inputPath), durationSeconds: 0 };
});

ipcMain.handle('encoder:start-batch', async (event, jobs: EncodeJob[]) => {
  for (const job of jobs) {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(zigEncoderPath(), [job.inputPath, job.outputPath], { stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', (chunk: Buffer) => {
        for (const line of chunk.toString().split('\n').filter(Boolean)) {
          event.sender.send('encoder:log', { jobId: job.id, message: line });
        }
      });
      child.stderr.on('data', (chunk: Buffer) => {
        event.sender.send('encoder:log', { jobId: job.id, message: chunk.toString() });
      });
      child.on('error', reject);
      child.on('close', code => (code === 0 ? resolve() : reject(new Error(`Encoder exited with ${code}`))));
    });
    event.sender.send('encoder:log', { jobId: job.id, message: 'Concluído' });
  }
  return { ok: true };
});

app.whenReady().then(async () => {
  await createWindow();
  registerShortcuts();
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) await createWindow();
});
