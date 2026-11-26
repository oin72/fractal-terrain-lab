# Fractal Terrain Lab

A browser lab for fractal terrain (five generation methods) rendered as a realistic landscape: weather, time of day,
grass, trees, animals, fly-through, walk and hunt modes. Owner: Triskelion Technology Ltd.

## Running
- No build step and no dependencies. ES modules need a web server, so do not open `index.html` from disk.
- `python -m http.server 8137 --bind 127.0.0.1 --directory "C:/Code/Fractal Terrain Lab"` then open http://localhost:8137
- The Claude Browser preview uses `C:\Code\.claude\launch.json` (server name `terrain-lab`). A copy is in this project's `.claude` folder.
- First load takes a few seconds (shader compilation and noise textures).

## Versioning
- Semantic Versioning. The single source of truth is the `VERSION` file. The page reads it at run time and shows it in the top bar.
- Bump `VERSION`, add a `CHANGELOG.md` entry, tag `vMAJOR.MINOR.PATCH`.

## Layout
- `index.html`, `css/style.css`: page and controls. Control ids match the original single-file lab.
- `js/state.js`: shared state object `S`. World units: base tile is [-0.5, 0.5]; one unit is about 400 m.
- `js/terrain.js`: the five fractal methods, the 1024x1024 heightmap, `gh()` (surface height used by all game logic).
- `js/trees.js`: tree skeleton generators, meshes, placement, leaf texture.
- `js/weather.js`: weather cells, snow build-up, tornado, lightning, and the numbers the renderer derives from the weather controls.
- `js/life.js`: animals, hunter, craft flight (game logic ported from the original).
- `js/lander.js`: the Lander game (physics, pads, scoring, effects). Its craft models are the sixth creature shader family in `glsl_scene.js`.
- `js/audio.js`: synthesised sound.
- `js/atmos.js`: CPU copy of the sky scattering integral (sun colour, ambient light, sun position).
- `js/glsl_common.js`, `js/glsl_scene.js`, `js/glsl_post.js`: all shaders.
- `js/renderer.js`: the WebGL2 frame. `js/main.js`: cameras, input, UI, frame loop.

## Rules that matter here
- The shader `terrainY()` in `glsl_common.js` and `ghLand()` in `terrain.js` must return the same height inside the tile.
  If they disagree, trees float and the walker sinks. The mirror fold is `abs(mod(p+1.5,2)-1)-.5`.
- The atmosphere constants exist twice (GLSL `ATMO` in `glsl_post.js`, JS in `atmos.js`). Change both together.
- Keep the creature shader split by family (`IMP_FS` array). One combined shader made the Direct3D compiler drop the GL context.
- Inside raymarch loops use `textureLod`, not `texture` (the cloud shader does this with a `#define`). Direct3D compiles gradient lookups in loops very slowly.
- Debugging: `FTL.S` is the state and `FTL.fixedScale = 0.8` pins the render scale in the console.
