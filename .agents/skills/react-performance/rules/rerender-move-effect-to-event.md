---
title: Interaction logic goes in the handler
impact: MEDIUM
tags: rerender, effects
---

## Put interaction logic in event handlers

An effect that watches state in order to react to something the user just did runs later than the handler, runs again on unrelated renders, and hides the causal link.

If the logic answers "the user did X", it belongs in the X handler.

Effects are for synchronising with something outside React: a subscription, a DOM listener, a network resource keyed on props.

Effects also have a required home: the component's `.hooks.ts` file, never inline in `.component.tsx`. See `.agents/skills/component-structure/SKILL.md`.
