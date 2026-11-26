# Changelog

All notable changes to Fractal Terrain Lab. Format follows Keep a Changelog; versions follow Semantic Versioning 2.0.0.

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
