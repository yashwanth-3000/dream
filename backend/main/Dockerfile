FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY agent_orchestrator ./agent_orchestrator

EXPOSE 8080

CMD ["uvicorn", "agent_orchestrator.main:app", "--host", "0.0.0.0", "--port", "8080"]
