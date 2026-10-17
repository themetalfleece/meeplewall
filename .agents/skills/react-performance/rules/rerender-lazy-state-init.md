---
title: Pass a function for expensive initial state
impact: MEDIUM
tags: rerender, state
---

## Use lazy state initialization

`useState(expensiveCall())` runs `expensiveCall()` on **every** render and throws the result away after the first. Passing the function defers it to the first render only.

**Incorrect:**

```ts
const [index] = useState(buildSearchIndex(posts));
```

**Correct:**

```ts
const [index] = useState(() => buildSearchIndex(posts));
```

The same trap applies to reading `localStorage` or parsing a URL in an initialiser.
