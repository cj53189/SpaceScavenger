import { debrisTypes } from "./config.js";

export function chooseDebrisType(randomSource = Math.random, types = debrisTypes) {
  const r = typeof randomSource === "function" ? randomSource() : randomSource;
  if (r > 0.94) return types[4];
  if (r > 0.82) return types[3];
  if (r > 0.62) return types[2];
  if (r > 0.32) return types[1];
  return types[0];
}
