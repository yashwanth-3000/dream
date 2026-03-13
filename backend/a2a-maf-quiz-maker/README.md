# Dream MAF Quiz Maker

Dream MAF Quiz Maker is the quiz-generation backend for the Dream platform. It uses **Microsoft Agent Framework (MAF)** to build kid-friendly multiple-choice quizzes and exposes the workflow over **A2A** and REST. Given a prompt or story context, it produces a normalized quiz contract with a fixed question count, exactly four options per question, exactly two hints, a correct answer index, a short explanation, and learning-goal metadata.

**Pipeline:** Incoming quiz request -> workflow selection -> `QuizBlueprintAgent` -> `QuizWriterAgent` -> contract normalization and fallback handling -> REST or A2A response.

**Core components used:**

- `gpt-4o-mini` - powers the blueprint and quiz-writing MAF agents
- `agent-framework-core` - provides the agent abstraction for structured JSON generation
- `a2a-sdk` and `agent-framework-a2a` - expose the quiz workflow over A2A with task-based streaming progress

## Why This Microsoft Setup Matters

The quiz service is another place where Dream benefits from an explicit multi-agent pattern. Quiz generation needs structure, consistency, and contract-safe outputs, so MAF is a better fit than a single unstructured completion.

| Microsoft product | Why Dream uses it here | How Dream uses it here |
|---|---|---|
| Microsoft Agent Framework | Quiz generation has a planning step and a writing step, and both need structured outputs that can be normalized into a fixed frontend contract. MAF makes that two-stage design explicit and easier to maintain. | The quiz service uses `QuizBlueprintAgent` to plan the quiz and `QuizWriterAgent` to produce the final questions, hints, answers, and explanations before normalization. |
| Azure Container Apps | The quiz backend should deploy and scale separately from chat, storybook, and character generation. That separation keeps the overall system cleaner and avoids one workload blocking another. | `dream-quiz-a2a` runs as its own Container App in `dream-env` and exposes both REST and A2A endpoints for orchestrated quiz generation. |
| Azure Container Registry | The quiz service ships as a container and needs a consistent image distribution path across revisions. | Quiz builds are pushed to `dreamacr64808802c.azurecr.io`, and the Container App is updated to that image tag during deploys. |

## Current Deployment

| Resource | Value |
|---|---|
| Resource Group | `dream-rg` |
| Region | `East US` |
| Container Apps Env | `dream-env` |
| ACR | `dreamacr64808802c.azurecr.io` |
| App Name | `dream-quiz-a2a` |
| App URL | `https://dream-quiz-a2a.greenplant-2d9bb135.eastus.azurecontainerapps.io` |
| Health | `https://dream-quiz-a2a.greenplant-2d9bb135.eastus.azurecontainerapps.io/health` |
| A2A RPC | `https://dream-quiz-a2a.greenplant-2d9bb135.eastus.azurecontainerapps.io/a2a` |
| Agent Card | `https://dream-quiz-a2a.greenplant-2d9bb135.eastus.azurecontainerapps.io/.well-known/agent.json` |
| Latest Revision | `dream-quiz-a2a--57fum6f` |
| Current Image | `dreamacr64808802c.azurecr.io/dream-quiz-a2a:20260304-v1` |
| Scale | `minReplicas=1`, `maxReplicas=3` |

## How It Works

This service supports a blocking REST endpoint and an A2A interface, but both paths run the same `QuizWorkflow`. The workflow selects a mode, runs two MAF agents in sequence, normalizes the output, and returns a contract-safe quiz response even when an agent step fails.

### 1. Quiz Creation (`/api/v1/quizzes/create` and A2A `operation=quiz_create`)

Every quiz request starts with `user_prompt` and can optionally include `story_title`, `story_text`, `age_band`, `difficulty`, and `question_count` (`1-10`).

If `story_text` or `story_title` is present, the workflow uses `story_based`. Otherwise it uses `prompt_only`.

`QuizBlueprintAgent` (`dream-quiz-blueprint-agent`) runs first and generates the quiz title, learner instructions, and one question plan per requested question. Each plan includes a question focus and a learning goal.

`QuizWriterAgent` (`dream-quiz-writer-agent`) then takes the original request plus the blueprint and expands it into the final quiz draft with questions, four answer choices, two hints, the correct answer index, a short explanation, and learning-goal metadata.

The final response returns `workflow_used`, the normalized `quiz`, a `warnings` list, and `generation_sources` so callers can tell whether blueprint and quiz generation came from MAF or fallback logic.

