from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

LOCAL_MODEL_PATH = "models/twitter-roberta-sentiment"

labels = ["negative", "neutral", "positive"]

tokenizer = AutoTokenizer.from_pretrained(LOCAL_MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(LOCAL_MODEL_PATH)
model.eval()


def predict_sentiment(text: str) -> dict:
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=128
    )

    with torch.no_grad():
        outputs = model(**inputs)

    probabilities = torch.softmax(outputs.logits, dim=1)[0]
    predicted_class = torch.argmax(probabilities).item()

    return {
        "text": text,
        "sentiment": labels[predicted_class],
        "confidence": round(probabilities[predicted_class].item(), 4),
        "scores": {
            labels[i]: round(probabilities[i].item(), 4)
            for i in range(len(labels))
        }
    }