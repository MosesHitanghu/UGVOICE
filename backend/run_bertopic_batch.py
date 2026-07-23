from database import SessionLocal
from main import (
    list_feedbacks_for_topic_modeling,
    save_bertopic_results,
)
from bertopic_service import train_bertopic


def main():
    db = SessionLocal()
    try:
        feedbacks = list_feedbacks_for_topic_modeling(db)
        if len(feedbacks) < 10:
            raise SystemExit(
                "BERTopic requires at least 10 feedback records with clean_text and saved embeddings."
            )

        result = train_bertopic(feedbacks)
        issue_id_by_topic = save_bertopic_results(db, result)
        print(
            "BERTopic completed:"
            f"{len(feedbacks)} feedbacks, "
            f"{len(issue_id_by_topic)} issues, "
            f"model_version={result['model_version']}, "
            f"model_path={result['model_path']}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
