---
name: writing-style
description: >-
  How to write anything a human reads here, including code comments, TSDoc,
  docs, blog posts, handoff comments, issue comments and product copy. Read
  before writing a comment or a paragraph of prose. Holds the company writing
  rules (no em dashes, natural language, concise), cuts the patterns that mark
  text as machine-written, and states what a code comment may contain.
---

# Writing style

Forked from Cursor's `unslop` (see `.agents/skill-lock.json`) and merged with the company writing rules and our comment rules. It applies to **code comments as well as prose**, and to issue comments and handoffs as much as to the repo. A comment that reads as generated is as bad as a paragraph that does.

## The company rules

These come from the board and win over anything below that seems to disagree.

- **Write in natural language**, the way you would explain it out loud.
- **No em dashes.** Not in comments, docs, issue comments, strings or identifiers. Not en dashes or a spaced hyphen standing in for one either. Use a comma, a colon, parentheses, or a second sentence instead.
- **Keep comments concise.** Say what the code does and why it exists, then stop. One line is usually enough.
- **Keep documentation concise.** Lead with the rule, skip the preamble, and do not restate what the reader just read.
- **Cut filler, hedging and throat-clearing.** If a sentence adds no information, delete it.

Over-commenting is the classic tell of generated code. Two paragraphs explaining an obvious three-line function is worse than no comment, because the reader still has to read it.

## Comments

A comment states, briefly, **what** the code does and **why** it exists. Nothing else.

- **Do not restate the code.** If the line says what it does, the comment is noise.
- **Do not explain how a framework or library works.** No paragraph on Next.js caching semantics.
- **Do not narrate history.** No "this used to X, now it Y", no "migrated from X". Describe only the current state.
- **Do not describe unrelated parts of the codebase** unless the reader genuinely needs that context right here.
- **Never reference the process.** No mention of the board, a reviewer, a task, an issue ID, or "the former X we migrated from". A requirement is documented as the code's own rationale, not as something a review asked for. This holds for identifiers, strings and test names too.
- **A `TODO` states the work and why.** "TODO: paginate once a tag has more than 50 posts", never "TODO(ABC-12)". Prefer doing the work, or stating the constraint as a fact about the code today, over leaving a marker at all.

Reserve extra length for the cases that earn it: a special-case branch, a non-obvious invariant, a gotcha a future reader must know about.

Add TSDoc to exported functions and non-trivial helpers. Skip it for obvious one-liners.

When the rationale genuinely needs a paragraph, it belongs in a README or a skill, and the comment points there.

## Process

1. Scan for the patterns below.
2. Rewrite. Preserve meaning, match the intended tone.
3. Self-audit: "what makes this obviously generated?" Fix what is left.

## Patterns to cut

### Content

- **Puffery.** "pivotal moment", "testament to", "evolving landscape", "setting the stage for". State what happened.
- **Superficial -ing clauses.** "highlighting...", "ensuring...", "reflecting...", "showcasing...". Delete, or expand into a real statement.
- **Promotional language.** "seamless", "powerful", "groundbreaking", "robust". Use neutral description.
- **Vague attribution.** "Experts believe", "Industry reports suggest". Name the source or cut it.
- **Formulaic contrast.** "Despite challenges, X continues to thrive." Replace with specific facts.

### Language

- **AI vocabulary.** Additionally, crucial, delve, enhance, fostering, garner, interplay, intricate, landscape (abstract), pivotal, showcase, tapestry, testament, underscore, vibrant. Use plain words.
- **Fancy ways to say "is".** "serves as", "stands as", "boasts", "features". Say "is" or "has".
- **"Not just X, but Y."** State the point directly.
- **Rule of three.** Do not force ideas into groups of three. Use the natural number.
- **Synonym cycling.** Pick one term for a thing and repeat it. In technical writing this is mandatory: calling the same value "the post", "the article" and "the entry" in one paragraph makes the reader wonder whether they are three things.
- **False ranges.** "from X to Y" where X and Y are not on a scale. List the items.

### Style

- **No em dashes.** See the company rules above.
- **No boldface on every proper noun or acronym.**
- **No inline-header lists** where a bold label and colon restate the line: "**Performance:** Performance improved...". A bold lead-in that ends in a period, names the item and is followed by genuinely new detail is fine.
- **Sentence case headings.**
- **No decorative emoji** in headings or bullets.
- **Straight quotes**, not curly.

### Communication artifacts

- **No chatbot phrases.** "I hope this helps", "Let me know if...", "Of course!", "Certainly!", "Found the smoking gun!"
- **No cutoff disclaimers.** "While specific details are limited..." Find the detail or cut the sentence.
- **No sycophancy.** "Great question!", "You're absolutely right!" Respond directly.

### Filler

- **Filler phrases.** "In order to" becomes "To". "Due to the fact that" becomes "Because". "It is important to note that" gets deleted.
- **Excessive hedging.** "could potentially possibly be argued that it might" becomes "may".
- **Generic conclusions.** "The future looks bright." State the specific plan or fact.

### Jargon

- **Abstract metaphor nouns.** Substrate, wedge, vector, locus, nexus, primitive (as a noun), harness (as a metaphor), surface (as in "API surface"), bedrock, scaffolding (as a metaphor), paradigm, gold-plating, ratchet, evacuate (for moving code), endgame, north star, flywheel.

  These read as technical but usually have a plainer concrete word. "Substrate" is "base". "Wedge in" is "add". "Vector" is "way". "Gold-plating" is "more than the job needs". "Evacuate" is "move out". "Endgame" is "the last phase". Pick the concrete word.

  One exception: where the repo already uses a term as a **name** for a specific thing, such as a UI primitive, keep it. A named concept is not a metaphor.

### Plain speech

- **Say what it does, not how it feels.** "types that follow your schema" names a feeling. "A column rename fails the build" names a mechanism. Ask what the sentence tells the reader to do or know, then write that. If you cannot restate it as a concrete instruction, fact or number, cut it.

  One more check: if the sentence could appear unchanged in another project's docs, it says nothing about this one. Cut it.

- **Shorten or split dense sentences.** If the reader has to backtrack to parse it, break it in two. One idea per sentence.
- **Active voice.** Catch "is/are/was/were" plus a past participle and name the actor. "queries are validated" becomes "the compiler validates queries". Passive is fine only when the actor is unknown or genuinely does not matter.
- **Cut adverbs, or use a stronger verb.** "runs quickly" becomes "is fast", or the number. "significantly improves" becomes the measured delta. An adverb propping up a weak verb means the verb is wrong.
- **Prefer the plain word.** "utilize" is "use". "leverage" is "use". "facilitate" is "help". "numerous" is "many". "in the event that" is "if".

## Voice, in prose

Removing patterns is half the job. Sterile, voiceless writing is just as obvious.

- **Have opinions.** React to the facts rather than neutrally listing pros and cons.
- **Vary rhythm.** Short sentences. Then longer ones that take their time.
- **Acknowledge complexity** where it exists rather than flattening it.
- **Be specific.** Not "this is concerning" but the thing that is concerning.

This section is about prose. Code comments stay terse: what and why, nothing else.
