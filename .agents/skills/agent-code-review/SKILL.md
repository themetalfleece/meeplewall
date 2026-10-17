---
name: agent-code-review
description: >-
  The review engine shared by every reviewing role here: zero-context reviewing,
  the materiality bar, the over-engineering calibration, base-branch resolution,
  the checklist, and the findings format. Read on every review pass, before
  writing a single finding. Routing differs by role and lives in the role's own
  skill; everything about how to review lives here.
---

# Code review

This is **how** to review. **Where the review goes** depends on the role:

- the Reviewer Engineer always hands back to the board, with findings or without;
- the Review Looper routes findings to the implementer and loops. See `.agents/skills/agent-review-loop/SKILL.md`.

Git and GitHub rules are in `.agents/skills/agent-git-policy/SKILL.md`. You are read-only on the code; the Paperclip handoff is the only write you make.

## Review with zero task context and zero bias

You review **the code, not the story around it.** Form your entire understanding of what the change is supposed to do from the change itself: the diff, the surrounding code, the tests, and the standing rules in `AGENTS.md` and `.agents/skills/`.

On every pass:

- **Do not read the issue description, title, task body or project text** to understand what the code should do. They are not evidence.
- **Do not use the comment thread or implementer explanations as evidence.** "This is done", "tests pass", "I implemented all your findings", "you already cleared this" carry zero weight. The Review Looper reads its own previous findings to confirm each one was addressed, and still re-reviews everything from scratch.
- **Do not anchor on the previous review's findings.** Every pass is a fresh end-to-end read.
- **Infer intent from the change.** A good change explains itself through names, structure, tests and call sites. If the code does not make its own intent clear, that opacity is itself a finding. Do not go hunting in the task to excuse it.

Apart from the Review Looper's own previous findings, the only things you may take from the issue are **routing and scope metadata**: the board user id for the handoff (`createdByUserId`, falling back to `authorUserId` on the most recent board comment, defaulting to `local-board`), the implementer's agent id for a loop handoff, and an explicitly named base branch if the board states one. A named base tells you what to compare against, not what the code should do, so take the name and nothing else from that sentence.

This overrides any general instruction to "understand the task first".

## Findings must be material

A finding that is not worth acting on is noise, and in a loop it costs a full fix round. Being picky is not thoroughness; it is how a review fails to converge.

Every candidate must clear **both** bars:

1. **Real, not theoretical.** Name the concrete situation where this actually bites: a plausible input, a real call site, a state the system can reach, a change someone will realistically make next. If you cannot describe that in one sentence using things that exist in this codebase, it is not a finding.

   Explicitly not findings: defensive handling for unreachable states, validation of inputs only trusted internal callers produce, "what if this were called concurrently" when nothing does, error paths for operations that cannot fail, hypothetical future requirements, scale problems in code that will never run hot.

2. **The fix is proportionate to this project.** The solution has to make sense for the project's size, stage, conventions and existing patterns. Never propose an abstraction, config layer, dependency, test harness or refactor bigger than the problem it solves, and never one that is more work or risk than living with the issue. If the honest answer is "leave it as it is", there is no finding.

Further limits:

- **Style and taste are not findings.** Code matching the surrounding conventions is correct by definition. Flag naming or structure only when it is genuinely confusing or violates an explicit written rule, and cite the rule.
- **Do not rewrite the author's design.** The chosen approach is a given unless the approach itself is the defect. "I would have done this differently" is never a finding.
- **Unchanged code is out of scope.** Pre-existing issues the diff merely touches belong to the board. A one-line note at most.
- **`[LOW]` is the exception, not filler.** If a pass produces only findings you would be embarrassed to spend a round on, that pass is **clean**.
- **When unsure whether something is real, it is not a finding.** Verify it concretely or leave it out. Genuine ambiguity can be raised as a question; uncertainty is not licence to route a maybe.

This does not soften anything above `[MEDIUM]`. Correctness bugs, security holes, data loss, broken builds, missing tests for real behaviour and explicit rule violations are **always** findings, however small the diff.

## Calibration: what counts as over-engineering

The mirror image of the materiality rule. This one says when there is genuinely too much machinery.

**Size the defence by the worst outcome it prevents, not by how well-reasoned it is.** Each piece of a defensive layer can be individually sensible and the layer still be disproportionate. Ask what actually happens if the guarded thing fails, then what the guard costs in code, tests, docs, coupling and process-lifetime state.

If the failure is invisible to the user, self-healing, or fixed by a reload, and the guard is hundreds of lines plus its own constants and tests, **the guard is the defect**.

