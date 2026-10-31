"""Minimal forward-only SQL migration runner.

Usage:
    python -m clipnote.infrastructure.db.migrate

Migrations are never run automatically on application start: run this
explicitly against the target environment.
"""

from __future__ import annotations

import logging
from pathlib import Path

import psycopg

from clipnote.infrastructure.config import load_settings

MIGRATIONS_DIR = Path(__file__).parent / "migrations"
logger = logging.getLogger(__name__)

_CREATE_TRACKING_TABLE = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
"""


def apply_migrations(database_url: str, migrations_dir: Path = MIGRATIONS_DIR) -> list[str]:
    """Apply every pending ``*.sql`` migration in filename order.

    Each migration runs in its own transaction and is recorded in
    ``schema_migrations``.

    Args:
        database_url: Postgres connection string.
        migrations_dir: Directory containing ordered ``NNNN_name.sql`` files.

    Returns:
        The versions applied by this call, in order.
    """
    applied: list[str] = []
    with psycopg.connect(database_url, autocommit=True) as conn:
        conn.execute(_CREATE_TRACKING_TABLE)
        done = {row[0] for row in conn.execute("SELECT version FROM schema_migrations")}
        for path in sorted(migrations_dir.glob("*.sql")):
            if path.stem in done:
                continue
            with conn.transaction():
                conn.execute(path.read_text(encoding="utf-8").encode())
                conn.execute("INSERT INTO schema_migrations (version) VALUES (%s)", (path.stem,))
            applied.append(path.stem)
            logger.info("Applied migration %s", path.stem)
    return applied


def main() -> None:
    """CLI entrypoint."""
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    applied = apply_migrations(load_settings().database_url)
    print(f"Applied {len(applied)} migration(s): {', '.join(applied) or 'none'}")


if __name__ == "__main__":
    main()
