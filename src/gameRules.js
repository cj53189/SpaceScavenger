import { TUNING } from "./config.js";

export function cargoUsed(cargo) {
  return cargo.reduce((sum, c) => sum + c.type.cargoSize, 0);
}

export function canStoreCargo(cargo, cargoCapacity, type) {
  return cargoUsed(cargo) + type.cargoSize <= cargoCapacity;
}

export function getRepairCost(hull, maxHull) {
  return Math.ceil((maxHull - hull) * 0.6);
}

export function getFuelCost(fuel, maxFuel) {
  return Math.ceil((maxFuel - fuel) * 0.35);
}

export function getUpgradeCost(currentCost, upgradeTuning) {
  return Math.floor(currentCost * upgradeTuning.costMultiplier + upgradeTuning.costFlatIncrease);
}

export function getCargoCapacityAfterUpgrade(currentCapacity, upgradeTuning = TUNING.upgrades.cargo) {
  return currentCapacity + upgradeTuning.capacityIncrease;
}

export function getProcessorLevelAfterUpgrade(currentLevel, upgradeTuning = TUNING.upgrades.processor) {
  return currentLevel + upgradeTuning.levelIncrease;
}

export function getProcessingDuration(type, processorTuning = TUNING.processor) {
  return processorTuning.durationBase
    + type.cargoSize * processorTuning.durationCargoSizeMultiplier
    + type.mass * processorTuning.durationMassMultiplier
    + type.danger * processorTuning.durationDangerMultiplier;
}

export function getProcessorSpeed(processorLevel, processorTuning = TUNING.processor) {
  return 1 + (processorLevel - 1) * processorTuning.speedPerLevel;
}

export function getProcessedMaterialYield(type, processorLevel, processorTuning = TUNING.processor) {
  return Math.round(type.material * (1 + (processorLevel - 1) * processorTuning.yieldPerLevel));
}
