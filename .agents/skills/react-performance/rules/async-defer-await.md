---
title: Await in the branch that uses the value
impact: CRITICAL
tags: waterfalls, async
---

## Defer await until needed

An `await` at the top of a function blocks every branch below it, including the ones that never use the value. Move it past the guards, into the branch that actually needs it.

**Incorrect.** Every caller pays for the fetch, including the ones that return immediately.

```ts
const comments = await fetchComments(post.slug);

if (!post.commentsEnabled) return null;

return renderThread(post, comments);
```

**Correct.** The guard runs first, so the early return costs nothing.

```ts
if (!post.commentsEnabled) return null;

const comments = await fetchComments(post.slug);

return renderThread(post, comments);
```

## Do not start a promise you might not await

Starting the request early and awaiting it later is a **different** technique, and it only pays when there is real work between the two points for it to overlap with. Reordering past a guard is not work, so there is nothing to overlap and nothing to gain.

It also costs something. A promise you start and then abandon on an early return is a request nobody wanted, and its rejection is unhandled.

So start a promise early only when every path that starts it also awaits it, and there is genuine work in between. At that point you are writing `async-parallel`, and `Promise.all` says it more clearly.
