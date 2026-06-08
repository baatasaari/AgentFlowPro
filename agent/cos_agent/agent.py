import os
from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm
from .prompts import CHIEF_OF_STAFF_PROMPT

# Model is configurable via LITELLM_MODEL env var.
# Default: gemini/gemini-2.5-flash-lite (requires GOOGLE_API_KEY)
# Vertex AI alternative: vertex_ai/gemini-2.5-flash-lite
_MODEL = os.getenv("LITELLM_MODEL", "gemini/gemini-2.5-flash-lite")

root_agent = Agent(
    name="chief_of_staff",
    model=LiteLlm(model=_MODEL),
    description=(
        "Personal Chief of Staff for Vijay. Generates daily priority briefings "
        "covering tasks, finance risks, family commitments, health signals, and "
        "calendar events. Returns structured JSON."
    ),
    instruction=CHIEF_OF_STAFF_PROMPT,
)
