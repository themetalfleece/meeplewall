---
name: data-modeling
description: >-
  When to wrap related data in a class instead of passing raw fields to a sprawl
  of free functions, how value objects are shaped, and how a closed union is
  dispatched so a new member fails compilation. Read before adding a helper that
  takes the same shape as several existing helpers, before passing a primitive
  pair such as an amount and its decimals together, before formatting a domain
  value at a call site, and before branching on a union.
---

# Data modeling

## Wrap related data in a class

When one conceptual entity has many associated computations that would otherwise be passed as raw fields to a sprawl of helpers, wrap it in a class: data on the constructor, derivations as getters and methods.

**Trigger.** More than roughly five free functions all read the same shape of input, or call sites keep destructuring the same fields and passing them around.

**Do not trigger** for one-off helpers, pure transforms, or anything with no persistent context.

**Shape.**

- One class per file, named for the class, with a co-located test. A shared value object lives in the package that owns its domain, on its own subpath.
- The constructor takes a single options object: `new Transfer({ transfer, callbackTransfer })`.
- `private` or `#` for internal state, never an underscore prefix.
- Getters for derived values (`get isMultiHop()`), methods only for actions or parameterised reads, statics for construction (`Money.fromCents`, `Money.fromDecimal`).
- Every public member has TSDoc.

Every free function in that file which only serves the class moves onto it. See `.agents/skills/component-structure/SKILL.md`.

## Value objects

A value that is easy to get wrong as a primitive gets a class: money, an address, an instant, a duration. Once one exists, **always use it.** Never pass the raw pieces (`bigint` plus `decimals`, a string address, epoch milliseconds) between functions where the value object would do.

- **Construction is total.** Each parsing static returns `null` for input that does not describe a valid value, so an unparseable wire field can never reach a formatter as `NaN` or a broken string. Keep that property when adding a constructor.
- **An empty value can be a real instance** (`isEmpty: true`) when display code would otherwise need a null check at every site.
- **Instances are immutable.** Re-scale, re-price or convert through a method that returns a new instance, never by hand-shifting the inner value.
- **Formatting lives on the class** (`format()`, `truncate()`), not at the call site. Read the class before writing a formatter next to it.
- **Never render an unlabelled clock time.** A time value formats with its zone named, or in UTC with the zone stated.

## Closed-set dispatch

A union that the wire, the config or a third party can grow (a status, an order type, a provider discriminant) is in scope.

Any branch on a member of one tests **every** member with an `if` and ends in a `never` assertion, so a newly added member fails compilation at every site that has to decide about it. A ternary, or an `if` chain ending in a bare fallthrough, silently routes the new member down the old path. The root rules ban `switch`; this is the replacement.

```ts
function labelFor(status: OrderStatus): string {
  if (status === "pending") return "Pending";
  if (status === "filled") return "Filled";
  if (status === "cancelled") return "Cancelled";

  return assertNever(status);
}
```

A union the app owns and nothing outside the repo can extend (two form fields) is not in scope; a plain two-way read is fine there.

**When the union also needs a runtime set**, derive it from a `Record<TheUnion, true>` rather than listing the members twice. The record is what fails to compile when the union grows:

```ts
const ORDER_STATUSES: Record<OrderStatus, true> = {
  pending: true,
  filled: true,
  cancelled: true,
};

export function isOrderStatus(value: string): value is OrderStatus {
  return Object.hasOwn(ORDER_STATUSES, value);
}
```

Deliberately invalid test fixtures need `@ts-expect-error`.
