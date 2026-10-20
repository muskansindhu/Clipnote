"""Application entrypoint.

Run locally with ``python app.py``. A WSGI server can import ``app`` from this module.
"""

from clipnote.constants import DEFAULT_HOST, DEFAULT_PORT
from clipnote.infrastructure.config import load_settings
from clipnote.interfaces.http import create_app

settings = load_settings()
app = create_app(settings)

if __name__ == "__main__":
    app.run(host=DEFAULT_HOST, port=DEFAULT_PORT, debug=not settings.is_production)
