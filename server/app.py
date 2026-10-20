"""Application entrypoint.

Run locally with ``python app.py``. A WSGI server can import ``app`` from this module.
"""

from clipnote.infrastructure.config import load_settings
from clipnote.interfaces.http import create_app

settings = load_settings()
app = create_app(settings)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=not settings.is_production)  # noqa: S104  # container entrypoint
