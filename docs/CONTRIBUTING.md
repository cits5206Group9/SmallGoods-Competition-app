# Contributing

## Branch strategy
- `main` stable releases
- `dev` integration branch
- `feature/*` short-lived feature branches

## Workflow
1. Create an issue (link to task on Project board)
2. Branch from `dev`: `git checkout -b feature/short-desc`
3. Commit small, focused changes
4. Open PR to `dev` → request review
5. Address feedback; ensure CI passes
6. Merge with squash/rebase

## Commit format (recommended)
`<type>: <short summary>` e.g. `feat: add workout model`
Types: feat, fix, docs, test, refactor, chore.
