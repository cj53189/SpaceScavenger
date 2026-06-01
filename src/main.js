import {
  debrisTypes,
  targetConeRange,
  targetConeHalfAngle,
  debrisFieldRadius,
  debrisDespawnRadius,
  minDebrisCount,
  debrisVisualYRange,
  intakeSafetyRadius,
  intakeFieldRadius
} from "./config.js";
import { ui, miniMapCanvas, miniMapCtx, toast, log } from "./dom.js";
import { Game, resetGameState } from "./state.js";
import { registerInputHandlers } from "./input.js";
import {
  configureCargo,
  cargoUsed,
  canStore,
  addCargoToShip,
  startProcessing,
  processCargo
} from "./cargo.js";
import {
  configureEconomy,
  updateShopUI,
  sellMaterials,
  buyCargo,
  buyProcessor,
  repairHull,
  refuel
} from "./economy.js";
import { removeAndDispose } from "./scene/dispose.js";

const { THREE } = window;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x000000, 0.0024);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 1600);
const tacticalCamera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 1, 2200);
// Keep the tactical camera locked to world-space instead of ship rotation.
// This makes piloting feel like the 2D MVP: the ship turns under the camera,
// but the camera does not orbit or tilt when the ship rotates.
tacticalCamera.up.set(0, 0, -1);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
ui.scene.appendChild(renderer.domElement);

const universeGroup = new THREE.Group();
scene.add(universeGroup);

const shipGroup = new THREE.Group();
scene.add(shipGroup);

const playerYaw = new THREE.Object3D();
const playerPitch = new THREE.Object3D();
playerPitch.add(camera);
playerYaw.add(playerPitch);
shipGroup.add(playerYaw);

const shipVelocity = new THREE.Vector3();
const keys = new Set();
let pointerLocked = false;
let lastTime = performance.now();

const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);
const debrisList = [];
const cargoInteractables = [];

function rand(min, max) { return min + Math.random() * (max - min); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function setPointerLockFallback(reason) {
  Game.pointerLockDenied = true;
  pointerLocked = false;
  ui.controlMode.textContent = "DRAG LOOK";
  ui.startHelp.textContent = "Pointer lock is blocked in this sandbox. Hold right mouse and drag to look inside the ship. Flight mode still uses visible mouse aiming.";
  log("Pointer lock blocked. Drag-look fallback enabled for interior mode.");
  if (reason) console.warn("Pointer lock fallback:", reason);
}

function safeRequestPointerLock() {
  if (Game.mode !== "interior") return false;
  if (Game.pointerLockDenied) return false;
  if (!document.body.requestPointerLock) {
    setPointerLockFallback("requestPointerLock unavailable");
    return false;
  }

  try {
    const result = document.body.requestPointerLock();
    if (result && typeof result.catch === "function") {
      result.catch((err) => setPointerLockFallback(err));
    }
    return true;
  } catch (err) {
    setPointerLockFallback(err);
    return false;
  }
}

function safeExitPointerLock() {
  try {
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  } catch (err) {
    console.warn("Could not exit pointer lock:", err);
  }
}


function applyLookDelta(dx, dy) {
  const sensitivity = 0.002;
  if (Game.mode === "interior") {
    playerYaw.rotation.y -= dx * sensitivity;
    playerPitch.rotation.x -= dy * sensitivity;
    playerPitch.rotation.x = clamp(playerPitch.rotation.x, -Math.PI / 2.2, Math.PI / 2.2);
  }
}

function makeMat(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: opacity < 1, opacity });
}

scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const point = new THREE.PointLight(0x42ff7a, 1.7, 45);
point.position.set(0, 3, -2);
shipGroup.add(point);

const starGeo = new THREE.BufferGeometry();
const starCount = 2500;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i++) starPos[i] = rand(-800, 800);
starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
universeGroup.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xbcd8ff, size: 1.25 })));

const station = new THREE.Group();
station.position.set(0, 0, -360);
station.add(new THREE.Mesh(new THREE.TorusGeometry(48, 5, 12, 64), makeMat(0x42ff7a)));
station.add(new THREE.Mesh(new THREE.SphereGeometry(18, 12, 12), makeMat(0x42ff7a, 0.65)));
universeGroup.add(station);

const flightGrid = new THREE.GridHelper(1300, 26, 0x225533, 0x12331f);
flightGrid.position.y = -0.04;
flightGrid.visible = false;
scene.add(flightGrid);

