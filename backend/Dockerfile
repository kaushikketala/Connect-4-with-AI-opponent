FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY __init__.py game.py main.py ./backend/

EXPOSE 8081
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8081"]
