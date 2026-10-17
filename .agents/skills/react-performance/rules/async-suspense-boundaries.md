---
title: Stream around a slow read
impact: CRITICAL
tags: waterfalls, rsc, suspense
---

## Strategic Suspense boundaries

A slow server read inside the page shell delays the whole page. Behind a Suspense boundary it delays only itself, and the rest streams immediately.

Put any async Server Component that performs a network or database read beneath a focused boundary, so a cold upstream or a cache miss streams fallback UI rather than holding the shell.

When the client takes over refreshing that data, hand the server result to it as initial data and let the client query own refreshes from there.

The boundary should wrap the smallest subtree that actually depends on the read. A boundary around the whole page buys nothing.
