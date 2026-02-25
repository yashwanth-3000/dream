# Main: Microsoft Agent Framework Orchestrator

This `backend/main/` service is the orchestration layer that connects your existing **A2A CrewAI Character Maker** backend to a **Microsoft Agent Framework** agent and prepares it for **Azure deployment**.

It decides whether to run:
- full character creation pipeline (`/api/v1/characters/create`), or
- regenerate-only image pipeline (`/api/v1/characters/regenerate-image`)

and sends requests to the backend over real A2A protocol (`/a2a`).

## Why this exists

Your backend already has the heavy creative pipeline (Vision + CrewAI + Replicate). This service adds:
- Microsoft Agent Framework decision layer
- clean API boundary for multi-agent/A2A integration
- Azure deployment packaging and CI/CD workflow

## Architecture

```text
User/UI
  -> main (Microsoft Agent Framework orchestrator)
      -> decides action (create | regenerate)
      -> A2AAgent call -> backend/a2a-crew-ai-character-maker (/a2a)
          -> vision + CrewAI + Replicate image generation
```

## Folder layout

```text
backend/main/
├── agent_orchestrator/
│   ├── __init__.py
│   ├── backend_client.py      # Calls A2A CrewAI backend APIs
│   ├── config.py              # Environment and provider settings
│   ├── maf_router.py          # Microsoft Agent Framework routing agent
│   ├── main.py                # FastAPI entrypoint
│   └── models.py              # Request/response models
├── azure/
│   └── containerapp.yaml      # Infra template (optional)
├── scripts/
│   └── deploy_azure.sh        # One-command Azure deployment (Container Apps)
├── .env.example
├── Dockerfile
├── requirements.txt
└── README.md
```

## API

### `GET /health`
Returns orchestrator status plus backend connectivity check.

### `GET /api/v1/orchestrate/a2a-health`
No-cost protocol probe that always calls backend over A2A (`/a2a`) with `operation=healthcheck`.

### `POST /api/v1/orchestrate/character`
Single entrypoint.

Input supports:
- `mode`: `auto | create | regenerate`
- `user_prompt`
- `positive_prompt` (for regenerate-only)
- `negative_prompt`
- `world_references[]`
- `character_drawings[]`
- `force_workflow` (`reference_enriched | prompt_only`)

Response includes:
- selected action
- who selected it (`agent`, `explicit_mode`, `rule_fallback`)
- backend endpoint called
- raw backend JSON response

## Local run

### 1) Start existing backend

```bash
cd /Users/yashwanthkrishna/Desktop/Projects/dream/backend/a2a-crew-ai-character-maker
./.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2) Start orchestrator service

```bash
cd /Users/yashwanthkrishna/Desktop/Projects/dream/backend/main
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Set `.env` values for local testing:
- `AGENT_PROVIDER=openai`
- `OPENAI_API_KEY=...`
- `A2A_BACKEND_BASE_URL=http://127.0.0.1:8000`
- `A2A_RPC_PATH=/a2a`
- `A2A_USE_PROTOCOL=true`

Run:

```bash
./.venv/bin/uvicorn agent_orchestrator.main:app --reload --host 127.0.0.1 --port 8010
```

One-command run (recommended):

```bash
cd /Users/yashwanthkrishna/Desktop/Projects/dream/backend/main && source .venv/bin/activate && A2A_USE_PROTOCOL=true A2A_BACKEND_BASE_URL=http://127.0.0.1:8000 python -m uvicorn agent_orchestrator.main:app --reload --host 127.0.0.1 --port 8010
```

Health:

```bash
curl http://127.0.0.1:8010/health
```

A2A protocol check:

```bash
curl http://127.0.0.1:8010/api/v1/orchestrate/a2a-health
```

### Example request (auto)

```bash
curl -X POST "http://127.0.0.1:8010/api/v1/orchestrate/character" \
  -H "content-type: application/json" \
  -d '{
    "mode": "auto",
    "user_prompt": "A relic hunter from submerged moon ruins",
    "world_references": [
      {
        "title": "Temple archives",
        "description": "Ancient orbital sanctuaries with cracked silver domes"
      }
    ]
  }'
```

### Example request (regenerate-only)

```bash
curl -X POST "http://127.0.0.1:8010/api/v1/orchestrate/character" \
  -H "content-type: application/json" \
  -d '{
    "mode": "regenerate",
    "positive_prompt": "story-ready keyframe portrait ...",
    "world_references": [],
    "character_drawings": []
  }'
```

## Azure deployment (Container Apps)

This service is ready for Azure Container Apps deploy.

### Prerequisites
- Azure CLI logged in
- Permission to create Resource Group, ACR, Container Apps
- Azure OpenAI deployment already created
- Your A2A backend deployed and reachable (`A2A_BACKEND_BASE_URL`)

### Required env vars for script

- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `AZURE_LOCATION`
- `AZURE_CONTAINERAPP_ENV`
- `AZURE_ACR_NAME`
- `AZURE_CONTAINERAPP_NAME`
- `A2A_BACKEND_BASE_URL`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_CHAT_DEPLOYMENT_NAME`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_API_VERSION` (optional, default `preview`)

### Deploy command

```bash
cd /Users/yashwanthkrishna/Desktop/Projects/dream
./backend/main/scripts/deploy_azure.sh
```

Script flow:
1. Creates/updates resource group.
2. Creates ACR if missing.
3. Builds image from `backend/main/` and pushes to ACR.
4. Creates Container Apps environment if missing.
5. Creates or updates orchestrator Container App.
6. Sets runtime env + secrets and prints final URL.

## GitHub Actions deployment

Workflow file:
- `.github/workflows/deploy-main-agent.yml`

Set these repository secrets:
- `AZURE_CREDENTIALS`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `AZURE_LOCATION`
- `AZURE_CONTAINERAPP_ENV`
- `AZURE_ACR_NAME`
- `AZURE_CONTAINERAPP_NAME`
- `A2A_BACKEND_BASE_URL`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_CHAT_DEPLOYMENT_NAME`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_API_VERSION`

## Mapping to your ultimate requirements

1. Build with hero technologies:
- Uses **Microsoft Agent Framework** in `agent_orchestrator/maf_router.py`.
- Uses Azure OpenAI client path when `AGENT_PROVIDER=azure`.

2. Deploy to Azure:
- Containerized app via `backend/main/Dockerfile`.
- Azure deployment automation in `backend/main/scripts/deploy_azure.sh`.
- CI/CD workflow in `.github/workflows/deploy-main-agent.yml`.

3. Use GitHub + Copilot:
- Repo is GitHub-ready with workflow and infra scripts.
- Copilot can be used in VS Code/Visual Studio to iterate agents/tools/tests.

## Notes

- `agent-framework-core==1.0.0rc1` is used (instead of the `agent-framework`
  meta package) to avoid pulling `core[all]` extras and slow pip resolver
  backtracking.
- `agent-framework-a2a==1.0.0b260219` is included for true A2A client calls.
- `mcp==1.24.0` and `a2a-sdk==0.3.5` are pinned for reliable installs on Python 3.13.
- `agent-framework-core==1.0.0rc1` currently has a semantic-conventions mismatch at import time.
  This project includes a runtime compatibility shim in
  `agent_orchestrator/maf_router.py` so `pip install -r requirements.txt` works
  without forcing conflicting package pins.
- Keep `.env` and API keys out of git.
