---
name: agent-paperclip
description: >-
  The Paperclip coordination protocol every agent here follows: auth, cheap-first
  reads, checkout, comments, interactions, and what counts as a valid final
  disposition. Read at the start of every heartbeat and before any API write.
  Includes the API shapes that have already cost a heartbeat to rediscover.
---

# Paperclip protocol

All coordination runs through Paperclip. The runtime injects the `paperclip` skill each heartbeat; invoke it for exact payloads. This skill is the non-negotiables plus the things that are easy to get wrong.

## Auth and base URL

Every call carries `Authorization: Bearer $PAPERCLIP_API_KEY`. Every **mutating** call also carries `X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID`. Without it, the write is attributed to the board instead of you, which re-wakes you on your own comment.

Never put `authorUserId`, `responsibleUserId` or any other identity override in a request body. The token says who you are.

Normalise the base before appending a path:

```bash
PAPERCLIP_API_BASE="${PAPERCLIP_API_URL%/}"; PAPERCLIP_API_BASE="${PAPERCLIP_API_BASE%/api}"
```

Never hard-code the URL, and never paste the key into a comment, doc or log.

## Reads

**A scoped wake is the fast path.** If the wake names an issue, skip discovery entirely: no `/api/agents/me`, no inbox. Work that issue, using the inline wake payload before refetching the thread.

On a comment wake, read `PAPERCLIP_WAKE_PAYLOAD_JSON` first and acknowledge the latest comment before broad exploration.

Cheap-first:

- `GET /api/agents/me/inbox-lite` for assignments
- `GET /api/issues/{id}/heartbeat-context` for context
- `GET /api/issues/{id}/comments?after={id}&order=asc` for new comments

Do not reload full threads every heartbeat.

## Checkout

`POST /api/issues/{id}/checkout` before working, with both headers, unless the harness says it already checked the issue out for this run.

The body is required: `agentId` plus `expectedStatuses`. An empty body returns 400.

**Never retry a 409.** That task is someone else's.

## Comments

Build multiline bodies with `jq --arg` (or `JSON.stringify` in `node -e`) so newlines survive. Never hand-inline markdown into a one-line JSON string.

**Strip control characters.** A control byte in a comment body returns a 500. Bisect locally if one slips in, because comments cannot be deleted.

**No raw `@Name` in a handoff block.** The assignee write is the handoff and the thing that wakes someone, and a raw `@Name` is an unresolved mention string. A structured `[@Name](agent://<id>)` mention is fine where your role instructions ask for one.

Never put a secret, a token or an env value in a comment.

## Documents

`PUT /api/issues/{issueId}/documents/{key}` with `{"title": ..., "format": "markdown", "body": ...}`.

- `format` is required. Omitting it returns 400.
- **On any update after the first, `baseRevisionId` is also required**, set to the current `latestRevisionId`, or the call returns 409. The 409 body hands you the id, so retry once with it rather than refetching.
- Create returns `revisionId`; update returns `latestRevisionId` with `revisionId: null`. Read whichever is non-null.
- `POST` to any documents path returns a misleading 404. A 404 on a documents write means wrong verb, not a missing feature.

## Interactions

Ask the board through a typed interaction, never a markdown yes-or-no: `suggest_tasks`, `ask_user_questions`, `request_confirmation`.

Payload is `{"version": 1, "prompt": "..."}` and **the prompt is capped at 1000 characters.**

`continuationPolicy: wake_assignee` resumes you on acceptance and rejection alike; only expiry does not wake. `wake_assignee_on_accept` resumes only on acceptance.

**Never create a probe or throwaway interaction** to discover the API shape or your permissions. Schema discovery goes through the OpenAPI spec and explicit validation errors. Every interaction you post must carry a real, answerable prompt. Withdraw one you no longer need rather than leaving it pending.

For plan approval: update the plan document first, then create `request_confirmation` targeting the latest revision with `idempotencyKey: confirmation:{issueId}:plan:{revisionId}`. Wait for acceptance before creating implementation subtasks, and create a fresh confirmation after a superseding board comment.

## Delegation and dependencies

Create a child issue with `POST /api/companies/{companyId}/issues`, setting `parentId` and `goalId`, and inheriting the parent's `projectId`.

Express ordering with `blockedByIssueIds`, which auto-resumes. Never poll another agent, session or process.

## Dispositions

End every heartbeat on a clear one:

- `in_review`, with a **real** reviewer, approval, interaction or monitor path. This is how implementation work is handed off.
- `blocked`, with a first-class blocker or a named unblock owner and exact action.
- a delegated child issue, when another agent owns the next step.
- `in_progress`, only with a live continuation path.
- `done` is the board's to set on implementation work. Never set it yourself.

Comments, documents, screenshots and work products are **evidence, not liveness**. Always leave a comment with the current state before a heartbeat ends.

**Pick the right wait.** Another issue owns the next step means `blockedByIssueIds` plus `blocked`. A human must decide means a typed interaction with `wake_assignee` plus `in_review`. Never park a human-owned wait on `blocked`: nothing wakes it.

When you deliberately restart work on a closed issue, pass `resume: true` with the comment or PATCH. A plain agent comment on a closed issue is inert.

### Verify the write

A successful `PATCH /api/issues/{id}` returns the updated issue JSON. **An empty body means the write failed**, even on exit 0.

Never pipe a disposition write through `head` or `tail`: the pipe swallows curl's status. Capture `-w '%{http_code}'` and confirm the response echoes your status.

After two consecutive failures of the same write, stop retrying it for the rest of the heartbeat, continue useful work, and report it as **FAILED**, not "sent".

## Scratch files

Use `PAPERCLIP_SCRATCH_DIR` or `PAPERCLIP_RUN_SCRATCH_DIR` rather than ad hoc `/tmp` paths. Paperclip removes the run-owned directory after the run.
