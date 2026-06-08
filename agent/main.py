"""
Local development server for the Chief of Staff ADK agent.

Run:
    cd agent
    uvicorn main:app --port 8001 --reload

The Express backend calls POST /briefing/generate with the context payload.
"""
import asyncio
import json
import os
import re
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import BaseModel

from cos_agent import root_agent

load_dotenv()

app = FastAPI(
    title="Chief of Staff Agent API",
    description="ADK agent powered by Gemini 2.5 Flash Lite via LiteLLM",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── ADK setup ────────────────────────────────────────────────────────────────

_session_service = InMemorySessionService()
_runner = Runner(
    agent=root_agent,
    app_name="chief_of_staff",
    session_service=_session_service,
)

_SESSION_COUNTER = 0


async def _run_agent(message: str) -> str:
    """Run the ADK agent with a text message and return the final text response."""
    global _SESSION_COUNTER
    _SESSION_COUNTER += 1
    session_id = f"session-{_SESSION_COUNTER}"

    session = _session_service.create_session(
        app_name="chief_of_staff",
        user_id="vijay",
        session_id=session_id,
    )

    content = types.Content(
        role="user",
        parts=[types.Part(text=message)],
    )

    final_text = ""
    async for event in _runner.run_async(
        user_id="vijay",
        session_id=session.id,
        new_message=content,
    ):
        if event.is_final_response() and event.content:
            for part in event.content.parts:
                if hasattr(part, "text") and part.text:
                    final_text += part.text

    return final_text


# ─── Request / response schemas ───────────────────────────────────────────────

class TaskItem(BaseModel):
    title: str
    category: str
    priority: str
    status: str
    dueDate: Optional[str] = None
    notes: Optional[str] = None


class EventItem(BaseModel):
    title: str
    startTime: str
    endTime: Optional[str] = None
    location: Optional[str] = None
    importance: str = "normal"


class FinanceItem(BaseModel):
    date: str
    merchant: str
    amount: str
    category: Optional[str] = None
    riskFlag: bool = False
    notes: Optional[str] = None


class HealthData(BaseModel):
    date: str
    sleepHours: Optional[str] = None
    steps: Optional[int] = None
    caffeineCount: Optional[int] = None
    notes: Optional[str] = None


class BriefingRequest(BaseModel):
    tasks: List[TaskItem] = []
    events: List[EventItem] = []
    finance: List[FinanceItem] = []
    health: Optional[HealthData] = None
    date: str


# ─── Prompt builder ───────────────────────────────────────────────────────────

def _build_prompt(ctx: BriefingRequest) -> str:
    open_tasks = [t for t in ctx.tasks if t.status == "open"]
    high = [t for t in open_tasks if t.priority == "high"]

    task_lines = "\n".join(
        f"- [{t.priority.upper()}] {t.title} | {t.category}"
        + (f" | Due: {t.dueDate}" if t.dueDate else "")
        + (f" | {t.notes}" if t.notes else "")
        for t in open_tasks[:10]
    ) or "None"

    event_lines = "\n".join(
        f"- {e.startTime}: {e.title}"
        + (f" @ {e.location}" if e.location else "")
        + f" [{e.importance}]"
        for e in ctx.events
    ) or "None"

    finance_lines = "\n".join(
        f"- {f.date}: {f.merchant} £{f.amount}"
        + (f" | {f.category}" if f.category else "")
        + (" ⚠️ RISK" if f.riskFlag else "")
        + (f" | {f.notes}" if f.notes else "")
        for f in ctx.finance[:10]
    ) or "None"

    if ctx.health:
        h = ctx.health
        health_line = (
            f"Sleep: {h.sleepHours or '?'}h"
            + f" | Steps: {h.steps or '?'}"
            + (f" | Caffeine: {h.caffeineCount}" if h.caffeineCount is not None else "")
            + (f" | {h.notes}" if h.notes else "")
        )
    else:
        health_line = "No health data logged today"

    return f"""Today is {ctx.date}.

OPEN TASKS ({len(open_tasks)} total, {len(high)} high priority):
{task_lines}

TODAY'S EVENTS ({len(ctx.events)}):
{event_lines}

RECENT FINANCE (last 14 days):
{finance_lines}

LATEST HEALTH:
{health_line}

Generate today's Chief of Staff briefing as strict JSON per the format in your instructions."""


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    model = os.getenv("LITELLM_MODEL", "gemini/gemini-2.5-flash-lite")
    return {"status": "ok", "agent": root_agent.name, "model": model}


@app.post("/briefing/generate")
async def generate_briefing(request: BriefingRequest):
    prompt = _build_prompt(request)

    raw = await _run_agent(prompt)
    if not raw:
        raise HTTPException(status_code=500, detail="No response from ADK agent")

    # Extract JSON from the response (agent may wrap in markdown)
    json_match = re.search(r"\{[\s\S]*\}", raw)
    if not json_match:
        raise HTTPException(
            status_code=500,
            detail=f"Could not parse JSON from agent response: {raw[:200]}",
        )

    try:
        return json.loads(json_match.group())
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"JSON parse error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8001")))
