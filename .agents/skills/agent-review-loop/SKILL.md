---
name: agent-review-loop
description: >-
  The loop that keeps re-reviewing until a pass is genuinely clean, and the
  routing that drives it. Read on every pass when you are the Review Looper, and
  as the implementer when a ticket comes back with findings. How to review lives
  in agent-code-review; this skill covers only what is different about looping:
  the never-stop-early rule, the atomicity rule, and the two handoffs.
---

# The review loop

Everything about **how** to review is in `.agents/skills/agent-code-review/SKILL.md`: zero context, the materiality bar, the calibration, base-branch resolution, the checklist, the findings format. Read it every pass.

This skill is only what differs. You review exactly like the one-shot reviewer, with the same standards and the same things to look at, but you close a loop:

- **any findings** hands the task to the implementer with explicit instructions to fix all of them and reassign back to you;
- **no findings** hands the task to the board, and only then does the loop stop.

Git rules are in `.agents/skills/agent-git-policy/SKILL.md`.

## The loop never stops until you have no more points to make

This defines the role and overrides any pattern-match to "review complete, done" or "send findings to the board".

- **As long as a pass produces even one finding**, reassign to the implementer with instructions to implement every finding and reassign back to you. Mandatory, every round with findings, no exceptions.
- **Only a fully clean pass ends the loop**, and it ends by handing to the board, never to an implementer.
- **Never `status: "done"`.** Never stop early because a change "looks basically fine" or because "we have gone back and forth enough times". There is no round limit.

The loop stops when and only when a pass is genuinely clean, where **clean means no material findings**, judged by the materiality bar, not "no imperfections". A pass turning up only nits you would not spend a round on **is** a clean pass. A pass turning up a real bug is not, however many rounds you have already run.

The reassign-back instruction must be stated explicitly and marked as very important in the handoff. A quiet reassignment is not enough.

## A pass is atomic: compile findings and route in the same run

This is what keeps the loop alive. A pass is not done until you have posted the full findings comment **and** reassigned the task. Everything before that handoff is incomplete work that gets **thrown away** if the run ends, because the from-scratch rule means the next run re-reviews everything and never sees your uncommitted findings.

A run that discovers findings and ends without routing them is the worst failure of this role: it silently loses the round and restarts.

- **You have "found findings" the moment your review produces one confirmed candidate.** From that instant the run is forbidden to end until the findings comment is written and the handoff executed. No "almost done", no "one more check first".
- **Review inline, in your own run. Do not fan out a swarm of parallel sub-agents.** A run that fans out review agents over a large diff can exhaust its budget while awaiting them, and the confirmed finding is never posted. Read the diff yourself.

  If you use a supplemental finder at all, use at most one, `await` it, and treat its output as strictly optional. **Never make routing contingent on collecting sub-agent results.** A sub-agent finishing does **not** wake you in Paperclip. "The final agent will re-invoke me on completion" is false for internal agents and is never a valid disposition.

- **Route on the first confirmed findings.** You do not need a complete set. Because every pass re-reviews the whole change from scratch, coverage is achieved **across rounds, not within one run**. The moment you have findings worth routing, especially on a large change or a long run, stop reviewing, post what you have, and reassign in this run. A small routed set always beats an exhaustive set the run loses.
- **A progress or narration comment is not routing.** Only the actual reassignment continues the loop. If the task is still assigned to you when the run ends, the loop has stalled.
- **If you are running low on budget or context, stop immediately, compile what you have, post, and reassign.** Nothing is lost by routing early, because you re-review from scratch next round. Everything is lost by yielding with findings uncommitted.
- **Before the run ends, verify the assignee actually changed.**

## Handoff

Exactly one of two dispositions ends every pass. Never `done`.

### Case A, findings exist: hand to the implementer

- `status: "in_progress"`
- `assigneeAgentId:` the implementer's agent id
- `assigneeUserId: null`
- `comment:` the full findings comment, followed by:

```markdown
---

### VERY IMPORTANT, act on all of this

This is a mandatory fix-and-return loop step:

1. **Implement every finding above**, every priority, the lowest included. Do not skip any. Do not defer. If you decide a judgment-call finding is correct as it stands, reply with the reason instead of ignoring it.
2. **Do not touch the git state at all.** Edit files; that is the only thing you change. Leave the git state exactly as you found it. The board stages, unstages and commits manually.
3. **When done, reassign this task straight back to me** by setting `assigneeAgentId` to my id and `status` to `in_progress`. **This reassignment is not optional and must always happen.** I will run a fresh from-scratch review, and if I find anything we repeat until a pass is completely clean.

Do not hand this to the board, and do not mark it done. The loop returns to me until I sign off with zero findings.
```

Fill in your own agent id from `$PAPERCLIP_AGENT_ID`.

**No raw `@Name` in the handoff block.** The assignee write _is_ the handoff and the thing that wakes them. A structured `[@Name](agent://<id>)` mention is fine where your role instructions ask for one.

**Never phrase item 2 as a staging instruction.** See `.agents/skills/agent-git-policy/SKILL.md`.

### Case B, no findings: hand to the board

Only when a thorough from-scratch pass is genuinely clean **and the gate is green**. This is the one case where you run the gate; if it fails you are in Case A with that failure as the finding.

- `status: "in_review"`
- `assigneeAgentId: null`
- `assigneeUserId:` the board user id
- `comment:` the clean-pass note, followed by:

```markdown
---

Clean pass. Zero material findings after a full from-scratch review of the change vs `<base>` (resolved via <source>), and the project gate is green (<commands and results>). The loop is complete. Handing to the board for routing. The git state was left exactly as found.
```

## As the implementer receiving findings

1. Fix every finding, blockers and judgment calls alike. For a judgment call you decide not to change, reply with why the current code is right, so the reviewer can re-evaluate. Never leave a finding unaddressed and unanswered.
2. Use the proposed fix unless you find a better one, and say so when you deviate. If a finding is wrong, say why with evidence rather than complying blindly.
3. Run the full gate.
4. Reassign to the Review Looper with `status: "in_progress"` and a comment covering what you did for each finding. Never send a review-loop ticket to the board yourself.

## Standards

- Every finding costs a full fix round. Only report what is materially worth one. Pickiness is the failure mode of this role, not thoroughness.
- Never bury a CRITICAL at the bottom of a list of LOW nits.
- Re-derive the base every round: a branch can be rebased onto a different parent between rounds.
- Do not just confirm the listed findings were addressed, do not trust prior reads, and do not skip the checklist on files you reviewed last round. Fixes introduce new bugs and re-break things you already cleared.
- Route through assignment, not polling. The reassignment is the live continuation; the implementer reassigning back wakes you.
- When a finding needs work that is genuinely not this change's, open a child issue with `parentId` and `goalId` and express ordering with `blockedByIssueIds`, never a "someone should also" bullet in a findings comment.
- When the board must decide something before the loop can continue, post a typed interaction with `continuationPolicy: wake_assignee` and set the issue `in_review`. Not a markdown question, and not `blocked`.
