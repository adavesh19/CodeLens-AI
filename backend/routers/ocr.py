from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter(tags=["ocr"])

DEMO_ERROR_TEXT = """Traceback (most recent call last):
  File "app/routes/auth.py", line 87, in validate_request
    user = validate_token(token)
  File "app/auth.py", line 42, in validate_token
    if datetime.now().timestamp() > payload['exp'] * 1000:
jwt.exceptions.InvalidSignatureError -> HTTPException: 401 Unauthorized

HTTP 401 Unauthorized
JWT validation failed: Token appears expired
auth.py:42

Error: datetime.now().timestamp() compared against payload['exp'] * 1000
Expected Unix timestamp in seconds, comparison done in milliseconds"""


class OCRRequest(BaseModel):
    image_data: Optional[str] = None


@router.post("/ocr")
async def perform_ocr(body: OCRRequest):
    """
    Extract text from an image.
    
    In production this would use pytesseract or a cloud OCR service.
    For the demo, returns the realistic auth error scenario when called
    (browser-side Tesseract.js handles real OCR in the frontend).
    """
    lines = DEMO_ERROR_TEXT.strip().split("\n")
    return {
        "text": DEMO_ERROR_TEXT,
        "confidence": 0.94,
        "lines": lines,
        "source": "demo_fallback",
        "note": "Browser OCR (Tesseract.js) handles real captures; this returns the demo scenario"
    }
