import os
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(tags=["project"])

DEMO_PROJECT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "demo-project")
)

EXCLUDED_DIRS = {"__pycache__", ".pytest_cache", ".venv", "venv", "node_modules", ".git"}
EXCLUDED_EXTS = {".pyc", ".pyo", ".pyd", ".bak"}


@router.get("/project")
async def get_project():
    """Get project structure and metadata."""
    files = []
    for root, dirs, filenames in os.walk(DEMO_PROJECT_DIR):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for fname in filenames:
            if any(fname.endswith(ext) for ext in EXCLUDED_EXTS):
                continue
            rel = os.path.relpath(os.path.join(root, fname), DEMO_PROJECT_DIR)
            files.append(rel.replace("\\", "/"))

    return {
        "name": "demo-project",
        "path": DEMO_PROJECT_DIR,
        "files": sorted(files),
        "status": "active",
        "description": "FastAPI Authentication Service (Demo)"
    }


@router.get("/project/file")
async def get_file(path: str = Query(..., description="Relative path within demo-project")):
    """Get the content of a specific file in the demo project."""
    # Security: prevent path traversal
    clean = path.lstrip("/\\").replace("..", "")
    abs_path = os.path.abspath(os.path.join(DEMO_PROJECT_DIR, clean))

    if not abs_path.startswith(DEMO_PROJECT_DIR):
        raise HTTPException(status_code=400, detail="Path traversal not allowed")

    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail=f"File not found: {path}")

    if not os.path.isfile(abs_path):
        raise HTTPException(status_code=400, detail="Path is not a file")

    with open(abs_path, "r", encoding="utf-8") as f:
        content = f.read()

    return {
        "path": path,
        "content": content,
        "size_bytes": os.path.getsize(abs_path)
    }
