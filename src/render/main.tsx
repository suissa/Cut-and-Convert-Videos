import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Film, FolderOpen, Pause, Play, Plus, Save, StepBack, StepForward, Upload } from 'lucide-react';
import type { EncodeJob, MediaMetadata } from '../shared/types';
import './styles.css';

function formatTime(value: number): string {
  const minutes = Math.floor(value / 60).toString().padStart(2, '0');
  const seconds = Math.floor(value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function webmOutputPath(inputPath: string): string {
  return inputPath.replace(/\.mp4$/i, '.webm');
}

function fileLabel(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [media, setMedia] = useState<MediaMetadata | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [duration, setDuration] = useState(1);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [queue, setQueue] = useState<EncodeJob[]>([]);
  const [log, setLog] = useState<string[]>([]);

  const openVideo = useCallback(async () => {
    const selected = await window.appApi.openVideo();
    if (!selected) return;
    setMedia(selected);
    setSourceUrl(`file://${selected.path}`);
    setCurrent(0);
  }, []);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play(); else video.pause();
  }, []);

  const seek = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(duration, Math.max(0, video.currentTime + delta));
  }, [duration]);

  const addToQueue = useCallback(() => {
    if (!media) return;
    setQueue(items => [...items, {
      id: crypto.randomUUID(),
      inputPath: media.path,
      outputPath: webmOutputPath(media.path)
    }]);
  }, [media]);

  const startEncode = useCallback(async () => {
    if (queue.length === 0) return;
    setLog(items => [`Iniciando conversão VP9 de ${queue.length} arquivo(s)...`, ...items]);
    await window.appApi.startBatch(queue);
  }, [queue]);

  useEffect(() => window.appApi.onShortcut(action => {
    if (action === 'toggle-playback') togglePlayback();
    if (action === 'seek-backward') seek(-1);
    if (action === 'seek-forward') seek(1);
    if (action === 'open-video') void openVideo();
    if (action === 'queue-current') addToQueue();
    if (action === 'start-encode') void startEncode();
    if (action === 'zoom-in') void window.appApi.setZoom(1);
    if (action === 'zoom-out') void window.appApi.setZoom(-1);
  }), [addToQueue, openVideo, seek, startEncode, togglePlayback]);

  useEffect(() => window.appApi.onEncodeLog(entry => {
    setLog(items => [`${entry.jobId.slice(0, 8)}: ${entry.message.trim()}`, ...items].slice(0, 10));
  }), []);

  return <main className="min-h-screen bg-[#f3f3f3] text-[#1f1f1f] antialiased">
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-14 items-center justify-between border-b border-[#d8d8d8] bg-white px-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0078d4] text-white"><Film size={18}/></div>
          <div>
            <h1 className="text-sm font-semibold">Editor de vídeo</h1>
            <p className="text-[11px] text-[#5f5f5f]">Projeto sem título · MVP WebM VP9</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="win-ghost-btn"><Save size={16}/> Salvar projeto</button>
          <button className="win-primary-btn" onClick={startEncode}>Ctrl+E Concluir vídeo</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-72 flex-col border-r border-[#d8d8d8] bg-white">
          <div className="border-b border-[#e5e5e5] p-4">
            <h2 className="text-sm font-semibold">Biblioteca do projeto</h2>
            <p className="mt-1 text-xs text-[#666]">Adicione MP4s e envie para o storyboard.</p>
            <button onClick={openVideo} className="win-primary-btn mt-4 w-full justify-center"><Upload size={16}/> Ctrl+N Adicionar</button>
          </div>
          <div className="flex-1 overflow-auto p-3">
            {media ? <div className="media-card">
              <div className="flex h-20 items-center justify-center rounded bg-[#e8f2fb] text-[#0078d4]"><Film size={28}/></div>
              <div className="mt-2 truncate text-xs font-medium">{media.fileName}</div>
              <button className="win-ghost-btn mt-3 w-full justify-center" onClick={addToQueue}><Plus size={15}/> Ctrl+Q Storyboard</button>
            </div> : <div className="empty-card"><FolderOpen size={28}/><span>Nenhum MP4 carregado</span></div>}
          </div>
          <div className="border-t border-[#e5e5e5] p-3 text-[11px] text-[#666]">Sem resize, VP8, AV1, progresso ou áudio no MVP.</div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-[#fafafa]">
          <div className="flex flex-1 min-h-0 gap-4 p-5">
            <div className="flex min-w-0 flex-1 flex-col rounded-sm border border-[#d8d8d8] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3">
                <h2 className="text-sm font-semibold">Pré-visualização</h2>
                <span className="rounded bg-[#f2f2f2] px-2 py-1 text-[11px] text-[#555]">MP4 → WebM VP9</span>
              </div>
              <div className="flex flex-1 items-center justify-center bg-[#111]">
                {sourceUrl ? <video ref={videoRef} src={sourceUrl} className="max-h-full max-w-full" onLoadedMetadata={e => setDuration(e.currentTarget.duration || 1)} onTimeUpdate={e => setCurrent(e.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} /> : <div className="text-sm text-[#aaa]">Abra um MP4 para visualizar</div>}
              </div>
              <div className="border-t border-[#e5e5e5] bg-white px-4 py-3">
                <div className="flex items-center justify-center gap-3">
                  <button className="win-round-btn" onClick={() => seek(-1)}><StepBack size={18}/></button>
                  <button className="win-play-btn" onClick={togglePlayback}>{playing ? <Pause size={20}/> : <Play size={20}/>}</button>
                  <button className="win-round-btn" onClick={() => seek(1)}><StepForward size={18}/></button>
                  <span className="ml-3 font-mono text-xs text-[#555]">{formatTime(current)} / {formatTime(duration)}</span>
                </div>
              </div>
            </div>

            <aside className="w-80 rounded-sm border border-[#d8d8d8] bg-white shadow-sm">
              <div className="border-b border-[#e5e5e5] px-4 py-3"><h2 className="text-sm font-semibold">Configurações de vídeo</h2></div>
              <div className="space-y-4 p-4 text-sm">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#666]">Formato</label>
                  <div className="mt-2 rounded border border-[#d8d8d8] bg-[#f8f8f8] p-3">WebM · VP9</div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#666]">Encoder</label>
                  <div className="mt-2 rounded border border-[#d8d8d8] bg-[#f8f8f8] p-3">FFmpeg / libvpx-vp9</div>
                </div>
                <div className="rounded border border-[#d8d8d8] bg-[#f8f8f8] p-3 text-xs text-[#555]">Fluxo do MVP: demux MP4, decode de vídeo, encode VP9 e mux WebM. O áudio será uma evolução posterior.</div>
                <h3 className="text-sm font-semibold">Log</h3>
                <div className="max-h-48 space-y-1 overflow-auto rounded border border-[#d8d8d8] bg-[#111] p-3 font-mono text-[11px] text-[#d6f5d6]">{log.length === 0 ? <p>Sem eventos.</p> : log.map((line, i) => <p key={i}>{line}</p>)}</div>
              </div>
            </aside>
          </div>

          <section className="border-t border-[#d8d8d8] bg-white">
            <div className="flex items-center justify-between border-b border-[#e5e5e5] px-5 py-3">
              <h2 className="text-sm font-semibold">Storyboard</h2>
              <span className="text-xs text-[#666]">{queue.length} item(ns) na fila</span>
            </div>
            <div className="flex h-36 gap-3 overflow-x-auto p-4">
              {queue.length === 0 ? <button onClick={addToQueue} className="storyboard-empty"><Plus size={22}/> Adicionar vídeo ao storyboard</button> : queue.map((job, index) => <div className="storyboard-tile" key={job.id}>
                <div className="flex h-20 items-center justify-center rounded-sm bg-[#e8f2fb] text-[#0078d4]"><Film size={28}/></div>
                <div className="mt-2 text-[11px] font-semibold">Cena {index + 1}</div>
                <div className="truncate text-[11px] text-[#666]">{fileLabel(job.outputPath)}</div>
              </div>)}
            </div>
          </section>
        </section>
      </div>
    </div>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
