# Minimal dev Dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV FLASK_ENV=development
CMD ["flask", "--app", "src/app", "run", "--host", "0.0.0.0"]
