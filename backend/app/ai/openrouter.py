"""Real refine / compile via OpenRouter, using LangChain's ChatOpenAI client.

Verified against the installed langchain-openai==1.6.2: ChatOpenAI accepts
`model`, `api_key`, `base_url` (aliases of `model_name`, `openai_api_key`,
`openai_api_base`), and `.with_structured_output(schema)` returns a Runnable
that yields an instance of `schema`.
"""

import base64
import mimetypes

from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from app.config import settings

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class RefineOutput(BaseModel):
    title: str
    body: str
    reply: str


class CompileOutput(BaseModel):
    prompt: str


def _refiner_llm():
    return ChatOpenAI(
        base_url=OPENROUTER_BASE_URL,
        api_key=settings.openrouter_api_key,
        model=settings.refiner_model,
    )


def _compiler_llm():
    return ChatOpenAI(
        base_url=OPENROUTER_BASE_URL,
        api_key=settings.openrouter_api_key,
        model=settings.compiler_model,
    )


def _image_data_url(path: str) -> str:
    mime, _ = mimetypes.guess_type(path)
    mime = mime or "image/png"
    with open(path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def refine(
    title: str,
    body: str,
    parent_concept_texts: list[str],
    parent_image_texts: list[str],
    parent_image_paths: list[str],
    history_lines: list[str],
    attachment_texts: list[str],
    attachment_paths: list[str],
    message: str,
) -> tuple[str, str, str]:
    text_parts = [
        f"Current title: {title or '(empty)'}",
        f"Current body: {body or '(empty)'}",
    ]
    if parent_concept_texts:
        text_parts.append("Parent concepts:\n" + "\n".join(parent_concept_texts))
    if parent_image_texts:
        text_parts.append("Parent images (visual references):\n" + "\n".join(parent_image_texts))
    if history_lines:
        text_parts.append("Chat history:\n" + "\n".join(history_lines))
    if attachment_texts:
        text_parts.append(
            "Attached images (context only, NOT visual references):\n" + "\n".join(attachment_texts)
        )
    text_parts.append(f"User message: {message}")

    content: list[dict] = [{"type": "text", "text": "\n\n".join(text_parts)}]
    for path in [*parent_image_paths, *attachment_paths]:
        content.append({"type": "image_url", "image_url": {"url": _image_data_url(path)}})

    llm = _refiner_llm().with_structured_output(RefineOutput)
    result = llm.invoke([{"role": "user", "content": content}])
    return result.title, result.body, result.reply


def compile(title: str, body: str, parent_notes: list[str]) -> str:
    text = f"Concept title: {title}\nConcept body: {body}\n"
    if parent_notes:
        text += "Parent image notes:\n" + "\n".join(parent_notes)

    llm = _compiler_llm().with_structured_output(CompileOutput)
    result = llm.invoke(text)
    return result.prompt
