"""Feedback NLP with remote Hugging Face, optional local ML, and safe fallbacks."""

from __future__ import annotations

import os
import re
import time

import hf_inference_service as hf


SUMMARY_MODEL = "sshleifer/distilbart-cnn-12-6"
SENTIMENT_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
_summary_tokenizer = None
_summary_model = None
_sentiment_analyzer = None
_embedding_model = None


def inference_provider() -> str:
    configured = os.getenv("UGVOICE_ML_PROVIDER", "").strip().lower()
    if configured in {"huggingface", "local", "disabled"}:
        return configured
    legacy_local_enabled = os.getenv("UGVOICE_ML_ENABLED", "false").strip().lower() in {
        "1", "true", "yes", "on"
    }
    return "local" if legacy_local_enabled else "disabled"


def ml_enabled() -> bool:
    return inference_provider() != "disabled"


def bertopic_enabled() -> bool:
    return inference_provider() == "local"


def remote_embeddings_enabled() -> bool:
    return os.getenv("HF_ENABLE_EMBEDDINGS", "true").strip().lower() in {
        "1", "true", "yes", "on"
    }


POSITIVE_WORDS = {
    "appreciate", "excellent", "good", "great", "happy", "helpful",
    "improved", "love", "positive", "resolved", "satisfied", "support",
}
NEGATIVE_WORDS = {
    "angry", "bad", "broken", "complaint", "corrupt", "delay", "failed",
    "missing", "negative", "poor", "problem", "slow", "unhappy", "worse",
}


def get_summary_components():
    global _summary_tokenizer, _summary_model
    if _summary_tokenizer is None or _summary_model is None:
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        _summary_tokenizer = AutoTokenizer.from_pretrained(SUMMARY_MODEL)
        _summary_model = AutoModelForSeq2SeqLM.from_pretrained(SUMMARY_MODEL)
        _summary_model.eval()
    return _summary_tokenizer, _summary_model


def get_sentiment_analyzer():
    global _sentiment_analyzer
    if _sentiment_analyzer is None:
        from transformers import pipeline

        _sentiment_analyzer = pipeline(
            "sentiment-analysis",
            model=SENTIMENT_MODEL,
            top_k=None,
        )
    return _sentiment_analyzer


def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer

        _embedding_model = SentenceTransformer(EMBEDDING_MODEL)
    return _embedding_model


def clean_feedback_text(text: str) -> str:
    if not text:
        return ""
    text = text.strip()
    text = re.sub(r"http\S+|www\S+", "", text)
    return re.sub(r"\s+", " ", text)


def lightweight_summary(text: str) -> str:
    return " ".join(text.split()[:60])


def lightweight_sentiment(text: str) -> dict:
    tokens = set(re.findall(r"[a-z]+", text.lower()))
    positive_score = len(tokens & POSITIVE_WORDS)
    negative_score = len(tokens & NEGATIVE_WORDS)
    if positive_score > negative_score:
        sentiment = "positive"
    elif negative_score > positive_score:
        sentiment = "negative"
    else:
        sentiment = "neutral"
    confidence = 0.5 if positive_score == negative_score else 0.65
    return {
        "sentiment": sentiment,
        "confidence": confidence,
        "scores": {
            "positive": confidence if sentiment == "positive" else 0.175,
            "neutral": confidence if sentiment == "neutral" else 0.175,
            "negative": confidence if sentiment == "negative" else 0.175,
        },
    }


def local_summary(text: str) -> str:
    words = text.split()
    if len(words) < 30:
        return text
    tokenizer, model = get_summary_components()
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=1024)
    summary_ids = model.generate(
        **inputs,
        max_length=60,
        min_length=15,
        do_sample=False,
        num_beams=4,
    )
    return tokenizer.decode(summary_ids[0], skip_special_tokens=True)


def local_sentiment(text: str) -> dict:
    results = get_sentiment_analyzer()(text)[0]
    scores = {item["label"].lower(): round(item["score"], 4) for item in results}
    sentiment = max(scores, key=scores.get)
    return {
        "sentiment": sentiment,
        "confidence": scores[sentiment],
        "scores": scores,
    }


def local_embedding(text: str) -> list:
    return get_embedding_model().encode(text).tolist()


def summarize_feedback(text: str) -> str:
    if len(text.split()) < 30:
        return text
    if inference_provider() == "huggingface":
        try:
            return hf.summarize(text)
        except Exception:
            return lightweight_summary(text)
    if inference_provider() == "local":
        return local_summary(text)
    return lightweight_summary(text)