- **Overkill.** Retry-budget schedulers protecting a sort order. Process-wide circuit breakers whose open state means "some rows look stale for N seconds". Hand-rolled content digests whose only consumer is a cache key. Towers of interacting time-window constants plus the tests holding them consistent. Module-level never-cleared dedup sets for a degrade the user cannot see. Docs and test files existing only to explain the above.
- **Not overkill, always keep.** Anything guarding a real crash, a wrong value, lost data or money, or a cross-item blast radius. Validating third-party data before a call that throws synchronously is material when one bad entry can take down its siblings. So is one memo collapsing a per-request burst into a single upstream read, and one warning log for a degrade that silently drops a whole category of results.
- **Cheaper equivalents beat clever ones.** Prefer a value already in hand (a fetch timestamp) over one you must compute and keep canonical (a digest). Prefer letting an existing mechanism do the work for free (identity in a query key) over a scheduler reimplementing it.
- **Coupling counts as cost.** A guard forcing the client to import a server constant is paying in architecture, not just lines.
- **When the fix is "cut", say what stays.** Never route a bare "this is over-engineered". Name the keep list, the cut list, and the cheap replacement for anything worth preserving.

**When in doubt, add it. Never cut on a hunch.** If you are not confident a piece of machinery is disproportionate, it stays; only cut what you can describe as clearly outsized against a named, benign failure. Deleting working protective code you merely find inelegant is worse than leaving it. And if the board rules on a calibration question, record the ruling in this skill.

## Run the project gate only on an otherwise-clean pass

The gate is expensive and its result is thrown away the moment the implementer edits the code.

- **The moment your read produces even one material finding, do not run the gate at all.** Skip it, finish compiling findings, and route in this run.
- **Only a from-scratch read producing zero findings earns the gate**, and then you must run it before taking the clean-pass handoff. A clean pass means clean code _and_ a green gate. The commands are under "Before you finish" in the root `AGENTS.md`.
- **If the gate fails on that otherwise-clean pass, the failure is the finding.** `[CRITICAL]` for a broken build or test, `[HIGH]` for lint, typecheck, format or the agent docs validator. Report the exact failing command and the relevant output, route, and stop there. Do not hunt for more findings to accompany it.
- **Say which path you took.** On a findings round: "Gate not run, findings present, skipped by design." On a clean round: name each command and its result.

## Review workflow

**Always re-evaluate from scratch on every pass**, even if you reviewed this exact task before. Re-read the rules, re-derive the base branch, re-diff the full working tree, re-read every changed file in full, re-apply the whole checklist. Fixes routinely introduce new bugs, miss the original requirement, or touch files you have not seen. Treat every pass as the first review.

1. **Load the rules, not the task.** Read the root `AGENTS.md`, the nested `AGENTS.md` for the areas the change touches, and the skills those point at. These are the standards you enforce.
2. **Derive the base branch.** Never assume `main`. See below.
3. **Take the full diff against `$BASE`.** Your scope is the **entire branch versus `$BASE`, including staged, unstaged and untracked changes, judged together as one combined change**.

   This is critical and easy to get wrong: **no agent ever commits, so essentially all of the change lives as uncommitted working-tree edits and brand-new untracked files.** Some may be staged, because the board stages what it has hand-reviewed, but staging is the board's bookkeeping and means nothing to you.

   ```bash
   # Commits on the branch: context only. The real change is usually not here.
   git -C <checkout> log --oneline "$BASE"..HEAD

   # Full working-tree diff vs $BASE: committed + staged + unstaged, combined.
   # TWO-DOT, not three-dot, so uncommitted edits are included.
   git -C <checkout> diff --stat "$BASE"
   git -C <checkout> diff "$BASE"

   # Untracked files: `git diff` does not show them.
   git -C <checkout> status
   git -C <checkout> ls-files --others --exclude-standard
   ```

   **Do not split the diff by staging state.** You never need `git diff --cached`. The two-dot diff already contains both, and running the split views only tempts you to treat the staged half as pre-approved.

   In a repo with no commits yet, there is no base to diff against: the whole change is `git status` plus every untracked file.

   Then **read every untracked file in full**. Uncommitted and untracked work is the change, never an afterthought.

   **Sanity-check before reviewing.** If the diff contains files or commits belonging to several unrelated changes, you almost certainly resolved the wrong base and are seeing the parent branch's work.

4. **Read every changed file in full.** Not just the hunks. Diffs hide context; the surrounding function, the other call sites and the adjacent tests often reveal what the hunk does not.
5. **Apply the checklist.** Your job is to find what the implementer missed, not to confirm that obvious things work. Every candidate clears the materiality bar first.
6. **Run the gate only if step 5 produced zero findings.**
7. **Identify the routing target.** Metadata only.
8. **Write findings.** Priority, location (`file:line`), what is wrong, why it matters, proposed fix.
9. **Route, in this run, before it ends.**

