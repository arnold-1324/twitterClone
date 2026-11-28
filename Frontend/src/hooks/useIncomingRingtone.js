import { useEffect, useRef, useState } from "react";

function makeRingtone(audio) {
  const buffer = audio.createBuffer(1, Math.round(3.2 * audio.sampleRate), audio.sampleRate);
  const samples = buffer.getChannelData(0);
  const noteLength = 0.28;
  for (const [offset, pitch] of [[0, 523.25], [0.37, 659.25]]) {
    const first = Math.round(offset * audio.sampleRate);
    for (let sample = 0; sample < noteLength * audio.sampleRate; sample++) {
      const time = sample / audio.sampleRate;
      const envelope = Math.min(1, time / 0.025, (noteLength - time) / 0.1);
      const phase = 2 * Math.PI * pitch * time;
      samples[first + sample] = 0.22 * envelope * (Math.sin(phase) + 0.2 * Math.sin(2 * phase));
    }
  }
  return buffer;
}

export default function useIncomingRingtone(ringing) {
  const AudioEngine = globalThis.AudioContext || globalThis.webkitAudioContext;
  const context = useRef(null);
  const ringtone = useRef(null);
  const [ready, setReady] = useState(false);

  const [enable] = useState(() => () => {
    if (!AudioEngine) return;
    try {
      const audio = context.current ?? new AudioEngine();
      if (!context.current) {
        context.current = audio;
        audio.onstatechange = () => {
          if (context.current === audio) setReady(audio.state === "running");
        };
      }
      if (audio.state === "running") setReady(true);
      else void audio.resume().then(() => {
        if (context.current === audio) setReady(audio.state === "running");
      }).catch(() => {});
    } catch {
      setReady(false);
    }
  });

  useEffect(() => {
    if (!AudioEngine) return;
    // Keep audio available for calls arriving after the first app interaction.
    function unlock(event) {
      if (event.isTrusted && context.current?.state !== "running") enable();
    }
    document.addEventListener("click", unlock, true);
    document.addEventListener("keydown", unlock, true);
    return () => {
      document.removeEventListener("click", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      const audio = context.current;
      context.current = null;
      ringtone.current = null;
      if (audio && audio.state !== "closed") {
        audio.onstatechange = null;
        void audio.close().catch(() => {});
      }
    };
  }, [AudioEngine, enable]);

  useEffect(() => {
    const audio = context.current;
    if (!ringing || !audio) return;
    if (audio.state !== "running") {
      enable();
      return;
    }
    if (!ready) return;
    ringtone.current ??= makeRingtone(audio);
    const player = audio.createBufferSource();
    player.buffer = ringtone.current;
    player.loop = true;
    player.connect(audio.destination);
    player.start();
    return () => {
      if (audio.state !== "closed") player.stop();
      player.disconnect();
    };
  }, [ringing, ready, enable]);

  return { enable, needsGesture: ringing && Boolean(AudioEngine) && !ready };
}
