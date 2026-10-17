---
name: agent-task-workflow
description: >-
  The task lifecycle for an implementing agent here: intake, implementation,
  writing down what you learned, the review gate, and the handoff. Read at the
  start of every implementation task and before handing work back. Covers when
  a change goes through the Review Looper and when straight to the board, and
  what a handoff must name.
---

# Task workflow

The lifecycle for an implementing agent: intake, implement, gate, hand off.

Git rules are in `.agents/skills/agent-git-policy/SKILL.md`. Coordination is in `.agents/skills/agent-paperclip/SKILL.md`.

## Intake

Read the task description and the whole comment thread before starting. Prefer simple solutions.

If the task is ambiguous, comment with the success condition you understood and proceed. If it is fundamentally unclear, ask through a typed interaction.

**A question is not a change request.** If the board asks something, answer it. Do not also ship the unrelated fix the question surfaced.

A sub-issue must inherit the parent's `projectId`, and set `parentId` and `goalId`. If the parent has no project, leave the child's null.

Work in the checkout the task names. Never create a branch or worktree yourself: both write refs, which `agent-git-policy` forbids. If the work needs one, ask the board to create it.

## While implementing

- Inspect the relevant code before editing, and match its conventions.
- Always include tests for new functionality. See `.agents/skills/testing/SKILL.md`.
- **Update the docs that name what you changed, in this change.** Renaming, moving or removing an export, file, route, config field or script, or changing what one does, leaves every skill, `AGENTS.md`, README and `docs/` page that mentions it describing something that no longer exists. Grep the whole tree for the old name, markdown included, and fix each hit. The validator catches a dangling skill path, not stale prose. That part is yours.
- Keep the change focused: one logical change per task.
- Document non-obvious decisions in a comment, in product terms. Never reference the board, a reviewer, a task or an issue ID. See `.agents/skills/writing-style/SKILL.md`.
- Save work as working-tree modifications. Never stage or commit.

## Write down what you learned

**If the task taught you something that is not already in these files, write it down before you hand off.** The trigger is anything you did not know at the start: a correction from the board, a convention someone told you, a gotcha that cost you an hour, an API behaving unlike its docs, a command that turned out to be the wrong one.

This is not optional cleanup. It is the difference between the repo getting smarter each task and every agent paying the same tuition.

Where it goes:

| What you learned                                           | Where                                   |
| ---------------------------------------------------------- | --------------------------------------- |
| A rule for one area                                        | that area's skill                       |
| A rule that holds everywhere and is visible in a diff      | the root `AGENTS.md`, budget permitting |
| A rule for one workspace                                   | that workspace's nested `AGENTS.md`     |
| Something about how to operate here, not how to write code | an `agent-` skill                       |
| A fact about a library or service, not about us            | the skill for the area that touches it  |

If a rule changes, edit the existing one instead of appending a contradiction. `.agents/README.md` has the mechanics. Name and quote what you added in the handoff, so the board can see the rule and not just the code.

A correction from the board is the strongest signal of all: it means the written rules let you get it wrong. Fix the rules, not just the code.

## The review gate

Run the commands under "Before you finish" in the root `AGENTS.md`, **only after every change is finished**, not incrementally on a half-finished one.

Every command must exit 0. If one fails, fix the underlying issue and **rerun the gate from the top**. Partial reruns do not count.

A failure on code your change does not touch, which you can show predates it, is reported in the handoff with the evidence rather than fixed silently. A failure you cannot fix and cannot show is pre-existing blocks the task: name the command, the error, your best hypothesis and what would unblock it.

If a script genuinely does not exist, do not invent or silently skip it. Name the missing script on the issue and ask which command to run. A missing script is a blocker, not a pass.

### Optional self-review

`/code-review` is available for a second pass on a large or subtle diff. Default to plain form; use `high` for broad or risky changes. `--fix` is allowed since it edits your own working tree, but rerun the whole gate afterwards.

**Never `--comment`**, which posts to a GitHub PR. **Never `ultra`**, which is a user-triggered billed cloud review.

It supplements the gate and never replaces it.

## Handoff

When the gate is green, decide where the change goes. Judge it over the whole change set, staged, unstaged and untracked alike.

- **Meaningful code changes go to the Review Looper.** New or changed logic, behaviour, interfaces, runtime config, or tests that assert behaviour. Assign it to the Review Looper with `status: "in_progress"`. When in doubt, send it: a small change that touches real logic or a trust boundary still goes.
- **Everything else goes straight to the board**: no changes at all, or docs prose, comment-only tweaks, formatting churn, a typo fix. Set `status: "in_review"`, `assigneeAgentId: null`, `assigneeUserId:` the board user id (`createdByUserId` on the issue, falling back to `authorUserId` on the most recent board comment). Say in the comment that the change was non-material and skipped the loop.

Either way, post a comment covering what changed, why, where to look, and the gate results with each command's pass or fail status. Leave the git state exactly as you found it.

**Name every new file explicitly**, and list any rename as old path and new path. Because `git add` is forbidden, a new file stays untracked and is easy to miss.

**Never set a task to `done`.** Only the board does that.

If the board requests changes, address them, then rerun the full gate before handing back.
