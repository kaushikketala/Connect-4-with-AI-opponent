# Connect Four AI Lab

Connect Four with a FastAPI search engine and a Next.js frontend. Play against alpha-beta pruning or compare its search with plain minimax at the same depth and position.

## Run with Docker

From the repository root, build and start both services:

```sh
docker compose up --build
```

- Frontend: http://localhost:3001
- Backend API: http://localhost:8081
- Backend health: http://localhost:8081/health

Stop the services with `Ctrl+C`; run `docker compose down` to remove the containers.

The frontend image is built with `NEXT_PUBLIC_API_URL=http://localhost:8081`, so the browser calls the published backend port. To change that address, update the frontend build argument in `compose.yaml` and rebuild the images.

## Run locally without Docker

Backend (Python 3.10+), from the repository root:

```sh
python -m venv .venv
# Activate the environment, then install dependencies:
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8081
```

Frontend (Node.js 18+):

```sh
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8081 npm run dev -- --port 3001
```

On PowerShell, set the frontend URL first with `$env:NEXT_PUBLIC_API_URL="http://localhost:8081"`, then run `npm run dev -- --port 3001`.

## Tests

From the repository root, install backend requirements, then run:

```sh
python -m pytest backend/tests
```