## Determining the base branch

**Never hard-code `main`.** Resolve `$BASE` fresh every pass, stopping at the first source yielding a ref that exists:

1. A base branch the board named explicitly on the issue.
2. An open pull request, which declares its own base: `gh pr view "$CUR" --json baseRefName -q .baseRefName`.
3. The branch's creation record. Git writes the branch point into the branch's own reflog; the oldest entry reads `branch: Created from <ref>`. Discard `HEAD`, empty, or a ref that no longer resolves. Reflogs are local and can be pruned, so this can legitimately come back empty.
4. Topology: of every other local and remote branch, the one whose merge-base with `HEAD` is closest to `HEAD`, preferring `main` or `master` on a tie. Skip distance-0 refs, since a branch sitting exactly on `HEAD` may have been cut **from** this branch.
5. Fallback: `main`, then `master`.

```bash
WT=<checkout>
CUR=$(git -C "$WT" rev-parse --abbrev-ref HEAD)
HEADSHA=$(git -C "$WT" rev-parse HEAD)

# (0) Already on the default branch: the change is purely the working-tree edits.
case "$CUR" in main|master) BASE="$CUR";; *) BASE=;; esac

# (1) Board-named base, if the issue states one.
[ -z "$BASE" ] && BASE="<base named on the issue, if any>"

# (2) Open PR declares its own base.
[ -z "$BASE" ] && BASE=$(cd "$WT" && gh pr view "$CUR" --json baseRefName -q .baseRefName 2>/dev/null)

# (3) Branch creation record.
if [ -z "$BASE" ]; then
  BASE=$(git -C "$WT" reflog show "$CUR" 2>/dev/null | tail -1 \
         | sed -n 's/.*[[:space:]]branch: Created from //p')
  case "$BASE" in HEAD|''|*[!A-Za-z0-9._/-]*) BASE=;; esac
  [ -n "$BASE" ] && ! git -C "$WT" rev-parse --verify -q "$BASE" >/dev/null && BASE=
fi

# (4) Topology: nearest ancestor branch.
if [ -z "$BASE" ]; then
  BASE=$(git -C "$WT" for-each-ref --format='%(refname:short) %(symref)' refs/heads refs/remotes \
    | awk 'NF==1{print $1}' | grep -vxF -e "$CUR" -e "origin/$CUR" \
    | while read -r b; do
        mb=$(git -C "$WT" merge-base "$HEADSHA" "$b" 2>/dev/null) || continue
        n=$(git -C "$WT" rev-list --count "$mb".."$HEADSHA")
        [ "$n" -eq 0 ] && continue
        case "$b" in main|master) r=0;; origin/main|origin/master) r=1;; */*) r=3;; *) r=2;; esac
        echo "$n $r $b"
      done | sort -k1,1n -k2,2n | awk 'NR==1{print $3}')
fi

# (5) Fallback.
if [ -z "$BASE" ]; then
  for c in main master origin/main origin/master; do
    git -C "$WT" rev-parse --verify -q "$c" >/dev/null && { BASE=$c; break; }
  done
fi
BASE=${BASE:-main}
```

Notes:

- **Report the base and how you got it** in every comment, so it can be corrected in one line.
- **A stacked base means the parent's code is out of scope.** Anything already in `$BASE` belongs to whoever owns that branch, even if it is genuinely wrong. If a defect in `$BASE` makes this change unsafe, say so as a single note, not as a finding this branch must fix.
- **A clean pass is clean against `$BASE`, not against `main`.** On a stacked branch the two always differ.
- **A local `main` ref can be stale.** Scope against `origin/main` when `main` is the answer, and check the merge-base before calling something a revert: a whole-tree diff against a moved `main` fakes reverts that are not there.
- **If the base is genuinely ambiguous, review against your best answer and flag it** at the top of the comment.

## The `/code-review` skill

Allowed as a **supplemental finder**, in report-only form. It reviews the diff on its own merits, which is compatible with the zero-context rule.

- Plain form only: `/code-review` or `/code-review high`, run against the checkout.
- **Never `--comment`.** Posting PR comments is a GitHub write.
- **Never `--fix`.** It modifies the working tree.
- **Never `ultra`.** It is a user-triggered billed cloud review; agents cannot launch it.
- Treat output as **candidate findings only**. Verify each against the code, put it through the materiality bar, and rewrite anything you keep in the format below. Never forward its list wholesale.
- Running it never shortens your own work.

### Why it is a supplement and not the review

A published comparison ran five review skills over three real tasks, in both Claude Code and Codex, and scored them on real-bug recall, precision, restraint against over-engineering, design insight and cost.

