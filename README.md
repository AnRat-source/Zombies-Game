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

## New York reference map

The current New York campaign asynchronously loads the standard **OpenStreetMap** tile layer for ground reference. This adds current streets and building footprints while keeping the game playable offline: failed or unavailable tile requests fall back to the bundled procedural terrain. The map displays the required [© OpenStreetMap contributors attribution](https://www.openstreetmap.org/copyright); production deployments should use a tile provider appropriate to their expected traffic.

3D structures remain optimized game geometry. High-rise density is concentrated around Lower Manhattan, Midtown, Hudson Yards, Downtown Brooklyn, and Long Island City, but individual extrusions are not yet an import of the official building-footprint/height data.

## Why the buildings are stylized

The offline fallback's borough silhouettes remain geographically inspired, and its building positions and footprints are **procedurally generated**, not a precise import of individual NYC structures. This preserves the fictional, stylized nature of the game while still enabling arbitrary polygon roofs and collision shapes.

## Folder layout

```text
index.html
assets/style.css
assets/polygon-mesh.js
assets/game.js
.github/workflows/pages.yml
README.md
```

## Saved games

Saves stay in local storage under the GitHub Pages site's origin. Export a JSON save as a backup, especially when switching browsers or devices.

## Limits

The view is a game, not real mapping software. Initial stage preparation may take longer on slower phones, but generation work is now spread across browser animation frames. Very high-density scenarios still demand significant CPU/GPU resources.
