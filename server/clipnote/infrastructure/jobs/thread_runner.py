"""Background task runner backed by a small thread pool."""

from __future__ import annotations

import logging
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any

logger = logging.getLogger(__name__)


class ThreadPoolTaskRunner:
    """Runs tasks off the request thread. Failures are logged, never raised to callers."""

    def __init__(self, max_workers: int = 4) -> None:
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="clipnote")

    def submit(self, task: Callable[..., None], *args: Any) -> None:
        self._executor.submit(self._run, task, args)

    @staticmethod
    def _run(task: Callable[..., None], args: tuple[Any, ...]) -> None:
        try:
            task(*args)
        except Exception:
            logger.exception("Background task %s failed", getattr(task, "__name__", task))