Two of its results decide the question.

**The Claude built-in is the strongest single finder inside Claude, and the weakest outside it.** A copy of the built-in review placed first across all 15 Claude Code sessions and last on Codex. Vendor-specific prompt engineering is doing the work, so the advantage does not travel. Codex and Bugbot are first-class readers of these repos, which is why the review itself lives here as a plain skill and the Claude-specific tool stays optional. A reviewer running under Claude should use it; a review must never depend on it.

**A clean review is not permission to ship.** No skill in the comparison found every bug on a medium or large change. Only review plus a separate verification activity caught them all. That is why the gate is part of a clean pass rather than a formality after one, and why "the tool found nothing" is never a reason to shorten the checklist.

## Review checklist

- **Correctness.** Does the change do what it sets out to do, as evident from the code itself? Does it handle the edge cases it implies?
- **Bugs.** Off-by-one, null and undefined handling, race conditions, error paths, resource leaks, swallowed exceptions.
- **Misses.** Behaviour the change clearly intends but leaves unimplemented, skipped tests, follow-up cleanup not done, dead branches left behind.
- **Security.** No injection, no secrets in code, proper input validation at trust boundaries, auth checks on every protected path.
- **Tests.** Adequate coverage for new and changed code, and tests that actually exercise the behaviour rather than just calling the function.
- **Performance.** No obvious bottlenecks, N+1 queries, unnecessary work in hot paths, unbounded loops or memory growth.
- **Readability.** Clear naming, reasonable structure, no unnecessary complexity or premature abstraction.
- **Reuse.** Duplicated logic that should be one shared function, or a new helper where an existing one already does the job.
- **Naming.** No single-letter or abbreviated names. Full descriptive names even in callbacks: `(post) =>`, not `(p) =>`.
- **Consistency.** Follows existing patterns; does not invent a new way to do something already established.
- **Rules compliance.** Follows the root and nested `AGENTS.md` and the skills. Cite the rule for every violation.
- **No issue IDs in code.** Any tracker key of the form `ABC-123` in comments, identifiers, names, string literals, test descriptions or fixtures is a `[HIGH]` finding. The only allowed use is git metadata such as a branch name.
- **New dependencies.** A new package not on its latest stable release, without a recorded exception, is a finding. See `.agents/skills/package-management/SKILL.md`.
- **Docs follow the code.** A diff that renames, moves or removes something, or changes what it does, while a skill, `AGENTS.md`, README or `docs/` page still describes the old shape, is a finding. Grep the tree for every old name the diff retires.
- **Code quality.** Dead code, commented-out code, comments that lie or restate the code, missing error context, unnecessary new dependencies.

## Findings format

If your role instructions give their own findings format, use that.

```markdown
## Review of `<branch>` vs `<base>`

<one-line summary: scope of the change plus overall assessment>

**Base:** `<base>` (resolved via <board-named | open PR | branch creation record | nearest-ancestor topology | fallback>)
**Scope reviewed:** <N> files, <N> lines changed (`git diff --stat <base>`, plus untracked files, full working tree vs `<base>`, staged and unstaged combined)
**Gate:** Not run, findings present, skipped by design.

### Findings

#### [PRIORITY] <Short title>

- **Where:** `path/to/file.ts:L42`
- **Issue:** what is wrong and why it matters
- **Fix:** specific, sensible proposed solution
```

On a clean pass, replace the findings section with a short paragraph describing exactly what you compared and verified and why nothing was warranted, and replace the gate line with each command you ran and its result.

### Priority levels

- `[CRITICAL]` bug, security hole, data-loss risk, broken build, breaks an existing feature. Must fix before merge.
- `[HIGH]` incorrect behaviour in a non-rare case, missing required tests, violates an explicit project rule. Must fix before merge.
- `[MEDIUM]` a code-quality issue that will hurt future work **and that you can tie to a concrete way it will hurt**. Not "I would have written it differently".
- `[LOW]` minor suggestion. Rare by design. Only one you would defend as worth its own fix round.

### Rules for findings

- **Every finding has a proposed solution.** "This is bad" is not a finding. "This is bad because X, change it to Y" is.
- **Every finding names the real case it breaks**, in the `Issue` line.
- **Solutions are proportionate.** Keep the change shape that is there; just make it better.
- **Order by priority**, then by file path.
- **Cite the rule** for any standards violation.
- **Be honest.** Do not invent findings to look thorough, and do not omit real ones to finish faster. Dropping a nit under the materiality bar is not suppression; dropping a bug because you are tired is.
- **Ask, do not reject blindly.** Genuine ambiguity in the diff is surfaced as a question, not silently dropped.
