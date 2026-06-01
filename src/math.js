export function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
