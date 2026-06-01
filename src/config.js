export const TUNING = {
  interior: {
    walkSpeed: 5.4,
    carryingSpeed: 3.9,
    bounds: {
      minX: -4.4,
      maxX: 4.4,
      minZ: -6.55,
      maxZ: 6.55,
      y: 1.6
    }
  },
  flight: {
    thrust: 38,
    brake: 20,
    thrustFuelUse: 5.5,
    brakeFuelUse: 2.8,
    idleFuelRecharge: 1.0,
    drag: 0.992,
    maxSpeed: 72,
    stationDockingRange: 120
  },
  tether: {
    maxLength: 300,
    storeDistance: 26,
    captureDistance: 38,
    fullCargoSafeLength: 75,
    pullStrength: 10,
    capturePull: 18,
    snapLengthMultiplier: 1.35
  },
  debrisField: {
    radius: 720,
    despawnRadius: 980,
    initialCount: 32,
    minCount: 34,
    visualYRange: 38
  },
  intake: {
    safetyRadius: 62,
    fieldRadius: 82,
    guideStrength: 22
  },
  collision: {
    radius: 5.5,
    baseDamage: 3,
    massSpeedDamageMultiplier: 0.08,
    damageThreshold: 4,
    highRawDamageLogThreshold: 10,
    debrisBounce: 10,
    shipBounce: 2
  },
  processor: {
    durationBase: 1.8,
    durationCargoSizeMultiplier: 1.65,
    durationMassMultiplier: 0.25,
    durationDangerMultiplier: 2,
    speedPerLevel: 0.28,
    yieldPerLevel: 0.18
  },
  upgrades: {
    cargo: {
      capacityIncrease: 2,
      costMultiplier: 1.6,
      costFlatIncrease: 20
    },
    processor: {
      levelIncrease: 1,
      costMultiplier: 1.7,
      costFlatIncrease: 25
    }
  }
};

export const debrisTypes = [
  { name: "Scrap Plate", color: 0x9a9a9a, size: 1.3, value: 28, mass: 1, cargoSize: 1, danger: 0, material: 18 },
  { name: "Broken Satellite", color: 0xffd966, size: 1.7, value: 54, mass: 2, cargoSize: 1, danger: 0, material: 36 },
  { name: "Reactor Chunk", color: 0xff4d5e, size: 1.9, value: 92, mass: 3, cargoSize: 2, danger: 0.28, material: 66 },
  { name: "Blackbox Cache", color: 0xc887ff, size: 1.5, value: 120, mass: 2, cargoSize: 1, danger: 0.08, material: 80 },
  { name: "Alien Relic", color: 0x55e7ff, size: 1.6, value: 160, mass: 2, cargoSize: 2, danger: 0.18, material: 105 }
];

export const targetConeRange = 170;
export const targetConeHalfAngle = Math.PI / 8;
