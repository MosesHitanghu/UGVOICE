"""Small Hugging Face Inference API client with no local model dependencies."""

from __future__ import annotations

import os
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

import requests


DEFAULT_BASE_URL = "https://router.huggingface.co/hf-inference/models"
SUMMARY_MODEL = os.getenv("HF_SUMMARY_MODEL", "facebook/bart-large-cnn")
SENTIMENT_MODEL = os.getenv(
    "HF_SENTIMENT_MODEL",
    "cardiffnlp/twitter-roberta-base-sentiment-latest",
)
EMBEDDING_MODEL = os.getenv(
    "HF_EMBEDDING_MODEL",
    "sentence-transformers/all-MiniLM-L6-v2",
)


class HuggingFaceInferenceError(RuntimeError):
    pass


def get_hf_token() -> str | None:
    return os.getenv("HF_UGVOICE_TOKEN") or os.getenv("HF_TOKEN")


def is_configured() -> bool:
    return bool(get_hf_token())


def _post(model: str, payload: dict[str, Any]) -> Any:
    token = get_hf_token()
    if not token:
        raise HuggingFaceInferenceError("Hugging Face token is not configured")

    base_url = os.getenv("HF_INFERENCE_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    timeout = float(os.getenv("HF_INFERENCE_TIMEOUT_SECONDS", "25"))
    max_attempts = max(1, int(os.getenv("HF_INFERENCE_MAX_ATTEMPTS", "2")))
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": "UGVoice/1.0",
    }
    request_payload = {
        **payload,
        "options": {"use_cache": True, "wait_for_model": True},
    }

    for attempt in range(1, max_attempts + 1):
        try:
            response = requests.post(
                f"{base_url}/{model}",
                headers=headers,
                json=request_payload,
                timeout=timeout,
            )
        except requests.RequestException as exc:
            if attempt == max_attempts:
                raise HuggingFaceInferenceError("Hugging Face request failed") from exc
            time.sleep(0.5 * attempt)
            continue

        if response.status_code in {429, 503} and attempt < max_attempts:
            retry_after = response.headers.get("Retry-After")
            delay = float(retry_after) if retry_after and retry_after.isdigit() else 0.5 * attempt
            time.sleep(min(delay, 2.0))
            continue
        if not response.ok:
            raise HuggingFaceInferenceError(
                f"Hugging Face returned HTTP {response.status_code}"
            )

        result = response.json()
        if isinstance(result, dict) and result.get("error"):
            raise HuggingFaceInferenceError("Hugging Face returned an inference error")
        return result

    raise HuggingFaceInferenceError("Hugging Face request did not complete")


def summarize(text: str) -> str:
    result = _post(
        SUMMARY_MODEL,
        {
            "inputs": text,
            "parameters": {"max_length": 80, "min_length": 15},
        },
    )
    item = result[0] if isinstance(result, list) and result else result
    if not isinstance(item, dict) or not item.get("summary_text"):
        raise HuggingFaceInferenceError("Unexpected summarization response")
    return str(item["summary_text"]).strip()


def classify_sentiment(text: str) -> dict[str, Any]:
    result = _post(SENTIMENT_MODEL, {"inputs": text})
    items = result
    if isinstance(items, list) and items and isinstance(items[0], list):
        items = items[0]
    if not isinstance(items, list):
        raise HuggingFaceInferenceError("Unexpected sentiment response")

    label_map = {"label_0": "negative", "label_1": "neutral", "label_2": "positive"}
    scores: dict[str, float] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or "").strip().lower()
        label = label_map.get(label, label)
        if label in {"positive", "neutral", "negative"}:
            scores[label] = round(float(item.get("score") or 0), 4)
    if not scores:
        raise HuggingFaceInferenceError("Sentiment response contained no recognized labels")
    sentiment = max(scores, key=scores.get)
    return {
        "sentiment": sentiment,
        "confidence": scores[sentiment],
        "scores": scores,
    }


def _mean_pool(rows: list[list[float]]) -> list[float]:
    width = len(rows[0]) if rows else 0
    if not width or any(len(row) != width for row in rows):
        raise HuggingFaceInferenceError("Embedding response has inconsistent dimensions")
    return [sum(row[index] for row in rows) / len(rows) for index in range(width)]


def create_embedding(text: str) -> list[float]:
    result = _post(EMBEDDING_MODEL, {"inputs": text})
    while isinstance(result, list) and len(result) == 1 and isinstance(result[0], list):
        result = result[0]
    if not isinstance(result, list) or not result:
        raise HuggingFaceInferenceError("Unexpected embedding response")
    if all(isinstance(value, (int, float)) for value in result):
        return [float(value) for value in result]
    if all(
        isinstance(row, list) and all(isinstance(value, (int, float)) for value in row)
        for row in result
    ):
        return _mean_pool(result)
    raise HuggingFaceInferenceError("Embedding response contained unsupported values")


def run_parallel(tasks: dict[str, Callable[[], Any]]) -> dict[str, dict[str, Any]]:
    """Run independent inference tasks concurrently and retain per-task failures."""
    results: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=len(tasks) or 1) as executor:
        futures = {name: executor.submit(task) for name, task in tasks.items()}
        for name, future in futures.items():
            try:
                results[name] = {"ok": True, "value": future.result()}
            except Exception as exc:
                results[name] = {"ok": False, "error": exc.__class__.__name__}
    return results
