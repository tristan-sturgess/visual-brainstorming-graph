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


REFINER_SYSTEM = """You maintain a short, human-readable creative concept for an image on a branching brainstorming canvas. The user talks to you in plain language; you keep the concept text current.

Output rules:
- title: at most 6 words, no trailing period.
- body: 2 to 4 plain sentences, at most 60 words. Prose only: no bullet lists, headings, markdown, or labels. Cover subject, composition, style, palette, and mood in concrete terms. When applying a change, keep the body the same length by tightening other sentences rather than appending.
- reply: one or two sentences saying what you changed or wrote. No preamble, no questions unless something is genuinely blocking.

Behavior:
- If the current body is empty, write the concept from the user's message.
- Otherwise apply the user's requested change and keep everything else as it was. Do not restate or expand unrelated parts.
- Parent concepts and parent images are context. Their feedback and annotations say what to keep (like), avoid (dislike), or note; fold those into the concept where relevant.
- When the user says "this one" or "that image", they mean the attached or parent image described in the context.
- Attached images are for reasoning only. Do not describe them as visual references in the body.
- Never include technical directives such as aspect ratio, resolution, file format, or the words "image generation". Describe the picture, not the process."""


COMPILER_SYSTEM = """You convert a frozen creative concept into exactly one prompt for an image-generation model.

Rules:
- Preserve the concept's intent. Do not add new creative ideas, props, or styles that are not implied by the concept or the parent image notes.
- One paragraph, at most 120 words, written as a direct description of the picture: subject, composition, style, palette, lighting, mood.
- Fold in the parent image notes: "like" means preserve that element from the reference image, "dislike" means avoid or change it, "note" is an instruction to follow. When reference images are present, refer to them as "the reference image" or "the reference images".
- Do not mention aspect ratio, resolution, dimensions, or file format. Do not address the model or the user. Output only the prompt."""


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
    result = llm.invoke(
        [
            {"role": "system", "content": REFINER_SYSTEM},
            {"role": "user", "content": content},
        ]
    )
    return result.title, result.body, result.reply


def compile(title: str, body: str, parent_notes: list[str]) -> str:
    text = f"Concept title: {title}\nConcept body: {body}\n"
    if parent_notes:
        text += (
            f"\nReference images: {len(parent_notes)} (these will be passed to the image model)\n"
            "Parent image notes:\n" + "\n".join(parent_notes)
        )
    else:
        text += "\nReference images: none\n"

    llm = _compiler_llm().with_structured_output(CompileOutput)
    result = llm.invoke(
        [
            {"role": "system", "content": COMPILER_SYSTEM},
            {"role": "user", "content": text},
        ]
    )
    return result.prompt