const sideWallMat = new THREE.MeshBasicMaterial({ color: 0x07100b, side: THREE.BackSide, transparent: true, opacity: 0.82 });
const solidWallMat = new THREE.MeshBasicMaterial({ color: 0x07100b, side: THREE.BackSide });
const windowMat = new THREE.MeshBasicMaterial({ color: 0x55e7ff, side: THREE.BackSide, transparent: true, opacity: 0.14, wireframe: true });

const room = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 15), [
  sideWallMat,
  sideWallMat,
  solidWallMat,
  solidWallMat,
  solidWallMat,
  windowMat
]);
room.position.y = 2;
shipGroup.add(room);

const roomEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(10, 4, 15)), new THREE.LineBasicMaterial({ color: 0x42ff7a, transparent: true, opacity: 0.35 }));
roomEdges.position.y = 2;
shipGroup.add(roomEdges);

function createConsole(kind, name, color, pos, scale) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(scale.x, scale.y, scale.z), makeMat(color));
  mesh.position.copy(pos);
  mesh.userData = { kind, name };
  shipGroup.add(mesh);
  return mesh;
}

const pilotSeat = createConsole("pilot", "Pilot Seat", 0x55e7ff, new THREE.Vector3(0, 0.8, -5.2), new THREE.Vector3(2, 1.2, 1.6));
createConsole("cargoBay", "Cargo Bay", 0xffd966, new THREE.Vector3(-3.2, 0.12, 4.8), new THREE.Vector3(3.3, 0.2, 3.2));
const processor = createConsole("processor", "Processor", 0xc887ff, new THREE.Vector3(4.1, 1.1, 0.5), new THREE.Vector3(1.6, 2.1, 3.0));
const storage = createConsole("storage", "Storage / Shop Network", 0x42ff7a, new THREE.Vector3(-4.25, 1.3, -1.6), new THREE.Vector3(1.1, 2.4, 2.1));

const cargoIntakeLocal = new THREE.Vector3(0, 0, 6.7);
const tetherLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
  new THREE.LineBasicMaterial({ color: 0x42ff7a, depthTest: false, transparent: true, opacity: 0.95 })
);
tetherLine.visible = false;
tetherLine.renderOrder = 999;
scene.add(tetherLine);

const coneVertices = [0, 0.08, -6];
const coneIndices = [];
const coneSegments = 28;
for (let i = 0; i <= coneSegments; i++) {
  const t = -targetConeHalfAngle + (targetConeHalfAngle * 2 * i) / coneSegments;
  coneVertices.push(Math.sin(t) * targetConeRange, 0.08, -6 - Math.cos(t) * targetConeRange);
  if (i > 0) coneIndices.push(0, i, i + 1);
}
const targetConeGeometry = new THREE.BufferGeometry();
targetConeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(coneVertices, 3));
targetConeGeometry.setIndex(coneIndices);
targetConeGeometry.computeVertexNormals();
const targetCone = new THREE.Mesh(
  targetConeGeometry,
  new THREE.MeshBasicMaterial({ color: 0x55e7ff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false })
);
targetCone.visible = false;
shipGroup.add(targetCone);

const coneEdgePoints = [new THREE.Vector3(0, 0.1, -6)];
for (let i = 0; i <= coneSegments; i++) {
  const t = -targetConeHalfAngle + (targetConeHalfAngle * 2 * i) / coneSegments;
  coneEdgePoints.push(new THREE.Vector3(Math.sin(t) * targetConeRange, 0.1, -6 - Math.cos(t) * targetConeRange));
}
coneEdgePoints.push(new THREE.Vector3(0, 0.1, -6));
const targetConeLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints(coneEdgePoints),
  new THREE.LineBasicMaterial({ color: 0x55e7ff, transparent: true, opacity: 0.28 })
);
targetConeLine.visible = false;
shipGroup.add(targetConeLine);

function chooseDebrisType() {
  const r = Math.random();
  if (r > 0.94) return debrisTypes[4];
  if (r > 0.82) return debrisTypes[3];
  if (r > 0.62) return debrisTypes[2];
  if (r > 0.32) return debrisTypes[1];
  return debrisTypes[0];
}