def get_sentiment(text: str) -> dict:
    if inference_provider() == "huggingface":
        try:
            return hf.classify_sentiment(text)
        except Exception:
            return lightweight_sentiment(text)
    if inference_provider() == "local":
        return local_sentiment(text)
    return lightweight_sentiment(text)


def get_embedding(text: str) -> list:
    if inference_provider() == "huggingface" and remote_embeddings_enabled():
        try:
            return hf.create_embedding(text)
        except Exception:
            return []
    if inference_provider() == "local":
        return local_embedding(text)
    return []


def _process_remote(clean_text: str) -> dict:
    started_at = time.perf_counter()
    should_summarize = len(clean_text.split()) >= 30
    tasks = {"sentiment": lambda: hf.classify_sentiment(clean_text)}
    if should_summarize:
        tasks["summary"] = lambda: hf.summarize(clean_text)
    if remote_embeddings_enabled():
        tasks["embedding"] = lambda: hf.create_embedding(clean_text)
    results = hf.run_parallel(tasks)

    fallback_tasks: list[str] = []
    sentiment_result = results["sentiment"]
    if sentiment_result["ok"]:
        sentiment = sentiment_result["value"]
        sentiment_model = f"huggingface:{hf.SENTIMENT_MODEL}"
    else:
        sentiment = lightweight_sentiment(clean_text)
        sentiment_model = "fallback:keyword-heuristic"
        fallback_tasks.append("sentiment")

    if not should_summarize:
        summary = clean_text
        summary_model = "not-required:short-text"
    elif results["summary"]["ok"]:
        summary = results["summary"]["value"]
        summary_model = f"huggingface:{hf.SUMMARY_MODEL}"
    else:
        summary = lightweight_summary(clean_text)
        summary_model = "fallback:extractive-truncation"
        fallback_tasks.append("summary")

    embedding_result = results.get("embedding")
    if embedding_result and embedding_result["ok"]:
        embedding = embedding_result["value"]
        embedding_model = f"huggingface:{hf.EMBEDDING_MODEL}"
    elif embedding_result:
        embedding = []
        embedding_model = "fallback:unavailable"
        fallback_tasks.append("embedding")
    else:
        embedding = []
        embedding_model = "disabled"

    return {
        "summary": summary,
        "sentiment": sentiment,
        "embedding": embedding,
        "summary_model": summary_model,
        "sentiment_model": sentiment_model,
        "embedding_model": embedding_model,
        "inference_provider": "huggingface",
        "inference_mode": "remote-api",
        "inference_fallback_used": bool(fallback_tasks),
        "inference_fallback_tasks": fallback_tasks,
        "inference_latency_ms": round((time.perf_counter() - started_at) * 1000),
    }


def process_feedback(text: str) -> dict:
    clean_text = clean_feedback_text(text)
    provider = inference_provider()

    if provider == "huggingface":
        analysis = _process_remote(clean_text)
    elif provider == "local":
        started_at = time.perf_counter()
        analysis = {
            "summary": local_summary(clean_text),
            "sentiment": local_sentiment(clean_text),
            "embedding": local_embedding(clean_text),
            "summary_model": f"local:{SUMMARY_MODEL}",
            "sentiment_model": f"local:{SENTIMENT_MODEL}",
            "embedding_model": f"local:{EMBEDDING_MODEL}",
            "inference_provider": "local-transformers",
            "inference_mode": "local-models",
            "inference_fallback_used": False,
            "inference_fallback_tasks": [],
            "inference_latency_ms": round((time.perf_counter() - started_at) * 1000),
        }
    else:
        started_at = time.perf_counter()
        analysis = {
            "summary": lightweight_summary(clean_text),
            "sentiment": lightweight_sentiment(clean_text),
            "embedding": [],
            "summary_model": "fallback:extractive-truncation",
            "sentiment_model": "fallback:keyword-heuristic",
            "embedding_model": "disabled",
            "inference_provider": "local-fallback",
            "inference_mode": "lightweight-fallback",
            "inference_fallback_used": True,
            "inference_fallback_tasks": ["summary", "sentiment", "embedding"],
            "inference_latency_ms": round((time.perf_counter() - started_at) * 1000),
        }

    sentiment = analysis.pop("sentiment")
    return {
        "original_text": text,
        "clean_text": clean_text,
        "summary": analysis.pop("summary"),
        "sentiment": sentiment["sentiment"],
        "sentiment_confidence": sentiment["confidence"],
        "sentiment_scores": sentiment["scores"],
        **analysis,
    }
