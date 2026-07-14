# Plano de desenvolvimento

## MVP do core nativo

```text
zig-webm/
├── build.zig
├── build.zig.zon
└── src/
    ├── main.zig
    ├── ffmpeg.zig
    └── encoder.zig
```

A responsabilidade inicial é somente converter MP4 em WebM VP9 usando FFmpeg:

```text
MP4
  ↓
libavformat
  ↓
libavcodec (decode)
  ↓
libvpx-vp9
  ↓
libavformat (WebM)
```

Não há resize, barra de progresso, AV1, VP8, parser complexo ou áudio inicial. Toda a codificação continua sendo feita pelo FFmpeg/libvpx-vp9.

## API Zig

```zig
const std = @import("std");

pub const Config = struct {
    crf: u8 = 30,
    speed: u8 = 4,
    threads: ?u32 = null,
};

pub fn convert(
    allocator: std.mem.Allocator,
    input: []const u8,
    output: []const u8,
    config: Config,
) !void;
```

## CLI

```bash
zig-webm input.mp4 output.webm
```

Opções como `--crf`, `--speed` e `--threads` ficam para uma evolução posterior, evitando parser complexo no MVP.

## Fluxo interno do encoder

1. `avformat_open_input`
2. `avformat_find_stream_info`
3. `avcodec_find_decoder`
4. `avcodec_open2`
5. `avformat_alloc_output_context2`
6. `avcodec_find_encoder_by_name("libvpx-vp9")`
7. `avcodec_open2`
8. `av_read_frame`
9. `avcodec_send_packet`
10. `avcodec_receive_frame`
11. `avcodec_send_frame`
12. `avcodec_receive_packet`
13. `av_interleaved_write_frame`
14. flush
15. `av_write_trailer`

## Próximas evoluções

1. Copiar áudio automaticamente com `libopus` ou stream copy quando possível.
2. Barra de progresso baseada em `pts / duration`.
3. Resize usando `libswscale`.
4. Alteração de FPS.
5. VP8.
6. AV1.
7. API de biblioteca estável.
8. Testes automatizados.