function flatDistance(a, b) {
  // Flight gameplay is intentionally flattened to X/Z, even if debris has
  // visual Y variation. This lets the cockpit/window view feel 3D while the
  // pilot controls and scanner cone stay clean and 2D.
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

function forwardFlatVector() {
  return new THREE.Vector3(0, 0, -1).applyQuaternion(shipGroup.quaternion).setY(0).normalize();
}

function mouseNDC() {
  return new THREE.Vector2(
    (Game.mouse.x / window.innerWidth) * 2 - 1,
    -(Game.mouse.y / window.innerHeight) * 2 + 1
  );
}

function mouseWorldOnFlightPlane() {
  raycaster.setFromCamera(mouseNDC(), tacticalCamera);
  const ray = raycaster.ray;
  const denom = ray.direction.y;
  if (Math.abs(denom) < 0.00001) return null;
  const t = -ray.origin.y / denom;
  if (t < 0) return null;
  return ray.origin.clone().add(ray.direction.clone().multiplyScalar(t));
}

function isWorldPointVisible(world, margin = 42) {
  const p = world.clone().project(tacticalCamera);
  const sx = (p.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-p.y * 0.5 + 0.5) * window.innerHeight;
  return sx >= -margin && sx <= window.innerWidth + margin && sy >= -margin && sy <= window.innerHeight + margin;
}

function updateShipAimFromMouse() {
  const world = mouseWorldOnFlightPlane();
  if (!world) return;
  const dx = world.x - shipGroup.position.x;
  const dz = world.z - shipGroup.position.z;
  if (Math.hypot(dx, dz) < 0.5) return;
  Game.flightYaw = Math.atan2(-dx, -dz);
  shipGroup.rotation.set(0, Game.flightYaw, 0, "YXZ");
}

function findMouseDebrisTarget() {
  if (Game.mode !== "flight") return null;

  // Priority 1: direct cursor hit. This keeps the old precise behavior.
  raycaster.setFromCamera(mouseNDC(), tacticalCamera);
  const meshes = debrisList.map(d => d.mesh);
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length) {
    const hit = hits[0].object;
    const deb = debrisList.find(d => d.mesh === hit);
    if (deb && flatDistance(shipGroup.position, deb.mesh.position) <= Game.tether.maxLength) return deb;
  }

  // Priority 2: forward salvage-scan cone. This matches the ship-window logic:
  // from inside the cockpit, debris reads as flat contacts in front of the ship.
  const forward = forwardFlatVector();
  let best = null;
  let bestScore = Infinity;
  debrisList.forEach((deb) => {
    if (!isWorldPointVisible(deb.mesh.position, 90)) return;
    const offset = deb.mesh.position.clone().sub(shipGroup.position).setY(0);
    const distance = offset.length();
    if (distance < 1 || distance > Game.tether.maxLength) return;
    const dir = offset.clone().normalize();
    const angle = Math.acos(clamp(forward.dot(dir), -1, 1));
    if (angle > targetConeHalfAngle) return;
    const score = angle * 180 + distance * 0.18;
    if (score < bestScore) {
      bestScore = score;
      best = deb;
    }
  });
  return best;
}

function updateTacticalCamera() {
  tacticalCamera.aspect = window.innerWidth / window.innerHeight;
  tacticalCamera.updateProjectionMatrix();

  // True 2D-style tactical camera. It follows the ship position, but it does
  // NOT follow the ship rotation. This prevents the camera from swinging around
  // when the ship turns and keeps mouse aiming predictable.
  tacticalCamera.position.set(shipGroup.position.x, 260, shipGroup.position.z + 0.01);
  tacticalCamera.lookAt(shipGroup.position.x, 0, shipGroup.position.z);
}

function spawnDebris(count = 1, center = shipGroup.position) {
  for (let i = 0; i < count; i++) {
    const type = chooseDebrisType();
    const dist = rand(180, debrisFieldRadius);
    const theta = rand(0, Math.PI * 2);
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(type.size, 0), makeMat(type.color));
    mesh.position.set(
      center.x + dist * Math.cos(theta),
      rand(-debrisVisualYRange, debrisVisualYRange),
      center.z + dist * Math.sin(theta)
    );
    mesh.userData.kind = "debrisMesh";
    universeGroup.add(mesh);
    debrisList.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
      type,
      mesh,
      velocity: new THREE.Vector3(rand(-1.5, 1.5), 0, rand(-1.5, 1.5)),
      spin: new THREE.Vector3(rand(-0.03,0.03), rand(-0.03,0.03), rand(-0.03,0.03))
    });
  }
}


