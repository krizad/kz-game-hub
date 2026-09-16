# Issue tracker

Issues live as **local markdown files under `.scratch/`** at the repo root. The folder is gitignored — it is working memory for the team and agents, not a published backlog.

## Layout

```
.scratch/
  <NNNN>-<kebab-case-title>.md   # one file per issue
```

- `NNNN` is a zero-padded sequential number local to the folder.
- One issue per file; keep the title short and verb-oriented (e.g. `0007-cancel-card-round-on-leave.md`).

## Issue file format

```markdown
# <Title>

Status: open | in-progress | done | dropped
Area: <game or package, e.g. card-game, tic-tac-toe, api, web>
Found: <date> — <where it surfaced, e.g. defect audit>

## Problem

What is wrong / what is missing, with `file:line` references.

## Expected

The behavior we want, plus acceptance criteria.

## Notes

Findings, risks, links to ADRs (`docs/adr/`) or plan files (`plan/`).
```

## Conventions

- Update `Status:` as work progresses; never delete an issue — set it to `dropped` with a one-line reason.
- Reference issues from commits/PRs by number (e.g. `Refs .scratch/0007-...`).
- Larger efforts may be broken into a plan file under `plan/` with tasks that reference issue numbers; plans are also gitignored.
- Durable knowledge (decisions, vocabulary) does not belong here — promote it to `docs/adr/` or `CONTEXT.md`.
