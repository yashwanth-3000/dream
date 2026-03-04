# Dream MAF Quiz Maker

A multi-agent quiz engine for children that generates 4-option quizzes with wrong-answer hints and correct-answer explanations. Built with Microsoft Agent Framework (MAF) and exposed through A2A.

**Pipeline:** Prompt/story context -> Quiz blueprint agent -> Quiz writer agent -> Contract normalization (4 options + hints + explanation) -> response.

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/api/v1/quizzes/create` | Quiz generation |
| `POST` | `/a2a` | A2A JSON-RPC endpoint (`message/send`, `message/stream`) |
| `GET` | `/.well-known/agent.json` | A2A agent card |

## Request Shape

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

## Response Shape

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

## Setup

```bash
cd backend/a2a-maf-quiz-maker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Run

```bash
uvicorn agent_quiz.main:app --reload --host 127.0.0.1 --port 8030
```

## Test

```bash
python -m pytest -q
```
