---
title: Never nest ternaries
tags: control-flow, readability
---

## Never nest ternaries

One ternary is fine. Nesting one inside another is not: the reader has to hold two conditions at once to know which arm produced the value.

Extract a function with clear `if`/`return` paths instead.

**Incorrect:**

```ts
const label = isDraft
  ? "Draft"
  : isScheduled
    ? "Scheduled"
    : isArchived
      ? "Archived"
      : "Published";
```

**Correct:**

```ts
function describeStatus(post: Post): string {
  if (post.isDraft) return "Draft";
  if (post.isScheduled) return "Scheduled";
  if (post.isArchived) return "Archived";

  return "Published";
}

const label = describeStatus(post);
```

The extracted function also gives the branch set a name, which is usually the thing the call site actually wanted to say.
