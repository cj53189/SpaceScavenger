import { Game, CargoState } from "./state.js";
import { toast, log } from "./dom.js";
import { removeAndDispose } from "./scene/dispose.js";
import {
  cargoUsed as calculateCargoUsed,
  canStoreCargo,
  getProcessingDuration,
  getProcessorSpeed,
  getProcessedMaterialYield
} from "./gameRules.js";

let deps;
let nextCargoId = 1;

export function configureCargo(dependencies) {
  deps = dependencies;
}

function requireDeps() {
  if (!deps) throw new Error("Cargo module has not been configured");
  return deps;
}

export function cargoUsed() {
  return calculateCargoUsed(Game.cargo);
}

export function canStore(type) {
  return canStoreCargo(Game.cargo, Game.cargoCapacity, type);
}

function createCargoMesh(cargo, position) {
  const { THREE, makeMat, shipGroup, cargoInteractables } = requireDeps();
  const size = cargo.type.cargoSize > 1 ? 0.95 : 0.72;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), makeMat(cargo.type.color));
  mesh.position.copy(position);
  mesh.userData = { kind: "cargo", cargo };
  cargo.mesh = mesh;
  shipGroup.add(mesh);
  cargoInteractables.push(mesh);
  return mesh;
}

export function addCargoToShip(type) {
  const { THREE, rand } = requireDeps();
  const cargo = { id: nextCargoId++, type, state: CargoState.STORED, mesh: null, progress: 0 };
  const position = new THREE.Vector3(-3.2 + rand(-1, 1), 0.55, 4.8 + rand(-1, 1));
  createCargoMesh(cargo, position);
  Game.cargo.push(cargo);
}

export function removeCargoMesh(cargo) {
  const { shipGroup, cargoInteractables } = requireDeps();
  if (!cargo.mesh) return;
  removeAndDispose(shipGroup, cargo.mesh);
  const i = cargoInteractables.indexOf(cargo.mesh);
  if (i >= 0) cargoInteractables.splice(i, 1);
  cargo.mesh = null;
}

export function pickUpCargo(cargo) {
  const { THREE, playerYaw } = requireDeps();
  if (Game.carrying || cargo.state !== CargoState.STORED) return;
  const worldCargo = new THREE.Vector3();
  cargo.mesh.getWorldPosition(worldCargo);
  const worldPlayer = new THREE.Vector3();
  playerYaw.getWorldPosition(worldPlayer);
  if (worldCargo.distanceTo(worldPlayer) > 3.2) return toast("Move closer to cargo");
  Game.carrying = cargo;
  cargo.state = CargoState.CARRIED;
  removeCargoMesh(cargo);
  log(`Carrying ${cargo.type.name}. Walk it into the purple processor.`);
}

export function putCargoBack() {
  const { THREE, playerYaw } = requireDeps();
  const cargo = Game.carrying;
  if (!cargo) return;
  cargo.state = CargoState.STORED;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerYaw.quaternion);
  const position = playerYaw.position.clone().add(forward.multiplyScalar(1.25));
  position.y = 0.55;
  createCargoMesh(cargo, position);
  Game.carrying = null;
  log(`${cargo.type.name} placed back in the ship.`);
}

export function startProcessing(cargo) {
  if (Game.processing || !cargo) return;
  cargo.state = CargoState.PROCESSING;
  Game.carrying = null;
  cargo.progress = 0;
  cargo.duration = getProcessingDuration(cargo.type);
  Game.processing = cargo;
  toast(`Processing ${cargo.type.name}`);
  log(`${cargo.type.name} loaded into processor. Larger cargo takes longer.`);
}

export function processCargo(dt) {
  const { processor } = requireDeps();
  const cargo = Game.processing;
  if (!cargo) return;
  const speed = getProcessorSpeed(Game.processorLevel);
  cargo.progress += (dt * speed) / cargo.duration;
  processor.material.opacity = 0.6 + Math.sin(Game.elapsed * 10) * 0.25;
  processor.material.transparent = true;
  if (cargo.progress >= 1) {
    const gained = getProcessedMaterialYield(cargo.type, Game.processorLevel);
    Game.materials += gained;
    toast(`Processed +${gained} materials`);
    log(`${cargo.type.name} processed into ${gained} materials.`);
    const i = Game.cargo.indexOf(cargo);
    if (i >= 0) Game.cargo.splice(i, 1);
    Game.processing = null;
    processor.material.opacity = 1;
    processor.material.transparent = false;
  }
}
