---
name: planning-docs
description: >-
  Map of the design and planning docs: the product plan, the box art pipeline
  and the package shapes. Read before working on game data, BoardGameGeek
  enrichment, covers, box textures, package shapes, the 3D box renderer or
  gallery, or before porting anything from the legacy app, which now lives
  only in git history.
---

# Planning docs

Each design doc lives with the workspace that owns it. Read the one for your area rather than rediscovering it from the code.

| Doc                                                | Read it for                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `docs/PLAN.md`                                     | Goals, the Stripe Press look, performance targets, open questions                           |
| `packages/image-pipeline/docs/box-art-pipeline.md` | The six-face box: orientation, BGG face photos, de-projection, matching, generated faces    |
| `packages/renderer/docs/package-shapes.md`         | Games whose real packaging is not a box, and the curated `package-shapes.json`              |
| `.agents/skills/boardgamegeek/`                    | The BGG endpoints, their quirks and rate limit, the XMLAPI2 collection, the box-size method |

## Reading them

- **The legacy app is gone from the tree.** The pre-monorepo Vite app, its Airtable import and its data pipeline scripts are in git history under `apps/web-legacy/`. The docs name a legacy script only to say where a design came from; port the design, not the script.
- **The workspace's `AGENTS.md` wins.** Where a doc and the package's rules disagree, the rules describe the code as it is.
- **BGG facts in these docs are dated.** Where they disagree with `.agents/skills/boardgamegeek/`, the skill wins.
- **The front cover is the reference and is never renormalised.** Every other face is matched to it. This principle runs through the texture work.

## Editing them

They are in the Prettier gate and follow `writing-style`. When code changes what one of them describes, update the passage in the same change.