---

### 2. Contract Normalization + Fallbacks

The workflow does not pass raw model output through directly. After each generation step, it normalizes the result so the response is predictable for the frontend and orchestrator.

- Keeps the exact requested `question_count`
- Ensures every question has exactly 4 options
- Ensures every question has exactly 2 hints
- Repairs invalid `correct_option_index` values so they stay in the `0-3` range
- Fills missing titles, instructions, explanations, and learning goals with deterministic fallback text
- Deduplicates repeated or empty options and hints before filling gaps

If `QuizBlueprintAgent` fails, the workflow records a warning, marks `generation_sources["blueprint"]` as `fallback`, and builds a deterministic blueprint from the input prompt.

If `QuizWriterAgent` fails, the workflow records a warning, marks `generation_sources["quiz"]` as `fallback`, and produces a deterministic quiz draft from the blueprint.

---

### 3. A2A Interface (`/a2a` and `/.well-known/agent.json`)

The A2A path is handled by `QuizA2AExecutor`. It supports two operations:

- `quiz_create` - runs the full quiz workflow
- `healthcheck` - returns a lightweight service health payload without running generation

The executor accepts payloads from message metadata or from JSON-like text in the user message. If no structured payload is supplied for quiz creation, it defaults to using the incoming text as `user_prompt` and falls back to `question_count=5`.

`message/send` supports blocking task execution, while `message/stream` streams progress updates as the workflow runs. The A2A agent card is exposed at `/.well-known/agent.json`.

---

### 4. Progress + Streaming

When the workflow runs through A2A streaming, the executor publishes progress artifacts during execution and a final result artifact when the quiz is complete.

| Stage | Meaning |
|---|---|
| `request_received` | Quiz request accepted by the A2A executor |
| `workflow_start` | Workflow selected and generation started |
| `blueprint_generation_start` | `QuizBlueprintAgent` started |
| `blueprint_generation_complete` | Blueprint completed successfully |
| `blueprint_generation_fallback` | Blueprint agent failed and fallback blueprint was used |
| `quiz_generation_start` | `QuizWriterAgent` started |
| `quiz_generation_complete` | Final quiz draft completed successfully |
| `quiz_generation_fallback` | Quiz writer failed and fallback draft was used |
| `workflow_complete` | Final quiz response ready |

Progress updates are emitted as `quiz-workflow-progress`. Final results are emitted as `quiz-workflow-result`. Failures are emitted as `quiz-workflow-error`.

---

### 5. MAF + A2A: Why Both?

| Layer | What It Provides |
|---|---|
| **MAF** (`agent-framework-core`) | Structured agents for blueprint generation and quiz writing. Each agent runs with fixed instructions and returns JSON that the workflow validates and normalizes. |
| **A2A** (`a2a-sdk`, `agent-framework-a2a`) | Standard agent-to-agent interface for `message/send` and `message/stream`, plus an agent card for discovery and integration. |

### Agent Roles

| Agent | Name | Purpose |
|---|---|---|
| QuizBlueprintAgent | `dream-quiz-blueprint-agent` | Builds quiz title, learner instructions, and one question plan per question |
| QuizWriterAgent | `dream-quiz-writer-agent` | Expands the blueprint into the final quiz with options, hints, explanations, and learning goals |

### Workflow Selection

| Condition | Workflow |
|---|---|
| `story_text` or `story_title` provided | `story_based` |
| Prompt only | `prompt_only` |

### Interface Paths

| Interface | Path or Operation | Behavior |
|---|---|---|
| REST | `POST /api/v1/quizzes/create` | Runs `QuizWorkflow` and returns a blocking JSON response |
| A2A send | `POST /a2a` with `message/send` and `operation=quiz_create` | Runs the workflow and returns the final result as an A2A task artifact |
| A2A stream | `POST /a2a` with `message/stream` and `operation=quiz_create` | Streams progress artifacts and a final result artifact |
| A2A healthcheck | `POST /a2a` with `message/send` and `operation=healthcheck` | Returns a lightweight status payload |
| Agent card | `GET /.well-known/agent.json` | Exposes quiz agent metadata and supported capability info |

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
| `AGENT_PROVIDER` | No | `openai` | LLM provider: `openai` or `azure` |
| `OPENAI_API_KEY` | Yes | — | Required by settings validation for quiz generation |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Base model used by quiz agents |
| `OPENAI_TEMPERATURE` | No | `0.4` | Generation temperature |
| `AZURE_OPENAI_ENDPOINT` | Yes (if `AGENT_PROVIDER=azure`) | — | Azure OpenAI endpoint |
| `AZURE_OPENAI_API_KEY` | Yes (if `AGENT_PROVIDER=azure`) | — | Azure OpenAI key |
| `AZURE_OPENAI_CHAT_DEPLOYMENT_NAME` | Yes (if `AGENT_PROVIDER=azure`) | — | Azure chat deployment |
| `AZURE_OPENAI_API_VERSION` | No | `preview` | Azure API version |
| `A2A_PUBLIC_BASE_URL` | No | `http://127.0.0.1:8030` | Public base URL used to build the agent card and RPC URL |
| `A2A_RPC_PATH` | No | `/a2a` | A2A endpoint path |
| `A2A_AGENT_NAME` | No | `Dream MAF Quiz Agent` | Agent card name |
| `A2A_AGENT_VERSION` | No | `0.1.0` | Agent card version |

