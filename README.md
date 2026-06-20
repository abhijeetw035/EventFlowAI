# EventFlow AI

EventFlow AI is a hackathon-ready full-stack demo for traffic incident response: a FastAPI backend runs diversion routing plus manpower/barricade deployment predictions, while the React frontend provides the operator UI that talks to the backend on port 8000.

## First-Time Setup

Put your own dataset at `backend/Data/Dataset.csv` before using either quickstart. The dataset is not included in this repo because it is gitignored and may contain real incident/location data. Docker runs the training pipeline automatically the first time its mounted `backend/model_artifacts/` directory is empty.

## Local Dev Quickstart

Requirements: Python 3.11+, Node 18+, and `make`.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ../frontend
npm install
cd ..
make pipeline && make dev
```

The backend runs at `http://localhost:8000`; the frontend dev server prints its local URL, usually `http://localhost:5173`.

## Docker Quickstart

Requirements: Docker.

```bash
docker compose up --build
```

Open `http://localhost:5173`. The frontend nginx container proxies `/api/*` to the `backend` service on the shared Docker network.
