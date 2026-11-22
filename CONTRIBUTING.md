# Contributing to Clipnote

Thanks for helping. This page covers how to set up, what a good change looks like, and how it gets merged.

## Set up

Follow **Setup** in [docs/README.md](docs/README.md): Postgres in Docker, a Python virtual environment, `pip install -r requirements-dev.txt`, and `npm install` in `web/`. A local run needs no API keys (`LLM_PROVIDER=stub`).

For how the code is organised, read [docs/architecture.md](docs/architecture.md). In short: `domain` and `application` know nothing about Flask or SQL, adapters live in `infrastructure`, and `interfaces/http` is the Flask layer. Named constants go in `server/clipnote/constants.py`. For UI changes, read [docs/DESIGN.md](docs/DESIGN.md) first.

## Before you open a pull request

Run what CI runs:

```bash
ruff check server && ruff format --check server && mypy server/clipnote
pytest                      # integration tests need `docker compose up -d db`
cd web && npm run typecheck && npm test
```

- Add or update tests with the change. Fix a bug with a test that fails without the fix.
- Update the docs your change touches (`docs/api.md` for endpoints, `docs/configuration.md` for settings).
- Use type annotations on every Python function. Do not hardcode secrets.
- Migrations are plain SQL files in `server/clipnote/infrastructure/db/migrations/`, numbered in order. They never run automatically.

## Branches, commits and pull requests

- **Branch names:** `feat/…`, `fix/…`, `chore/…`, `docs/…`, in lowercase with dashes.
- **Commit messages:** `type(scope): short imperative subject`, such as `fix(api): reject empty video ids`. Types are `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`. Keep one logical change per commit.
- **Pull requests:** give each one a plain-sentence title (not a commit message), link it to an issue with `Closes #123`, and keep it small enough to review in one sitting. The template asks what changed, how you tested it, and what to check before merging.
- CI must pass before merging.

## Reporting problems

- Bugs and ideas: open an issue.
- Security problems: do **not** open a public issue. See [SECURITY.md](SECURITY.md).