function setMode(nextMode, options = {}) {
  const {
    clearKeys = true,
    captureFlightHeading = false,
    interiorPosition = new THREE.Vector3(0, 1.6, -3.2)
  } = options;
  const isFlight = nextMode === "flight";
  const isInterior = nextMode === "interior";
  const isInteractive = isFlight || isInterior;

  if (clearKeys) keys.clear();

  if (!isInterior) {
    safeExitPointerLock();
    pointerLocked = false;
  }

  Game.mode = nextMode;
  Game.fallbackLookActive = false;

  ui.crosshair.classList.toggle("hidden", !isInteractive || isFlight);
  renderer.domElement.style.cursor = isFlight ? "crosshair" : (isInterior && !Game.pointerLockDenied ? "crosshair" : "default");

  flightGrid.visible = isFlight;
  targetCone.visible = isFlight;
  targetConeLine.visible = isFlight;
  pilotSeat.visible = isInterior;

  if (isFlight) {
    shipGroup.position.y = 0;
    shipVelocity.y = 0;
    if (captureFlightHeading) {
      Game.flightYaw = shipGroup.rotation.y;
      Game.flightPitch = 0;
    }
    shipGroup.rotation.set(Game.flightPitch, Game.flightYaw, 0, "YXZ");
    playerYaw.position.set(0, 1.6, -4.25);
    playerYaw.rotation.set(0, 0, 0);
    playerPitch.rotation.set(0, 0, 0);
    updateTacticalCamera();
  } else if (isInterior) {
    playerYaw.position.copy(interiorPosition);
    playerYaw.rotation.set(0, 0, 0);
    playerPitch.rotation.set(0, 0, 0);
    safeRequestPointerLock();
  }
}


function resetGame() {
  Game.cargo.forEach(c => { if (c.mesh) removeAndDispose(shipGroup, c.mesh); });
  resetGameState(Game);
  releaseTether(false);
  shipGroup.position.set(0, 0, 0);
  shipGroup.rotation.set(0, 0, 0);
  shipVelocity.set(0, 0, 0);
  debrisList.forEach(d => removeAndDispose(universeGroup, d.mesh));
  debrisList.length = 0;
  cargoInteractables.length = 0;
  spawnDebris(32);
  ui.startScreen.classList.add("hidden");
  ui.shopScreen.classList.add("hidden");
  ui.endScreen.classList.add("hidden");
  setMode("interior", { interiorPosition: new THREE.Vector3(0, 1.6, 2.4) });
  log(Game.pointerLockDenied ? "Systems online. Hold right mouse to look around inside. Sit in the pilot seat for 2D flight." : "Systems online. Look at the blue pilot seat and press F to fly.");
}

function releaseTether(show = true) {
  Game.tether.active = false;
  Game.tether.debris = null;
  Game.tether.length = 0;
  tetherLine.visible = false;
  if (show) log("Tether released.");
}

function fireGrapple(deb) {
  const distance = flatDistance(shipGroup.position, deb.mesh.position);
  if (distance > Game.tether.maxLength) return toast("Out of tether range");
  Game.tether.active = true;
  Game.tether.debris = deb;
  Game.tether.length = distance;
  tetherLine.visible = true;
  toast(`Tether locked: ${deb.type.name}`);
  log(`Tether locked to ${deb.type.name}. Scroll wheel winches it into the cargo intake.`);
}

function enterFlightMode() {
  if (Game.carrying) return toast("Put cargo down first");
  setMode("flight", { captureFlightHeading: true });
  log("Pilot controls engaged. 2D tactical flight: mouse aims, W thrust, S brake/reverse, click debris to grapple, scroll reels.");
}

function leavePilotSeat() {
  shipVelocity.set(0, 0, 0);
  setMode("interior", { interiorPosition: new THREE.Vector3(0, 1.6, -3.2) });
  log("Left pilot seat. Walk to cargo bay and processor.");
}

function openShop() {
  Game.modeBeforeShop = Game.mode;
  releaseTether(false);
  setMode("shop");
  updateShopUI();
  ui.shopScreen.classList.remove("hidden");
  log("Docked at the salvage station network.");
}

function closeShop() {
  const returnMode = Game.modeBeforeShop === "flight" ? "flight" : "interior";
  ui.shopScreen.classList.add("hidden");
  setMode(returnMode, { interiorPosition: new THREE.Vector3(0, 1.6, -3.2) });

  if (returnMode === "flight") {
    log("Undocked. Still seated. Mouse aims the ship; W/S controls thrust.");
  } else {
    log(Game.pointerLockDenied ? "Undocked. Hold right mouse to look around." : "Undocked. Back aboard the junker.");
  }
}


