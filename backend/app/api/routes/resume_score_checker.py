import io
import os
import json
import logging
import re  # <--- Imported for regex cleaning
import pypdf
from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from openai import AsyncOpenAI
from app.core.config import settings
from app.models import ResumeAnalysis

router = APIRouter(prefix="/score_checker", tags=["score_checker"])
logger = logging.getLogger(__name__)

def extract_text(file_bytes: bytes) -> str:
    reader = pypdf.PdfReader(io.BytesIO(file_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)

def clean_json_string(raw_str: str) -> str:
    """Removes markdown code block wrappers (```json ... ```) that models wrap text in."""
    stripped = raw_str.strip()
    # Remove markdown code blocks if present
    stripped = re.sub(r"^```json\s*", "", stripped, flags=re.IGNORECASE)
    stripped = re.sub(r"^```\s*", "", stripped, flags=re.IGNORECASE)
    stripped = re.sub(r"\s*```$", "", stripped, flags=re.IGNORECASE)
    return stripped.strip()

@router.post("/analyze")
async def analyze(
    resume: UploadFile = File(...), job_description: str = Form(...)
):
    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
    )
    
    resume_bytes = await resume.read()
    resume_text = extract_text(resume_bytes)

    # Added explicit constraints telling the model NOT to talk or explain
    prompt = f"""
    You are an expert technical recruiter. Compare this resume against the job description.
    You must output your answer strictly as a valid JSON object matching this structural schema:
    {ResumeAnalysis.model_json_schema()}

    CRUCIAL: Do not include any explanations, introductory text, markdown formatting, or notes. 
    Return ONLY the raw JSON object string.

    RESUME:
    {resume_text}

    JOB DESCRIPTION:
    {job_description}
    """

    try:
        completion = await client.chat.completions.create(
            model="nemotron-3-ultra-550b-a55b:free", 
            messages=[
                {"role": "system", "content": "You are a precise parsing engine. You output raw JSON matching the requested schema template only. Do not talk. Do not explain."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}, 
            extra_headers={
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": "FastAPI Resume Analyzer",
            }
        )
        
        raw_content = completion.choices[0].message.content
        logger.info(f"Raw text payload from OpenRouter: {raw_content}")

        if raw_content is None:
            raise HTTPException(status_code=502, detail="AI engine returned an empty response.")
        
        # 1. Sanitize the string to discard markdown backticks or hidden breaks
        clean_content = clean_json_string(raw_content)
        logger.info(f"Sanitized payload for parsing: {clean_content}")

        # 2. Parse string into dictionary and validate using Pydantic
        json_data = json.loads(clean_content)
        parsed_analysis = ResumeAnalysis.model_validate(json_data)
        
        return parsed_analysis

    except json.JSONDecodeError as je:
        # We print the raw content here to let you view exactly what text fouled up the processing pipeline
        logger.error(f"Target free model returned unparseable text format: {raw_content} | Error: {je}")
        raise HTTPException(status_code=502, detail="AI engine response could not be parsed as valid JSON.")
        
    except Exception as e:
        logger.error(f"OpenRouter Gateway Failure: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"OpenRouter Gateway Core Exception: {str(e)}")
