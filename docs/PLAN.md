# Meeplewall product plan

The goals and the look the app is built toward. How each part works lives in the owning workspace's `AGENTS.md`; this file holds what no single package owns.

## Goals

- A tactile 3D presentation of each game box that evokes the physical object: front cover, spine, side panels and real depth.
- Box proportions from real dimensions, so a collection reads as authentic. This is the single most important visual detail. The method is in the `boardgamegeek` skill.
- Smooth 60 fps scrolling on desktop and graceful degradation on mobile.
- Fast first paint, with the 3D loading progressively.

## Non-goals

- No borrowing or lending workflow and no inventory management.
- No e-commerce.

## The look: Stripe Press, for boxes

The reference is [Stripe Press](https://press.stripe.com/).

- **Gallery**: boxes float in a dark, near-black space, evenly spaced in one vertical column and gently tilted toward the viewer. Scrolling drifts them in and out with subtle parallax. Soft studio lighting, with a faint shadow underneath.
- **Detail**: the selected box at a three-quarter angle, slowly rotating or draggable, beside its title, designers and a long description in a serif-forward layout.
- **Boxes, not books.** Stripe Press shows books, thin objects dominated by their spine. Board games are boxes, from near-cubes to flat squares to tuck boxes, so the primitive is a rectangular box with six textured faces. Some games ship in tins, tubes or bags instead (`packages/renderer/docs/package-shapes.md`).
- **Mobile and fallbacks**: one column, larger boxes, tap to open. With no WebGL or with `prefers-reduced-motion`, show a 2D grid of covers with the same detail pages, and no auto-rotate or parallax.

## Performance targets

- Interactive in under 2.5 s on desktop, and Lighthouse performance of at least 90.
- Textures capped at 1024 px and served as WebP. Load them as boxes near the viewport, mount only nearby boxes and share geometry.
- Pause the render loop when the tab is hidden or nothing animates.

## Open questions

1. **Sides**: invest in per-game de-projection for spines and tops, or ship mostly generated sides? A shelf view, where the spine is what you read, is the eventual headline view. The pipeline design is in `packages/image-pipeline/docs/box-art-pipeline.md`.
2. **Photo QA**: build a review page to vet auto-picked face photos (some are angled or in another language) before they ship?
3. **A shelf view**: boxes turned to show the spine, packed side by side like books.

## Risks

- **Missing or low-resolution cover art** makes boxes look flat. Keep a fallback that never looks broken.
- **Unknown box dimensions** make a collection look uniform. Use category-based estimates, flag them as estimated, and allow a manual override.
- **3D on low-end mobile**: virtualise, and keep the 2D fallback.