function updateInterior(dt) {
  const speed = Game.carrying ? 3.9 : 5.4;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerYaw.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(playerYaw.quaternion);
  forward.y = 0; right.y = 0; forward.normalize(); right.normalize();
  const move = new THREE.Vector3();
  if (keys.has("w")) move.add(forward);
  if (keys.has("s")) move.sub(forward);
  if (keys.has("a")) move.sub(right);
  if (keys.has("d")) move.add(right);
  if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);
  playerYaw.position.add(move);
  playerYaw.position.x = clamp(playerYaw.position.x, -4.4, 4.4);
  playerYaw.position.z = clamp(playerYaw.position.z, -6.55, 6.55);
  playerYaw.position.y = 1.6;
  if (Game.carrying) {
    const processorWorld = new THREE.Vector3();
    processor.getWorldPosition(processorWorld);
    const heldWorld = getHeldCargoWorldPosition();
    if (!Game.processing && heldWorld.distanceTo(processorWorld) < 2.15) startProcessing(Game.carrying);
  }
}

function updateFlight(dt) {
  updateShipAimFromMouse();

  const forward = forwardFlatVector();
  if (keys.has("w") && Game.fuel > 0) {
    shipVelocity.add(forward.clone().multiplyScalar(38 * dt));
    Game.fuel = Math.max(0, Game.fuel - 5.5 * dt);
  }
  if (keys.has("s") && Game.fuel > 0) {
    shipVelocity.add(forward.clone().multiplyScalar(-20 * dt));
    Game.fuel = Math.max(0, Game.fuel - 2.8 * dt);
  }
  if (!keys.has("w") && !keys.has("s")) Game.fuel = Math.min(Game.maxFuel, Game.fuel + 1.0 * dt);

  shipVelocity.y = 0;
  shipVelocity.multiplyScalar(0.992);
  if (shipVelocity.length() > 72) shipVelocity.setLength(72);

  shipGroup.position.add(shipVelocity.clone().multiplyScalar(dt));
  shipGroup.position.y = 0;

  Game.nearStation = flatDistance(shipGroup.position, station.position) < 120;
  updateTether(dt);
  updateTacticalCamera();
}

function getCargoIntakeWorld() { return cargoIntakeLocal.clone().applyMatrix4(shipGroup.matrixWorld); }

function updateTether(dt) {
  if (!Game.tether.active || !Game.tether.debris) return;
  const deb = Game.tether.debris;
  if (!debrisList.includes(deb)) { releaseTether(false); return; }
  if (!canStore(deb.type) && Game.tether.length < Game.tether.fullCargoSafeLength) Game.tether.length = Game.tether.fullCargoSafeLength;

  const intake = getCargoIntakeWorld();
  intake.y = 0;
  const toIntake = intake.clone().sub(deb.mesh.position).setY(0);
  const dist = Math.max(0.1, toIntake.length());
  if (dist > Game.tether.maxLength * 1.35) {
    toast("Tether snapped");
    releaseTether();
    return;
  }
  if (dist > Game.tether.length) {
    const force = (dist - Game.tether.length) * Game.tether.pullStrength * dt;
    const dir = toIntake.normalize();
    deb.velocity.add(dir.clone().multiplyScalar(force / deb.type.mass));
    shipVelocity.add(dir.clone().multiplyScalar(-force * 0.035));
  }
  deb.velocity.y = 0;
  const stabilized = Game.tether.length <= intakeFieldRadius || dist <= intakeSafetyRadius;
  // The intake zone should prevent unfair hull damage, not make the debris
  // feel like it is stuck in syrup. Keep normal tether drag so reeling stays responsive.
  deb.velocity.multiplyScalar(0.988);
  if (stabilized) {
    const guide = toIntake.lengthSq() > 0 ? toIntake.clone().normalize() : new THREE.Vector3();
    deb.velocity.add(guide.multiplyScalar(22 * dt));
  }
  const winchedIn = Game.tether.length <= Game.tether.storeDistance;
  if (winchedIn && dist <= Game.tether.captureDistance && canStore(deb.type)) {
    const dir = toIntake.normalize();
    deb.velocity.add(dir.clone().multiplyScalar(Game.tether.capturePull * dt));
    if (dist <= Game.tether.storeDistance + 2) {
      addCargoToShip(deb.type);
      removeAndDispose(universeGroup, deb.mesh);
      const i = debrisList.indexOf(deb);
      if (i >= 0) debrisList.splice(i, 1);
      releaseTether(false);
      spawnDebris(1);
      toast("Cargo secured");
      log(`${deb.type.name} reeled into cargo bay. Leave the seat and process it.`);
      return;
    }
  }
  tetherLine.geometry.setFromPoints([intake, deb.mesh.position]);
}

function maintainDebrisField() {
  for (let i = debrisList.length - 1; i >= 0; i--) {
    const deb = debrisList[i];
    if (Game.tether.active && Game.tether.debris === deb) continue;
    if (flatDistance(deb.mesh.position, shipGroup.position) > debrisDespawnRadius) {
      removeAndDispose(universeGroup, deb.mesh);
      debrisList.splice(i, 1);
    }
  }
  if (debrisList.length < minDebrisCount) spawnDebris(minDebrisCount - debrisList.length, shipGroup.position);
}

