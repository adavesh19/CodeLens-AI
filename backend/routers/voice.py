from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["voice"])


class VoiceQuery(BaseModel):
    query: str


@router.post("/voice/query")
async def process_voice(body: VoiceQuery):
    """
    Process a voice query transcribed on the client side.
    Detects intent and formats the query for analysis.
    """
    q = body.query.lower().strip()

    # Detect intent
    intent = "general_error"
    if any(w in q for w in ["401", "unauthorized", "auth", "jwt", "token", "login", "credentials"]):
        intent = "authentication_error"
    elif any(w in q for w in ["500", "server error", "crash", "internal"]):
        intent = "server_error"
    elif any(w in q for w in ["database", "sql", "query", "db", "postgres", "mysql"]):
        intent = "database_error"
    elif any(w in q for w in ["404", "not found", "missing"]):
        intent = "not_found_error"
    elif any(w in q for w in ["timeout", "connection", "network", "refused"]):
        intent = "network_error"

    # Format the query
    formatted = body.query.strip()
    if not formatted.endswith(("?", ".", "!")):
        formatted = formatted + "?"

    return {
        "formatted_query": formatted,
        "detected_intent": intent,
        "original": body.query,
        "ready_for_analysis": True
    }
