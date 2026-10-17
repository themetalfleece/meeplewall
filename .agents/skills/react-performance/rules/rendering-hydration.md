---
title: What suppressHydrationWarning actually does
impact: MEDIUM
tags: rendering, hydration
---

## Hydration mismatches

A value that legitimately differs between server and client (a locale-formatted time, a relative duration such as "3 days ago") produces a hydration warning.

**`suppressHydrationWarning` silences the warning and stops React repairing the text.** It is not a repair mechanism. The server-rendered text stays on screen until something else re-renders that node.

So it is correct only where the server value is itself acceptable to display, and wrong wherever the client value is the true one.

When the client value is the true one, render a stable placeholder on the server and fill it in after mount, or move the value behind a Suspense boundary so it is never server-rendered.

Parse timestamps once at the boundary into a type that cannot hold an invalid date, so an unparseable field never reaches a formatter as `NaN`.
