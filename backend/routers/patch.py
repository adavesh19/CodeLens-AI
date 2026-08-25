import os
import shutil
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(tags=["patch"])

DEMO_PROJECT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "demo-project")
)


class PatchRequest(BaseModel):
    file: str
    old_code: str
    new_code: str


def resolve_safe_path(file_path: str) -> str:
    """Resolve a file path within the demo project, preventing path traversal."""
    if not file_path or str(file_path).strip().lower() in ["unknown", "none", "null", "undefined", ""]:
        raise HTTPException(status_code=404, detail="File not found: unknown")

    # Clean demo-project prefix & leading slashes
    clean = str(file_path).replace("demo-project/", "").replace("demo-project\\", "").strip()
    clean = clean.lstrip("/\\").replace("\\", "/")

    # Strip line numbers like :52 if attached
    if ":" in clean:
        parts = clean.split(":")
        if parts[-1].isdigit():
            clean = ":".join(parts[:-1])

    clean = clean.strip()
    if not clean or clean.lower() in ["unknown", "none", "null", "undefined"]:
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    abs_path = os.path.abspath(os.path.join(DEMO_PROJECT_DIR, clean))

    # Security check: path traversal prevention
    if not abs_path.startswith(DEMO_PROJECT_DIR):
        raise HTTPException(status_code=400, detail="Path traversal not allowed")

    return abs_path


@router.post("/apply-patch")
async def apply_patch(body: PatchRequest):
    """
    Apply a code patch to a file in the demo project.
    Security: Only allows modifications inside the demo-project directory.
    """
    try:
        target = resolve_safe_path(body.file)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid path: {e}")

    if not os.path.exists(target) or not os.path.isfile(target):
        raise HTTPException(status_code=404, detail=f"File not found: {body.file}")

    # Read current file content
    with open(target, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Exact string match check
    if body.old_code in content:
        new_content = content.replace(body.old_code, body.new_code, 1)
    else:
        # Try normalizing line endings (\r\n -> \n)
        content_norm = content.replace("\r\n", "\n")
        old_norm = body.old_code.replace("\r\n", "\n")
        new_norm = body.new_code.replace("\r\n", "\n")

        if old_norm in content_norm:
            new_content_norm = content_norm.replace(old_norm, new_norm, 1)
            if "\r\n" in content:
                new_content = new_content_norm.replace("\n", "\r\n")
            else:
                new_content = new_content_norm
        elif not body.old_code.strip() and body.new_code.strip():
            # Appending code if old_code is empty (e.g. adding new function)
            new_content = content + "\n\n" + body.new_code
        else:
            raise HTTPException(
                status_code=400,
                detail="Old code pattern not found in file. The file may have already been patched."
            )

    # Create backup before writing
    backup_path = target + ".bak"
    shutil.copy2(target, backup_path)

    # Write patched content
    with open(target, "w", encoding="utf-8") as f:
        f.write(new_content)

    rel_name = os.path.relpath(target, DEMO_PROJECT_DIR).replace("\\", "/")

    return {
        "success": True,
        "message": f"Patch applied successfully to {rel_name}",
        "backup_created": True,
        "backup_path": backup_path,
        "file": rel_name
    }


@router.post("/reject-patch")
async def reject_patch():
    """Reject the suggested patch."""
    return {"success": True, "message": "Patch rejected. No changes were made."}
