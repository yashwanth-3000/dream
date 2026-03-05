# Dream MAF Quiz Maker

A multi-agent quiz backend for children, built with Microsoft Agent Framework (MAF) and exposed through A2A.

It generates structured multiple-choice quizzes with:

- exactly 4 options per question
- exactly 2 hints per question
- correct answer index and explanation
- learning-goal metadata

**Pipeline:** prompt/story context -> quiz blueprint generation -> quiz writing -> contract normalization -> A2A/REST response.

## Current Production Deployment

| Resource | Value |
|---|---|
| App URL | `https://dream-quiz-a2a.greenplant-2d9bb135.eastus.azurecontainerapps.io` |
| Health | `https://dream-quiz-a2a.greenplant-2d9bb135.eastus.azurecontainerapps.io/health` |
| A2A RPC | `https://dream-quiz-a2a.greenplant-2d9bb135.eastus.azurecontainerapps.io/a2a` |
| Agent Card | `https://dream-quiz-a2a.greenplant-2d9bb135.eastus.azurecontainerapps.io/.well-known/agent.json` |

## Agent Roles

| Agent | Name | Purpose |
|---|---|---|
| QuizBlueprintAgent | `dream-quiz-blueprint-agent` | Builds quiz title, instructions, and question plans |
| QuizWriterAgent | `dream-quiz-writer-agent` | Expands blueprint into full question set with options, hints, explanations |

## Workflow Selection

| Condition | Workflow |
|---|---|
| `story_text` or `story_title` provided | `story_based` |
| prompt only | `prompt_only` |

## Progress Stages (Streaming Logs)

The workflow emits structured stage events (used by orchestrator/chat logs):

- `workflow_start`
- `blueprint_generation_start`
- `blueprint_generation_complete`
- `blueprint_generation_fallback` (if blueprint agent fails)
- `quiz_generation_start`
- `quiz_generation_complete`
- `quiz_generation_fallback` (if writer agent fails)
- `workflow_complete`

## Project Layout

```text
backend/a2a-maf-quiz-maker/
├── agent_quiz/
│   ├── main.py                    # FastAPI entrypoint
│   ├── a2a_server.py              # A2A protocol routes + executor
│   ├── config.py                  # Env settings + validation
│   ├── schemas.py                 # Request/response models
│   ├── maf_agents.py              # QuizBlueprintAgent + QuizWriterAgent
│   ├── quiz_workflow.py           # Workflow orchestration + normalization
│   └── af_compat.py               # Agent Framework compatibility shim
├── scripts/
│   └── deploy_azure.sh            # Azure Container Apps deploy
├── tests/
│   └── test_quiz_workflow.py
├── Dockerfile
├── requirements.txt
├── .env.example
└── README.md
```

## Setup

```bash
cd backend/a2a-maf-quiz-maker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `APP_ENV` | No | `dev` | Runtime environment label |
| `APP_DEBUG` | No | `false` | Debug toggle |
| `AGENT_PROVIDER` | No | `openai` | `openai` or `azure` |
| `OPENAI_API_KEY` | Yes | — | Required for quiz generation |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | MAF text model |
| `OPENAI_TEMPERATURE` | No | `0.4` | Generation temperature |
| `AZURE_OPENAI_ENDPOINT` | Yes (if azure) | — | Azure OpenAI endpoint |
| `AZURE_OPENAI_API_KEY` | Yes (if azure) | — | Azure OpenAI key |
| `AZURE_OPENAI_CHAT_DEPLOYMENT_NAME` | Yes (if azure) | — | Azure chat deployment |
| `AZURE_OPENAI_API_VERSION` | No | `preview` | Azure API version |
| `A2A_PUBLIC_BASE_URL` | No | `http://127.0.0.1:8030` | Public base URL for agent card |
| `A2A_RPC_PATH` | No | `/a2a` | A2A endpoint path |
| `A2A_AGENT_NAME` | No | `Dream MAF Quiz Agent` | Agent card name |
| `A2A_AGENT_VERSION` | No | `0.1.0` | Agent card version |

Model ID normalization removes prefixes like `openai/`, `models/`, `model/` automatically.

