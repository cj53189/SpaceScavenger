export function createGameState() {
  return {
    running: false,
    mode: "interior",
    elapsed: 0,
    credits: 0,
    score: 0,
    goal: 750,
    materials: 0,
    hull: 100,
    maxHull: 100,
    fuel: 100,
    maxFuel: 100,
    cargoCapacity: 4,
    processorLevel: 1,
    cargo: [],
    processing: null,
    carrying: null,
    prompt: "",
    targetedObject: null,
    targetedDebris: null,
    nearStation: false,
    modeBeforeShop: "interior",
    pointerLockDenied: false,
    fallbackLookActive: false,
    lastMouseX: 0,
    lastMouseY: 0,
    mouse: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    flightYaw: 0,
    flightPitch: 0,
    upgradeCosts: { cargo: 80, processor: 100 },
    tether: {
      active: false,
      debris: null,
      length: 0
    }
  };
}

export const Game = createGameState();

export const CargoState = {
  STORED: "stored",
  CARRIED: "carried",
  PROCESSING: "processing"
};

export function resetGameState(game = Game) {
  game.running = true;
  game.mode = "interior";
  game.modeBeforeShop = "interior";
  game.elapsed = 0;
  game.credits = 0;
  game.score = 0;
  game.materials = 0;
  game.hull = game.maxHull;
  game.fuel = game.maxFuel;
  game.cargoCapacity = 4;
  game.processorLevel = 1;
  game.cargo = [];
  game.processing = null;
  game.carrying = null;
  game.upgradeCosts = { cargo: 80, processor: 100 };
  game.flightYaw = 0;
  game.flightPitch = 0;
}
