from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.feature_extraction.text import CountVectorizer


BACKEND_DIR = Path(__file__).resolve().parent
MODEL_DIR = BACKEND_DIR / "models" / "bertopic_feedback_model"
MIN_FEEDBACK_RECORDS = 10
NOISE_TOPIC_LABEL = "Other / Noise"


def build_vectorizer():
    return CountVectorizer(
        stop_words="english",
        ngram_range=(1, 3),
        min_df=2,
    )


def create_bertopic_model():
    from bertopic import BERTopic

    return BERTopic(
        vectorizer_model=build_vectorizer(),
        language="english",
        calculate_probabilities=True,
        verbose=True,
        min_topic_size=5,
    )


def generate_issue_label(topic_words: list[str]):
    if not topic_words:
        return "Unclear Issue"

    return " / ".join(word.title() for word in topic_words[:3])


def topic_probability_for_row(probabilities: Any, row_index: int):
    if probabilities is None:
        return None

    try:
        row = probabilities[row_index]
        if row is None:
            return None
        return float(np.max(row))
    except (IndexError, TypeError, ValueError):
        return None


def train_bertopic(feedbacks: list[dict], *, model_version: str | None = None):
    if len(feedbacks) < MIN_FEEDBACK_RECORDS:
        raise ValueError(
            f"BERTopic needs at least {MIN_FEEDBACK_RECORDS} feedback records."
        )

    docs = [str(item["clean_text"]).strip() for item in feedbacks]
    embeddings = np.asarray([item["embedding"] for item in feedbacks], dtype=np.float32)
    if embeddings.ndim != 2:
        raise ValueError("Feedback embeddings must be a two-dimensional array.")

    resolved_model_version = model_version or datetime.utcnow().strftime("%Y%m%d%H%M%S")
    topic_model = create_bertopic_model()
    topics, probabilities = topic_model.fit_transform(docs, embeddings)
    topic_info = topic_model.get_topic_info()
    size_by_topic = {
        int(row["Topic"]): int(row["Count"])
        for row in topic_info.to_dict(orient="records")
        if row.get("Topic") is not None
    }

    issue_by_topic: dict[int, dict] = {}
    assignments = []

    for index, item in enumerate(feedbacks):
        topic_id = int(topics[index])
        if topic_id == -1:
            keywords: list[str] = []
            issue_label = NOISE_TOPIC_LABEL
            topic_probability = None
        else:
            keywords = [word for word, _score in topic_model.get_topic(topic_id)]
            issue_label = generate_issue_label(keywords)
            topic_probability = topic_probability_for_row(probabilities, index)

        issue_by_topic.setdefault(
            topic_id,
            {
                "topic_id": topic_id,
                "issue_label": issue_label,
                "keywords": keywords,
                "size": size_by_topic.get(topic_id, 0),
                "model_version": resolved_model_version,
            },
        )
        assignments.append(
            {
                "feedback_id": item["id"],
                "topic_id": topic_id,
                "issue_label": issue_label,
                "topic_probability": topic_probability,
                "model_version": resolved_model_version,
            }
        )

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    topic_model.save(
        str(MODEL_DIR),
        serialization="safetensors",
        save_ctfidf=True,
    )

    return {
        "issues": list(issue_by_topic.values()),
        "assignments": assignments,
        "topic_info": topic_info.to_dict(orient="records"),
        "model_path": str(MODEL_DIR),
        "model_version": resolved_model_version,
    }


def load_bertopic_model():
    from bertopic import BERTopic

    return BERTopic.load(str(MODEL_DIR))