## Run Locally

```bash
cd backend/a2a-maf-quiz-maker
source .venv/bin/activate
uvicorn agent_quiz.main:app --reload --host 127.0.0.1 --port 8030
```

Verify:

```bash
curl http://127.0.0.1:8030/health
```

## API Reference

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Service health |
| `POST` | `/api/v1/quizzes/create` | Blocking quiz generation |
| `POST` | `/a2a` | A2A JSON-RPC endpoint (`message/send`, `message/stream`) |
| `GET` | `/.well-known/agent.json` | A2A agent card |
| `GET` | `/docs` | Swagger docs |

### REST Request Example

```json
{
  "user_prompt": "A short story about teamwork in the ocean",
  "story_title": "The Coral Rescue",
  "story_text": "Mina and her friends saved the reef by working together.",
  "age_band": "6-8",
  "difficulty": "easy",
  "question_count": 5
}
```

### REST Response Shape

```json
{
  "workflow_used": "story_based",
  "quiz": {
    "quiz_title": "Coral Rescue Quiz",
    "instructions": "Pick one answer for each question.",
    "questions": [
      {
        "question_number": 1,
        "question": "Why did the reef recover?",
        "options": ["...", "...", "...", "..."],
        "correct_option_index": 0,
        "hints": ["Hint 1...", "Hint 2..."],
        "correct_explanation": "...",
        "learning_goal": "..."
      }
    ]
  },
  "warnings": [],
  "generation_sources": {
    "blueprint": "maf",
    "quiz": "maf"
  }
}
```

### A2A Request Example (`message/send`)

```json
{
  "jsonrpc": "2.0",
  "id": "quiz-1",
  "method": "message/send",
  "params": {
    "message": {
      "role": "user",
      "parts": [{ "kind": "text", "text": "Create a 5-question quiz about friendship" }],
      "messageId": "quiz-msg-1",
      "metadata": {
        "operation": "quiz_create",
        "payload": {
          "user_prompt": "Create a 5-question quiz about friendship",
          "question_count": 5,
          "age_band": "6-8"
        }
      }
    }
  }
}
```

### A2A Healthcheck Example

```json
{
  "jsonrpc": "2.0",
  "id": "quiz-health-1",
  "method": "message/send",
  "params": {
    "message": {
      "role": "user",
      "parts": [{ "kind": "text", "text": "healthcheck" }],
      "messageId": "quiz-health-msg-1",
      "metadata": { "operation": "healthcheck" }
    }
  }
}
```

### Error Codes

| Code | Meaning |
|---|---|
| `422` | Invalid schema (missing/invalid required fields) |
| `502` | Quiz workflow upstream/agent failure |
| `500` | Unhandled backend exception |

## Integration Notes

- Main orchestrator consumes this backend over A2A (`/api/v1/orchestrate/quiz`, `/stream`).
- Chat quiz mode renders one question at a time with interactive correctness checks.
- Dashboard includes dedicated quiz test UI at `/dashboard/quiz-test`.

## Deploy (Azure Container Apps)

Use `scripts/deploy_azure.sh`.

Required env vars:

- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `AZURE_LOCATION`
- `AZURE_CONTAINERAPP_ENV`
- `AZURE_ACR_NAME`
- `AZURE_CONTAINERAPP_NAME`
- `OPENAI_API_KEY`

Run:

```bash
cd backend/a2a-maf-quiz-maker
./scripts/deploy_azure.sh
```

## Run Tests

```bash
cd backend/a2a-maf-quiz-maker
python -m pytest -q
```

## Troubleshooting

| Problem | Check |
|---|---|
| `OPENAI_API_KEY is required for quiz generation` | set `OPENAI_API_KEY` in `.env` |
| Azure provider validation error | set all `AZURE_OPENAI_*` variables when `AGENT_PROVIDER=azure` |
| A2A method errors | use `message/send` with `operation=quiz_create` or `operation=healthcheck` |
| Empty/weak quiz output | inspect `warnings` and `generation_sources` for fallback usage |
| Deployment build blocked in ACR Tasks | build/push locally then `az containerapp update --image ...` |
