# Handoff note (2026-11-26)

## Done
- Version 0.1.0: the single-file Fractal Terrain Lab rebuilt as a multi-file, hand-written WebGL2 project.
- Every original feature is present: five terrain methods, surrounding tiles, horizon, clouds, six weather modes with
  tornado and lightning, three tree types, eight animal species, death mode, fly-through with seven craft, walk and hunt
  with five weapons and two views, synthesised sound, Spotify embed.
- New: time of day slider, realistic lighting and weather, new grass, water, sky and clouds. See `CHANGELOG.md`.
- Checked in the Claude Browser pane (Intel UHD integrated graphics): all shaders compile, no GL errors, orbit, fly,
  walk, hunt (both views), rain, snow, storm, tornado, night, dusk, triangle method with surrounding tiles, horizon.

## Added in 0.2.0
- Lander game with Modern and Retro styles (`js/lander.js`). It is an original thrust-and-gravity game, not a copy of a
  specific old title: retro means a generic 1980s look (240-line resolution, flat facets, six colour levels per channel).
- Checked in the browser: take-off, scored soft landing, next pad lighting, crash and respawn, stopping, both styles.
- Not verified: playing a full flight by hand between pads (the difficulty balance of thrust, fuel and landing limits is
  untested by a person), engine sound, the on-screen touch buttons.

## Decided
- Hand-written WebGL2, several files, no build step (owner's choice).
- Tuned for a dedicated GPU. An adaptive scaler lowers render scale and grass density on slower GPUs.
- The "GPU scene" checkbox was removed because the 2D painter it switched to no longer exists.
- Pushed to a private GitHub repository, `oin72/fractal-terrain-lab` (branch `main`, tags `v0.1.0` and `v0.2.0`). Nothing deployed.

## Not verified
- Frame rate on a dedicated GPU. The test machine's browser pane used Intel UHD graphics (about 8 to 10 frames per second
  at full grass density before the scaler steps in).
- Sound (not audible from the test harness), the Spotify embed, touch controls and pinch zoom.
- Firing weapons, kills, tornado capture of craft and hunter, and the parachute were ported but not exercised.
- Trees are not drawn on the surrounding (mirrored) tiles, the same as the original.

## Next ideas
- Temporal anti-aliasing and reprojection for the clouds (they are half resolution with a blur).
- Trees and animals on the surrounding tiles.
- A triskelionltd.com subdomain, if the owner wants it published.
