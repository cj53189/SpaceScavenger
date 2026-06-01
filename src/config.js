export const debrisTypes = [
  { name: "Scrap Plate", color: 0x9a9a9a, size: 1.3, value: 28, mass: 1, cargoSize: 1, danger: 0, material: 18 },
  { name: "Broken Satellite", color: 0xffd966, size: 1.7, value: 54, mass: 2, cargoSize: 1, danger: 0, material: 36 },
  { name: "Reactor Chunk", color: 0xff4d5e, size: 1.9, value: 92, mass: 3, cargoSize: 2, danger: 0.28, material: 66 },
  { name: "Blackbox Cache", color: 0xc887ff, size: 1.5, value: 120, mass: 2, cargoSize: 1, danger: 0.08, material: 80 },
  { name: "Alien Relic", color: 0x55e7ff, size: 1.6, value: 160, mass: 2, cargoSize: 2, danger: 0.18, material: 105 }
];

export const targetConeRange = 170;
export const targetConeHalfAngle = Math.PI / 8;
export const debrisFieldRadius = 720;
export const debrisDespawnRadius = 980;
export const minDebrisCount = 34;
export const debrisVisualYRange = 38;
export const intakeSafetyRadius = 62;
export const intakeFieldRadius = 82;
