import time
import logging
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.llm_service import get_llm_provider

logger = logging.getLogger(__name__)

router = APIRouter(tags=["analyze"])


class AnalyzeRequest(BaseModel):
    error_text: str
    voice_query: Optional[str] = None
    image_data: Optional[str] = None
    selected_file: Optional[str] = None


@router.post("/analyze")
async def analyze_error(request: Request, body: AnalyzeRequest):
    """
    Analyze an error using AI with codebase context retrieval.
    Includes full timing metrics logging.
    """
    t_start = time.time()
    logger.info("[ANALYZE] request received")

    retriever = request.app.state.retriever

    # 1. Codebase Retrieval
    t_ret_start = time.time()
    logger.info("[ANALYZE] retrieval started")
    context_results = retriever.retrieve(body.error_text, max_files=5)
    context_files = [r["file"] for r in context_results]

    context_str = "\n\n".join([
        f"=== File: {r['file']} ===\n{r['content']}"
        for r in context_results
    ])
    t_ret_ms = (time.time() - t_ret_start) * 1000
    logger.info(f"[ANALYZE] retrieval completed: {t_ret_ms:.1f} ms")

    # Combine error text with voice query if provided
    full_query = body.error_text
    if body.voice_query:
        full_query = f"Error: {body.error_text}\n\nDeveloper query: {body.voice_query}"

    # 2. Get LLM Provider & Perform Analysis
    try:
        provider = await get_llm_provider()
        result = await provider.analyze(full_query, context_str)
    except Exception as e:
        err_msg = str(e)
        logger.error(f"[ANALYZE] Provider failed: {err_msg}")
        if "TIMED OUT" in err_msg:
            raise HTTPException(status_code=504, detail="LOCAL AI REQUEST TIMED OUT")
        if "MODEL NOT FOUND" in err_msg:
            raise HTTPException(status_code=404, detail="MODEL NOT FOUND")
        if "UNAVAILABLE" in err_msg:
            raise HTTPException(status_code=503, detail="LOCAL AI UNAVAILABLE")
        if "COULD NOT BE PARSED" in err_msg:
            raise HTTPException(status_code=422, detail="AI RESPONSE COULD NOT BE PARSED")
        raise HTTPException(status_code=500, detail=f"ANALYSIS ERROR: {err_msg}")

    # 3. Resolve repository file path
    raw_affected = result.get("affected_file", "")
    resolved = retriever.resolve_file(
        raw_file=raw_affected,
        error_text=body.error_text,
        retrieved_files=context_files,
        selected_file=body.selected_file
    )

    if resolved and resolved != "unknown":
        result["affected_file"] = resolved

    t_total_ms = (time.time() - t_start) * 1000
    logger.info(f"[ANALYZE] completed: {t_total_ms:.1f} ms")
    result["total_ms"] = round(t_total_ms, 1)

    return result
