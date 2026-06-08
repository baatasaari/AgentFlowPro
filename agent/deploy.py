"""
Deploy the Chief of Staff ADK agent to Vertex AI Agent Engine.

Prerequisites:
    gcloud auth application-default login
    gcloud config set project YOUR_PROJECT_ID

Usage:
    cd agent
    pip install -r requirements.txt
    python deploy.py

After deployment, set AGENT_ENGINE_RESOURCE_NAME in the Express backend's
environment to route production briefing calls through Agent Engine.
"""
import os
import sys

import vertexai
from dotenv import load_dotenv
from google.adk.agents import Agent
from vertexai import agent_engines
from vertexai.preview.reasoning_engines import AdkApp

from cos_agent import root_agent

load_dotenv()

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
STAGING_BUCKET = os.environ.get("GCS_STAGING_BUCKET")
LITELLM_MODEL = os.environ.get("LITELLM_MODEL", "gemini/gemini-2.5-flash-lite")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")

if not PROJECT_ID:
    sys.exit("Error: GOOGLE_CLOUD_PROJECT is required")
if not STAGING_BUCKET:
    sys.exit("Error: GCS_STAGING_BUCKET is required (e.g. gs://my-bucket/staging)")

print(f"Project:  {PROJECT_ID}")
print(f"Location: {LOCATION}")
print(f"Model:    {LITELLM_MODEL}")
print(f"Bucket:   {STAGING_BUCKET}")
print()

vertexai.init(project=PROJECT_ID, location=LOCATION)

# Wrap the ADK agent for Agent Engine deployment
app = AdkApp(
    agent=root_agent,
    enable_tracing=True,
)

print("Deploying to Vertex AI Agent Engine… (this takes 5–10 minutes)")

env_vars = {"LITELLM_MODEL": LITELLM_MODEL}
if GOOGLE_API_KEY:
    env_vars["GOOGLE_API_KEY"] = GOOGLE_API_KEY

remote = agent_engines.create(
    agent_engine=app,
    requirements=[
        "google-adk>=1.0.0",
        "litellm>=1.40.0",
        "google-cloud-aiplatform[agent_engines,adk]>=1.144.0",
        "python-dotenv>=1.0.0",
    ],
    display_name="Chief of Staff Agent",
    description="Personal Chief of Staff — daily briefings via Gemini 2.5 Flash Lite",
    staging_bucket=STAGING_BUCKET,
    env_vars=env_vars,
)

print()
print("=" * 60)
print("Deployed successfully!")
print(f"Resource name: {remote.resource_name}")
print()
print("Add this to your Express .env:")
print(f"  AGENT_ENGINE_RESOURCE_NAME={remote.resource_name}")
print("=" * 60)
