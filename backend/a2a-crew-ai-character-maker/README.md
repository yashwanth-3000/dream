# Dream Backend: A2A CrewAI Character Maker

Agentic backend that takes a character prompt (plus optional world references and character drawings), then returns:

- a structured character backstory
- a highly detailed image prompt
- generated character image URL(s) from Replicate

Image generation is always enabled. There is no non-image mode.

## What This Service Does

`POST /api/v1/characters/create` runs an end-to-end pipeline:

1. Ingest prompt + optional reference images.
2. Use OpenAI Vision to describe uploaded drawing/world images.
3. Choose workflow:
`reference_enriched` when references/drawings exist.
`prompt_only` when only prompt exists.
4. Run CrewAI agents to generate backstory + detailed image prompt.
5. Call Replicate (`prunaai/p-image` by default) to generate output image URLs.
6. Return structured JSON response.

## Project Layout

```text
backend/a2a-crew-ai-character-maker/
├── app/
│   ├── main.py                    # FastAPI entrypoint
│   ├── config.py                  # Environment settings
│   ├── schemas.py                 # Request/response schema
│   ├── services/
│   │   ├── vision_service.py      # OpenAI vision descriptions
│   │   └── replicate_service.py   # Replicate image generation
│   └── workflows/
│       └── character_creation.py  # Workflow decider + CrewAI orchestration
├── tests/
├── pyproject.toml
├── .env.example
└── README.md
```

## Requirements

- Python `>=3.11`
- OpenAI API key
- Replicate API token

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

### Request schema

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

### Important behavior

- Image generation is always performed.
- If `image_data` or `url` exists in drawings and world references, those original images are forwarded to Replicate as reference candidates for stronger identity and world consistency.
- If workflow prompt output is empty, backend returns a failure instead of silently generating weak output.

## Example Request (Minimal)

```bash
curl -X POST "http://127.0.0.1:8000/api/v1/characters/create" \
  -H "content-type: application/json" \
  -d '{
    "user_prompt": "A young explorer with lantern and patchwork cloak in ancient ruins"
  }'
```

## Example Request (With Uploaded Images)

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

## Response Shape (Success)

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

## Regenerate-Only Response Shape (Success)

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
missing `user_prompt` or invalid types.
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
check `OPENAI_API_KEY`, vision model access, and image_data format.
- No image URLs returned:
confirm response status is `200` and inspect backend logs for upstream model errors.
- Environment not loading:
run server from this folder so `.env` is discovered correctly.

## Security Notes

- Do not commit `.env` or API keys.
- Keep keys server-side only; never expose them in frontend code.
