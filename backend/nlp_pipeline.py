# nlp_pipeline.py

import re
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, pipeline
from sentence_transformers import SentenceTransformer


# -----------------------------
# Load models once when app starts
# -----------------------------

SUMMARY_MODEL = "sshleifer/distilbart-cnn-12-6"
SENTIMENT_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
_summary_tokenizer = None
_summary_model = None
_sentiment_analyzer = None
_embedding_model = None


def get_summary_components():
    global _summary_tokenizer, _summary_model

    if _summary_tokenizer is None or _summary_model is None:
        _summary_tokenizer = AutoTokenizer.from_pretrained(SUMMARY_MODEL)
        _summary_model = AutoModelForSeq2SeqLM.from_pretrained(SUMMARY_MODEL)
        _summary_model.eval()

    return _summary_tokenizer, _summary_model


def get_sentiment_analyzer():
    global _sentiment_analyzer

    if _sentiment_analyzer is None:
        _sentiment_analyzer = pipeline(
            "sentiment-analysis",
            model=SENTIMENT_MODEL,
            top_k=None,
        )

    return _sentiment_analyzer


def get_embedding_model():
    global _embedding_model

    if _embedding_model is None:
        _embedding_model = SentenceTransformer(EMBEDDING_MODEL)

    return _embedding_model


# -----------------------------
# Clean text
# -----------------------------

def clean_feedback_text(text: str) -> str:
    if not text:
        return ""

    text = text.strip()
    text = re.sub(r"http\S+|www\S+", "", text)
    text = re.sub(r"\s+", " ", text)

    return text


# -----------------------------
# Summarize feedback
# -----------------------------

def summarize_feedback(text: str) -> str:
    words = text.split()

    # If feedback is already short, don't summarize
    if len(words) < 30:
        return text

    tokenizer, model = get_summary_components()
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=1024,
    )

    summary_ids = model.generate(
        **inputs,
        max_length=60,
        min_length=15,
        do_sample=False,
        num_beams=4,
    )

    return tokenizer.decode(summary_ids[0], skip_special_tokens=True)


# -----------------------------
# Sentiment analysis
# -----------------------------

def get_sentiment(text: str) -> dict:
    results = get_sentiment_analyzer()(text)[0]

    scores = {
        item["label"].lower(): round(item["score"], 4)
        for item in results
    }

    sentiment = max(scores, key=scores.get)

    return {
        "sentiment": sentiment,
        "confidence": scores[sentiment],
        "scores": scores
    }


# -----------------------------
# Generate embedding
# -----------------------------

def get_embedding(text: str) -> list:
    embedding = get_embedding_model().encode(text)

    return embedding.tolist()


# -----------------------------
# Full real-time NLP pipeline
# -----------------------------

def process_feedback(text: str) -> dict:
    clean_text = clean_feedback_text(text)

    summary = summarize_feedback(clean_text)

    sentiment_result = get_sentiment(clean_text)

    embedding = get_embedding(clean_text)

    return {
        "original_text": text,
        "clean_text": clean_text,
        "summary": summary,
        "sentiment": sentiment_result["sentiment"],
        "sentiment_confidence": sentiment_result["confidence"],
        "sentiment_scores": sentiment_result["scores"],
        "embedding": embedding,
        "embedding_model": EMBEDDING_MODEL,
        "summary_model": SUMMARY_MODEL,
        "sentiment_model": SENTIMENT_MODEL
    }