**Model ID note:** Model ID normalization strips prefixes like `openai/`, `models/`, and `model/` automatically.

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
| `POST` | `/a2a` | A2A JSON-RPC endpoint for `message/send` and `message/stream` |
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
| `422` | Invalid schema such as missing or invalid required fields |
| `502` | Quiz workflow failure surfaced as `QuizWorkflowError` |
| `500` | Unhandled backend exception |

## Integration Notes

- Main orchestrator consumes this backend over A2A for quiz orchestration
- Chat quiz mode renders one question at a time with interactive correctness checks
- Dashboard includes a dedicated quiz test UI at `/dashboard/quiz-test`

## Deploy to Azure

Build and deploy to Azure Container Apps with:

```bash
export AZURE_SUBSCRIPTION_ID=...
export AZURE_RESOURCE_GROUP=dream-rg
export AZURE_LOCATION=eastus
export AZURE_CONTAINERAPP_ENV=dream-env
export AZURE_ACR_NAME=dreamacr64808802c
export AZURE_CONTAINERAPP_NAME=dream-quiz-a2a
export OPENAI_API_KEY=...

cd backend/a2a-maf-quiz-maker
./scripts/deploy_azure.sh
```

Required deployment environment variables:

- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `AZURE_LOCATION`
- `AZURE_CONTAINERAPP_ENV`
- `AZURE_ACR_NAME`
- `AZURE_CONTAINERAPP_NAME`
- `OPENAI_API_KEY`

Typical live Azure values:

- `AZURE_RESOURCE_GROUP=dream-rg`
- `AZURE_LOCATION=eastus`
- `AZURE_CONTAINERAPP_ENV=dream-env`
- `AZURE_ACR_NAME=dreamacr64808802c`
- `AZURE_CONTAINERAPP_NAME=dream-quiz-a2a`

Important optional deployment settings:

- `AZURE_CONTAINER_CPU` defaults to `1.0`
- `AZURE_CONTAINER_MEMORY` defaults to `2Gi`
- `AZURE_MIN_REPLICAS` defaults to `1`
- `AZURE_MAX_REPLICAS` defaults to `3`

What the deploy script does:

1. Builds the quiz image in ACR.
2. Creates or updates the `dream-quiz-a2a` Container App.
3. Injects `OPENAI_API_KEY` as a secret.
4. Sets the default quiz runtime to `OPENAI_MODEL=gpt-4o-mini` and `OPENAI_TEMPERATURE=0.4`.
5. Keeps the app warm with `minReplicas=1`.

Important deployment note:

- The current deploy script uses the default OpenAI-backed runtime and does not inject `AZURE_OPENAI_*` variables automatically.
- If you want to run the Azure provider path for quiz generation, update the Container App environment variables after deploy or extend `scripts/deploy_azure.sh`.

## Run Tests

```bash
cd backend/a2a-maf-quiz-maker
python -m pytest -q
```

## Troubleshooting

| Problem | Check |
|---|---|
| `OPENAI_API_KEY is required for quiz generation` | Set `OPENAI_API_KEY` in `.env` |
| Azure provider validation error | Set all `AZURE_OPENAI_*` variables when `AGENT_PROVIDER=azure` |
| A2A method errors | Use `message/send` or `message/stream` with `operation=quiz_create` or `operation=healthcheck` |
| Empty or weak quiz output | Inspect `warnings` and `generation_sources` for fallback usage |
| Deployment build blocked in ACR Tasks | Build and push separately, then update the Container App image manually |
