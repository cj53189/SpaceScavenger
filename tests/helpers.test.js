import test from "node:test";
import assert from "node:assert/strict";

import { TUNING, debrisTypes } from "../src/config.js";
import { chooseDebrisType } from "../src/debrisRules.js";
import {
  cargoUsed,
  canStoreCargo,
  getCargoCapacityAfterUpgrade,
  getFuelCost,
  getProcessedMaterialYield,
  getProcessingDuration,
  getProcessorLevelAfterUpgrade,
  getProcessorSpeed,
  getRepairCost,
  getUpgradeCost
} from "../src/gameRules.js";
import { clamp, formatTime } from "../src/math.js";

test("clamp keeps values inside inclusive bounds", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
});

test("formatTime renders zero-padded minutes and seconds", () => {
  assert.equal(formatTime(0), "00:00");
  assert.equal(formatTime(9.9), "00:09");
  assert.equal(formatTime(75), "01:15");
  assert.equal(formatTime(600), "10:00");
});

test("chooseDebrisType preserves the debris rarity thresholds", () => {
  assert.equal(chooseDebrisType(0.1), debrisTypes[0]);
  assert.equal(chooseDebrisType(0.33), debrisTypes[1]);
  assert.equal(chooseDebrisType(0.63), debrisTypes[2]);
  assert.equal(chooseDebrisType(0.83), debrisTypes[3]);
  assert.equal(chooseDebrisType(0.95), debrisTypes[4]);
});

test("cargoUsed and canStoreCargo calculate cargo capacity without game state", () => {
  const small = { type: debrisTypes[0] };
  const large = { type: debrisTypes[2] };
  assert.equal(cargoUsed([small, large]), 3);
  assert.equal(canStoreCargo([small, large], 4, debrisTypes[0]), true);
  assert.equal(canStoreCargo([small, large], 4, debrisTypes[2]), false);
});

test("economy cost formulas match current balance", () => {
  assert.equal(getRepairCost(73, 100), 17);
  assert.equal(getFuelCost(42, 100), 21);
  assert.equal(getUpgradeCost(80, TUNING.upgrades.cargo), 148);
  assert.equal(getUpgradeCost(100, TUNING.upgrades.processor), 195);
});

test("upgrade formulas apply the configured increments", () => {
  assert.equal(getCargoCapacityAfterUpgrade(4), 6);
  assert.equal(getProcessorLevelAfterUpgrade(1), 2);
});

test("processor formulas match current duration, speed, and yield balance", () => {
  const reactorChunk = debrisTypes[2];
  assert.equal(getProcessingDuration(reactorChunk), 6.41);
  assert.equal(getProcessorSpeed(3), 1.56);
  assert.equal(getProcessedMaterialYield(reactorChunk, 3), 90);
});