function updateDebris(dt) {
  debrisList.forEach((deb) => {
    deb.velocity.y = 0;
    deb.mesh.position.add(deb.velocity.clone().multiplyScalar(dt));
    deb.mesh.rotation.x += deb.spin.x;
    deb.mesh.rotation.y += deb.spin.y;
    deb.mesh.rotation.z += deb.spin.z;
    const dist = flatDistance(deb.mesh.position, shipGroup.position);
    if (Game.mode === "flight" && dist < 5.5) {
      const tethered = Game.tether.active && Game.tether.debris === deb;
      const stabilized = tethered && (Game.tether.length <= intakeFieldRadius || dist <= intakeSafetyRadius);
      const relativeSpeed = shipVelocity.distanceTo(deb.velocity);
      const rawDamage = Math.round(3 + deb.type.mass * relativeSpeed * 0.08);
      const damage = stabilized ? 0 : rawDamage;
      if (stabilized) {
        // Controlled cargo should not punish the player with catastrophic impact damage.
        // No bounce here either, because bounce makes the final reel-in feel worse.
        if (rawDamage > 10) log(`Intake field controlled ${deb.type.name}. No hull damage.`);
      } else if (damage > 4) {
        Game.hull = Math.max(0, Game.hull - damage);
        const bounce = deb.mesh.position.clone().sub(shipGroup.position).setY(0).normalize();
        deb.velocity.add(bounce.clone().multiplyScalar(10));
        shipVelocity.add(bounce.clone().multiplyScalar(-2));
        log(`Impact with ${deb.type.name}. Hull damage: ${damage}.`);
        if (Game.hull <= 0) endGame(false, "Your ship shattered against space junk.");
      }
    }
  });
}

function updateTargets() {
  Game.prompt = "";
  Game.targetedObject = null;
  Game.targetedDebris = null;
  ui.crosshair.classList.remove("active");

  if (Game.mode === "interior") {
    raycaster.setFromCamera(center, camera);
    const objects = [pilotSeat, processor, storage, ...cargoInteractables];
    const hits = raycaster.intersectObjects(objects, false);
    if (hits.length && hits[0].distance < 4.2) {
      const obj = hits[0].object;
      Game.targetedObject = obj;
      ui.crosshair.classList.add("active");
      if (obj.userData.kind === "pilot") Game.prompt = "[F] Sit in pilot seat";
      else if (obj.userData.kind === "storage") Game.prompt = "Storage locker";
      else if (obj.userData.kind === "processor") Game.prompt = Game.processing ? `Processing ${Game.processing.type.name}` : Game.carrying ? `Walk cargo into processor` : "Processor: carry cargo here";
      else if (obj.userData.kind === "cargo") Game.prompt = `[Click] Pick up ${obj.userData.cargo.type.name}`;
    }
    if (Game.carrying) Game.prompt = `Holding ${Game.carrying.type.name}. Walk it into the processor. Click to put down.`;
  } else if (Game.mode === "flight") {
    const deb = findMouseDebrisTarget();
    if (deb) {
      Game.targetedDebris = deb;
      ui.crosshair.classList.add("active");
      const d = Math.round(flatDistance(shipGroup.position, deb.mesh.position));
      Game.prompt = `[Click] Grapple ${deb.type.name} · ${d}m`;
    }
    if (Game.tether.active && Game.tether.debris) {
      const canFit = canStore(Game.tether.debris.type);
      Game.prompt = canFit
        ? `Tethered ${Game.tether.debris.type.name} · winch ${Math.round(Game.tether.length)}m · scroll to reel · ${Game.tether.length <= intakeFieldRadius ? "INTAKE SHIELD ACTIVE" : ""}`
        : `Cargo full: towing ${Game.tether.debris.type.name}, intake locked`;
    } else if (Game.nearStation) Game.prompt = "[E] Dock / access station shop";
    else if (!Game.prompt) Game.prompt = "[F] Leave pilot seat";
  }
}

function getHeldCargoWorldPosition() {
  const pos = new THREE.Vector3(0.75, -0.55, -1.25);
  pos.applyMatrix4(camera.matrixWorld);
  return pos;
}

