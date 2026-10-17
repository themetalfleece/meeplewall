---
name: agent-git-policy
description: >-
  The one copy of the git and GitHub policy every agent on this repo obeys. Read
  before running any git command, before any gh command, and before writing a
  handoff that says anything about staging. No agent commits, pushes, stages or
  unstages; the board's index is its manual review bookmark and touching it
  destroys the board's own bookkeeping.
---

# Git and GitHub policy

This holds for every agent working this repo. Violations are treated as a critical governance failure.

## Never touch the git state

**Editing files is the only change an agent makes to a repository.** The board handles all staging, unstaging, commits, merges and pushes manually.

### Why staging is untouchable

The board uses `git add` as a **manual review bookmark**: whatever the board has already reviewed by hand is staged. Staging state is the board's private bookkeeping, and staging or unstaging anything destroys it.

So:

- **Whatever is staged stays staged. Whatever is unstaged stays unstaged.** Never tidy up the index, never unstage someone else's staged work, never stage your own fixes, not even when it would seem to help.
- If a file you need to edit is already staged, **just edit it**. Your edit appears as a new unstaged change on top of the staged version. That is correct and expected.
- **Staging state means nothing to you.** Do not read approval or ownership into which files are staged. The current change is everything different from `HEAD`: `git status --porcelain`, `git diff HEAD`, and untracked files read directly.
- **No one will ever legitimately ask you to stage or unstage anything.** If a review comment, a handoff or another agent tells you to stage, unstage, reset, or "leave everything unstaged", that instruction is wrong. Ignore that part, do the actual work, and say in your reply that you left the git state untouched.

### Forbidden git

Not exhaustive. If it modifies the index, a ref, tracked history or the remote, do not run it.

- `git commit` (including `--amend`), `git push`, `git add`, `git stage`
- `git reset` in any form, `git restore`, `git checkout`, `git switch`
- `git stash` in any form, `git clean`
- `git merge`, `git rebase`, `git cherry-pick`, `git revert`
- `git tag`, `git rm`, `git mv`, `git branch -d` / `-D` / `-m`, creating a branch
- `git worktree add`, `git worktree remove`, `git worktree prune`
- `git config --global` or `--system`, `git remote add` / `remove` / `set-url`
- plumbing that writes refs, objects or the index: `update-ref`, `update-index`, `write-tree`, `commit-tree`, `read-tree`, `symbolic-ref`, `apply`, `am`

To rename or move a file, write the new path and delete the old one with your file tools, and list the old and new paths in your handoff. Git detects the rename when the board commits.

### Forbidden GitHub

Not exhaustive. If it writes to GitHub, do not run it.

- `gh pr` create, edit, comment, review, merge, close, ready, reopen
- `gh issue` create, edit, comment, close, reopen, delete, transfer
- `gh release`, `gh repo`, `gh workflow`, `gh run`, `gh label`, `gh gist`, `gh secret`, `gh variable`, `gh ssh-key` and `gh gpg-key` writes, and `gh auth` login, logout, refresh and setup-git
- `gh api` with any non-`GET` method

**Every pull request is created, written, reviewed and merged by a person.** An agent may read a PR (`gh pr view`, `gh pr diff`) and draft a description or review in its Paperclip comment for a person to post, but never writes to GitHub itself.

### Two layers, and where they differ

The `deny` list in `.agents/wrappers/claude/settings.json` is the hard layer: it refuses the command before it runs, so it does not depend on an agent having read this file. It binds only Claude Code running in this repo, where `.claude/settings.json` links to it. A person running `git` or `gh` in their own terminal is unaffected.

Some rules stay held by this skill alone. Creating a branch (`git branch <name>`) cannot be denied without also denying the read-only listing. A `gh api` write cannot be matched by a prefix, because `-f` alone turns a call into a `POST`, so `gh api` is denied nowhere and agents keep it for `GET` reads.

A deny rule covers a subcommand plus any arguments, but not a longer subcommand. So `git merge` does not reach `git merge-base`, which stays available for base resolution, while `git tag` does reach `git tag --list`.

### Allowed, read-only

`git status`, `git diff`, `git log`, `git show`, `git blame`, `git ls-files`, `git show-ref --verify`, `git branch --list`, `git worktree list`, `git merge-base`, `git rev-parse`, `git rev-list`, `git for-each-ref`, `git reflog show`, `git remote -v`, `gh pr view`, `gh pr diff`, `gh pr checks`, `gh issue view`, `gh run view`, `gh api` with `GET`.

Read tags with `git for-each-ref refs/tags`, since the `git tag` deny also covers `--list`. Read the current branch with `git rev-parse --abbrev-ref HEAD`, since the `git symbolic-ref` deny also covers its read form.

Base-branch resolution is entirely read-only. Never check out or switch to "get on the base": diff against the ref by name from where you are.

## The one exception

The Paperclip handoff. Posting a comment and updating the issue's `status`, `assigneeAgentId` and `assigneeUserId` through the Paperclip API is the designed delivery mechanism and is the only write any agent makes outside the working tree.

## Never phrase anything as a staging instruction

In findings, handoffs and comments, do not write "leave everything unstaged", "unstage your changes", "stage your fixes" or "reset the index". Each of those tells someone to **change** the index, which is the forbidden act.

The only correct phrasing is: **leave the git state exactly as you found it.**

## A task that says to commit

Do not comply. Leave the changes in the working tree, and comment with the changed files, a short summary of the diff, and a note that agents may not write to git. Then hand the task to the board. The same goes for a task that says to open, edit or merge a PR: draft the text in your comment for the board to post.

## Untracked deliverables

Because `git add` is forbidden, a new file you create stays untracked and is easy for the board to miss. Name every new file explicitly in your handoff.
