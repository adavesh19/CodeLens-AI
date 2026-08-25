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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import analyze, patch, tests, project, ocr, voice, demo
from services.retrieval import CodebaseRetriever
from services.llm_service import check_ollama_status, warmup_ollama

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
    print(f"[CodeLens] Backend started. Demo project: {demo_project_abs}")
    print(f"[CodeLens] Indexed {len(retriever.file_index)} files")
    # Trigger non-blocking background model warmup
    asyncio.create_task(warmup_ollama())


@app.get("/health")
async def health():
    """Health check - verifies Ollama reachability AND model presence."""
    status = await check_ollama_status()
    # Trigger non-blocking background model warmup if available
    if status["ai_available"]:
        asyncio.create_task(warmup_ollama())

    return {
        "status": "ok",
        "ai_available": status["ai_available"],
        "model": status["model"],
        "fallback": status["fallback"],
        "demo_project": demo_project_abs
    }