function drawHeldCargo() {
  if (!drawHeldCargo.mesh) {
    drawHeldCargo.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), makeMat(0xffffff));
    drawHeldCargo.mesh.position.set(0.75, -0.55, -1.25);
    camera.add(drawHeldCargo.mesh);
  }
  const mesh = drawHeldCargo.mesh;
  if (Game.carrying) {
    mesh.visible = true;
    mesh.material.color.setHex(Game.carrying.type.color);
    const s = Game.carrying.type.cargoSize > 1 ? 1.35 : 1.0;
    mesh.scale.set(s, s, s);
  } else mesh.visible = false;
}

function drawMiniMap() {
  const box = ui.miniMap;
  box.style.display = Game.mode === "flight" && Game.running ? "block" : "none";
  if (Game.mode !== "flight" || !Game.running) return;

  const w = miniMapCanvas.width;
  const h = miniMapCanvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const range = 650;
  const scale = (w * 0.42) / range;

  miniMapCtx.clearRect(0, 0, w, h);
  miniMapCtx.fillStyle = "rgba(0, 12, 20, 0.72)";
  miniMapCtx.fillRect(0, 0, w, h);

  miniMapCtx.strokeStyle = "rgba(85,231,255,0.25)";
  miniMapCtx.lineWidth = 1;
  miniMapCtx.beginPath();
  miniMapCtx.arc(cx, cy, w * 0.22, 0, Math.PI * 2);
  miniMapCtx.arc(cx, cy, w * 0.42, 0, Math.PI * 2);
  miniMapCtx.moveTo(cx, 8);
  miniMapCtx.lineTo(cx, h - 8);
  miniMapCtx.moveTo(8, cy);
  miniMapCtx.lineTo(w - 8, cy);
  miniMapCtx.stroke();

  function plotWorld(pos, color, size = 3, clampToEdge = true) {
    let dx = pos.x - shipGroup.position.x;
    let dz = pos.z - shipGroup.position.z;
    const dist = Math.hypot(dx, dz);
    let edge = false;
    if (clampToEdge && dist > range) {
      dx = (dx / dist) * range;
      dz = (dz / dist) * range;
      edge = true;
    }
    const x = cx + dx * scale;
    const y = cy + dz * scale;
    miniMapCtx.fillStyle = color;
    miniMapCtx.beginPath();
    miniMapCtx.arc(x, y, edge ? size + 1.5 : size, 0, Math.PI * 2);
    miniMapCtx.fill();
  }

  debrisList.forEach((deb) => plotWorld(deb.mesh.position, deb === Game.tether.debris ? "#ffd966" : "#9fdcff", deb === Game.tether.debris ? 4 : 2.4));
  plotWorld(station.position, "#42ff7a", 5);

  miniMapCtx.save();
  miniMapCtx.translate(cx, cy);
  miniMapCtx.rotate(-Game.flightYaw);
  miniMapCtx.fillStyle = "#ffffff";
  miniMapCtx.beginPath();
  miniMapCtx.moveTo(0, -8);
  miniMapCtx.lineTo(5, 6);
  miniMapCtx.lineTo(0, 3);
  miniMapCtx.lineTo(-5, 6);
  miniMapCtx.closePath();
  miniMapCtx.fill();
  miniMapCtx.restore();

  miniMapCtx.fillStyle = "rgba(190,255,210,0.9)";
  miniMapCtx.font = "10px Courier New";
  miniMapCtx.fillText("SCAN", 10, 16);
  miniMapCtx.fillText("station", 10, h - 10);
}

function updateHUD() {
  ui.modeTitle.textContent = Game.mode === "interior" ? "INTERIOR" : Game.mode === "flight" ? "PILOTING" : Game.mode === "shop" ? "DOCKED" : "END";
  ui.uiCredits.textContent = Game.credits;
  ui.uiScore.textContent = Game.score;
  ui.uiGoal.textContent = Game.goal;
  ui.uiCargo.textContent = `${cargoUsed()}/${Game.cargoCapacity}`;
  ui.uiMaterials.textContent = Game.materials;
  ui.uiSpeed.textContent = Math.round(shipVelocity.length());
  ui.timer.textContent = formatTime(Game.elapsed);
  ui.hullBar.style.width = `${(Game.hull / Game.maxHull) * 100}%`;
  ui.hullBar.style.background = Game.hull < 30 ? "var(--red)" : "var(--green)";
  ui.fuelBar.style.width = `${(Game.fuel / Game.maxFuel) * 100}%`;
  ui.fuelBar.style.background = Game.fuel < 25 ? "var(--yellow)" : "var(--cyan)";
  ui.statusLamp.textContent = Game.hull < 30 ? "WARNING" : "ONLINE";
  ui.statusLamp.className = Game.hull < 30 ? "red" : "";

  if (Game.mode === "interior") {
    ui.controlMode.textContent = Game.pointerLockDenied ? "DRAG LOOK" : "POINTER LOCK";
    ui.controlsText.innerHTML = Game.pointerLockDenied
      ? "WASD walk · Hold right mouse + drag look · F sit in pilot seat · Left-click cargo pick up/drop"
      : "WASD walk · Mouse look · F sit in pilot seat · Click cargo pick up/drop";
    ui.objectiveText.innerHTML = "Use the pilot seat to fly. Cargo appears in the yellow bay. Pick it up close-range and carry it into the purple processor.";
  } else if (Game.mode === "flight") {
    ui.controlMode.textContent = "2D MOUSE";
    ui.controlsText.innerHTML = "Visible mouse aims · W thrust · S brake/reverse · Left-click debris grapple/release · Scroll reel · F stand up";
    ui.objectiveText.innerHTML = "2D tactical flight. The scanner cone is shorter now and only assists with visible debris, so it should stop grabbing off-screen targets.";
  }
  const cp = ui.centerPrompt;
  cp.textContent = Game.prompt;
  cp.style.display = Game.prompt ? "block" : "none";
  drawMiniMap();
}


