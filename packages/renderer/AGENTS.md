# packages/renderer

`@meeplewall/renderer`: the framework-agnostic Three.js game box. `mountGameBox({ element, game, options })` from `.` and the `<GameBox>` React wrapper from `./react`. `GameBoxInput.shape` picks the package: `box` (the default, optionally with a hang tab), `rect-tin`, `round-tin`, `tube`, `foil-bag` or `pouch`.

## Rules

- **The look is tuned against `public/practice/index.html`**, the legacy app's practice page. Its code stays as written, since it is the reference. After any change to lighting, material, shader or antialiasing, run `pnpm --filter @meeplewall/renderer dev` and compare both panes of `dev.html`. `?yaw=<radians>` and `?cam=x,y,z` move both panes together; `?spin` idle-spins the new one.
- **`public/textures/` holds only the faces the samples draw.** A new sample copies its textures in; nothing else reads them.
- **Other shapes are compared with the legacy app itself.** `?shape=<name>` (or the links above the panes) picks a sample from `src/dev/samples.ts`; for anything but `box` the left pane loads that game's `/g/<id>/` page from `http://localhost:5174`, or from `?legacy=<origin>`. The legacy app is gone from the tree: run it from a checkout of the last commit that still has `apps/web-legacy` (`pnpm install`, then `pnpm --filter web-legacy dev --port 5174`). The legacy camera differs, so compare shape and material, not pixels.
- **A new shape touches every exhaustive dispatch.** Add it to `PackageShape` in `types.ts`, then `layoutPackage`, `packageHalfHeight` and `artworkUrls` in `packageLayout.ts` and `createPackageModel`; the `never` tails fail the build until each handles it. Geometry builders go in `packageGeometry.ts` (the pouch's mesher in `pouchGeometry.ts`) as pure functions with tests.
- **Textures belong to `ArtworkLoader`, not to a model.** A model is rebuilt whenever its layout changes and is re-shown every loaded texture, so it frees only its own geometry and materials. `ArtSurface` clones a texture before applying a repeat or offset, so the shared original stays untouched.
- **Never replace a face uniform object; set its `.value`.** The compiled program keeps the object `onBeforeCompile` handed it, so a new object is never seen.
- **Every shader chunk the patch targets must exist.** `patchShader` in `shaderPatch.ts` throws when one is missing, and `boxShader.test.ts` and `seamShader.test.ts` run each patch against the installed `ShaderLib.physical`, so a three.js upgrade that renames a chunk fails the tests. Never use a silent `String.replace`.
- **`GameBoxOptions` are mount-time.** `update` takes only the game. The React wrapper reads options once; a caller remounts with a new `key` to change them.
- **Relative imports end in `.js`.** The package resolves as `NodeNext`.

`docs/package-shapes.md` lists the games whose packaging is not a box, with the curated data in `docs/package-shapes.json`.

The traps already hit and the known deltas from the legacy app are in `.agents/skills/renderer/SKILL.md`. Read it before changing lighting, a shader or a package shape.
