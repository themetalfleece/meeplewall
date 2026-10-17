---
title: Use the updater form
impact: MEDIUM
tags: rerender, state
---

## Use functional setState updates

When the next state depends on the previous, pass a function. Reading the current value from the closure captures a stale one when several updates batch.

**Incorrect:**

```ts
setFilters({ ...filters, tag });
```

**Correct:**

```ts
setFilters((previous) => ({ ...previous, tag }));
```

### Keep the updater pure

**Never fire a side effect inside an updater**: no analytics event, no fetch, no log. React StrictMode, on by default in Next dev, intentionally double-invokes updaters to surface impurities, so the side effect runs twice in development.

Fire it **before** the setter, using a ref mirror of the prior state when you need to diff against it. The ref sync goes in a `useEffect`, not in render: the `react-hooks/refs` rule blocks in-render ref writes.
