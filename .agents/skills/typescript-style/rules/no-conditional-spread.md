---
title: No conditional object spread
tags: objects, readability
---

## No conditional object spread for optional fields

Never build an object literal with `...(cond ? { key: value } : {})`. It hides keys behind a spread, so the object's full shape is no longer readable at a glance.

**Incorrect:**

```ts
const query = {
  page,
  ...(tag ? { tag } : {}),
  ...(limit !== undefined ? { limit } : {}),
};
```

**Correct**, when the key may be present as `undefined`:

```ts
const query = {
  page,
  tag: tag ?? undefined,
  limit,
};
```

**Correct**, when the record must actually drop absent keys, as for query params or analytics payloads, use a small shared helper that strips `undefined` values:

```ts
const query = omitUndefined({
  page,
  tag,
  limit,
});
```

Assigning in an `if` block after the literal is also fine. The rule is only that the literal shows every key it can carry.
