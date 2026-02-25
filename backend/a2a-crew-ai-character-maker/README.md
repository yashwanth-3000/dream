# Dream Backend: A2A CrewAI Character Maker

This subsystem powers Dream's ability to generate story-ready characters with identity consistency across future scenes. Built with CrewAI, it runs as a self-contained multi-agent character engine and connects to the Main Microsoft Agent Framework orchestrator through the A2A (Agent-to-Agent) Protocol.

The system combines:
- `gpt-4o-mini` (via CrewAI) for reasoning, synthesis, and narrative generation,
- `gpt-4.1-mini` vision analysis for converting uploaded drawings/references into structured textual cues,
- Replicate (`prunaai/p-image` by default) for final character image rendering.

This allows the backend to transform a user prompt plus uploaded reference images into:
- a structured character backstory,
- a highly detailed image prompt designed for downstream story/video reuse,
- generated image URL outputs.

Image generation is always enabled in this backend. There is no non-image mode.

## Specialized Agent Roles

The CrewAI subsystem is built around specialized roles that divide research, narrative design, and prompt engineering:

1. Lore Research Analyst (`reference_enriched` workflow)

Analyzes world references and character drawings (including OpenAI vision descriptions) to extract high-signal worldbuilding facts, style cues, materials, era hints, motifs, and consistency constraints.

2. Narrative Character Designer

Produces a coherent, emotionally grounded character backstory with goals, flaws, turning points, and visual signifiers. The output is structured so downstream systems can reuse it for scene generation.

3. Generative Image Prompt Engineer

Converts narrative + visual cues into a highly detailed, model-ready prompt focused on:
- story keyframe quality,
- stable identity continuity across scenes,
- world consistency,
- cinematic framing and production-grade detail,
- clean negative constraints (artifact/text/watermark suppression).

Prompt-only path note:
- When references are not provided, a `Concept Worldbuilder` role first expands the raw prompt into concept scaffolding before the Narrative Designer and Prompt Engineer continue.

## Adaptive Workflow Handling

Before generation, the backend dynamically selects the most relevant path:

- `reference_enriched`
Used when world references or character drawings are present, or when forced via `force_workflow`.

- `prompt_only`
Used when the request includes only the core character prompt.

- `regenerate-image` (endpoint-level mode)
Skips CrewAI and reruns Replicate using an existing `positive_prompt` plus uploaded references for fast image-only regeneration.

Decision behavior is implemented in `CharacterWorkflowDecider.choose_workflow(...)`.

## A2A Protocol: Communication Bridge

The A2A layer allows this CrewAI subsystem to interoperate cleanly with external orchestrators and services over JSON-RPC.

In this backend:
- `POST /a2a` is the A2A RPC endpoint.
- `GET /.well-known/agent-card.json` serves the A2A agent card.
- `GET /.well-known/agent.json` serves a compatibility card path.

The A2A executor supports operation routing via metadata/payload:
- `create`
- `regenerate`
- `healthcheck`

Supported interaction styles include `message/send` and streaming-capable A2A flows (`message/stream`).

## Integration With Main Agentic Structure

Within Dream's architecture, this service acts as a specialized external intelligence module for character generation.

Typical flow:
1. User interacts with the Main orchestrator (`backend/main`).
2. Main decides create vs regenerate and forwards the request to this subsystem over A2A.
3. This subsystem runs vision + CrewAI + Replicate (or regenerate-only path).
4. Structured results are returned to Main and then to UI/clients.

This keeps orchestration and creative generation concerns decoupled.

## Key Benefits of A2A Integration

- Separation of concerns: Character creation logic is isolated in a dedicated subsystem.
- Interoperability: Any A2A-capable client can invoke it regardless of language stack.
- Scalability: The A2A character backend can scale independently from Main orchestration.
- Modularity: Main only depends on A2A contracts, not CrewAI internals.
- Reusability: Multiple orchestrators can consume the same character-generation capability.

## What This Service Does

`POST /api/v1/characters/create` runs an end-to-end pipeline:

1. Ingest prompt + optional reference images.
2. Use OpenAI Vision to describe uploaded character drawings and world reference images.
3. Choose workflow (`reference_enriched` or `prompt_only`).
4. Run CrewAI agents to generate backstory + detailed image prompt.
5. Call Replicate to generate output image URLs.
6. Return structured JSON response.

`POST /api/v1/characters/regenerate-image` runs Replicate-only regeneration:
- reuses an existing positive prompt,
- forwards uploaded reference images,
- skips CrewAI to reduce cost/latency.

