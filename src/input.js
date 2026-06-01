import { TUNING } from "./config.js";
import { clamp } from "./math.js";
import { Game } from "./state.js";
import { toast, log, ui } from "./dom.js";
import { canStore, pickUpCargo, putCargoBack } from "./cargo.js";

export function registerInputHandlers({
  keys,
  getPointerLocked,
  setPointerLocked,
  setPointerLockFallback,
  safeRequestPointerLock,
  applyLookDelta,
  closeShop,
  openShop,
  enterFlightMode,
  leavePilotSeat,
  releaseTether,
  findMouseDebrisTarget,
  fireGrapple
}) {
  document.addEventListener("pointerlockchange", () => {
    setPointerLocked(document.pointerLockElement === document.body);
    if (getPointerLocked()) {
      Game.pointerLockDenied = false;
      ui.controlMode.textContent = "POINTER LOCK";
    }
  });

  document.addEventListener("pointerlockerror", () => {
    if (Game.mode === "interior") setPointerLockFallback("pointerlockerror event");
  });

  document.addEventListener("mousemove", (e) => {
    Game.mouse.x = e.clientX;
    Game.mouse.y = e.clientY;
    if (Game.mode === "shop" || Game.mode === "end") return;

    // Interior keeps first-person mouselook. Flight deliberately uses visible
    // 2D cursor aiming, so moving the mouse should aim, not rotate by delta.
    if (Game.mode === "flight") return;

    if (getPointerLocked()) {
      applyLookDelta(e.movementX || 0, e.movementY || 0);
      return;
    }
    if (Game.pointerLockDenied && Game.fallbackLookActive) {
      const dx = e.clientX - Game.lastMouseX;
      const dy = e.clientY - Game.lastMouseY;
      Game.lastMouseX = e.clientX;
      Game.lastMouseY = e.clientY;
      applyLookDelta(dx, dy);
    }
  });

  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();

    if (k === "escape" && Game.mode === "shop") {
      closeShop();
      return;
    }

    if (Game.mode === "shop" || Game.mode === "end") return;

    keys.add(k);
    if (!Game.running) return;
    if (k === "e") {
      if (Game.mode === "flight" && Game.nearStation) openShop();
    }
    if (k === "f") {
      if (Game.mode === "flight" && !Game.tether.active) leavePilotSeat();
      else if (Game.mode === "interior" && Game.targetedObject && Game.targetedObject.userData.kind === "pilot") enterFlightMode();
    }
  });

  document.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  document.addEventListener("mousedown", (e) => {
    if (!Game.running) return;
    if (Game.mode === "shop" || Game.mode === "end") return;

    Game.mouse.x = e.clientX;
    Game.mouse.y = e.clientY;

    if (Game.mode === "interior" && !getPointerLocked() && !Game.pointerLockDenied) safeRequestPointerLock();

    if (Game.mode === "interior" && Game.pointerLockDenied && e.button === 2) {
      Game.fallbackLookActive = true;
      Game.lastMouseX = e.clientX;
      Game.lastMouseY = e.clientY;
      e.preventDefault();
      return;
    }

    if (e.button !== 0) return;
    if (Game.mode === "flight") {
      if (Game.tether.active) releaseTether();
      else {
        const target = findMouseDebrisTarget();
        if (target) fireGrapple(target);
        else {
          toast("Click directly on debris");
          log("No debris under the cursor. Aim with the mouse and click a chunk of salvage to fire the tether.");
        }
      }
    } else if (Game.mode === "interior") {
      if (Game.carrying) putCargoBack();
      else if (Game.targetedObject && Game.targetedObject.userData.kind === "cargo") pickUpCargo(Game.targetedObject.userData.cargo);
    }
  });

  document.addEventListener("mouseup", (e) => {
    if (e.button === 2) Game.fallbackLookActive = false;
  });

  document.addEventListener("contextmenu", (e) => {
    if (Game.pointerLockDenied && Game.running && Game.mode === "interior") e.preventDefault();
  });

  document.addEventListener("wheel", (e) => {
    if (Game.mode !== "flight" || !Game.tether.active || !Game.tether.debris) return;
    e.preventDefault();
    const cargoCanFit = canStore(Game.tether.debris.type);
    const minLength = cargoCanFit ? TUNING.tether.storeDistance * 0.65 : TUNING.tether.fullCargoSafeLength;
    const amount = e.deltaY > 0 ? -8 : 8;
    Game.tether.length = clamp(Game.tether.length + amount, minLength, TUNING.tether.maxLength);
    if (!cargoCanFit && Game.tether.length <= minLength) {
      toast("Cargo full: intake locked");
      log("Cargo hold full. You can tow debris, but the winch will not pull it into the ship.");
    }
  }, { passive: false });
}
