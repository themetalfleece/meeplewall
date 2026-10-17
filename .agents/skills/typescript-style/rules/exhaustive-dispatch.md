---
title: Closed-set dispatch must be exhaustive
tags: exhaustiveness, unions, boundaries
---

## Closed-set dispatch must be exhaustive, never a ternary

### Which unions are in scope

The ones the wire or the config can grow: a status an API returns, a provider discriminant, a format read from config or a query param.

Any branch on a member of one, or any function that _produces_ one, tests every member with an `if` and tails out through a `never` assertion.

A ternary, or an `if` chain whose last branch is a bare fallthrough, silently routes a newly added member down the old path.

**Not in scope:** a union the app owns that nothing outside the repo can extend, such as a two-state UI toggle. A plain two-way read there is fine.

### Deliberately invalid fixtures

A test that feeds an out-of-union value needs `@ts-expect-error`, which documents that the invalidity is the point of the test.

### When a runtime set is also needed

Where an in-scope union needs a **runtime** set as well (a boundary type guard, a schema literal union), derive it from a `Record<TheUnion, true>` rather than hand-listing the members twice. The record is what fails to compile when the union grows.

**Incorrect:**

```ts
export type ExportFormat = "csv" | "json";

export function isExportFormat(value: string): value is ExportFormat {
  return value === "csv" || value === "json";
}
```

**Correct:**

```ts
const EXPORT_FORMAT_SET: Record<ExportFormat, true> = {
  csv: true,
  json: true,
};

export const EXPORT_FORMATS = Object.keys(EXPORT_FORMAT_SET) as ExportFormat[];

export function isExportFormat(value: string): value is ExportFormat {
  return Object.hasOwn(EXPORT_FORMAT_SET, value);
}
```
