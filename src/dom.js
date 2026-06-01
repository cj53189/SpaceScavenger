const $ = (id) => document.getElementById(id);

export const ui = {
  scene: $("scene"),
  crosshair: $("crosshair"),
  miniMap: $("miniMap"),
  miniMapCanvas: $("miniMapCanvas"),
  centerPrompt: $("centerPrompt"),
  toast: $("toast"),
  startScreen: $("startScreen"),
  shopScreen: $("shopScreen"),
  endScreen: $("endScreen"),
  startHelp: $("startHelp"),
  modeTitle: $("modeTitle"),
  statusLamp: $("statusLamp"),
  uiCredits: $("uiCredits"),
  uiScore: $("uiScore"),
  uiGoal: $("uiGoal"),
  uiCargo: $("uiCargo"),
  uiMaterials: $("uiMaterials"),
  uiSpeed: $("uiSpeed"),
  hullBar: $("hullBar"),
  fuelBar: $("fuelBar"),
  controlMode: $("controlMode"),
  controlsText: $("controlsText"),
  objectiveText: $("objectiveText"),
  shipLog: $("shipLog"),
  timer: $("timer"),
  shopMaterials: $("shopMaterials"),
  shopCargoCap: $("shopCargoCap"),
  shopWorkbench: $("shopWorkbench"),
  sellMaterialsBtn: $("sellMaterialsBtn"),
  buyCargoBtn: $("buyCargoBtn"),
  buyWorkbenchBtn: $("buyWorkbenchBtn"),
  repairBtn: $("repairBtn"),
  refuelBtn: $("refuelBtn"),
  endTitle: $("endTitle"),
  endText: $("endText"),
  startBtn: $("startBtn"),
  restartBtn: $("restartBtn"),
  undockBtn: $("undockBtn")
};

const missingUi = Object.entries(ui)
  .filter(([, element]) => !element)
  .map(([key]) => key);
if (missingUi.length) {
  console.error(`Missing UI elements: ${missingUi.join(", ")}`);
}

export const miniMapCanvas = ui.miniMapCanvas;
export const miniMapCtx = miniMapCanvas.getContext("2d");

export function toast(message) {
  const t = ui.toast;
  t.textContent = message;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 1400);
}

export function log(message) {
  ui.shipLog.textContent = message;
}
