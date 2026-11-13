# Session delete

DSH stores every Session as its own directory under the Harness home, and its
sidebar only offers **Archive** — a reversible hide that keeps the log on disk.
This bundle adds the missing permanent operation.

## What it adds

A **Delete session** row at the bottom of a Session's context menu (right-click
the row, or use its menu button, next to *Archive session*). Choosing it raises
one confirmation notice; only the confirmation's **Delete permanently** button
performs the deletion.

## What deleting does

1. Refuses a Session whose Agent reports `running` — deleting the log of a live
   turn would pull it out from under the running Agent.
2. Asks the archive path to stop the work the Session still owns (scheduled
   reminders, background jobs, subagents).
3. Removes the Session id from its Workspace's accounting, which is what drops
   the row from the sidebar.
4. Deletes the Session's log directory (`session.vN.jsonl` / `.zstd`, together
   with any historical generation stored beside it).

Deletion is irreversible: no undo, no trash, and the transcript cannot be
recovered from the Harness afterwards.

## Limitations

- **The running Host may keep a live Session object for the rest of the process.**
  DSH hands the teardown capability only to the consumer that created the Agent,
  so a plugin cannot release it. The object has no log and no Workspace slot, is
  not listed anywhere, and is gone after the next start.
- **Only the clicked Session's own log is removed.** Sub-session logs that a
  subagent produced for it live in separate directories and stay on disk.
- **A Session with no materialized log** (created but never written) reports
  success while removing only its accounting; there is no file to delete.
- The route is an owner-only exact Fetch route (`POST /api/session.delete`) on
  the shared API channel, so only the authenticated browser that opened this
  Harness can reach it.
