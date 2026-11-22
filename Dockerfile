FROM node:22-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm install -g npm@latest && npm ci
COPY web/ .
# vite.config.ts writes to ../server/static/app
RUN mkdir -p /server/static && npm run build

FROM python:3.11-slim

WORKDIR /server

RUN apt-get update \
 && apt-get install -y --no-install-recommends libpq-dev gcc \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY server/ .
COPY --from=web /server/static/app ./static/app

ENV FLASK_ENV=production
EXPOSE 5001

# Liveness only: a database blip should not make the host restart a healthy process.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5001/health', timeout=3)"

CMD ["gunicorn", "app:app", "--config", "gunicorn.conf.py"]
