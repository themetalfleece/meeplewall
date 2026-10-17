---
title: Minimise what crosses the RSC boundary
impact: HIGH
tags: rsc, payload
---

## Minimise serialization at RSC boundaries

Everything passed from a Server Component to a Client Component is serialised into the HTML payload. Passing a whole record when the client needs two fields ships the rest to every visitor.

Project down to what the client actually renders before passing it.

Watch for the duplicate case too: the same object passed to two client components is serialised twice. Pass an id and let one component own the data.

Class instances do not survive serialization. Pass the plain values and reconstruct the instance on the client.
