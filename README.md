# Space Scavenger Hybrid

Space Scavenger Hybrid is currently a browser-based Three.js prototype in a single HTML file. It already supports the full core loop: walk inside the ship, sit in the pilot seat, fly in 2D tactical mode, grapple debris, store cargo, process materials, dock at the shop, upgrade, and repeat.

This document is a safe development plan for improving the project without rewriting or removing working features.

## 1. Main systems currently mixed together

The single HTML file combines these systems:

- **Page shell and HUD markup**: the canvas mount, crosshair, HUD panels, minimap canvas, start screen, shop screen, and end screen.
- **Styling/theme**: all terminal-green visual styling, HUD layout, panels, overlays, buttons, minimap sizing, responsive rules, and prompts.
- **Global game state/config**: the `Game` object, cargo states, debris type table, upgrade costs, tether tuning, and runtime flags.
- **Three.js scene setup**: renderer, cameras, scene fog/background, universe group, ship group, lights, stars, station, flight grid, interior room, consoles, targeting cone, and tether line.
- **Input and pointer-lock handling**: keyboard state, pointer-lock fallback, mouse look, flight cursor aiming, right-drag look fallback, click interactions, and wheel winching.
- **Interior mode**: first-person movement, raycast targeting of consoles/cargo, pilot-seat entry, cargo pickup/drop, held-cargo rendering, and processor loading.
- **2D tactical flight mode**: mouse-to-plane aiming, flattened ship steering, thrust/brake/fuel, overhead camera, station proximity, debris targeting, and flight HUD behavior.
- **Debris and tether gameplay**: debris spawning/despawning, weighted debris types, flat-distance math, tether fire/release, winch length, intake-field capture, hull impacts, and cargo conversion.
- **Cargo/processing/economy**: cargo capacity, processor progress/yield, materials, selling, contract score, repair, refuel, and upgrade purchases.
- **UI refresh loop**: HUD updates, minimap drawing, shop UI updates, prompts, logs, toasts, and cursor/crosshair state.
- **Game lifecycle/tests**: reset, end-game flow, resize handling, event listener registration, animation loop, and console self-tests.

## 2. Obvious bugs, fragile areas, and duplicated logic

- **Restart can duplicate starting debris**: the file spawns debris once on page load for self-tests/start visuals, then `resetGame()` removes debris and spawns again. That works for a normal start, but it means startup state and reset state are coupled. A clearer `initializeWorld()` vs. `resetRun()` split would reduce surprises.
- **Mode transitions are fragile**: `enterFlightMode()`, `leavePilotSeat()`, `openShop()`, `closeShop()`, and `endGame()` each manually toggle some combination of cursor, crosshair, pointer lock, pilot-seat visibility, flight grid visibility, camera, and key state. It is easy for one transition to forget a flag.
- **Flight-grid and targeting-cone visibility are not fully symmetrical**: `closeShop()` restores `flightGrid` and pilot-seat visibility when returning to flight, but the targeting cone visibility is handled elsewhere and could be left inconsistent after future edits.
- **Cargo mesh creation is duplicated**: `addCargoToShip()` and `putCargoBack()` both build a cargo cube, assign `userData`, attach it to `shipGroup`, and push it into `cargoInteractables`.
- **Cargo removal does not dispose geometry/materials**: debris and cargo meshes are removed from the scene, but geometry/material disposal is not centralized. This is acceptable for a prototype, but longer sessions or future content could leak GPU resources.
- **DOM lookups are repeated every frame**: `updateHUD()` and related functions repeatedly call `$()` for the same elements. It is simple but fragile because a typo only fails at runtime and repeated lookups make the HUD harder to split later.
- **Magic numbers are spread through gameplay code**: movement speeds, room bounds, camera height, fuel costs, debris radii, station docking range, collision ranges, processing formulas, and upgrade formulas live directly inside functions.
- **Self-tests mutate live state**: `runSelfTests()` changes `Game.flightYaw` and `shipGroup.rotation`. The current assertions restore enough to be harmless at startup, but future tests should use helpers or restore all changed state explicitly.
- **Pointer-lock fallback and cursor state are intertwined with UI state**: pointer lock, drag-look fallback, cursor style, and control text are changed from several places, making browser/sandbox behavior harder to reason about.
- **Shop/economy UI and economy rules are coupled**: cost formulas and purchase effects live beside button text and disabled-state updates, which makes balance changes riskier than necessary.

## 3. Safe folder/module structure

A beginner-friendly split should keep behavior identical at first. Use native browser ES modules and keep Three.js loaded from the existing CDN until the project is ready for a build tool.

