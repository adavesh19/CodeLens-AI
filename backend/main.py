import os
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="CodeLens AI Backend",
    description="AI-powered debugging assistant API",
    version="1.0.0"
)

# CORS setup for local development and Vercel production deployment
allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "https://code-lens-ai-topaz.vercel.app",
]
if allowed_origins_env:
    for o in allowed_origins_env.split(","):
        o_clean = o.strip()
        if o_clean and o_clean not in allowed_origins:
            allowed_origins.append(o_clean)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import analyze, patch, tests, project, ocr, voice, demo
from services.retrieval import CodebaseRetriever
from services.llm_service import check_llm_status, warmup_ollama

DEMO_PROJECT_PATH = os.environ.get("DEMO_PROJECT_PATH", "../demo-project")
demo_project_abs = os.path.abspath(os.path.join(os.path.dirname(__file__), DEMO_PROJECT_PATH))

retriever = CodebaseRetriever(demo_project_abs)
app.state.retriever = retriever
app.state.demo_project_path = demo_project_abs

app.include_router(analyze.router)
app.include_router(patch.router)
app.include_router(tests.router)
app.include_router(project.router)
app.include_router(ocr.router)
app.include_router(voice.router)
app.include_router(demo.router)


@app.on_event("startup")
async def startup():
    retriever.index_files()
    provider_name = os.environ.get("LLM_PROVIDER", "ollama")
    print(f"[CodeLens] Backend started. Provider: {provider_name} | Demo project: {demo_project_abs}")
    print(f"[CodeLens] Indexed {len(retriever.file_index)} files")
    asyncio.create_task(warmup_ollama())


@app.get("/health")
async def health():
    """Health check - returns provider metadata safely without exposing secrets."""
    status = await check_llm_status()
    if status["ai_provider"] == "ollama" and status["ai_online"]:
        asyncio.create_task(warmup_ollama())

    return {
        "status": "ok",
        "ai_provider": status["ai_provider"],
        "ai_online": status["ai_online"],
        "ai_available": status["ai_online"],
        "model": status["model"],
        "fallback": status["fallback"],
        "demo_project": demo_project_abs
    }
