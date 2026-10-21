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

CMD ["python3", "app.py"]
