import { TUNING } from "./config.js";
import { Game } from "./state.js";
import { ui, toast } from "./dom.js";

let deps;

export function configureEconomy(dependencies) {
  deps = dependencies;
}

function requireDeps() {
  if (!deps) throw new Error("Economy module has not been configured");
  return deps;
}

export function getRepairCost() {
  return Math.ceil((Game.maxHull - Game.hull) * 0.6);
}

export function getFuelCost() {
  return Math.ceil((Game.maxFuel - Game.fuel) * 0.35);
}

export function updateShopUI() {
  ui.shopMaterials.textContent = Game.materials;
  ui.shopCargoCap.textContent = Game.cargoCapacity;
  ui.shopWorkbench.textContent = Game.processorLevel;
  ui.sellMaterialsBtn.textContent = Game.materials > 0 ? `Sell +${Game.materials} CR` : "No Materials";
  ui.sellMaterialsBtn.disabled = Game.materials <= 0;
  ui.buyCargoBtn.textContent = `Upgrade Cargo (${Game.upgradeCosts.cargo} CR)`;
  ui.buyCargoBtn.disabled = Game.credits < Game.upgradeCosts.cargo;
  ui.buyWorkbenchBtn.textContent = `Upgrade Processor (${Game.upgradeCosts.processor} CR)`;
  ui.buyWorkbenchBtn.disabled = Game.credits < Game.upgradeCosts.processor;
  const repairCost = getRepairCost();
  ui.repairBtn.textContent = Game.hull >= Game.maxHull ? "Hull Full" : `Repair (${repairCost} CR)`;
  ui.repairBtn.disabled = Game.hull >= Game.maxHull || Game.credits < repairCost;
  const fuelCost = getFuelCost();
  ui.refuelBtn.textContent = Game.fuel >= Game.maxFuel ? "Fuel Full" : `Refuel (${fuelCost} CR)`;
  ui.refuelBtn.disabled = Game.fuel >= Game.maxFuel || Game.credits < fuelCost;
}

export function sellMaterials() {
  const { formatTime, endGame } = requireDeps();
  if (Game.materials <= 0) return toast("No materials");
  Game.credits += Game.materials;
  Game.score += Game.materials;
  toast(`Sold +${Game.materials} CR`);
  Game.materials = 0;
  updateShopUI();
  if (Game.score >= Game.goal) endGame(true, `Contract complete in ${formatTime(Game.elapsed)}.`);
}

export function buyCargo() {
  if (Game.credits < Game.upgradeCosts.cargo) return toast("Not enough credits");
  Game.credits -= Game.upgradeCosts.cargo;
  Game.cargoCapacity += TUNING.upgrades.cargo.capacityIncrease;
  Game.upgradeCosts.cargo = Math.floor(Game.upgradeCosts.cargo * TUNING.upgrades.cargo.costMultiplier + TUNING.upgrades.cargo.costFlatIncrease);
  updateShopUI();
  toast("Cargo expanded");
}

export function buyProcessor() {
  if (Game.credits < Game.upgradeCosts.processor) return toast("Not enough credits");
  Game.credits -= Game.upgradeCosts.processor;
  Game.processorLevel += TUNING.upgrades.processor.levelIncrease;
  Game.upgradeCosts.processor = Math.floor(Game.upgradeCosts.processor * TUNING.upgrades.processor.costMultiplier + TUNING.upgrades.processor.costFlatIncrease);
  updateShopUI();
  toast("Processor upgraded");
}

export function repairHull() {
  const cost = getRepairCost();
  if (cost <= 0) return toast("Hull full");
  if (Game.credits < cost) return toast("Not enough credits");
  Game.credits -= cost;
  Game.hull = Game.maxHull;
  updateShopUI();
  toast("Hull repaired");
}

export function refuel() {
  const cost = getFuelCost();
  if (cost <= 0) return toast("Fuel full");
  if (Game.credits < cost) return toast("Not enough credits");
  Game.credits -= cost;
  Game.fuel = Game.maxFuel;
  updateShopUI();
  toast("Fuel refilled");
}
