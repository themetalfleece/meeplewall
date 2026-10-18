# packages/image-pipeline

`@meeplewall/image-pipeline`: pure image-processing functions over Sharp. Bytes in, bytes and colours out. No network, no storage, no database, no `process.env`.

## API

- `processCover({ input })` returns `{ cover, thumb, sideColor, edgeColor }`. `cover` (long side 1024, WebP q82) and `thumb` (long side 320, WebP q72) are each `{ data, contentType, width, height }`, because every size is stored as its own asset row with its own dimensions.
- `sampleCoverColors({ input })` returns `{ sideColor, edgeColor }` as `#rrggbb`: the dominant colour of the middle 60% of the art, then the average when the dominant is near white or near black, then a neutral slate. `edgeColor` is `sideColor` darkened by 40%.

## Rules

- **Never colour-correct the front cover.** It is the reference every other box face is matched to. `processCover` only orients, resizes and re-encodes.
- **Never upscale.** A cover smaller than a tier keeps its own size.
- **Decode through `openImage`**, so EXIF orientation and the truncated-input check apply everywhere.
- **`stats()` ignores the pipeline.** It reads the decoded input, so an `extract` or `flatten` queued before it does nothing. Render the region to raw pixels and stat that. The legacy script fell for this: its "centre" dominant was really the whole image's.
- **The average is the exact mean of the region.** The legacy script used a 1x1 resize, which weights the middle, so averaged colours differ from the legacy values by a few levels.

## Docs

`docs/box-art-pipeline.md` is the design for the full six-face box: orientation, BGG face photos, de-projection, matching to the front and generated fallbacks. Only the front is ported. Read it before porting another face.

## Tests

The fixtures in `src/fixtures/` are real covers from the legacy app, with the legacy dimensions and colours in `covers.ts`. Assert format, dimensions and colours within a tolerance, never bytes: a libvips upgrade changes the encoded output.
