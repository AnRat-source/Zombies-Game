# OUTBREAK / CITYFALL — GitHub Pages project

Static 3D fictional-city outbreak strategy game. Independent project; not an official release of *Zombies Aren't Real*.

## GitHub Pages setup

1. Upload the **contents of this folder** to a repository on its `main` branch.
2. In repository **Settings → Pages**, choose **GitHub Actions** as the source.
3. Push to `main` or run **Publish Cityfall** under Actions.
4. Open the generated GitHub Pages URL. No Node, bundler, build tool or server-side runtime is required.

For local previews: `python -m http.server 8000` in this folder, then visit `http://localhost:8000`.

## What changed

- **Persistent, precise zombie heatmap:** world-space histogram of small cells that stays displayed through zoom transitions, overlaid on the 3D ground below buildings. 3D zombies remain visible.
- **Single-plane horde texture:** one cached red-glow image spans the entire world and is updated from nearby zombie density at most four times per second. It replaces hundreds of separate heatmap meshes while remaining beneath structures.
- **Loading without one giant blocking operation:** city layout, population, and static 3D polygon mesh construction yield between frames, with a progress overlay. The main menu opens without eagerly building a whole city.
- **Vertex-placed safe zones:** select Safe zone, tap each corner, then press **FINISH** (or tap the first corner). Use **UNDO** to remove the previous vertex. Cost, capacity, wall geometry and entrance placement follow the polygon. Old rectangle saves remain supported.
- **Non-rectangular buildings:** a mixture of rectangular and six-sided, notched buildings extruded into flat-roofed 3D polygon meshes. Their collision checks use the polygon itself rather than an invisible rectangular barrier.
- **Full site folder:** HTML, stylesheet, game script and polygon-mesh code are separate, so GitHub Pages hosting and future updates are simpler.

## Offline blue-city skyline

New York no longer loads a map, map tile, or remote ground texture. It uses a fully offline blue tactical surface with official NYC Department of City Planning borough-boundary vectors for its coastline. Manhattan street geometry is bundled from the official NYC Street Centerline (CSCL) release: the game uses its centerlines to draw streets and to keep generated building footprints inside real street-defined blocks. Major skyline towers are individually defined buildings: One World Trade Center, the World Trade complex, Empire State, Chrysler, One Vanderbilt, Central Park Tower, Hudson Yards, Downtown Brooklyn, Long Island City, and more. They are real 3D game objects, so they participate in the existing roof placement, damage, collapse, and chain-topple systems.

The lower city remains deliberately stylized and procedural for mobile performance; landmarks are explicit game objects rather than imported building footprints. The source road layer is stored in `assets/nyc-road-data.js`, regenerated with `scripts/build-nyc-road-data.mjs` from the NYC Open Data CSCL GeoJSON export. The vector coastline is stored in `assets/nyc-shore-data.js`, regenerated with `scripts/build-nyc-shore-data.mjs` from NYC Open Data Borough Boundaries.

## Installable mobile app

The site includes `manifest.webmanifest`, an offline service worker, install metadata, 180/192/512 PNG icons, and a Windows `.ico`. On Android/desktop browsers that expose the install prompt, the **INSTALL** button appears in the header. On iOS, use Safari's **Share → Add to Home Screen**. The first online visit caches the application shell for offline launch.

## Rust/WebAssembly acceleration

`wasm/` holds a Rust `wasm-bindgen` module for horde-density aggregation. The browser continues to use its proven JavaScript fallback until a release has generated and deployed `wasm/pkg/`. See [`wasm/README.md`](wasm/README.md) for the build command. Canvas, WebGL rendering, and browser input remain JavaScript because those APIs are browser-native; the numerically repetitive aggregation runs in Rust/WASM when available.

## Why the buildings are stylized

The offline fallback's borough silhouettes remain geographically inspired, and its building positions and footprints are **procedurally generated**, not a precise import of individual NYC structures. This preserves the fictional, stylized nature of the game while still enabling arbitrary polygon roofs and collision shapes.

## Folder layout

```text
index.html
assets/style.css
assets/polygon-mesh.js
assets/game.js
assets/app-install.js
assets/wasm-sim.js
assets/nyc-road-data.js
assets/nyc-shore-data.js
scripts/build-nyc-road-data.mjs
scripts/build-nyc-shore-data.mjs
assets/icons/
manifest.webmanifest
service-worker.js
wasm/
.github/workflows/pages.yml
README.md
```

## Saved games

Saves stay in local storage under the GitHub Pages site's origin. Export a JSON save as a backup, especially when switching browsers or devices.

## Limits

The view is a game, not real mapping software. Initial stage preparation may take longer on slower phones, but generation work is now spread across browser animation frames. Very high-density scenarios still demand significant CPU/GPU resources.
