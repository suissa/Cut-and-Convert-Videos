# HOW TO USE — criando um app desktop com este projeto

Este guia explica como usar este repositório como base para criar um app desktop de conversão de vídeo com Electron, React, TypeScript e o encoder nativo `zig-webm`.

## 1. O que este projeto entrega

Este projeto já vem com:

- **Electron Main Process** em `src/main/main.ts` para criar a janela, registrar atalhos, abrir arquivos e chamar o encoder nativo.
- **Preload seguro** em `src/preload/preload.ts` usando `contextBridge` para expor uma API controlada ao renderer.
- **Renderer React + TypeScript** em `src/render/` com interface em estilo editor de vídeos do Windows.
- **Tipos compartilhados** em `src/shared/types.ts`.
- **Parsers HTML/CSS** em `src/shared/parsers/`.
- **Encoder nativo Zig** em `zig-webm/` para converter `input.mp4` em `output.webm` usando FFmpeg/libvpx-vp9.

## 2. Pré-requisitos

Instale no Windows:

1. **Node.js 20+**.
2. **npm** incluído com o Node.js.
3. **Zig** compatível com `build.zig.zon`.
4. **FFmpeg development libraries** disponíveis para linkagem do Zig:
   - `avcodec`
   - `avformat`
   - `avutil`
   - `swscale`
5. As DLLs do FFmpeg correspondentes ao build devem ser distribuídas junto ao app final.

> Se você só quiser trabalhar na interface Electron/React, Zig e FFmpeg não são necessários imediatamente. Eles só são necessários para `npm run zig:build` e para conversões reais.

## 3. Instalação do projeto

Na raiz do repositório:

```bash
npm install
```

Isso instala Electron, React, Vite, TailwindCSS, TypeScript, Lucide Icons e ferramentas de teste.

## 4. Rodando o app em desenvolvimento

```bash
npm run dev
```

Esse comando:

1. Inicia o Vite para servir o renderer React.
2. Espera a porta `5173` ficar disponível.
3. Compila o processo Main/Preload do Electron.
4. Abre o Electron apontando para o servidor Vite.

## 5. Estrutura principal

```text
src/
├── main/
│   └── main.ts          # Janela Electron, IPC, atalhos e chamada do encoder
├── preload/
│   └── preload.ts       # API segura exposta ao renderer
├── render/
│   ├── index.html       # HTML de entrada do Vite
│   ├── main.tsx         # Interface React
│   ├── styles.css       # Estilos Tailwind/CSS do app
│   └── vite-env.d.ts    # Tipos globais do renderer
└── shared/
    ├── types.ts         # Contratos TypeScript entre main/preload/renderer
    └── parsers/         # Parsers HTML e CSS

zig-webm/
├── build.zig
├── build.zig.zon
└── src/
    ├── main.zig         # CLI: zig-webm input.mp4 output.webm
    ├── ffmpeg.zig       # Imports C do FFmpeg
    └── encoder.zig      # Fluxo MP4 -> decode -> VP9 -> WebM
```

## 6. Como o app desktop funciona

### 6.1 Renderer

A interface fica em `src/render/main.tsx`.

Ela controla:

- abertura visual do vídeo selecionado;
- preview com `<video>`;
- play/pause e seek de 1 segundo;
- storyboard/fila;
- painel de configuração informativo;
- logs recebidos do encoder.

### 6.2 Preload

O arquivo `src/preload/preload.ts` expõe `window.appApi` para o renderer.

A API disponível é:

```ts
window.appApi.openVideo();
window.appApi.startBatch(jobs);
window.appApi.onEncodeLog(callback);
window.appApi.onShortcut(callback);
window.appApi.setZoom(delta);
```

Use essa ponte para adicionar novas ações sem ativar `nodeIntegration` no renderer.

### 6.3 Main Process

O arquivo `src/main/main.ts`:

- cria a janela Electron;
- registra atalhos globais;
- abre o seletor de arquivo MP4;
- chama o binário `zig-webm` usando `spawn`;
- envia logs do encoder de volta para o renderer por IPC.

### 6.4 Encoder Zig

O encoder nativo fica em `zig-webm/`.

O CLI esperado é:

```bash
zig-webm input.mp4 output.webm
```

O app Electron chama esse binário automaticamente ao iniciar a conversão em lote.

## 7. Criando uma nova funcionalidade

### Exemplo: adicionar uma nova ação ao renderer

1. Adicione o tipo da ação em `src/shared/types.ts`.
2. Registre o atalho ou IPC em `src/main/main.ts`.
3. Exponha a função em `src/preload/preload.ts` se for uma chamada do renderer para o main.
4. Consuma a função em `src/render/main.tsx`.
5. Rode:

```bash
npm run typecheck
npm run build
```

### Exemplo: adicionar uma opção ao encoder

Para adicionar `--crf` futuramente:

1. Atualize `zig-webm/src/main.zig` para ler o argumento.
2. Passe o valor para `encoder.convert` em `zig-webm/src/encoder.zig`.
3. Atualize o tipo `EncodeJob` em `src/shared/types.ts`.
4. Atualize a chamada `spawn` em `src/main/main.ts`.
5. Adicione controle visual em `src/render/main.tsx`.

## 8. Comandos úteis

### Validar TypeScript

```bash
npm run typecheck
```

### Rodar testes dos parsers

```bash
npm run test:parsers
```

### Gerar build do renderer e Electron main/preload

```bash
npm run build
```

### Compilar o encoder Zig

```bash
npm run zig:build
```

> Esse comando exige Zig e bibliotecas/headers do FFmpeg disponíveis no ambiente.

## 9. Como transformar em um app desktop distribuível

O repositório ainda não inclui um empacotador como `electron-builder` ou `electron-forge`. Para transformar isso em instalador Windows, siga esta ordem:

1. Compile o renderer e main/preload:

```bash
npm run build
```

2. Compile o encoder nativo:

```bash
npm run zig:build
```

3. Copie o binário gerado para o pacote final:

```text
zig-webm/zig-out/bin/zig-webm.exe
```

4. Inclua as DLLs necessárias do FFmpeg ao lado do binário ou em um diretório conhecido do app.

5. Configure um empacotador Electron para incluir:

```text
dist/
zig-webm/zig-out/bin/zig-webm.exe
DLLs do FFmpeg
package.json
```

6. No app empacotado, `src/main/main.ts` espera encontrar o encoder em:

```text
resources/zig-webm/zig-webm.exe
```

Ajuste a configuração do empacotador para copiar o binário para esse caminho.

## 10. Fluxo recomendado de desenvolvimento

1. Rode `npm run dev` para trabalhar na interface.
2. Edite `src/render/main.tsx` e `src/render/styles.css` para UX/UI.
3. Edite `src/main/main.ts` para IPC, atalhos e integração com sistema operacional.
4. Edite `zig-webm/src/encoder.zig` para evolução do encoder.
5. Rode `npm run typecheck`, `npm run test:parsers` e `npm run build` antes de abrir PR.
6. Rode `npm run zig:build` em uma máquina com Zig + FFmpeg dev libs instalados.

## 11. Limitações atuais do MVP

- Converte somente MP4 para WebM VP9.
- Não faz resize.
- Não altera FPS.
- Não tem barra de progresso.
- Não implementa VP8 ou AV1.
- Não processa áudio inicialmente.
- Não possui empacotamento final configurado.

Essas limitações são intencionais para manter o MVP pequeno e fácil de validar.
