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

## Added in 0.3.0
- Sandbox, 20 games, buildings and people, roads/railway/transport, volumetric tornado, more natural animals and craft. See `CHANGELOG.md`.
- Checked in the browser (frames stepped by hand, Intel UHD): no shader or script errors; villages, roads, railway, train, cars, people, boats render; sandbox starts; all 20 games start and run 60 to 70 frames with scripted key presses without errors; flight, racing, platformer, golf looked right in screenshots; tornado funnel and collar seen from the ground.
- Not verified: every game played through to a win or loss by a person (balance and difficulty are untuned); driving, sailing, flying and the train by hand; talking, building and removing by hand; the tornado seen from above (the test camera was inside the storm cloud); the new animal poses and bird banking close up; night window lights and headlights; hex (triangle) terrain with the new world; frame rate with everything on.
- Known rough edges: villagers can walk through house corners; platforms, golf holes and courses can be placed across a village; the railway can cross roads without a level crossing; buildings and vehicles are not drawn on the mirrored surrounding tiles.

## Added in 0.4.0
- Keyboard icon (controls on hover or tap) and Requests button. Checked locally and on the GitHub site: icon and tooltip show, Requests falls back to Copy/GitHub outside the artifact, sandbox starts on the live site.
- Not verified: the artifact copy opened in claude.ai (page load there, and a real Send from a second account).

## Decided
- Hand-written WebGL2, several files, no build step (owner's choice).
- Tuned for a dedicated GPU. An adaptive scaler lowers render scale and grass density on slower GPUs.
- The "GPU scene" checkbox was removed because the 2D painter it switched to no longer exists.
- GitHub repository `oin72/fractal-terrain-lab` is now PUBLIC (owner's decision, 2026-11-26) and served by GitHub Pages from `main` at https://oin72.github.io/fractal-terrain-lab/ . Pushing to `main` updates the site.
- Claude artifact copy: https://claude.ai/artifact/RVtHD7ZD6JBDAb8YHyr7aV (private until the owner shares it). Rebuild with `python tools/build_artifact.py` and republish with `js/*` and `VERSION`; capabilities `db` (rules: `requests` read admin / write owner, `requests/{self}` read and write interact) and `user`.
- Requests from players: read the artifact's `requests` collection, and the repository's GitHub issues. Signed-in visitors from outside the owner's organisation can only view, so their Send falls back to Copy or GitHub.

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
