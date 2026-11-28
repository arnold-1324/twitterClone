let value = { muted: false, volume: 0.75 };
const listeners = new Set();

export function musicVolume() {
  return value;
}

export function subscribeMusicVolume(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function changeMusicVolume(next) {
  value = { ...value, ...next };
  for (const listener of listeners) listener();
}

window.addEventListener("dayline-session-ended", () => changeMusicVolume({ muted: false, volume: 0.75 }));
