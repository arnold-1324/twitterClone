import { execFile } from "node:child_process";
import { unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const ladder = [
  { name: "low", edge: 480, bitrate: 460, audio: 64 },
  { name: "medium", edge: 800, bitrate: 1050, audio: 96 },
  { name: "high", edge: 1280, bitrate: 2200, audio: 128 },
];
const headers = ["-hide_banner", "-nostdin", "-v", "error", "-max_alloc", "134217728"];
const demux = (format) => ["-protocol_whitelist", "file,pipe", "-f", format];
const limits = { timeout: 75000, killSignal: "SIGKILL", maxBuffer: 256 * 1024 };
const invalidVideo = (maxDuration) => Object.assign(
  new Error(`Choose a readable MP4 or WebM video up to ${maxDuration} seconds, with a maximum resolution of 3840 × 3840.`),
  { status: 415 },
);

export async function transcodeVideo(file, directory, maxDuration = 180, signal) {
  const format = file.mimetype === "video/mp4" ? "mov" : "matroska";
  const source = join(directory, "input");
  await writeFile(source, file.buffer);
  try {
    const { stdout } = await run("ffprobe", [
      "-v", "error", "-max_alloc", "134217728", ...demux(format),
      "-show_entries", "stream=codec_type,width,height,duration:format=duration", "-of", "json", source,
    ], { ...limits, signal, timeout: 10000 });
    const probe = JSON.parse(stdout);
    const video = probe.streams?.find((stream) => stream.codec_type === "video");
    const maxEdge = Math.max(video?.width, video?.height);
    const duration = Number(probe.format?.duration ?? video?.duration);
    // Some WebM recordings omit a duration. The encoder still caps their output.
    if (!(maxEdge >= 2 && maxEdge <= 3840) || (Number.isFinite(duration) && (duration <= 0 || duration > maxDuration))) {
      throw invalidVideo(maxDuration);
    }

    // Keep one rendition above the source size so sources between tiers don't
    // lose resolution. Scaling itself never enlarges the input.
    const renditions = ladder.slice(0, Math.min(ladder.length, ladder.filter(({ edge }) => edge < maxEdge).length + 1));
    const variants = [];
    for (const { name, edge, bitrate, audio } of renditions) {
      const scale = `scale=w='min(iw,${edge})':h='min(ih,${edge})':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,fps=30`;
      const encode = [
        ...headers, "-filter_threads", "1", "-threads", "2", ...demux(format), "-i", source,
        "-map", "0:v:0", "-map", "0:a:0?", "-map_metadata", "-1", "-t", String(maxDuration),
        "-vf", scale, "-c:v", "libx264", "-preset", "veryfast", "-threads", "2",
        "-pix_fmt", "yuv420p", "-b:v", `${bitrate}k`, "-maxrate", `${bitrate}k`,
        "-bufsize", `${2 * bitrate}k`, "-g", "120", "-sc_threshold", "0",
        "-c:a", "aac", "-ac", "2", "-b:a", `${audio}k`,
      ];
      const hls = [
        "-f", "hls", "-hls_time", "4", "-hls_playlist_type", "vod", "-hls_flags", "independent_segments",
        "-hls_segment_filename", join(directory, `${name}-%04d.ts`), join(directory, `${name}.m3u8`),
      ];
      await run("ffmpeg", [...encode, ...hls], { ...limits, signal });
      const { stdout: resolution } = await run("ffprobe", [
        "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
        "-of", "csv=p=0:s=x", join(directory, `${name}-0000.ts`),
      ], { ...limits, signal, timeout: 10000 });
      const dimensions = resolution.match(/^\d+x\d+/)?.[0];
      const bandwidth = Math.ceil(1.2 * (bitrate + audio)) * 1000;
      variants.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth}${dimensions ? `,RESOLUTION=${dimensions}` : ""}\n${name}.m3u8`);
    }
    await run("ffmpeg", [
      ...headers, ...demux("hls"), "-i", join(directory, "low.m3u8"),
      "-c", "copy", "-movflags", "+faststart", join(directory, "video.mp4"),
    ], { ...limits, signal });
    await writeFile(join(directory, "master.m3u8"), ["#EXTM3U", "#EXT-X-VERSION:3", "#EXT-X-INDEPENDENT-SEGMENTS", ...variants, ""].join("\n"));
  } catch (error) {
    if (error.code === "ENOENT") throw Object.assign(new Error("Video processing is temporarily unavailable."), { status: 503 });
    if (error.killed) throw Object.assign(new Error("This video took too long to process. Try a shorter clip."), { status: 422 });
    if (typeof error.code === "number") throw invalidVideo(maxDuration);
    throw error;
  } finally {
    await unlink(source);
  }
}

const audioFormats = { "audio/webm": "matroska", "audio/ogg": "ogg", "audio/mp4": "mov",
  "audio/wav": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3" };

export async function transcodeAudio(file, directory, signal) {
  const source = join(directory, "audio-input");
  await writeFile(source, file.buffer);
  try {
    await run("ffmpeg", [...headers, ...demux(audioFormats[file.mimetype.split(";")[0]]), "-i", source,
      "-map", "0:a:0", "-map_metadata", "-1", "-map_chapters", "-1", "-t", "600",
      "-c:a", "libmp3lame", "-b:a", "96k", join(directory, "audio.mp3")], { ...limits, signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    if (error.code === "ENOENT") throw Object.assign(new Error("Audio inspection is temporarily unavailable."), { status: 503 });
    throw Object.assign(new Error("Audio is malformed or exceeds the processing limit."), { status: 415 });
  } finally {
    await unlink(source);
  }
}