Suggested structure:

```text
SpaceScavenger/
├── index.html
├── README.md
└── src/
    ├── main.js              # bootstraps the app, registers events, starts loop
    ├── state.js             # createInitialGameState(), CargoState, runtime state
    ├── config.js            # debrisTypes, tuning constants, upgrade formulas
    ├── dom.js               # cached DOM references, toast(), log()
    ├── scene/
    │   ├── setupScene.js    # scene, renderer, cameras, groups, resize
    │   ├── interior.js      # room, consoles, cargo bay, held-cargo visual
    │   ├── space.js         # stars, station, flight grid, debris visuals
    │   └── materials.js     # makeMat(), shared material helpers
    ├── input.js             # keyboard/mouse/pointer-lock event handling
    ├── modes.js             # enterFlightMode(), leavePilotSeat(), shop/end transitions
    ├── flight.js            # 2D aiming, movement, tactical camera, station proximity
    ├── debris.js            # spawn/despawn/update debris, targeting helpers
    ├── tether.js            # fire/release/update tether, intake capture
    ├── cargo.js             # cargo storage, pickup/drop, processing lifecycle
    ├── economy.js           # selling, upgrade, repair, refuel rules
    ├── hud.js               # updateHUD(), minimap, shop panel rendering
    └── selfTests.js         # console assertions and lightweight smoke checks
```

Safe migration order:

1. Rename the HTML file to `index.html` only after verifying the game still loads locally.
2. Extract constants and pure helpers first (`config.js`, `state.js`, simple math helpers). These are the least risky.
3. Cache DOM references in `dom.js` while preserving all existing element IDs.
4. Move one gameplay system at a time, starting with economy/shop because it has fewer Three.js dependencies.
5. Move scene construction last, because object references are shared widely across gameplay systems.

## 4. First 3–5 improvements with the biggest payoff

1. **Add a development README and rename the HTML to `index.html`**.
   - Payoff: makes the project approachable and easier to run.
   - Risk: very low if links/scripts stay unchanged.

2. **Introduce cached DOM references and UI helper functions**.
   - Payoff: reduces repeated `document.getElementById` calls, makes HUD/shop updates easier to test, and catches missing element IDs earlier.
   - Risk: low; keep all IDs unchanged.

3. **Centralize mode transitions**.
   - Payoff: prevents cursor, crosshair, pointer-lock, pilot-seat, flight-grid, and targeting-cone state from drifting apart.
   - Risk: medium; test every transition manually.

4. **Create cargo/debris mesh helper functions and disposal helpers**.
   - Payoff: removes duplicate cargo cube creation and prepares the prototype for longer play sessions.
   - Risk: low to medium; cargo pickup/drop/store/process must be tested carefully.

5. **Extract gameplay constants into a config section/module**.
   - Payoff: makes balance tuning safer and more beginner-friendly without changing mechanics.
   - Risk: low if values are copied exactly.

## 5. Manual tests after each change

After every small refactor, manually verify the full loop:

1. Load the page and confirm the start screen appears with the existing visual style.
2. Click **Start** and confirm either pointer lock works or the right-mouse drag-look fallback message appears.
3. Walk around the ship with **WASD** and confirm wall bounds still prevent leaving the interior.
4. Look at the blue pilot seat and press **F** to enter 2D tactical flight.
5. Move the mouse and confirm the ship turns under the stable overhead camera without camera spin.
6. Use **W/S** to thrust/brake and confirm fuel changes and speed updates.
7. Click debris to grapple it, scroll to reel it in, and confirm cargo is secured when it reaches the intake.
8. Press **F** to leave the pilot seat after releasing or securing tethered debris.
9. Pick up cargo in the yellow bay, carry it to the purple processor, and confirm processing starts and completes.
10. Fly near the salvage station, press **E**, sell materials, repair/refuel if needed, buy upgrades if affordable, and undock.
11. Confirm the minimap only appears in flight mode and tracks station/debris/cargo target state.
12. Confirm losing all hull triggers the failure screen and reaching the contract goal triggers the completion screen.
13. Open the browser console and confirm the self-tests do not report failed assertions.

## Suggested small first commit

**Commit title:** `Document prototype structure and refactor plan`

Beginner-friendly changes:

- Add this README with a map of the current systems so new contributors know where features live.
- Document the safest module split before moving code.
- List manual regression tests for the existing gameplay loop.
- Do not change game code yet; this keeps the working prototype intact while creating a clear checklist for future commits.
