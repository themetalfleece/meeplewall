---
name: planning-docs
description: >-
  Map of the root planning docs (PLAN.md, BOX-ART-PIPELINE.md, TEXTURE-PLAN.md,
  SIDES-PLAN.md, PACKAGE-SHAPES.md) and the legacy data pipeline. Read before
  working on game data, Airtable or BoardGameGeek enrichment, covers, box
  textures, package shapes, the 3D box renderer or gallery, or before porting
  any of it from apps/web-legacy to the new app.
---

# Planning docs

The design and pipeline knowledge lives in the root planning docs. They stay where they are; read the one for your area rather than rediscovering it from the code.

| Doc                                 | Read it for                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| `README.md`                         | What the site does, its features and controls                                                   |
| `PLAN.md`                           | Goals, the "Stripe Press" look, data schema, 3D design, performance, milestones, open questions |
| `BOX-ART-PIPELINE.md`               | The end-to-end playbook for a 6-face box: download, crop, de-project, normalise, generate       |
| `TEXTURE-PLAN.md`                   | Why boxes need full 6-face textures and correct orientation                                     |
| `SIDES-PLAN.md`                     | Turning BGG user photos into consistent spine, top, bottom and back faces                       |
| `PACKAGE-SHAPES.md`                 | Games whose real packaging is not a rectangular box                                             |
| `apps/web-legacy/scripts/README.md` | Running the legacy Airtable and BGG data pipeline                                               |
| `.agents/skills/boardgamegeek/`     | The BGG endpoints, their quirks and rate limit, the XMLAPI2 collection, and the box-size method |

## Reading them

- **Paths are from before the monorepo.** `src/`, `scripts/` and `public/` in these docs are now under `apps/web-legacy/`.
- **`PLAN.md` section 0 wins.** Its revisions are authoritative where they conflict with later sections, which are marked as superseded.
- **Commands use `npm`.** They predate the workspace. Use the `pnpm` equivalent, for example `pnpm --filter web-legacy data` for the pipeline CLI. A data refresh may change its output, but not the legacy code (see `apps/web-legacy/AGENTS.md`).
- **BGG facts in these docs are dated.** Where they disagree with `.agents/skills/boardgamegeek/`, the skill wins.
- **The 3D box and the package shapes are ported to `packages/renderer`.** Its `AGENTS.md` holds the current renderer rules and the known deltas from the legacy app, and wins over `PLAN.md` section 5 and the implementation notes in `PACKAGE-SHAPES.md`.
- **The front cover is the reference and is never renormalised.** Every other face is matched to it. This principle runs through the texture docs.

## Editing them

They are kept as originally written and are outside the Prettier gate, so do not reformat or restyle them wholesale. When code changes what one of them describes, update the affected passage in the same change. New text in them follows `writing-style`.
