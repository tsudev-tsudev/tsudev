# OPTIMIZATIONS APPLIED (local, uncommitted)

Summary

- Added `.dockerignore` to reduce Docker build context and avoid shipping `node_modules` and debug artifacts.
- Added `scripts/ci-checks.sh` — a small helper to run `npm ci`, `prettier --check`, and `eslint` locally.
- Added `Makefile` with `format`, `lint`, `ci`, and `e2e` helper targets.

Notes

- Per your instruction, these files were created locally but NOT committed or pushed. Review before committing.
- Current branch: `feat/auth-rbac-20260415` (local changes present). If you want me to commit later, I can do that when you say so.

Suggested next steps

1. Review the new files and run local checks:
   ```bash
   bash scripts/ci-checks.sh
   make format
   make lint
   ```
2. If satisfied, commit the new files (example):
   ```bash
   git add .dockerignore scripts/ci-checks.sh Makefile docs/OPTIMIZATIONS.md
   git commit -m "chore(opt): add dockerignore, ci checks and Makefile for local dev"
   ```
3. If you want CI on GitHub, consider adding `.github/workflows/ci.yml` to run the `ci` target on PRs/pushes.

If you'd like, I can continue with non-destructive optimizations (add a CI workflow, add per-service `.dockerignore` files, or create reduced Dockerfiles). Tell me which to do next or I can continue with a recommended safe step.