## Project Layout

```text
backend/a2a-crew-ai-character-maker/
├── app/
│   ├── main.py                    # FastAPI entrypoint
│   ├── a2a_server.py              # A2A protocol routes + executor
│   ├── config.py                  # Environment settings
│   ├── schemas.py                 # Request/response models
│   ├── services/
│   │   ├── vision_service.py      # OpenAI vision descriptions
│   │   └── replicate_service.py   # Replicate image generation
│   └── workflows/
│       └── character_creation.py  # Workflow decider + CrewAI orchestration
├── tests/
│   └── test_workflow_decider.py
├── pyproject.toml
├── .env.example
└── README.md
```

## Requirements

- Python `>=3.11`
- OpenAI API key
- Replicate API token
- A2A SDK (installed via project dependencies)

## Setup

```bash
cd /Users/yashwanthkrishna/Desktop/Projects/dream/backend/a2a-crew-ai-character-maker

# Create virtual env (recommended)
python3 -m venv .venv
source .venv/bin/activate

# Install package + runtime deps
pip install -e .
```

Optional dev extras:

```bash
pip install -e ".[dev]"
```

## Environment Variables

Create env file:

```bash
cp .env.example .env
```

Configure:

- `OPENAI_API_KEY` (required): OpenAI key used by CrewAI LLM + vision service.
- `OPENAI_MODEL` (optional, default `openai/gpt-4o-mini`): text model for CrewAI tasks.
- `OPENAI_TEMPERATURE` (optional, default `0.6`): generation temperature.
- `OPENAI_VISION_MODEL` (optional, default `gpt-4.1-mini`): model for image description.
- `OPENAI_VISION_MAX_TOKENS` (optional, default `500`): max vision output tokens.
- `REPLICATE_API_TOKEN` (required): Replicate API token.
- `REPLICATE_MODEL` (optional, default `prunaai/p-image`): image model.
- `REPLICATE_OUTPUT_COUNT` (optional, default `1`): number of generated images.
- `REPLICATE_ASPECT_RATIO` (optional, default `3:4`): aspect ratio passed to Replicate.
- `A2A_PUBLIC_BASE_URL` (optional, default `http://127.0.0.1:8000`): public base URL used in agent card.
- `A2A_RPC_PATH` (optional, default `/a2a`): A2A JSON-RPC endpoint path.
- `A2A_AGENT_NAME` (optional): A2A agent card name.
- `A2A_AGENT_VERSION` (optional): A2A agent card version.
- `CREWAI_VERBOSE` (optional, default `true`): CrewAI verbose logs.

## Run Server

```bash
cd /Users/yashwanthkrishna/Desktop/Projects/dream/backend/a2a-crew-ai-character-maker
./.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

## API Contract

### Endpoints

- `POST /api/v1/characters/create`
  Full pipeline: vision + CrewAI + Replicate.
- `POST /api/v1/characters/regenerate-image`
  Replicate only: reuses existing prompt + uploaded references, skips CrewAI.
- `POST /a2a`
  Real A2A JSON-RPC endpoint (`message/send`, `message/stream`, etc.).
- `GET /.well-known/agent-card.json`
  A2A agent card.
- `GET /.well-known/agent.json`
  Legacy A2A agent card path for compatibility.

### Create Request Schema

- `user_prompt` (`string`, required)
- `world_references` (`array`, optional)
- `character_drawings` (`array`, optional)
- `force_workflow` (`"reference_enriched" | "prompt_only"`, optional)

`world_references[]` fields:

- `title` (`string`, optional)
- `description` (`string`, optional)
- `url` (`string`, optional, public URL)
- `image_data` (`string`, optional, data URL: `data:image/<type>;base64,...`)

`character_drawings[]` fields:

- `description` (`string`, optional)
- `notes` (`string`, optional)
- `url` (`string`, optional, public URL)
- `image_data` (`string`, optional, data URL)

### Regenerate Request Schema

- `positive_prompt` (`string`, required)
- `negative_prompt` (`string`, optional)
- `world_references` (`array`, optional)
- `character_drawings` (`array`, optional)

### Important Behavior

- Image generation is always performed.
- If `image_data` or `url` exists in references/drawings, original images are forwarded to Replicate for stronger identity/world consistency.
- If the generated positive prompt is empty, backend fails fast instead of returning weak output.

## Example Request (Minimal Create)

```bash
curl -X POST "http://127.0.0.1:8000/api/v1/characters/create" \
  -H "content-type: application/json" \
  -d '{
    "user_prompt": "A young explorer with lantern and patchwork cloak in ancient ruins"
  }'
