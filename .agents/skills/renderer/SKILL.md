---
name: renderer
description: >-
  The traps already hit in packages/renderer and its known deltas from the
  legacy app and the practice page. Read before changing the renderer's
  lighting, materials, shaders, antialiasing or a package shape, and before
  calling a difference from the legacy app a bug.
---

# Renderer

The rules live in `packages/renderer/AGENTS.md`. This skill holds what was learned the hard way.

## Traps already hit

- **`RoomEnvironment` got brighter after r161.** The practice page built it without a renderer, which in r161 meant a main light of intensity 5. Current three.js always uses 900 and also drops the room by 3.5 units. Unpatched, the box renders about 35% brighter. `GameBoxScene` puts both back.
- **`PCFSoftShadowMap` is gone in r186** and logs a warning. `PCFShadowMap` now honours `shadow.radius`, so it gives the same soft contact shadow.
- **ANGLE's D3D11 backend (Chrome on Windows) warns on a GLSL function with early returns** (`X4000: potentially uninitialized variable`). `boxAlbedo` assigns one result per branch and returns once.
- **On D3D11, three's own `packing` chunk logs `X4122` precision warnings.** They come from three, not our patch, and do not appear on ANGLE's GL backend. A smoke check may ignore exactly that warning and nothing else.
- **The legacy pane logs plenty of its own.** React Router flags, its shader's `X4000`, texture-pool and `glBlitFramebuffer` warnings all come from the iframe. A smoke check sorts console messages by `location().url` and judges only the renderer's origin.
- **Antialiasing is MSAA plus SMAA.** The scene renders into a 4-sample half-float target for the silhouette, then `SMAAPass` cleans the bevel and texture seams that MSAA misses. Because the scene renders into a target, tone mapping and the sRGB transfer happen in `OutputPass`, which must stay last.

## Known deltas from the legacy app

- **The foil bag is the legacy pillow fallback.** Legacy draws Bag of Chips from a glTF model; that model path is not ported.
- **A pouch drops flat triangles at sharp tips.** Legacy kept a triangle whose three corners all sit on the rim, leaving a zero-thickness fin; skipping it makes the solid watertight with no visible change.

## Known deltas from the practice page

- **Artwork is cover-fit, not stretched.** A face image whose aspect differs from its face is centre-cropped. The practice textures are about 3% off, so the front shifts slightly; with the fit off the two panes match to under 1% of pixels.
- **Faces at a glancing angle (the top, from above) render about 10% darker.** r186 changed the physical BRDF (a DFG lookup and multi-scattering compensation). This is three.js, not our material, and is not patched back.
