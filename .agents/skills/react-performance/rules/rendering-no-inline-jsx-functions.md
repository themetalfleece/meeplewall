---
title: No inline functions in JSX
impact: HIGH
tags: rendering, rerender
---

## Never use inline functions in JSX

An inline arrow is a new function identity on every render, and the React Compiler cannot memoise it.

Define the handler in the component body, or in the component's `.hooks.ts` file.

**Incorrect:**

```tsx
<SearchField onChange={(event) => setQuery(event.target.value)} />
```

**Correct:**

```tsx
function handleQueryChange(event: ChangeEvent<HTMLInputElement>) {
  setQuery(event.target.value);
}

<SearchField onChange={handleQueryChange} />;
```

A hook that exists to produce one handler returns the handler directly, so the JSX stays `onClick={handleShareClick}`.

When a handler needs a per-item argument, bind it in a small child component rather than closing over the item inline.
