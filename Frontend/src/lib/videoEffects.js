import { FaceLandmarker, FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";
import simdLoader from "../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js?url";
import simdWasm from "../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm?url";
import basicLoader from "../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.js?url";
import basicWasm from "../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.wasm?url";
import { drawFireworks, drawUpcomingYear } from "./newYearCelebration.js";
import { drawBackdrop, drawCostume, drawParticles, loadEffectArtwork, trackFace } from "./videoEffectArtwork.js";

function surface(options) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", options);
  if (!ctx) throw new Error("Video effects require canvas support.");
  return { canvas, ctx };
}

export async function createVideoEffect(camera, effect, signal, onError) {
  const output = surface({ alpha: false });
  if (!output.canvas.captureStream) throw new Error("This browser cannot send video effects.");
  const backdrop = surface({ alpha: false });
  const person = surface();
  const mask = surface();
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;

  let face;
  let segmenter;
  let track;
  let cameraTrack;
  let frame;
  let pixels;
  let pose;
  let artwork;
  let celebration;
  let lastFrame = -Infinity;
  let lastInference = -Infinity;
  let lastVideoTime = -1;
  const artworkCache = new Map();

  async function getArtwork(name) {
    if (artworkCache.has(name)) return artworkCache.get(name);
    const images = await loadEffectArtwork(name);
    signal.throwIfAborted();
    artworkCache.set(name, images);
    return images;
  }

  async function setEffect(name) {
    const images = await getArtwork(name);
    signal.throwIfAborted();
    drawBackdrop(backdrop.ctx, images.background, output.canvas.width, output.canvas.height);
    artwork = images;
    celebration = name === "newYear" ? { year: new Date().getFullYear() + 1, startedAt: null } : undefined;
  }

  function stop() {
    cancelAnimationFrame(frame);
    track?.stop();
    video.pause();
    video.srcObject = null;
    face?.close();
    segmenter?.close();
    artworkCache.clear();
    face = undefined;
    segmenter = undefined;
  }

  async function setCamera(next) {
    cameraTrack = next;
    video.srcObject = new MediaStream([next]);
    pose = undefined;
    pixels = undefined;
    lastInference = -Infinity;
    lastVideoTime = -1;
    await video.play();
    signal.throwIfAborted();
  }

  function updateMask(result) {
    const confidence = result.confidenceMasks?.[1] ?? result.confidenceMasks?.[0];
    if (!confidence) return;
    const { width, height } = confidence;
    const hasPreviousMask = pixels?.width === width && pixels?.height === height;
    if (!hasPreviousMask) {
      mask.canvas.width = width;
      mask.canvas.height = height;
      pixels = mask.ctx.createImageData(width, height);
    }
    const values = confidence.getAsFloat32Array();
    for (let i = 0; i < values.length; i++) {
      const t = Math.max(0, Math.min(1, (values[i] - 0.47) / 0.4));
      const alpha = 255 * t * t * (3 - 2 * t);
      const index = i * 4 + 3;
      pixels.data[index] = hasPreviousMask && alpha > 0
        ? alpha * 0.84 + pixels.data[index] * 0.16 : alpha;
    }
    mask.ctx.putImageData(pixels, 0, 0);
  }

  function paint(now) {
    if (video.readyState < 2 || !cameraTrack.enabled || now - lastFrame < 55) return;
    lastFrame = now;
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    if (!width || !height) return;
    if (output.canvas.width !== width || output.canvas.height !== height) {
      for (const layer of [output, backdrop, person]) {
        layer.canvas.width = width;
        layer.canvas.height = height;
      }
      pose = undefined;
      pixels = undefined;
      lastInference = -Infinity;
      lastVideoTime = -1;
      drawBackdrop(backdrop.ctx, artwork.background, width, height);
    }
    if (now - lastInference >= 95 && video.currentTime !== lastVideoTime) {
      lastInference = now;
      lastVideoTime = video.currentTime;
      const landmarks = face.detectForVideo(video, now).faceLandmarks[0];
      pose = trackFace(landmarks, width, height, pose);
      segmenter.segmentForVideo(video, now, updateMask);
    }
    output.ctx.drawImage(backdrop.canvas, 0, 0);
    let elapsed;
    if (celebration) {
      celebration.startedAt ??= now;
      elapsed = (now - celebration.startedAt) / 1000;
      drawFireworks(output.ctx, width, height, elapsed);
    }
    if (pixels) {
      person.ctx.clearRect(0, 0, width, height);
      person.ctx.drawImage(video, 0, 0, width, height);
      person.ctx.globalCompositeOperation = "destination-in";
      person.ctx.drawImage(mask.canvas, 0, 0, width, height);
      person.ctx.globalCompositeOperation = "source-atop";
      person.ctx.fillStyle = artwork.tint;
      person.ctx.fillRect(0, 0, width, height);
      person.ctx.globalCompositeOperation = "source-over";
      output.ctx.drawImage(person.canvas, 0, 0);
      drawCostume(output.ctx, artwork, pose);
    }
    drawParticles(output.ctx, artwork.name, width, height, now / 1000);
    if (celebration) drawUpcomingYear(output.ctx, width, height, elapsed, celebration.year);
  }

  function tick(now) {
    if (signal.aborted) return;
    try {
      paint(now);
      frame = requestAnimationFrame(tick);
    } catch (error) {
      onError(error);
    }
  }

  try {
    const [simd] = await Promise.all([FilesetResolver.isSimdSupported(), setEffect(effect)]);
    const files = { wasmLoaderPath: simd ? simdLoader : basicLoader, wasmBinaryPath: simd ? simdWasm : basicWasm };
    signal.throwIfAborted();
    face = await FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: "/call-models/face-landmarker-v1.task" }, runningMode: "VIDEO", numFaces: 1,
    });
    signal.throwIfAborted();
    segmenter = await ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: "/call-models/selfie-segmenter-landscape-v1.tflite" },
      runningMode: "VIDEO", outputConfidenceMasks: true,
    });
    signal.throwIfAborted();
    await setCamera(camera);
    paint(performance.now());
    const stream = output.canvas.captureStream(18);
    [track] = stream.getVideoTracks();
    if (!track) throw new Error("The browser could not capture the effect.");
    frame = requestAnimationFrame(tick);
    return { stream, track, setCamera, setEffect, stop, get effect() { return artwork.name; } };
  } catch (error) {
    stop();
    throw error;
  }
}
