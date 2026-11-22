"""Gunicorn settings for production.

Start from the ``server`` directory with ``gunicorn app:app``. The Dockerfile does this.
Local development keeps using ``python app.py``.
"""

from clipnote.constants import (
    DEFAULT_HOST,
    DEFAULT_PORT,
    GUNICORN_GRACEFUL_TIMEOUT_SECONDS,
    GUNICORN_KEEPALIVE_SECONDS,
    GUNICORN_THREADS,
    GUNICORN_TIMEOUT_SECONDS,
    GUNICORN_WORKERS,
)

bind = f"{DEFAULT_HOST}:{DEFAULT_PORT}"
# Threaded workers keep slow requests, such as streamed Clipchat answers, from blocking others.
worker_class = "gthread"
workers = GUNICORN_WORKERS
threads = GUNICORN_THREADS
timeout = GUNICORN_TIMEOUT_SECONDS
graceful_timeout = GUNICORN_GRACEFUL_TIMEOUT_SECONDS
keepalive = GUNICORN_KEEPALIVE_SECONDS
# Log to stdout and stderr so the container runtime collects them.
accesslog = "-"
errorlog = "-"
