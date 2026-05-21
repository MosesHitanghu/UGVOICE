from transformers import AutoTokenizer, AutoModelForSequenceClassification

MODEL_NAME = "cardiffnlp/twitter-roberta-base-sentiment-latest"
LOCAL_MODEL_PATH = "models/twitter-roberta-sentiment"

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)

tokenizer.save_pretrained(LOCAL_MODEL_PATH)
model.save_pretrained(LOCAL_MODEL_PATH)

print("Model saved successfully.")