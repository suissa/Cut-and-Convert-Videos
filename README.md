# Cut-and-Convert-Videos

Aplicativo desktop leve e portável para Windows com Electron, React, TypeScript, uma interface inspirada no editor de vídeos do Windows e um MVP nativo `zig-webm` para converter MP4 em WebM VP9 via FFmpeg/libvpx-vp9.

## Estrutura do projeto

```text
.
├── src/
│   ├── main/          # Processo principal Electron, atalhos globais e IPC
│   ├── preload/       # Ponte segura contextBridge para o renderer
│   ├── render/        # Interface React + Tailwind em estilo Windows, player, storyboard e fila
│   └── shared/        # Tipos compartilhados e parsers HTML/CSS
├── zig-webm/
│   ├── build.zig
│   ├── build.zig.zon
│   └── src/
│       ├── main.zig
│       ├── ffmpeg.zig
│       └── encoder.zig
└── docs/architecture.md
```

## Parsers HTML/CSS

O diretório `src/shared/parsers/` contém parsers leves de HTML e CSS em TypeScript para gerar ASTs simples, cobertos por `npm run test:parsers`.

## Escopo do MVP Zig

- Entrada: `input.mp4`.
- Saída: `output.webm`.
- Encoder: `avcodec_find_encoder_by_name("libvpx-vp9")`.
- Configuração inicial: CRF `30`, `cpu-used` `4`, `threads` opcional pela API.
- Sem resize, sem barra de progresso, sem AV1, sem VP8, sem parser complexo e sem áudio inicialmente.

## Comandos

- `npm run dev`: inicia Vite e Electron em modo desenvolvimento.
- `npm run build`: compila Electron main/preload e gera o bundle do renderer.
- `npm run typecheck`: valida TypeScript do renderer, preload e main.
- `npm run zig:build`: compila `zig-webm` quando Zig e os headers/libs do FFmpeg estão instalados.

## CLI Zig

```bash
zig-webm input.mp4 output.webm
```

## Atalhos da interface

| Atalho | Ação |
| --- | --- |
| `Espaço` | Play / pause |
| `Seta Esquerda` / `Seta Direita` | Voltar / avançar 1 segundo na pré-visualização |
| `Ctrl + N` | Abrir MP4 |
| `Ctrl + Q` | Adicionar conversão atual à fila |
| `Ctrl + E` | Converter lote |
| `Ctrl + +` / `Ctrl + -` | Zoom nativo da janela |
