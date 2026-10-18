---
name: boardgamegeek
description: >-
  What BoardGameGeek actually serves and how packages/boardgamegeek talks to it.
  Read before calling BGG, adding a geekdo endpoint or schema field, touching
  the rate limit or backoff, considering XMLAPI2, fetching a user's collection,
  or changing the box-size cross-check. Lists the open endpoints, their quirks,
  and what is blocked.
---

# BoardGameGeek

Facts as of October 2026. Re-probe before trusting one that matters: BGG changes these without notice.

## geekdo endpoints

`api.geekdo.com` serves BGG's own JSON API. All open, no auth, no Cloudflare challenge: plain `fetch` works.

| Endpoint                                                                                       | Returns                                          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `/api/geekitems?objectid={id}&objecttype=thing`                                                | `{ item }`: metadata, links, images, description |
| `/api/dynamicinfo?objectid={id}&objecttype=thing`                                              | `{ item }`: rating, weight, rank stats           |
| `/api/geekitem/linkeditems?objectid={id}&objecttype=thing&linkdata_index=boardgameversion&...` | `{ items, config }`: one page of versions        |
| `/api/users?username={name}`                                                                   | An array with the user's numeric `userid`        |
| `/api/collections?objectid={id}&objecttype=thing&userid={userid}`                              | That user's collection entries for one game only |

## Quirks

- **Numbers arrive as strings, and `0` or `""` means unknown.** The schemas map those to `null`.
- **An unknown id answers 404 with the body `null`.** The client returns `null` for a game and `[]` for versions.
- **Versions come 50 per page, whatever `showcount` asks for.** `config.numitems` is the total. The legacy pipeline only read page one, so popular games lost editions; the client pages until a short page or the total.
- **Version dimensions are contributor-entered with no unit.** Some editions are in inches, some in centimetres. A version whose largest side is over 15 is read as centimetres, otherwise as inches (no boxed game is over about 15in).
- **No geekdo endpoint lists a user's whole collection.** `/api/collections` answers 400 without an `objectid`. The collection comes from XMLAPI2 (below).

## What is blocked

- **XMLAPI2 needs a registered application.** `/xmlapi2/*` on both `boardgamegeek.com` and `api.geekdo.com` answers 401 with `WWW-Authenticate: Bearer realm="xml api"` without its bearer token. We hold one, `BGG_API_TOKEN`, and use XMLAPI2 for the collection only.
- **The `boardgamegeek.com` HTML pages sit behind Cloudflare Turnstile.** A scripted client, headless Chromium included, gets 403 or a challenge.

## XMLAPI2 collection

`createBggCollectionClient` calls `https://boardgamegeek.com/xmlapi2/collection?username=<name>&subtype=boardgame&excludesubtype=boardgameexpansion&stats=1` with `Authorization: Bearer <token>`.

- **202 means BGG is still building the collection.** Repeat the same request; the client waits 2 seconds, growing to 10, for about two minutes.
- **An unknown user is a 200**, with `<errors><error><message>Invalid username specified</message></error></errors>`. The client returns `null`.
- **`subtype=boardgame` alone still lists owned expansions**, hence `excludesubtype`.
- **The user's rating is `<stats><rating value>`**, `N/A` until rated. It needs `stats=1`.
- **The collection holds wishlist and previously owned games too.** The client keeps only `own="1"` or `wanttoplay="1"`.

The parser and its fixture follow BGG's documented XML. Re-check them against a live answer whenever `collection.e2e.test.ts` runs with a token.

## Rate limit

BGG publishes no limit for geekdo. The legacy pipeline ran about five requests a second without trouble; `dev-fetch` and the e2e suite use two.

On 429 or 503 the client retries up to five attempts, waiting one second and doubling each time, or the `Retry-After` seconds when BGG sends them, capped at 30 seconds. Any other non-2xx status throws `BggHttpError` at once.

## Box size

`crossCheckBoxSize({ versions, title })` ports the legacy enrichment step. It normalises every version with dimensions to centimetres, then narrows them to the owned copy:

1. A title naming a size variant (Mini, XXL, Travel, Big Box, Deluxe and so on) uses the editions with that word in their name.
2. Otherwise a Greek title uses the Greek editions: a name in Greek script, or one naming Kaissa, Desyllas or Greek.
3. Otherwise it drops size-variant editions to get the standard box.

It keeps the versions whose longest side is within 20% of the median, takes the median of each side, and scores `agreement` from the spread of the longest side. It returns `null` when no version has dimensions; the category-based fallback size stays with the caller.
