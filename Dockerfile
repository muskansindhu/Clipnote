FROM python:3.11-slim

WORKDIR /server

RUN apt-get update \
 && apt-get install -y --no-install-recommends libpq-dev gcc \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY server/ .

EXPOSE 5001

CMD ["python3", "app.py"]
