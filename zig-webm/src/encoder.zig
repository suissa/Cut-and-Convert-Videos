const std = @import("std");
const ffmpeg = @import("ffmpeg.zig");
const c = ffmpeg.c;

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
) !void {
    const input_z = try allocator.dupeZ(u8, input);
    defer allocator.free(input_z);
    const output_z = try allocator.dupeZ(u8, output);
    defer allocator.free(output_z);

    var input_format: ?*c.AVFormatContext = null;
    try ff(c.avformat_open_input(&input_format, input_z.ptr, null, null));
    defer c.avformat_close_input(&input_format);

    try ff(c.avformat_find_stream_info(input_format, null));

    const video_stream_index = c.av_find_best_stream(input_format, c.AVMEDIA_TYPE_VIDEO, -1, -1, null, 0);
    try ff(video_stream_index);

    const input_stream = input_format.?.streams[@intCast(video_stream_index)];
    const decoder = c.avcodec_find_decoder(input_stream.*.codecpar.*.codec_id) orelse return error.DecoderNotFound;
    var decoder_ctx = c.avcodec_alloc_context3(decoder) orelse return error.OutOfMemory;
    defer c.avcodec_free_context(&decoder_ctx);

    try ff(c.avcodec_parameters_to_context(decoder_ctx, input_stream.*.codecpar));
    try ff(c.avcodec_open2(decoder_ctx, decoder, null));

    var output_format: ?*c.AVFormatContext = null;
    try ff(c.avformat_alloc_output_context2(&output_format, null, "webm", output_z.ptr));
    defer c.avformat_free_context(output_format);

    const vp9 = c.avcodec_find_encoder_by_name("libvpx-vp9") orelse return error.EncoderNotFound;
    var encoder_ctx = c.avcodec_alloc_context3(vp9) orelse return error.OutOfMemory;
    defer c.avcodec_free_context(&encoder_ctx);

    encoder_ctx.*.width = decoder_ctx.*.width;
    encoder_ctx.*.height = decoder_ctx.*.height;
    encoder_ctx.*.sample_aspect_ratio = decoder_ctx.*.sample_aspect_ratio;
    encoder_ctx.*.pix_fmt = vp9.*.pix_fmts[0];
    encoder_ctx.*.time_base = input_stream.*.time_base;
    encoder_ctx.*.framerate = decoder_ctx.*.framerate;

    if ((output_format.?.*.oformat.*.flags & c.AVFMT_GLOBALHEADER) != 0) {
        encoder_ctx.*.flags |= c.AV_CODEC_FLAG_GLOBAL_HEADER;
    }

    var opts: ?*c.AVDictionary = null;
    defer c.av_dict_free(&opts);
    try setIntOption(&opts, "crf", config.crf);
    try setIntOption(&opts, "cpu-used", config.speed);
    if (config.threads) |threads| try setIntOption(&opts, "threads", threads);
    try ff(c.avcodec_open2(encoder_ctx, vp9, &opts));

    const output_stream = c.avformat_new_stream(output_format, null) orelse return error.OutOfMemory;
    output_stream.*.time_base = encoder_ctx.*.time_base;
    try ff(c.avcodec_parameters_from_context(output_stream.*.codecpar, encoder_ctx));

    if ((output_format.?.*.oformat.*.flags & c.AVFMT_NOFILE) == 0) {
        try ff(c.avio_open(&output_format.?.*.pb, output_z.ptr, c.AVIO_FLAG_WRITE));
    }
    defer if ((output_format.?.*.oformat.*.flags & c.AVFMT_NOFILE) == 0) _ = c.avio_closep(&output_format.?.*.pb);

    try ff(c.avformat_write_header(output_format, null));

    var packet = c.av_packet_alloc() orelse return error.OutOfMemory;
    defer c.av_packet_free(&packet);
    var encoded_packet = c.av_packet_alloc() orelse return error.OutOfMemory;
    defer c.av_packet_free(&encoded_packet);
    var frame = c.av_frame_alloc() orelse return error.OutOfMemory;
    defer c.av_frame_free(&frame);

    while (c.av_read_frame(input_format, packet) >= 0) {
        defer c.av_packet_unref(packet);
        if (packet.*.stream_index != video_stream_index) continue;

        try ff(c.avcodec_send_packet(decoder_ctx, packet));
        while (receiveFrame(decoder_ctx, frame)) {
            frame.*.pts = frame.*.best_effort_timestamp;
            try ff(c.avcodec_send_frame(encoder_ctx, frame));
            try drainEncoder(encoder_ctx, encoded_packet, output_stream, output_format);
            c.av_frame_unref(frame);
        }
    }

    try ff(c.avcodec_send_packet(decoder_ctx, null));
    while (receiveFrame(decoder_ctx, frame)) {
        frame.*.pts = frame.*.best_effort_timestamp;
        try ff(c.avcodec_send_frame(encoder_ctx, frame));
        try drainEncoder(encoder_ctx, encoded_packet, output_stream, output_format);
        c.av_frame_unref(frame);
    }

    try ff(c.avcodec_send_frame(encoder_ctx, null));
    try drainEncoder(encoder_ctx, encoded_packet, output_stream, output_format);
    try ff(c.av_write_trailer(output_format));
}

fn drainEncoder(
    encoder_ctx: *c.AVCodecContext,
    packet: *c.AVPacket,
    output_stream: *c.AVStream,
    output_format: *c.AVFormatContext,
) !void {
    while (true) {
        const rc = c.avcodec_receive_packet(encoder_ctx, packet);
        if (rc == c.AVERROR_EOF or rc == c.AVERROR(c.EAGAIN)) return;
        try ff(rc);
        c.av_packet_rescale_ts(packet, encoder_ctx.*.time_base, output_stream.*.time_base);
        packet.*.stream_index = output_stream.*.index;
        try ff(c.av_interleaved_write_frame(output_format, packet));
        c.av_packet_unref(packet);
    }
}

fn receiveFrame(decoder_ctx: *c.AVCodecContext, frame: *c.AVFrame) bool {
    const rc = c.avcodec_receive_frame(decoder_ctx, frame);
    return !(rc == c.AVERROR_EOF or rc == c.AVERROR(c.EAGAIN) or rc < 0);
}

fn setIntOption(opts: *?*c.AVDictionary, key: [:0]const u8, value: anytype) !void {
    var buf: [32]u8 = undefined;
    const text = try std.fmt.bufPrintZ(&buf, "{d}", .{value});
    try ff(c.av_dict_set(opts, key.ptr, text.ptr, 0));
}

fn ff(rc: c_int) !void {
    if (rc < 0) return error.FFmpegError;
}