```

## Example Request (Create With Uploaded Images)

Generate base64 data URLs:

```bash
DRAWING_B64=$(base64 < ./character-drawing.png | tr -d '\n')
WORLD_B64=$(base64 < ./world-reference.jpg | tr -d '\n')
```

Send request:

```bash
curl -X POST "http://127.0.0.1:8000/api/v1/characters/create" \
  -H "content-type: application/json" \
  -d "{
    \"user_prompt\": \"An apprentice relic hunter from a flooded moon temple\",
    \"world_references\": [
      {
        \"title\": \"Moon temple archive\",
        \"description\": \"Flooded stone halls and bronze observatory machinery\",
        \"image_data\": \"data:image/jpeg;base64,${WORLD_B64}\"
      }
    ],
    \"character_drawings\": [
      {
        \"notes\": \"Front pose with satchel and rusted compass\",
        \"image_data\": \"data:image/png;base64,${DRAWING_B64}\"
      }
    ]
  }"
```

## Example Request (Regenerate Image Only, No CrewAI)

Use this when you already have a prompt and just want new image variations:

```bash
curl -X POST "http://127.0.0.1:8000/api/v1/characters/regenerate-image" \
  -H "content-type: application/json" \
  -d "{
    \"positive_prompt\": \"story-ready keyframe portrait of a moon ranger with ceremonial armor ...\",
    \"negative_prompt\": \"blurry, low detail, watermark, text artifacts\",
    \"world_references\": [
      { \"image_data\": \"data:image/jpeg;base64,${WORLD_B64}\" }
    ],
    \"character_drawings\": [
      { \"image_data\": \"data:image/png;base64,${DRAWING_B64}\" }
    ]
  }"
```

## A2A Quick Check

Agent card:

```bash
curl http://127.0.0.1:8000/.well-known/agent.json
```

A2A JSON-RPC healthcheck (no model/image cost):

```bash
curl -X POST "http://127.0.0.1:8000/a2a" \
  -H "content-type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [{ "kind": "text", "text": "healthcheck" }],
        "messageId": "health-1",
        "metadata": { "operation": "healthcheck" }
      }
    }
  }'
```

## Response Shape (Create Success)

```json
{
  "workflow_used": "reference_enriched",
  "backstory": {
    "name": "string",
    "archetype": "string",
    "era": "string",
    "origin": "string",
    "goals": ["string"],
    "flaws": ["string"],
    "narrative_backstory": "string",
    "visual_signifiers": ["string"]
  },
  "image_prompt": {
    "positive_prompt": "string",
    "negative_prompt": "string",
    "composition_guidance": ["string"],
    "color_palette": ["string"],
    "lighting": "string"
  },
  "generated_images": ["https://..."],
  "drawing_descriptions": ["string"],
  "world_reference_descriptions": ["string"],
  "replicate_model": "prunaai/p-image",
  "reference_summary": {
    "key_facts": ["string"],
    "style_cues": ["string"],
    "source_links": ["string"],
    "research_notes": "string"
  }
}
```

## Response Shape (Regenerate Success)

```json
{
  "image_prompt": {
    "positive_prompt": "string",
    "negative_prompt": "string",
    "composition_guidance": [],
    "color_palette": [],
    "lighting": ""
  },
  "generated_images": ["https://..."],
  "replicate_model": "prunaai/p-image",
  "total_reference_images_sent": 2
}
```

## Error Handling

- `422` validation error:
  missing `user_prompt` / `positive_prompt` or invalid schema.
- `502` workflow/generation error:
  upstream failure in OpenAI/Replicate or workflow output failure.
- `500` unhandled server exception.

## Run Tests

```bash
cd /Users/yashwanthkrishna/Desktop/Projects/dream/backend/a2a-crew-ai-character-maker
python -m pytest -q
```

## Website Integration

If using the website test page (`/dashboard/api-test`), set:

- `BACKEND_API_BASE_URL=http://127.0.0.1:8000`

The website proxy route `/api/character-test` forwards requests to this backend.

## Troubleshooting

- `Replicate generation failed`:
  check `REPLICATE_API_TOKEN`, model name, and Replicate account limits.
- `Vision description failed`:
  check `OPENAI_API_KEY`, vision model access, and `image_data` format.
- No image URLs returned:
  confirm response status is `200` and inspect backend logs for upstream model errors.
