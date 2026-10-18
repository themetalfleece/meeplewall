# Package shapes

Some games do not ship in a rectangular cardboard box. A vision audit of every cover in the original 210-game collection found the ones below. The curated list is `package-shapes.json`, keyed by game id. Nothing reads it yet: the app does not pass a `shape` to the renderer, so every game draws as a box until a data pass maps these entries onto `GameBoxInput.shape`.

`source: image` means the shape shows in the cover art. `source: product-knowledge` means the cover hid it but the retail packaging is known. Verify those before acting on them.

## The games

| Game                          | id                                    | Audit shape | Renderer shape                     | Source            |
| ----------------------------- | ------------------------------------- | ----------- | ---------------------------------- | ----------------- |
| Dobble                        | `dobble-63268`                        | `round-tin` | `round-tin`                        | image             |
| Chupacabra: Survive the Night | `chupacabra-survive-the-night-120515` | `tube`      | `tube`                             | image             |
| Zombie Dice: Horde Edition    | `zombie-dice-horde-edition-224035`    | `tube`      | `tube`                             | product-knowledge |
| Sushi Go!                     | `sushi-go-133473`                     | `tin-rect`  | `rect-tin`                         | product-knowledge |
| Forbidden Island (Greek)      | `apagoreymeni-nisos-65244`            | `tin-rect`  | `rect-tin`                         | product-knowledge |
| Cash 'n Guns (2nd edition)    | `cash-n-guns-second-edition-155362`   | `tin-rect`  | `rect-tin`                         | product-knowledge |
| Bag of Chips                  | `bag-of-chips-344114`                 | `bag: foil` | `foil-bag`                         | image             |
| Happy Salmon                  | `happy-salmon-194626`                 | `bag: fish` | `pouch`                            | image             |
| Love Letter                   | `love-letter-277085`                  | `blister`   | `box` with a hang tab              | image             |
| Who am I?                     | `who-am-i-33406`                      | `blister`   | none yet                           | image             |
| Ντάμα (draughts)              | `ntama-2083`                          | `other`     | none: a marble board, no box       | image             |
| Connect 4 Shots               | `connect-4-shots-258818`              | `other`     | none: a moulded case with a handle | image             |

## Artwork per shape

- **Round tin and tube** wrap a flat label around the side. Dobble uses a genuine top-down lid photo, and its `capCrop` cuts the round lid out of the cover. Zombie Dice wraps its flat front key art. Chupacabra has no flat front art in the BGG gallery, so it keeps its cover.
- **Rect tin** keeps the box mesh with a metal finish. `cornerR` is the per-game corner radius.
- **Foil bag** is the legacy pillow fallback; the legacy glTF model is not ported (see the renderer skill).
- **Pouch** draws Happy Salmon's fish outline from a cutout texture.
- **Hang tab** flap tuning (corner radius, width and the die-cut hole for Uno, Love Letter and a Greek card game) lived in the legacy `flap-params.json` and `flap-overrides.json`. They are in git history, not in this tree.

## Still to do

- `blister` and `other` have no renderer shape. A blister is a flat backer card, so a shallow box with a glossy clamshell is the cheap version. The two `other` games are one-offs.
