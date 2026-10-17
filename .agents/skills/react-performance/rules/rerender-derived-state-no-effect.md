---
title: Derive during render, never in an effect
impact: MEDIUM
tags: rerender, effects
---

## Calculate derived state during rendering

State that can be computed from existing state or props is not state. Storing it in an effect costs an extra render and creates a window where the two disagree.

**Incorrect:**

```tsx
const [readingMinutes, setReadingMinutes] = useState(0);

useEffect(() => {
  setReadingMinutes(Math.ceil(wordCount / 200));
}, [wordCount]);
```

**Correct:**

```tsx
const readingMinutes = Math.ceil(wordCount / 200);
```

With the React Compiler you do not need to wrap that in `useMemo` unless the computation is genuinely expensive and you have measured it.
