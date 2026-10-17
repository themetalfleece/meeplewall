---
title: A value the UI does not display belongs in a ref
impact: MEDIUM
tags: rerender, refs
---

## Use `useRef` for transient values

If a value changes often and nothing renders it, `useState` buys only re-renders. A ref holds it without them.

Typical cases: a pointer position during a drag, a last-seen timestamp, a scroll offset, a mirror of prior state kept for diffing.

For the "most recent request wins" pattern, write one shared hook that owns the monotonic counter, rather than hand-rolling a counter ref in each component.
