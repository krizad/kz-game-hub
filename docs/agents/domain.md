# Domain docs

This repo uses a **single-context** domain-doc layout: one shared vocabulary and boundary document for the whole product, plus numbered ADRs for decisions.

## Files

| File                       | Purpose                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| `CONTEXT.md` (repo root)   | Shared vocabulary, glossary, and product boundaries. Source of truth for terms used across code, docs, and issues. |
| `docs/adr/NNNN-title.md`   | One Architecture Decision Record per settled decision.                  |
| `docs/agents/domain.md`    | This file — where domain knowledge lives and how to maintain it.         |

## CONTEXT.md

- Keep it short and normative: each glossary term gets a one-line definition that code and docs must agree on.
- Update it **when a decision changes the meaning of a term or a boundary** (e.g. what a "match" is, what may be persisted).
- Do not duplicate implementation details here; link to code or ADRs instead.

## ADRs

- Filename: `docs/adr/NNNN-kebab-case-title.md`, numbered sequentially (e.g. `0004-card-game-match-lifecycle-and-removal.md`).
- Each ADR starts with `# NNNN. Title`, then `Status:` (`Proposed`, `Accepted`, `Superseded`) and `Date:`.
- Sections: Context, Decision, Consequences (and Alternatives when relevant).
- ADRs are immutable once accepted — supersede them with a new ADR instead of rewriting history.
- Write an ADR when a decision is architectural (state ownership, privacy, protocol, persistence) or when it resolves an ambiguity the glossary alone cannot.

## Agent workflow

1. Before changing behavior, read `CONTEXT.md` and the ADRs that touch the area.
2. If a decision is unsettled, resolve it with the user first; then record it as an ADR **and** update `CONTEXT.md` if vocabulary changed.
3. Keep Thai and English user-facing rule text generated from the same canonical config/definitions (see ADR 0001).
