# Box art pipeline

How the legacy app built a complete, correctly oriented, tonally consistent six-face box for every game, and what of it this package has ported. Read it before porting another face.

## Ported so far

Only the front. `processCover` and `sampleCoverColors` replace the legacy texture prep: the cover and thumb, plus `sideColor` and `edgeColor`. Everything below the principles is **not ported**. The legacy scripts it names are gone from the tree and live in git history, under `apps/web-legacy/scripts/`.

## Principles

1. **The front cover is the reference and is never renormalised.** It is the best, most colour-accurate asset. Every other face is matched to it, so the box reads as one object with no tone jump at the seams.
2. **Photographic where possible, generated where not.** Real photos beat generated faces. A face with no usable photo (almost always the top and bottom, often the spine) falls back to art-derived generation, so every box still has six faces.
3. **Orientation follows the art, not the raw dimensions.** A landscape cover must sit on a landscape face, or the cover-fit crop slices the middle out of the art.
4. **Every face records its provenance**: `bgg-hires`, `photo`, `cover-derived`, `procedural` or `derived`, and `normalized` for a matched photo. The UI can then badge real against generated, and a later pass can find faces worth upgrading.

## The six faces

| Face   | Real box shows             | 1st choice        | 2nd choice                        | Fallback                       | Legacy coverage (of 210) |
| ------ | -------------------------- | ----------------- | --------------------------------- | ------------------------------ | ------------------------ |
| front  | the cover art              | BGG hi-res cover  |                                   |                                | all                      |
| back   | blurb, components, barcode | flat BGG photo    | another edition's flat back       | procedural panel               | 167 photo                |
| spine  | title on a colour band     | flat side photo   | de-projected from a 3D-box render | procedural title band          | about 30 photo           |
| top    | title band or plain        | flat top photo    | de-projected from a render        | cover-derived band and title   | none photo               |
| bottom | legal text, barcode        | flat bottom photo |                                   | cover-derived band and barcode | about 3 photo            |

The spine is what a shelf view reads, so it matters most after the front. Prefer photos whose caption names our edition or publisher, so the printed art matches. Another edition's back usually shares the layout; another edition's spine carries that language's text.

## Stage 1: orientation

Pure, no network. Sort the real dimensions descending into `[a, b, c]`, where `c` is the depth.

- Cover aspect within 0.05 of square: keep the raw dimensions, the signal is unreliable.
- Landscape cover (aspect at least 1): face is `{ w: a, h: b, d: c }`.
- Portrait cover: face is `{ w: b, h: a, d: c }`.

The front then matches the cover aspect to within a few percent, so the cover-fit crop is close to a no-op. An angled product shot used as a cover gives a misleading aspect; flag it for review.

## Stage 2: discover and pick

Page through a game's BGG gallery, deduplicating by `imageid` and downloading `imageurl_lg` (about 1024 on the long edge). The legacy script used `https://api.geekdo.com/api/images?ajax=1&foritempage=1&galleries[]=game&nosession=1&objectid=<bggId>&objecttype=thing&pageid=<n>&showcount=50&size=crop100&sort=hot`; check it against the `boardgamegeek` skill's rules before porting. Score each image per face:

- **Caption keywords**: `back|rear`, `spine|side|edge`, `top|lid`, `bottom|underside`, and `3d box|render|mockup` for de-projection sources.
- **Aspect prior**: a spine is about `h:d`, a top or bottom about `w:d`, a back about the front's aspect.
- **Edition match**: boost captions naming our edition or publisher.
- **Penalise gameplay and component shots**: board, cards, meeples, minis, dice, hands, "game state".

Auto-pick the best per face and keep the rest as alternates. Publisher and retailer pages show only front and back; nobody photographs tops and bottoms. A local review page (candidates per face, click to accept, reassign or reject) was planned for QA and never built.

## Stage 3: crop or de-project

- **Straight-on photo**: resize to at most 1024 on the long side, then cover-crop to the face aspect.
- **Angled photo**: a four-point homography (DLT) maps the quad onto a flat rectangle with bilinear resampling. Corners run top-left, top-right, bottom-right, bottom-left; if the text comes out mirrored, swap left and right. The output keeps the face's true aspect, for example 360×1080 for a spine. Keep the quad strictly inside the face, since the lid band and the front's title bleed are easy to grab. Corner picking was manual; automatic quad detection is the upgrade if de-projection is ever used widely. Reject a photo with no clean quad and fall back.

## Stage 4: match to the front

For every photographic face other than the front:

1. Take the per-channel mean and standard deviation of the front and of the face.
2. Apply a Reinhard transfer per channel: `out = (in - meanFace) * (stdFront / stdFace) + meanFront`.
3. Blend about 0.82 of the way, not all of it, so a real content difference survives. A white contents panel must not drag the whole back bright.

Check it by luminance: a matched face's mean lands within a few percent of the front's. Cover-derived and procedural faces are built from the cover's own palette, so they skip this step.

## Stage 5: generate the gaps

- **Spine**: a `sideColor` to `edgeColor` gradient, an accent stripe in the cover's most vivid colour, the title rotated and auto-fitted to about 70% of the long axis, and the publisher small at the other end. Needs a serif font with Greek coverage.
- **Top**: a darkened (about 0.5×), blurred slice of the cover with the title and the accent stripe.
- **Bottom**: the same band dimmer (about 0.3×), with a barcode block and an auto-fitted `© year publisher · title` line.
- **Back**: a darkened `edgeColor` panel with the short description.

The legacy generators used Sharp with SVG for the text.

## Re-runs

The legacy face generator was idempotent: a face whose provenance was `photo` or `cover-derived` was kept, and only procedural or missing faces were rebuilt, unless forced. Orientation was always recomputed. A port should keep that guarantee, so a batch re-run never clobbers an upgrade.

## QA

- A contact sheet of each game's six faces: crops, text fit, no tone jump against the front.
- A shelf sheet of every spine: legibility and palette variety.
- A turntable in the renderer: orientation, seams on the bevels, even lighting all round.
