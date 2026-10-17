# `.agents/`

Everything an AI agent reads about this repo. One copy of each rule, linked into whatever path a given tool expects.

## Layout

```
.agents/
  skills/<name>/SKILL.md   a rule set, loaded on demand
              rules/*.md   one rule per file, for the large skills
  roles/<role>/AGENTS.md   who an agent is and which skills it reads
  wrappers/<tool>/         config for one specific tool
  skill-lock.json          where each forked skill came from
```

## The three layers

**`AGENTS.md` at a directory root** is always on. The repo root holds the universal rules; in a monorepo, a workspace root (`apps/web`, `packages/ui`) holds rules for that workspace only. Both readers walk the tree, so a nested file costs nothing outside its own subtree. These are budgeted: 6 KB at the root, 3 KB nested.

**A skill** is loaded on demand, when an agent decides its description matches the task. That decision is why the description matters more than the title: write it as when to read this, not what this is.

**A role** says who an agent is and which skills it reads. It holds no rules of its own beyond the invariants that must hold even if no skill loaded.

The split between an always-on rule and a skill is **diff detectability**. Bugbot and Codex have no skill listing and will never open a skill file, so a rule they need to catch has to be inline in an `AGENTS.md`. Everything long or domain-scoped becomes a skill.

## Keeping it current

These files are only worth their budget if they grow with what we learn. Anything a task teaches you that is not already written down belongs here, in the same change that taught you it: a correction from the board, a convention someone stated, a gotcha that cost an hour, an API that does not behave as documented.

A correction from the board is the strongest signal, because it means the written rules let an agent get it wrong. Fix the rules, not just the code.

The other half is keeping what is already written true. A rename, removal or change of scope in the code updates every file here that names it, in that same change. A doc naming something that no longer exists is worse than no doc, because the next agent trusts it.

## Adding a skill

1. Create `.agents/skills/<name>/SKILL.md` with frontmatter:

   ```yaml
   ---
   name: <name> # must equal the directory name
   description: >-
     When to read this, in enough detail that an agent can route on it.
     At least 40 characters.
   ---
   ```

2. Add a row to the table in the root `AGENTS.md`, referencing `.agents/skills/<name>/`. The validator checks this in both directions.
3. Name it for its scope: no prefix means it applies anywhere, a workspace prefix (`ui-`, `blog-`) means that area, `agent-` means how to operate rather than how to write code.
4. If it is large, split it into an index plus `rules/<id>.md`, and list every rule in the index as ``- `<id>` ``. The validator checks that both directions agree.

   **A rule id is at least two hyphen-separated words**, conventionally `<category>-<name>`: `bundle-dynamic-imports`, `rendering-hydration`. The index is ordinary prose, so a single-word backtick such as ``- `switch` `` is read as prose rather than as a rule id.

Run the validator when you are done. Its errors name the fix.

## The scripts

Plain Node, no install needed. Node 24.2 or newer runs `.mts` files directly and supports the `import.meta.main` guard the validator uses.

```bash
node scripts/validate-agent-docs.mts          # check the whole tree, links included
node scripts/link-agent-config.mts            # create missing links, replace git placeholders
node scripts/link-agent-config.mts --check    # report link drift, write nothing
node scripts/link-agent-config.mts --override # also replace real files and wrong links
node --test "scripts/*.test.mts"              # unit tests for both
```

A repo with a `package.json` wires these in as scripts (`agents:link`, `validate`) and runs the link script from `prepare`, so a fresh install links itself. The commands above still work there.

## The symlinks

Each tool reads a different path for the same content, so the content lives once here and every tool gets a symlink:

| Link                                 | Target                                  |
| ------------------------------------ | --------------------------------------- |
| `CLAUDE.md`, `<workspace>/CLAUDE.md` | the sibling `AGENTS.md`                 |
| `.claude/skills`                     | `.agents/skills`                        |
| `.claude/settings.json`              | `.agents/wrappers/claude/settings.json` |
| `.cursor/BUGBOT.md`                  | `.agents/wrappers/cursor/BUGBOT.md`     |

They are committed rather than ignored. Bugbot reads a PR checkout and never runs an install, so an ignored symlink means it silently gets no config.

### On Windows

Git stores a symlink as its target text. With `core.symlinks=false`, the Git for Windows default, a checkout writes each link as a small plain file holding that text, which no tool follows. The link script recognises such a placeholder by its content and replaces it with a real link, no `--override` needed. Rerun it after any checkout that rewrites the links.

Creating a symlink on Windows needs Developer Mode or an elevated shell. Link targets are always written with forward slashes, so the committed text is identical on every OS.

To have git check links out as real links in the first place, set `core.symlinks=true` in the repo before cloning or checking out. Either way, `git ls-files -s CLAUDE.md` shows mode `120000` for a correctly committed link.

## Forked skills

`writing-style`, `react-performance` and `find-docs` started as someone else's. `skill-lock.json` records the source, the ref forked at, and what we changed, so a future upgrade is a diff rather than a guess. A fork is edited to fit and never tracks upstream automatically.

Point `sourceUrl` and `sourceRefRepo` at the public upstream, and pin `sourceRef` to a commit in that repo: the last one touching `sourcePath` on or before `forkedAt`. Never use a private mirror, because anyone without access to it cannot diff an upgrade.

## What the validator enforces

Frontmatter names match directories and descriptions are long enough to route on. Every skill reaches the root table of contents, and every `.agents/skills/<name>/` path in the tree resolves to a real skill, wherever it is written: a nested `AGENTS.md`, a role, a wrapper, or another skill. Every `AGENTS.md` is under budget. Every link above is a real symlink to its target. No skill name collides with a runtime-supplied one. Rule indexes match their files. Every forked skill has provenance.

What it cannot check is whether a sentence is still true. Prose naming a renamed function passes. That is the part the rule above exists for.

The budget is the load-bearing one. Without it the root file grows back into a monolith that loads on every task.

## The shared baseline

These files are the same in every repo that uses this layout. Copy them as they are, and change them here first when a change applies everywhere:

- `.agents/README.md`, `.agents/skill-lock.json`
- `.agents/roles/**`
- `.agents/wrappers/claude/settings.json`, `.agents/wrappers/cursor/BUGBOT.md`
- `.agents/skills/` `writing-style`, `typescript-style`, `react-performance`, `find-docs`, `testing`, `component-structure`, `nextjs`, `package-management`, `env-config`, and every `agent-` skill
- `scripts/agent-links.mts`, `scripts/link-agent-config.mts`, `scripts/validate-agent-docs.mts`, and their `.test.mts` files

Everything else is the repo's own: the root `AGENTS.md` (its header, table, project rules and gate), any nested `AGENTS.md`, any project skill, and project-only additions to `BUGBOT.md`. A repo whose stack does not use one of the shared skills may delete it, along with its row in the root table.