function endGame(won, text) {
  Game.running = false;
  releaseTether(false);
  setMode("end");
  ui.endScreen.classList.remove("hidden");
  ui.shopScreen.classList.add("hidden");
  ui.endTitle.textContent = won ? "CONTRACT COMPLETE" : "CONTRACT FAILED";
  ui.endTitle.style.color = won ? "var(--green)" : "var(--red)";
  ui.endText.textContent = text;
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (Game.running) {
    Game.elapsed += dt;
    if (Game.mode === "interior") updateInterior(dt);
    if (Game.mode === "flight") {
      updateFlight(dt);
      maintainDebrisField();
    }
    updateDebris(dt);
    processCargo(dt);
    updateTargets();
  }
  station.rotation.z += dt * 0.25;
  drawHeldCargo();
  updateHUD();
  const activeCamera = Game.mode === "flight" ? tacticalCamera : camera;
  renderer.render(scene, activeCamera);
}

function runSelfTests() {
  console.group("Space Scavenger Hybrid self-tests");
  console.assert(typeof safeRequestPointerLock === "function", "safeRequestPointerLock exists");
  console.assert(typeof updateTacticalCamera === "function", "updateTacticalCamera exists");
  console.assert(typeof mouseWorldOnFlightPlane === "function", "mouseWorldOnFlightPlane exists");
  console.assert(cargoUsed() === 0, "Initial cargo is empty");
  console.assert(canStore(debrisTypes[0]) === true, "Small cargo fits in empty hold");
  Game.flightYaw = 0.75;
  Game.flightPitch = 0;
  shipGroup.rotation.set(0, Game.flightYaw, 0, "YXZ");
  console.assert(Math.abs(shipGroup.rotation.x) < 0.000001 && Math.abs(shipGroup.rotation.z) < 0.000001, "Flight steering keeps pitch and roll at zero");
  console.assert(room.material[2].transparent === false && room.material[3].transparent === false && room.material[4].transparent === false, "Ceiling, floor, and rear wall are opaque");
  console.assert(pilotSeat.visible === true, "Pilot seat starts visible before piloting");
  console.groupEnd();
}

configureCargo({
  THREE,
  makeMat,
  rand,
  shipGroup,
  playerYaw,
  cargoInteractables,
  processor
});
configureEconomy({ formatTime, endGame });
registerInputHandlers({
  keys,
  getPointerLocked: () => pointerLocked,
  setPointerLocked: (value) => { pointerLocked = value; },
  setPointerLockFallback,
  safeRequestPointerLock,
  applyLookDelta,
  closeShop,
  openShop,
  enterFlightMode,
  leavePilotSeat,
  releaseTether,
  findMouseDebrisTarget,
  fireGrapple,
  clamp
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  tacticalCamera.aspect = window.innerWidth / window.innerHeight;
  tacticalCamera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

ui.startBtn.addEventListener("click", resetGame);
ui.restartBtn.addEventListener("click", resetGame);
ui.undockBtn.addEventListener("click", closeShop);
ui.sellMaterialsBtn.addEventListener("click", sellMaterials);
ui.buyCargoBtn.addEventListener("click", buyCargo);
ui.buyWorkbenchBtn.addEventListener("click", buyProcessor);
ui.repairBtn.addEventListener("click", repairHull);
ui.refuelBtn.addEventListener("click", refuel);

spawnDebris(32);
runSelfTests();
requestAnimationFrame(loop);
