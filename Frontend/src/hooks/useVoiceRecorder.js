import { useEffect, useRef, useState } from "react";

const empty = { phase: "idle", seconds: 0, levels: Array(32).fill(.12), file: null };
const formats = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"];
const extensions = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg" };

function release(session) {
  clearInterval(session.timer);
  session.stream?.getTracks().forEach((track) => track.stop());
  session.context?.close().catch(() => {});
}

export default function useVoiceRecorder(onError) {
  const sessionRef = useRef(null);
  const [voice, setVoice] = useState(empty);

  function cancelSession() {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    if (session.recorder) {
      session.recorder.onstop = null;
      if (session.recorder.state !== "inactive") session.recorder.stop();
    }
    release(session);
    session.resolve?.(null);
  }

  useEffect(() => cancelSession, []);

  function discard() {
    cancelSession();
    setVoice(empty);
  }

  function stop() {
    const session = sessionRef.current;
    if (session?.recorder?.state !== "recording") return Promise.resolve(null);
    setVoice((current) => ({ ...current, phase: "finishing" }));
    return new Promise((resolve) => {
      session.resolve = resolve;
      session.recorder.stop();
    });
  }

  async function start() {
    if (sessionRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      onError("Voice recording needs a supported browser and a secure connection.");
      return;
    }

    const session = {};
    sessionRef.current = session;
    setVoice({ ...empty, phase: "opening" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (sessionRef.current !== session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      session.stream = stream;
      const preferred = formats.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, {
        ...(preferred && { mimeType: preferred }), audioBitsPerSecond: 48000,
      });
      session.recorder = recorder;
      const chunks = [];
      const startedAt = performance.now();
      let analyser;
      let samples;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        try {
          session.context = new AudioContext();
          analyser = session.context.createAnalyser();
          analyser.fftSize = 256;
          samples = new Uint8Array(analyser.fftSize);
          session.context.createMediaStreamSource(stream).connect(analyser);
          void session.context.resume().catch(() => {});
        } catch {
          // Recording remains available if the browser cannot provide levels.
        }
      }

      recorder.ondataavailable = ({ data }) => { if (data.size) chunks.push(data); };
      recorder.onerror = () => {
        if (sessionRef.current !== session) return;
        discard();
        onError("The recording stopped unexpectedly. Try recording again.");
      };
      recorder.onstop = () => {
        if (sessionRef.current !== session) return;
        sessionRef.current = null;
        release(session);
        const mime = (recorder.mimeType || chunks[0]?.type || "").split(";")[0];
        const file = chunks.length && extensions[mime]
          ? new File(chunks, `voice-note.${extensions[mime]}`, { type: mime }) : null;
        if (!file) onError("No playable audio was captured. Try recording again.");
        setVoice((current) => file
          ? { ...current, phase: "ready", file, seconds: Math.floor((performance.now() - startedAt) / 1000) }
          : empty);
        session.resolve?.(file);
      };
      recorder.start(250);
      setVoice({ ...empty, phase: "recording" });
      session.timer = setInterval(() => {
        const seconds = Math.floor((performance.now() - startedAt) / 1000);
        let level = .12;
        if (analyser && samples) {
          analyser.getByteTimeDomainData(samples);
          const meanSquare = samples.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / samples.length;
          level = Math.max(.12, Math.min(1, Math.sqrt(meanSquare) * 3.2));
        }
        setVoice((current) => ({ ...current, seconds, levels: [...current.levels.slice(1), level] }));
        if (seconds >= 120) void stop();
      }, 100);
    } catch (error) {
      if (sessionRef.current !== session) return;
      discard();
      onError(error.name === "NotAllowedError" ? "Allow microphone access to record a voice message."
        : "Could not start the microphone. Check that it’s available and try again.");
    }
  }

  return { ...voice, start, stop, discard };
}
