# Changelog

All notable changes to Fractal Terrain Lab. Format follows Keep a Changelog; versions follow Semantic Versioning 2.0.0.

## [0.4.0] - 2026-11-26

### Added
- Keyboard icon in the top bar. Hover over it (or tap it) to see the controls for whatever is running: orbit view, fly-through, walk, hunt, lander, the sandbox or the current game.
- Requests button. Players can write what they would like added or changed, then copy it, post it as a GitHub issue, or (in the Claude artifact copy, where their access allows) send it straight to the artifact's store.
- `tools/build_artifact.py` builds the single page used for the Claude artifact copy.

### Fixed
- A negative time step (possible after the tab was paused) could break the tower defence game.

## [0.3.0] - 2026-11-26

### Added
- Open-world sandbox (Sandbox button): walk, drive any car or bus, sail the boats, fly a plane and drive the train. Talk to people, startle animals, build and remove buildings and trees, change the weather and the time of day from the keyboard.
- Twenty compact games played in the sandbox (Options, Sandbox & games): racing, flight simulator, first-person shooter, battle royale, platformer, survival, tower defence, turn-based artillery, city builder, treasure hunt, role-playing quest, stealth, horror, golf, endless runner, fishing, roguelike horde survival, lights-out puzzle, light-trail arcade and taxi driving.
- Buildings and people option: villages with a church, farms with barns, silos and crop fields, windmills with turning sails, and fishing towns with a jetty and lighthouse. Villagers walk the streets. Windows light up at night.
- Roads, tracks and transport option: roads, farm tracks and a railway routed over the terrain, with the land graded along them. Cars and buses (driving on the left), a train that stops at stations, fishing and sailing boats, cargo ships offshore, airliners with contrails and a light aircraft. Each kind has its own on/off control.

### Changed
- The tornado is now a true volume with a hollow rotating funnel, a spiral wall cloud and a debris cloud, so it holds its shape from any angle, including from above.
- Animals move more naturally: steady wandering instead of jitter, walking and running speeds with acceleration, deer and rabbits lower their heads to graze, deer herd and wolves pack together, bodies tilt with the slope, and they walk round buildings.
- Birds of prey soar on fixed wings and flap only to chase; small birds flap in bursts; all birds bank into turns.
- The plane has a new model (tapered wings, spinning propeller, undercarriage) and craft pitch up and down as they climb and descend.

## [0.2.0] - 2026-11-26

### Added
- Lander game (Lander button): fly a thrust-and-gravity craft over the landscape and set it down gently on the lit pad. Each pad landing scores 50 to 100 points and refuels; the next pad then lights up. Fuel, altitude, descent rate, drift and pad direction are shown on screen.
- Lander style control (Options, Lander): Modern is a new quad-thruster craft with glowing engines, folding landing gear, exhaust plumes and dust, in the full renderer. Retro is an angular faceted pod drawn at low resolution with flat shading and a limited colour palette.
- Exhaust wash flattens grass under the craft, and a shadow under it helps judge height.

## [0.1.0] - 2026-11-26

First version of the project, rebuilt from the single-file "Fractal Terrain Lab" page.

### Added
- New hand-written WebGL2 renderer (no libraries, no build step) with an HDR pipeline: two sun shadow maps, 4x multisampling, bloom and filmic tone mapping.
- Terrain drawn as a camera-centred clipmap with procedural sand, soil, rock, scree and snow, ambient occlusion and fine detail close up.
- The land now slopes away to a sea bed outside the tile instead of ending in a cut edge.
- Physically based sky (Rayleigh, Mie and ozone scattering) with sun, moon and stars.
- Time of day slider. The sun position relights the sky, clouds, fog, water and land.
- Volumetric clouds that cast moving shadows on the landscape, with rain veils under weather cells.
- Weather lighting: overcast ambient light, storm darkening, wet ground, snow build-up, lightning that lights the clouds, fog that thickens with intensity.
- Water with refraction, depth colour, sky and cloud reflections, screen-space reflections of the land, sun glitter, shoreline foam and caustics.
- Grass as individually shaded curved blades (up to about two million): clumped height and colour, dry and lush patches, wild flowers, wind gusts, translucency against the sun, shadows, snow and trampling.
- Trees as real meshes from the three original skeleton generators, with leaf sprays, soft crown shading, wind and shadows.
- Animals, hunter, craft and weapons are lit by the same sun, sky and shadows as the landscape. The craft and the first-person weapon are now 3D objects in the scene.
- Render scale and grass density adapt automatically when the frame rate is low.

### Changed
- The orbit view moves the camera closer when zooming, instead of magnifying from a fixed distance.
- The default orbit pitch is lower so the horizon and sky are in view.
- The "GPU grass" checkbox is now called "Grass".

### Removed
- The "GPU scene" checkbox. It switched between the old 2D canvas painter and the GPU overlay; the 2D painter no longer exists.
