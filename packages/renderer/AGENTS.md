# packages/renderer

`@meeplewall/renderer`: the framework-agnostic Three.js game box. `mountGameBox({ element, game, options })` from `.` and the `<GameBox>` React wrapper from `./react`. v1 draws the rectangular box only; bags, cylinders, tins and flaps render as boxes.

## Rules

- **The look is tuned against `apps/web-legacy/public/practice/index.html`.** After any change to lighting, material, shader or antialiasing, run `pnpm --filter @meeplewall/renderer dev` and compare both panes of `dev.html`. `?yaw=<radians>` and `?cam=x,y,z` move both panes together; `?spin` idle-spins the new one.
- **Never replace a face uniform object; set its `.value`.** The compiled program keeps the object `onBeforeCompile` handed it, so a new object is never seen.
- **Every shader chunk the patch targets must exist.** `patchBoxShader` throws when one is missing, and `boxShader.test.ts` runs it against the installed `ShaderLib.physical`, so a three.js upgrade that renames a chunk fails the tests. Keep it that way rather than using a silent `String.replace`.
- **`GameBoxOptions` are mount-time.** `update` takes only the game. The React wrapper reads options once; a caller remounts with a new `key` to change them.
- **Relative imports end in `.js`.** The package resolves as `NodeNext`.

## Traps already hit

- **`RoomEnvironment` got brighter after r161.** The practice page built it without a renderer, which in r161 meant a main light of intensity 5. Current three.js always uses 900 and also drops the room by 3.5 units. Unpatched, the box renders about 35% brighter. `GameBoxScene` puts both back.
- **`PCFSoftShadowMap` is gone in r186** and logs a warning. `PCFShadowMap` now honours `shadow.radius`, so it gives the same soft contact shadow.
- **ANGLE's D3D11 backend (Chrome on Windows) warns on a GLSL function with early returns** (`X4000: potentially uninitialized variable`). `boxAlbedo` assigns one result per branch and returns once.
- **On D3D11, three's own `packing` chunk logs `X4122` precision warnings.** They come from three, not our patch, and do not appear on ANGLE's GL backend. A smoke check may ignore exactly that warning and nothing else.
- **Antialiasing is MSAA plus SMAA.** The scene renders into a 4-sample half-float target for the silhouette, then `SMAAPass` cleans the bevel and texture seams that MSAA misses. Because the scene renders into a target, tone mapping and the sRGB transfer happen in `OutputPass`, which must stay last.

## Known deltas from the practice page

- **Artwork is cover-fit, not stretched.** A face image whose aspect differs from its face is centre-cropped. The practice textures are about 3% off, so the front shifts slightly; with the fit off the two panes match to under 1% of pixels.
- **Faces at a glancing angle (the top, from above) render about 10% darker.** r186 changed the physical BRDF (a DFG lookup and multi-scattering compensation). This is three.js, not our material, and is not patched back.
