---
title: Never use switch
tags: control-flow, exhaustiveness
---

## Never use switch

`switch` is not used. Closed-set dispatch is an `if`/`return` chain: one `if` per member, in source order, then the `never` tail.

**Incorrect:**

```ts
switch (format) {
  case "csv":
    return exportCsv(rows);
  case "json":
    return exportJson(rows);
  default:
    throw new Error("unsupported");
}
```

**Correct:**

```ts
function exportRows(format: ExportFormat, rows: Row[]): string {
  if (format === "csv") return exportCsv(rows);
  if (format === "json") return exportJson(rows);

  const unreachable: never = format;
  throw new Error(`Unhandled export format: ${String(unreachable)}`);
}
```

The `never` assignment is the point. A `default` that throws compiles fine when a new member appears and fails at runtime; the `never` tail fails at compile time, at every site that has to decide.

See `exhaustive-dispatch` for which unions this applies to.
