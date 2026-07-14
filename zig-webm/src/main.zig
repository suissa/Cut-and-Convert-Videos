const std = @import("std");
const encoder = @import("encoder.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const args = try std.process.argsAlloc(allocator);
    defer std.process.argsFree(allocator, args);

    if (args.len != 3) {
        try std.io.getStdErr().writer().writeAll("usage: zig-webm input.mp4 output.webm\n");
        return error.InvalidArguments;
    }

    try encoder.convert(allocator, args[1], args[2], .{});
}
