from collections import Counter
from datetime import date, datetime, time, timedelta
import json
from pathlib import Path
import random
from typing import Optional, Type
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, text
from sqlalchemy.orm import Session
#from sentiment_analysis_model import predict_sentiment_class
#from sentiment_analysis_model import predict_sentiment as get_sentiment
import db_models
from security import hash_password, verify_password
from nlp_pipeline import (
    bertopic_enabled,
    get_sentiment,
    inference_provider,
    process_feedback,
)
import hf_inference_service as hf_inference
from database import (
    drop_obsolete_messaging_tables,
    get_db,
    initialize_database,
    ensure_users_theme_colors_column,
    SessionLocal,
)
from dotenv import load_dotenv
import os
from bertopic_service import train_bertopic
from storage import (
    LOCAL_UPLOADS_DIR,
    create_presigned_upload,
    ensure_local_upload_directories,
    save_upload,
    using_local_storage,
)
load_dotenv()
HF_TOKEN = os.getenv("HF_UGVOICE_TOKEN") or os.getenv("HF_TOKEN")

if not HF_TOKEN:
    print("HF_TOKEN not found")
app = FastAPI()

TEMPORARY_SENTIMENTS = ["positive", "neutral", "negative"]
POST_REACTIONS = {"like", "dislike", "love", "celebrate", "insightful", "support"}
POST_VISIBILITY_PUBLIC = "public"
POST_VISIBILITY_PRIVATE = "private"
POST_VISIBILITY_CONSTITUENCY = "constituency"
POST_VISIBILITIES = {
    POST_VISIBILITY_PUBLIC,
    POST_VISIBILITY_PRIVATE,
    POST_VISIBILITY_CONSTITUENCY,
}
BACKEND_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = LOCAL_UPLOADS_DIR
ALLOWED_POST_ATTACHMENT_EXTENSIONS = {".pdf"}
ALLOWED_POST_THUMBNAIL_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
PERSONAL_ACCOUNT_TYPE = "personal"
LEGACY_PERSONAL_ACCOUNT_TYPES = {"individual", "personal"}
ORGANIZATION_ACCOUNT_TYPES = {"government organization"}
SUPPORTED_ACCOUNT_TYPES = {PERSONAL_ACCOUNT_TYPE, *ORGANIZATION_ACCOUNT_TYPES}
POST_CREATOR_ROLES = {"admin", "mp", "parliament", "constituency"}
DB_SETUP_TOKEN_ENV_KEYS = ("UGVOICE_DB_SETUP_TOKEN", "DB_SETUP_TOKEN")
POST_VIEW_DEDUP_WINDOW = timedelta(hours=24)
REVIEW_EDIT_WINDOW = timedelta(hours=1)



def env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def require_ml_enabled() -> None:
    if not bertopic_enabled():
        raise HTTPException(
            status_code=503,
            detail="Advanced ML analysis is disabled for this API deployment",
        )


def normalize_account_type(value: Optional[str]):
    account_type = (value or PERSONAL_ACCOUNT_TYPE).strip().lower()
    normalized_type = (
        PERSONAL_ACCOUNT_TYPE
        if account_type in LEGACY_PERSONAL_ACCOUNT_TYPES
        else account_type
    )
    if normalized_type not in SUPPORTED_ACCOUNT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Account type must be personal or government organization",
        )
    return normalized_type


def get_db_setup_token():
    for key in DB_SETUP_TOKEN_ENV_KEYS:
        token = os.getenv(key)
        if token:
            return token
    return None


configured_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,http://localhost:5174",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_origins,
    allow_credentials="*" not in configured_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

if using_local_storage():
    ensure_local_upload_directories()
    app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.on_event("startup")
def ensure_runtime_schema():
    default_schema_sync = not bool(os.getenv("DATABASE_URL") or os.getenv("VERCEL"))
    if env_flag("UGVOICE_RUN_STARTUP_SCHEMA_SYNC", default_schema_sync):
        drop_obsolete_messaging_tables()
        ensure_users_theme_colors_column()


def now_parts():
    current = datetime.now()
    return current.date(), current.time().replace(microsecond=0)


def normalize_upload_extension(filename: Optional[str]):
    if not filename:
        return ""
    return Path(filename).suffix.lower()


def build_post_viewer_key(
    viewer_user_id: Optional[int],
    viewer_key: Optional[str] = None,
):
    if viewer_user_id is not None:
        return f"user:{viewer_user_id}"

    normalized_viewer_key = (viewer_key or "").strip()
    if normalized_viewer_key:
        return f"anon:{normalized_viewer_key}"

    return None


def get_post_view_recorded_at(post_view: db_models.PostView):
    return datetime.combine(
        post_view.date_added or date.min,
        post_view.time_added or time.min,
    )


def get_review_recorded_at(review):
    return datetime.combine(
        review.date_added or date.min,
        review.time_added or time.min,
    )


def get_review_edited_at(review):
    edited_date = getattr(review, "edited_date", None)
    edited_time = getattr(review, "edited_time", None)
    if edited_date is None or edited_time is None:
        return None
    return datetime.combine(edited_date, edited_time)


def can_manage_review(review) -> bool:
    return datetime.now() - get_review_recorded_at(review) <= REVIEW_EDIT_WINDOW


def require_review_author(actor_user_id: int, author_user_id: int):
    if actor_user_id != author_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the review author can manage this review",
        )


def require_review_manage_window(review):
    if not can_manage_review(review):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Reviews can only be edited or deleted within 1 hour of submission",
        )


async def save_uploaded_post_file(
    upload,
    folder: str,
    *,
    allowed_extensions: set[str],
    max_bytes: int,
):
    if upload is None or not getattr(upload, "filename", None):
        return None

    extension = normalize_upload_extension(upload.filename)
    if extension not in allowed_extensions:
        allowed_values = ", ".join(sorted(allowed_extensions))
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type. Allowed types: {allowed_values}",
        )

    file_bytes = await upload.read()
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Uploaded file exceeds the {max_bytes // (1024 * 1024)} MB limit",
        )
    try:
        return save_upload(
            file_bytes,
            extension=extension,
            folder=folder,
            content_type=getattr(upload, "content_type", None),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Upload storage is unavailable or not configured",
        ) from exc


async def parse_post_create_payload(request: Request):
    content_type = request.headers.get("content-type", "").lower()

    if "multipart/form-data" in content_type:
        form = await request.form()
        author_user_id = form.get("author_user_id")
        if author_user_id is None:
            raise HTTPException(status_code=422, detail="author_user_id is required")

        thumbnail_path = await save_uploaded_post_file(
            form.get("thumbnail"),
            "post-thumbnails",
            allowed_extensions=ALLOWED_POST_THUMBNAIL_EXTENSIONS,
            max_bytes=int(os.getenv("MAX_THUMBNAIL_BYTES", str(5 * 1024 * 1024))),
        )
        attachment_path = await save_uploaded_post_file(
            form.get("attachment"),
            "post-attachments",
            allowed_extensions=ALLOWED_POST_ATTACHMENT_EXTENSIONS,
            max_bytes=int(os.getenv("MAX_ATTACHMENT_BYTES", str(20 * 1024 * 1024))),
        )

        return PostCreate(
            author_user_id=int(author_user_id),
            title=str(form.get("title") or "").strip(),
            content=str(form.get("content") or ""),
            category=str(form.get("category") or "").strip() or None,
            visibility=str(form.get("visibility") or "public"),
            district_id=int(form.get("district_id")) if form.get("district_id") else None,
            constituency_id=int(form.get("constituency_id")) if form.get("constituency_id") else None,
            subcounty_id=int(form.get("subcounty_id")) if form.get("subcounty_id") else None,
            parish_id=int(form.get("parish_id")) if form.get("parish_id") else None,
            thumbnail=thumbnail_path,
            attachment=attachment_path,
        )

    payload = await request.json()
    return PostCreate(**payload)


def model_to_dict(instance):
    # Return plain dictionaries and never leak stored passwords.
    payload = {
        column.name: getattr(instance, column.name)
        for column in instance.__table__.columns
    }
    payload.pop("password", None)
    return payload


def schema_dump(schema: BaseModel, *, exclude_unset: bool = False):
    # Support both Pydantic v1 and v2 style model serialization.
    if hasattr(schema, "model_dump"):
        return schema.model_dump(exclude_unset=exclude_unset)
    return schema.dict(exclude_unset=exclude_unset)


def get_or_404(db: Session, model: Type, record_id: int):
    record = db.query(model).filter(model.id == record_id).first()
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    return record


def create_record(db: Session, model: Type, payload: BaseModel | dict):
    payload_data = payload if isinstance(payload, dict) else schema_dump(payload)
    record = model(**payload_data)
    db.add(record)
    db.commit()
    db.refresh(record)
    return model_to_dict(record)


def list_records(db: Session, model: Type):
    records = db.query(model).all()
    return [model_to_dict(record) for record in records]


def list_records_ordered_by_name(db: Session, model: Type):
    records = db.query(model).order_by(model.name.asc()).all()
    return [model_to_dict(record) for record in records]


def list_records_by_field(db: Session, model: Type, field_name: str, value):
    records = db.query(model).filter(getattr(model, field_name) == value).all()
    return [model_to_dict(record) for record in records]


def update_record(db: Session, model: Type, record_id: int, payload: BaseModel):
    record = get_or_404(db, model, record_id)
    for field, value in schema_dump(payload, exclude_unset=True).items():
        setattr(record, field, value)
    db.commit()
    db.refresh(record)
    return model_to_dict(record)


def delete_record(db: Session, model: Type, record_id: int, message: str):
    record = get_or_404(db, model, record_id)
    db.delete(record)
    db.commit()
    return {"message": message}


def ensure_user_exists(db: Session, user_id: int):
    return get_or_404(db, db_models.User, user_id)


def ensure_country_exists(db: Session, country_id: int):
    return get_or_404(db, db_models.Countries, country_id)


def ensure_region_exists(db: Session, region_id: int):
    return get_or_404(db, db_models.Regions, region_id)


def ensure_district_exists(db: Session, district_id: int):
    return get_or_404(db, db_models.District, district_id)


def ensure_constituency_exists(db: Session, constituency_id: int):
    return get_or_404(db, db_models.Constituency, constituency_id)


def ensure_subcounty_exists(db: Session, subcounty_id: int):
    return get_or_404(db, db_models.Subcounty, subcounty_id)


def ensure_parish_exists(db: Session, parish_id: int):
    return get_or_404(db, db_models.Parish, parish_id)


def normalize_user_location_hierarchy(
    db: Session,
    *,
    district_id: Optional[int] = None,
    constituency_id: Optional[int] = None,
    subcounty_id: Optional[int] = None,
    parish_id: Optional[int] = None,
):
    resolved_district_id = district_id
    resolved_constituency_id = constituency_id
    resolved_subcounty_id = subcounty_id
    resolved_parish_id = parish_id

    parish = None
    if resolved_parish_id is not None:
        parish = ensure_parish_exists(db, resolved_parish_id)
        resolved_subcounty_id = resolved_subcounty_id or parish.subcounty_id

    subcounty = None
    if resolved_subcounty_id is not None:
        subcounty = ensure_subcounty_exists(db, resolved_subcounty_id)
        if parish is not None and parish.subcounty_id != subcounty.id:
            raise HTTPException(status_code=400, detail="Selected parish does not belong to the selected subcounty")
        resolved_constituency_id = resolved_constituency_id or subcounty.constituency_id

    constituency = None
    if resolved_constituency_id is not None:
        constituency = ensure_constituency_exists(db, resolved_constituency_id)
        if subcounty is not None and subcounty.constituency_id != constituency.id:
            raise HTTPException(status_code=400, detail="Selected subcounty does not belong to the selected constituency")
        resolved_district_id = resolved_district_id or constituency.district_id

    district = None
    if resolved_district_id is not None:
        district = ensure_district_exists(db, resolved_district_id)
        if constituency is not None and constituency.district_id != district.id:
            raise HTTPException(status_code=400, detail="Selected constituency does not belong to the selected district")

        region = ensure_region_exists(db, district.region_id)
        country = ensure_country_exists(db, region.country_id)
        if country.name.strip().lower() != "uganda":
            raise HTTPException(
                status_code=422,
                detail="User locations must be within Uganda",
            )

    if any(
        value is None
        for value in (
            resolved_district_id,
            resolved_constituency_id,
            resolved_subcounty_id,
            resolved_parish_id,
        )
    ):
        raise HTTPException(
            status_code=422,
            detail="District, constituency, subcounty/division, and parish are required",
        )

    return {
        "district_id": resolved_district_id,
        "constituency_id": resolved_constituency_id,
        "subcounty_id": resolved_subcounty_id,
        "parish_id": resolved_parish_id,
        "company_country": "Uganda",
        "company_city": district.name,
    }


def normalize_review_source_hierarchy(
    db: Session,
    *,
    district_id: Optional[int] = None,
    constituency_id: Optional[int] = None,
    subcounty_id: Optional[int] = None,
    parish_id: Optional[int] = None,
):
    resolved_district_id = district_id
    resolved_constituency_id = constituency_id
    resolved_subcounty_id = subcounty_id
    resolved_parish_id = parish_id

    parish = None
    if resolved_parish_id is not None:
        parish = ensure_parish_exists(db, resolved_parish_id)
        resolved_subcounty_id = resolved_subcounty_id or parish.subcounty_id

    subcounty = None
    if resolved_subcounty_id is not None:
        subcounty = ensure_subcounty_exists(db, resolved_subcounty_id)
        if parish is not None and parish.subcounty_id != subcounty.id:
            raise HTTPException(status_code=400, detail="Selected parish does not belong to the selected subcounty/division")
        resolved_constituency_id = resolved_constituency_id or subcounty.constituency_id

    if resolved_constituency_id is not None:
        constituency = ensure_constituency_exists(db, resolved_constituency_id)
        if subcounty is not None and subcounty.constituency_id != constituency.id:
            raise HTTPException(status_code=400, detail="Selected subcounty/division does not belong to the selected constituency")
        resolved_district_id = resolved_district_id or constituency.district_id

    if resolved_district_id is not None:
        district = ensure_district_exists(db, resolved_district_id)
        if resolved_constituency_id is not None:
            constituency = ensure_constituency_exists(db, resolved_constituency_id)
            if constituency.district_id != district.id:
                raise HTTPException(status_code=400, detail="Selected constituency does not belong to the selected district")

    return {
        "district_id": resolved_district_id,
        "constituency_id": resolved_constituency_id,
        "subcounty_id": resolved_subcounty_id,
        "parish_id": resolved_parish_id,
    }


def ensure_valid_company_country(db: Session, country_name: Optional[str]):
    normalized_country_name = (country_name or "Uganda").strip()
    if normalized_country_name.lower() != "uganda":
        raise HTTPException(
            status_code=422,
            detail="User country must be Uganda",
        )

    country = (
        db.query(db_models.Countries)
        .filter(func.lower(db_models.Countries.name) == normalized_country_name.lower())
        .first()
    )
    if country is None:
        raise HTTPException(status_code=400, detail="Selected country is invalid")

    return country.name


def normalize_optional_string(value: Optional[str]):
    if value is None:
        return None
    normalized_value = value.strip()
    return normalized_value or None


def normalize_post_category_name(value: Optional[str]):
    normalized_value = normalize_optional_string(value)
    if normalized_value is None:
        return None
    return " ".join(normalized_value.split())


def ensure_post_category(db: Session, category_name: Optional[str]):
    normalized_name = normalize_post_category_name(category_name)
    if normalized_name is None:
        return None

    existing = (
        db.query(db_models.PostCategory)
        .filter(func.lower(db_models.PostCategory.name) == normalized_name.lower())
        .first()
    )
    if existing:
        return existing.name

    record = db_models.PostCategory(name=normalized_name)
    db.add(record)
    db.flush()
    return record.name


def generate_share_token():
    return uuid4().hex


def can_view_user(db: Session, target_user: db_models.User, viewer_user_id: Optional[int]):
    del db
    del viewer_user_id
    return target_user.status != "deactivated"


def require_feedback_owner(viewer_user_id: Optional[int], owner_user_id: int):
    if viewer_user_id != owner_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This resource is only visible to the feedback owner",
        )


def require_admin_user(db: Session, actor_user_id: int):
    user = ensure_user_exists(db, actor_user_id)
    if (user.role or "").lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only an admin can run this operation",
        )
    return user


def authorize_database_admin_action(
    db: Session,
    *,
    actor_user_id: Optional[int] = None,
    setup_token: Optional[str] = None,
):
    expected_setup_token = get_db_setup_token()
    if expected_setup_token and setup_token == expected_setup_token:
        return None

    if db.query(db_models.User).count() == 0:
        return None

    if actor_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An admin actor_user_id or valid setup token is required",
        )

    return require_admin_user(db, actor_user_id)


def normalize_role_name(role: Optional[str]):
    return (role or "").strip().lower()


def normalize_country_name(country: Optional[str]):
    return (country or "").strip().lower()


def require_user_moderation_actor(
    db: Session,
    *,
    actor_user_id: int,
    target_user: db_models.User,
):
    actor = ensure_user_exists(db, actor_user_id)
    actor_role = normalize_role_name(actor.role)

    if actor_role == "admin":
        return actor

    if actor_role == "parliament":
        actor_country = normalize_country_name(actor.company_country)
        target_country = normalize_country_name(target_user.company_country)
        if actor_country and actor_country == target_country:
            return actor

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to manage this user",
    )


def is_personal_account(user: db_models.User):
    return normalize_account_type(user.type) == PERSONAL_ACCOUNT_TYPE


def is_government_organization_account(user: db_models.User):
    return (user.type or "").strip().lower() == "government organization"


def assign_user_role_with_rules(db: Session, target_user: db_models.User, next_role: str):
    current_role = normalize_role_name(target_user.role)
    normalized_next_role = normalize_role_name(next_role)

    if current_role == normalized_next_role:
        target_user.role = "standard"
        return

    if normalized_next_role == "mp":
        if not is_personal_account(target_user):
            raise HTTPException(
                status_code=400,
                detail="Only personal accounts can be flagged as MPs",
            )
        target_user.role = "MP"
        return

    if normalized_next_role == "constituency":
        if not is_government_organization_account(target_user):
            raise HTTPException(
                status_code=400,
                detail="Only government organization accounts can be flagged as Constituency",
            )
        target_user.role = "Constituency"
        return

    if normalized_next_role == "parliament":
        if not is_government_organization_account(target_user):
            raise HTTPException(
                status_code=400,
                detail="Only government organization accounts can be flagged as Parliament",
            )
        country = normalize_country_name(target_user.company_country)
        if not country:
            raise HTTPException(
                status_code=400,
                detail="A Parliament account must have a country",
            )
        existing_parliament = (
            db.query(db_models.User)
            .filter(func.lower(db_models.User.role) == "parliament")
            .filter(func.lower(db_models.User.company_country) == country)
            .filter(db_models.User.id != target_user.id)
            .first()
        )
        if existing_parliament is not None:
            raise HTTPException(
                status_code=409,
                detail="Only one Parliament account is allowed per country",
            )
        target_user.role = "Parliament"
        return

    raise HTTPException(status_code=400, detail="Unsupported user role")


def predict_sentiment_label(text: str):
    return get_sentiment(text)["sentiment"]


def add_predicted_sentiment(payload: dict, *text_keys: str):
    text = " ".join(
        str(payload.get(key) or "").strip()
        for key in text_keys
        if str(payload.get(key) or "").strip()
    )
    if text:
        payload["sentiment"] = predict_sentiment_label(text)
    return payload


def add_feedback_analysis_fields(payload: dict):
    text = " ".join(
        str(payload.get(key) or "").strip()
        for key in ("title", "description")
        if str(payload.get(key) or "").strip()
    )
    if not text:
        return payload

    try:
        analysis = process_feedback(text)
    except Exception:
        add_predicted_sentiment(payload, "title", "description")
        return payload

    payload["clean_text"] = analysis.get("clean_text")
    payload["summary"] = analysis.get("summary")
    payload["sentiment"] = analysis.get("sentiment")
    payload["sentiment_confidence"] = analysis.get("sentiment_confidence")
    payload["sentiment_score"] = json.dumps(analysis.get("sentiment_scores") or {})
    payload["embending"] = json.dumps(analysis.get("embedding") or [])
    payload["embedding_model"] = analysis.get("embedding_model")
    payload["summar_model"] = analysis.get("summary_model")
    payload["sentiment_model"] = analysis.get("sentiment_model")
    payload["inference_provider"] = analysis.get("inference_provider")
    payload["inference_mode"] = analysis.get("inference_mode")
    payload["inference_fallback_used"] = analysis.get("inference_fallback_used")
    payload["inference_fallback_tasks"] = json.dumps(
        analysis.get("inference_fallback_tasks") or []
    )
    payload["inference_latency_ms"] = analysis.get("inference_latency_ms")
    return payload


def add_feedback_defaults(payload: dict):
    add_feedback_analysis_fields(payload)
    payload["status"] = payload.get("status") or "pending"
    return payload


def add_date_time_defaults(payload: dict, date_key: str = "date_added", time_key: str = "time_added"):
    current_date, current_time = now_parts()
    payload.setdefault(date_key, current_date)
    payload.setdefault(time_key, current_time)
    return payload


def ensure_user_identity_available(
    db: Session,
    *,
    email: Optional[str],
    username: Optional[str],
    mobile_number: Optional[str],
    excluding_user_id: Optional[int] = None,
):
    email = normalize_optional_string(email)
    username = normalize_optional_string(username)
    mobile_number = normalize_optional_string(mobile_number)

    if email:
        query = db.query(db_models.User).filter(
            func.lower(db_models.User.email) == email.lower()
        )
        if excluding_user_id is not None:
            query = query.filter(db_models.User.id != excluding_user_id)
        if query.first():
            raise HTTPException(status_code=400, detail="Email already exists")

    if username:
        query = db.query(db_models.User).filter(
            func.lower(db_models.User.username) == username.lower()
        )
        if excluding_user_id is not None:
            query = query.filter(db_models.User.id != excluding_user_id)
        if query.first():
            raise HTTPException(status_code=400, detail="Username already exists")

    if mobile_number:
        query = db.query(db_models.User).filter(db_models.User.mobile_number == mobile_number)
        if excluding_user_id is not None:
            query = query.filter(db_models.User.id != excluding_user_id)
        if query.first():
            raise HTTPException(status_code=400, detail="Mobile number already exists")


def check_identity_availability(
    db: Session,
    *,
    username: Optional[str] = None,
    email: Optional[str] = None,
    mobile_number: Optional[str] = None,
):
    result: dict[str, object] = {}

    if username is not None:
        normalized_username = normalize_optional_string(username) or ""
        available = (
            db.query(db_models.User)
            .filter(func.lower(db_models.User.username) == normalized_username.lower())
            .first()
            is None
        )
        result["username"] = {
            "value": normalized_username,
            "available": available,
            "message": "Username is available" if available else "Username is already taken",
        }

    if email is not None:
        normalized_email = normalize_optional_string(email) or ""
        available = (
            db.query(db_models.User)
            .filter(func.lower(db_models.User.email) == normalized_email.lower())
            .first()
            is None
        )
        result["email"] = {
            "value": normalized_email,
            "available": available,
            "message": (
                "No account is associated with this email address"
                if available
                else "An account is already associated with this email address"
            ),
        }

    if mobile_number is not None:
        normalized_mobile_number = normalize_optional_string(mobile_number) or ""
        available = (
            db.query(db_models.User)
            .filter(db_models.User.mobile_number == normalized_mobile_number)
            .first()
            is None
        )
        result["mobile_number"] = {
            "value": normalized_mobile_number,
            "available": available,
            "message": (
                "No account is associated with this mobile number"
                if available
                else "An account is already associated with this mobile number"
            ),
        }

    return result


def resolve_parent_user_id(
    db: Session,
    *,
    parent_user_id: Optional[int] = None,
    owner_email: Optional[str] = None,
):
    resolved_parent_user_id = parent_user_id

    if resolved_parent_user_id is None and owner_email:
        owner = (
            db.query(db_models.User)
            .filter(func.lower(db_models.User.email) == owner_email.strip().lower())
            .first()
        )
        if owner is None:
            raise HTTPException(
                status_code=400,
                detail="No personal account matches the owner email address",
            )
        resolved_parent_user_id = owner.id

    if resolved_parent_user_id is None:
        return None

    parent_user = ensure_user_exists(db, resolved_parent_user_id)
    if normalize_account_type(parent_user.type) != PERSONAL_ACCOUNT_TYPE:
        raise HTTPException(
            status_code=400,
            detail="Organization child accounts must belong to a personal account",
        )

    return parent_user.id


def build_signup_payload(db: Session, user: "SignupRequest"):
    account_type = normalize_account_type(user.type)
    if account_type not in {PERSONAL_ACCOUNT_TYPE, *ORGANIZATION_ACCOUNT_TYPES}:
        raise HTTPException(status_code=400, detail="Unsupported account type")

    payload = {
        **schema_dump(user),
        "username": normalize_optional_string(user.username),
        "email": normalize_optional_string(user.email),
        "mobile_number": normalize_optional_string(user.mobile_number),
        "password": hash_password(user.password),
        "role": "standard",
        "status": "active",
        "type": account_type,
        "visibility": user.visibility or "public",
        "company_country": ensure_valid_company_country(db, user.company_country),
    }
    payload.update(
        normalize_user_location_hierarchy(
            db,
            district_id=user.district_id,
            constituency_id=user.constituency_id,
            subcounty_id=user.subcounty_id,
            parish_id=user.parish_id,
        )
    )

    if account_type == PERSONAL_ACCOUNT_TYPE:
        if not user.fname or not user.fname.strip():
            raise HTTPException(status_code=400, detail="First name is required")
        if not user.lname or not user.lname.strip():
            raise HTTPException(status_code=400, detail="Last name is required")

        payload["fname"] = normalize_optional_string(user.fname)
        payload["lname"] = normalize_optional_string(user.lname)
        payload["company_name"] = None
        payload["type_of_business"] = None
        payload["number_of_employees"] = None
        payload["parent_user_id"] = None
        return payload

    if not user.company_name or not user.company_name.strip():
        raise HTTPException(status_code=400, detail="Organization name is required")

    payload["company_name"] = normalize_optional_string(user.company_name)
    payload["fname"] = None
    payload["lname"] = None
    payload["gender"] = None
    payload["parent_user_id"] = resolve_parent_user_id(
        db,
        parent_user_id=user.parent_user_id,
    )

    return payload


def get_user_snippet(db: Session, user_id: int):
    user = get_or_404(db, db_models.User, user_id)
    return {
        "id": user.id,
        "username": user.username,
        "fname": user.fname,
        "lname": user.lname,
        "company_name": user.company_name,
        "profile_picture": user.profile_picture,
        "visibility": user.visibility,
        "role": user.role,
        "verification_status": user.verification_status,
    }


def user_snippet_from_record(user: Optional[db_models.User]):
    if user is None:
        return None

    return {
        "id": user.id,
        "username": user.username,
        "fname": user.fname,
        "lname": user.lname,
        "company_name": user.company_name,
        "profile_picture": user.profile_picture,
        "visibility": user.visibility,
        "role": user.role,
        "verification_status": user.verification_status,
    }


def can_view_post(
    db: Session,
    post: db_models.Post,
    viewer_user_id: Optional[int],
    shared_token: Optional[str] = None,
):
    visibility = post.visibility or POST_VISIBILITY_PUBLIC
    if visibility == POST_VISIBILITY_PUBLIC:
        return True

    if post.author_user_id == viewer_user_id:
        return True

    if visibility == POST_VISIBILITY_PRIVATE:
        return bool(shared_token and post.share_token and shared_token == post.share_token)

    if visibility == POST_VISIBILITY_CONSTITUENCY and viewer_user_id is not None:
        viewer = db.query(db_models.User).filter(db_models.User.id == viewer_user_id).first()
        author = db.query(db_models.User).filter(db_models.User.id == post.author_user_id).first()
        return bool(
            viewer
            and author
            and viewer.constituency_id is not None
            and viewer.constituency_id == author.constituency_id
        )

    return False


def get_viewer_constituency_id(db: Session, viewer_user_id: Optional[int]):
    if viewer_user_id is None:
        return None
    viewer = db.query(db_models.User).filter(db_models.User.id == viewer_user_id).first()
    return viewer.constituency_id if viewer else None


def visible_post_filter_for_viewer(db: Session, viewer_user_id: Optional[int]):
    filters = [db_models.Post.visibility == POST_VISIBILITY_PUBLIC]

    if viewer_user_id is not None:
        filters.append(db_models.Post.author_user_id == viewer_user_id)
        viewer_constituency_id = get_viewer_constituency_id(db, viewer_user_id)
        if viewer_constituency_id is not None:
            filters.append(
                and_(
                    db_models.Post.visibility == POST_VISIBILITY_CONSTITUENCY,
                    db_models.User.constituency_id == viewer_constituency_id,
                )
            )

    return or_(*filters)


def ensure_author_can_use_post_visibility(author: db_models.User, visibility: str):
    if visibility == POST_VISIBILITY_CONSTITUENCY and author.constituency_id is None:
        raise HTTPException(
            status_code=422,
            detail="The post author must have a constituency to use My constituency visibility",
        )


def ensure_author_can_create_post(author: db_models.User):
    if (author.role or "").strip().lower() not in POST_CREATOR_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only MPs, Parliament, Constituency, and Admin accounts can create posts",
        )


def require_post_author(actor_user_id: int, post: db_models.Post):
    if actor_user_id != post.author_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the post author can manage this post",
        )


def can_switch_between_accounts(
    actor_user: db_models.User,
    target_user: db_models.User,
):
    if actor_user.id == target_user.id:
        return True

    return target_user.parent_user_id == actor_user.id


def build_post_reaction_summary(db: Session, post_id: int):
    reactions = db.query(db_models.PostReaction).filter(db_models.PostReaction.post_id == post_id).all()
    counts = Counter(reaction.reaction_type for reaction in reactions)
    return {
        "total": len(reactions),
        "counts": {reaction_type: counts.get(reaction_type, 0) for reaction_type in sorted(POST_REACTIONS)},
    }


def build_post_review_payload(db: Session, review: db_models.PostReview):
    payload = model_to_dict(review)
    payload["author"] = get_user_snippet(db, review.author_user_id)
    payload["is_edited"] = get_review_edited_at(review) is not None
    payload["can_edit"] = can_manage_review(review)
    payload["can_delete"] = can_manage_review(review)
    return payload


def build_post_payload(db: Session, post: db_models.Post, viewer_user_id: Optional[int]):
    payload = model_to_dict(post)
    payload["author"] = get_user_snippet(db, post.author_user_id)
    payload["review_count"] = db.query(db_models.PostReview).filter(db_models.PostReview.post_id == post.id).count()
    payload["reaction_summary"] = build_post_reaction_summary(db, post.id)
    if viewer_user_id is not None:
        viewer_reaction = (
            db.query(db_models.PostReaction)
            .filter(db_models.PostReaction.post_id == post.id)
            .filter(db_models.PostReaction.user_id == viewer_user_id)
            .first()
        )
        payload["viewer_reaction"] = viewer_reaction.reaction_type if viewer_reaction else None
        payload["viewer_has_reviewed"] = (
            db.query(db_models.PostReview)
            .filter(db_models.PostReview.post_id == post.id)
            .filter(db_models.PostReview.author_user_id == viewer_user_id)
            .first()
            is not None
        )
    else:
        payload["viewer_reaction"] = None
        payload["viewer_has_reviewed"] = False
    if viewer_user_id == post.author_user_id and post.visibility == "private" and post.share_token:
        payload["share_url"] = f"/shared-post/{post.id}?token={post.share_token}"
    else:
        payload.pop("share_token", None)
        payload["share_url"] = None
    return payload


def build_post_analytics(db: Session, post_id: int):
    post = get_or_404(db, db_models.Post, post_id)
    reviews_count = db.query(db_models.PostReview).filter(db_models.PostReview.post_id == post.id).count()
    reactions = db.query(db_models.PostReaction).filter(db_models.PostReaction.post_id == post.id).all()
    reaction_counts = Counter(reaction.reaction_type for reaction in reactions)
    sentiment_breakdown = {
        "positive": (
            reaction_counts.get("like", 0)
            + reaction_counts.get("love", 0)
            + reaction_counts.get("celebrate", 0)
            + reaction_counts.get("support", 0)
        ),
        "negative": reaction_counts.get("dislike", 0),
        # Temporary proxy until post-level sentiment analysis is available.
        "neutral": reaction_counts.get("insightful", 0) + reviews_count,
    }
    return {
        "post_id": post.id,
        "visibility": post.visibility,
        "total_reviews": reviews_count,
        "total_reactions": len(reactions),
        "reactions": {reaction_type: reaction_counts.get(reaction_type, 0) for reaction_type in sorted(POST_REACTIONS)},
        "sentiment_breakdown": sentiment_breakdown,
    }


def build_post_detail_payload(
    db: Session,
    post: db_models.Post,
    viewer_user_id: Optional[int],
    *,
    review_limit: int = 8,
    review_offset: int = 0,
):
    payload = build_post_payload(db, post, viewer_user_id)
    reviews_query = (
        db.query(db_models.PostReview)
        .filter(db_models.PostReview.post_id == post.id)
        .order_by(db_models.PostReview.date_added.desc(), db_models.PostReview.time_added.desc())
    )
    reviews = reviews_query.offset(review_offset).limit(review_limit).all()
    payload["reviews"] = [build_post_review_payload(db, review) for review in reviews]
    payload["analytics"] = build_post_analytics(db, post.id)
    return payload


def visible_users_for_viewer(db: Session, viewer_user_id: Optional[int], query: Optional[str] = None):
    del viewer_user_id
    users_query = db.query(db_models.User).filter(db_models.User.status != "deactivated")
    if query:
        search_term = f"%{query.lower()}%"
        users_query = users_query.filter(
            or_(
                db_models.User.username.ilike(search_term),
                db_models.User.fname.ilike(search_term),
                db_models.User.lname.ilike(search_term),
                db_models.User.email.ilike(search_term),
                db_models.User.company_name.ilike(search_term),
            )
        )
    return users_query.order_by(db_models.User.id.asc())


def paginated_visible_users_for_viewer(
    db: Session,
    viewer_user_id: Optional[int],
    query: Optional[str] = None,
    *,
    limit: int = 20,
    offset: int = 0,
):
    records = visible_users_for_viewer(db, viewer_user_id, query).offset(offset).limit(limit).all()
    return [model_to_dict(record) for record in records]


def visible_posts_for_viewer(
    db: Session,
    viewer_user_id: Optional[int],
    query: Optional[str] = None,
    scope: str = "visible",
):
    posts_query = db.query(db_models.Post).join(
        db_models.User,
        db_models.User.id == db_models.Post.author_user_id,
    )

    if scope == "public":
        posts_query = posts_query.filter(db_models.Post.visibility == POST_VISIBILITY_PUBLIC)
    elif scope == "own":
        if viewer_user_id is None:
            posts_query = posts_query.filter(db_models.Post.id == -1)
        else:
            posts_query = posts_query.filter(db_models.Post.author_user_id == viewer_user_id)
    else:
        posts_query = posts_query.filter(visible_post_filter_for_viewer(db, viewer_user_id))

    if query:
        search_terms = [term.strip() for term in query.split() if term.strip()]
        if search_terms:
            posts_query = posts_query.filter(
                and_(
                    *[
                        or_(
                            db_models.Post.title.ilike(f"%{term}%"),
                            db_models.Post.content.ilike(f"%{term}%"),
                            db_models.User.username.ilike(f"%{term}%"),
                            db_models.User.fname.ilike(f"%{term}%"),
                            db_models.User.lname.ilike(f"%{term}%"),
                        )
                        for term in search_terms
                    ]
                )
            )

    return posts_query


def post_timestamp_sort_parts(post: db_models.Post):
    return (
        post.date_added or date.min,
        post.time_added or time.min,
        post.id,
    )


def post_featured_score(db: Session, post: db_models.Post):
    review_count = db.query(db_models.PostReview).filter(db_models.PostReview.post_id == post.id).count()
    reaction_total = db.query(db_models.PostReaction).filter(db_models.PostReaction.post_id == post.id).count()
    return (reaction_total * 2) + (review_count * 3), reaction_total, review_count


def sort_posts(
    db: Session,
    posts: list[db_models.Post],
    sort: str,
):
    if sort == "latest":
        return sorted(posts, key=post_timestamp_sort_parts, reverse=True)

    if sort == "featured":
        return sorted(
            posts,
            key=lambda post: (*post_featured_score(db, post), *post_timestamp_sort_parts(post)),
            reverse=True,
        )

    return sorted(
        posts,
        key=lambda post: (*post_featured_score(db, post), *post_timestamp_sort_parts(post)),
        reverse=True,
    )


def paginated_visible_posts_for_viewer(
    db: Session,
    viewer_user_id: Optional[int],
    query: Optional[str] = None,
    *,
    scope: str = "visible",
    sort: str = "default",
    limit: int = 20,
    offset: int = 0,
):
    records = visible_posts_for_viewer(db, viewer_user_id, query, scope).all()
    sorted_records = sort_posts(db, records, sort)
    paginated_records = sorted_records[offset : offset + limit]
    return [build_post_payload(db, record, viewer_user_id) for record in paginated_records]


def list_feedbacks_for_analysis(db: Session, user_id: int, start_date: date, end_date: date):
    records = (
        db.query(db_models.Feedback)
        .filter(db_models.Feedback.target_user_id == user_id)
        .filter(db_models.Feedback.date_added >= start_date)
        .filter(db_models.Feedback.date_added <= end_date)
        .filter(db_models.Feedback.status != "analysed")
        .all()
    )
    return [model_to_dict(record) for record in records]


def list_reviews_for_topic(db: Session, topic_id: int):
    records = db.query(db_models.Review).filter(db_models.Review.topic_id == topic_id).all()
    payloads = []
    for record in records:
        payload = model_to_dict(record)
        payload["is_edited"] = get_review_edited_at(record) is not None
        payload["can_edit"] = can_manage_review(record)
        payload["can_delete"] = can_manage_review(record)
        payloads.append(payload)
    return payloads


def get_submitted_feedback_summary_for_user(db: Session, user_id: int):
    ensure_user_exists(db, user_id)
    return {
        "feedbacks": list_records_by_field(db, db_models.Feedback, "author_user_id", user_id),
    }


def get_received_feedback_summary_for_user(db: Session, user_id: int):
    ensure_user_exists(db, user_id)
    return {
        "feedbacks": list_records_by_field(db, db_models.Feedback, "target_user_id", user_id),
    }


def get_user_resources(db: Session, user_id: int):
    user_record = get_or_404(db, db_models.User, user_id)
    own_posts = (
        db.query(db_models.Post)
        .filter(db_models.Post.author_user_id == user_id)
        .order_by(db_models.Post.date_added.desc(), db_models.Post.time_added.desc())
        .all()
    )
    return {
        "user": model_to_dict(user_record),
        "topics": list_records_by_field(db, db_models.Topics, "author_id", user_id),
        "subscriptions": list_records_by_field(db, db_models.Subscription, "user_id", user_id),
        "feedbacks": {
            "submitted": list_records_by_field(db, db_models.Feedback, "author_user_id", user_id),
            "received": list_records_by_field(db, db_models.Feedback, "target_user_id", user_id),
        },
        "posts": [build_post_payload(db, post, user_id) for post in own_posts],
        "emerging_issues": list_records_by_field(db, db_models.EmergingIssue, "user_id", user_id),
    }


def age_range_for_dob(dob: Optional[date]):
    if dob is None:
        return "Unknown"

    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    if age < 18:
        return "Under 18"
    if age < 25:
        return "18-24"
    if age < 35:
        return "25-34"
    if age < 45:
        return "35-44"
    if age < 55:
        return "45-54"
    if age < 65:
        return "55-64"
    return "65+"


AGE_GROUP_ORDER = ["Under 18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+", "Unknown"]
GENDER_ORDER = ["Female", "Male", "Non-Binary", "Other", "Unspecified"]
SENTIMENT_ORDER = ["Positive", "Neutral", "Negative", "Unknown"]
VISIBLE_SENTIMENT_ORDER = ["Positive", "Neutral", "Negative"]


def format_sentiment_label(sentiment: Optional[str]):
    normalized = (sentiment or "").strip().lower()
    if not normalized:
        return "Unknown"
    return normalized.title()


def format_gender_label(gender: Optional[str]):
    normalized = (gender or "").strip()
    if not normalized:
        return "Unspecified"
    lowered = normalized.lower()
    if lowered in {"non-binary", "non binary"}:
        return "Non-Binary"
    if lowered in {"male", "female"}:
        return lowered.title()
    return normalized.title()


def counter_to_chart_data(counter: Counter, *, order: Optional[list[str]] = None, include_zeroes: bool = False):
    chart_data = []
    seen = set()

    for label in order or []:
        value = counter.get(label, 0)
        if include_zeroes or value > 0:
            chart_data.append({"label": label, "value": value})
        seen.add(label)

    for label in sorted(counter.keys()):
        if label in seen:
            continue
        value = counter[label]
        if include_zeroes or value > 0:
            chart_data.append({"label": label, "value": value})

    return chart_data


def sentiment_counter_to_chart_data(counter: Counter):
    return counter_to_chart_data(
        Counter({label: counter.get(label, 0) for label in VISIBLE_SENTIMENT_ORDER}),
        order=VISIBLE_SENTIMENT_ORDER,
        include_zeroes=True,
    )


def dominant_binary_sentiment(counter: Counter):
    positive_count = counter.get("Positive", 0)
    negative_count = counter.get("Negative", 0)
    if positive_count == 0 and negative_count == 0:
        return "Unknown"
    return "Positive" if positive_count > negative_count else "Negative"


def dominant_counter_value(counter: Counter):
    candidates = [(key, value) for key, value in counter.items() if key is not None and value > 0]
    if not candidates:
        return None
    return sorted(candidates, key=lambda item: (-item[1], item[0]))[0][0]


def priority_for_feedback_count(feedback_count: int):
    if feedback_count >= 25:
        return "High"
    if feedback_count >= 10:
        return "Medium"
    return "Low"


def get_location_reference_maps(db: Session):
    regions = db.query(db_models.Regions).all()
    districts = db.query(db_models.District).all()
    constituencies = db.query(db_models.Constituency).all()
    subcounties = db.query(db_models.Subcounty).all()
    parishes = db.query(db_models.Parish).all()

    return {
        "region_names": {record.id: record.name for record in regions},
        "region_country": {record.id: record.country_id for record in regions},
        "district_names": {record.id: record.name for record in districts},
        "district_region": {record.id: record.region_id for record in districts},
        "constituency_names": {record.id: record.name for record in constituencies},
        "constituency_district": {record.id: record.district_id for record in constituencies},
        "subcounty_names": {record.id: record.name for record in subcounties},
        "parish_names": {record.id: record.name for record in parishes},
        "subcounty_constituency": {record.id: record.constituency_id for record in subcounties},
        "parish_subcounty": {record.id: record.subcounty_id for record in parishes},
    }


def build_user_profile_analytics_header(db: Session, user: db_models.User, location_maps: dict):
    district_names = location_maps["district_names"]
    constituency_names = location_maps["constituency_names"]
    subcounty_names = location_maps["subcounty_names"]
    parish_names = location_maps["parish_names"]

    return {
        "id": user.id,
        "username": user.username,
        "fname": user.fname,
        "lname": user.lname,
        "company_name": user.company_name,
        "email": user.email,
        "type": user.type,
        "visibility": user.visibility,
        "gender": user.gender,
        "profile_picture": user.profile_picture,
        "district_id": user.district_id,
        "district_name": district_names.get(user.district_id),
        "constituency_id": user.constituency_id,
        "constituency_name": constituency_names.get(user.constituency_id),
        "subcounty_id": user.subcounty_id,
        "subcounty_name": subcounty_names.get(user.subcounty_id),
        "parish_id": user.parish_id,
        "parish_name": parish_names.get(user.parish_id),
    }


def build_feedback_payload(db: Session, feedback: db_models.Feedback):
    payload = model_to_dict(feedback)
    payload["author"] = get_user_snippet(db, feedback.author_user_id)
    payload["target"] = get_user_snippet(db, feedback.target_user_id)
    return payload


def build_profile_post_analytics(
    db: Session,
    user: db_models.User,
    post: db_models.Post,
    *,
    reviews_by_post_id: dict[int, list[db_models.PostReview]],
    reactions_by_post_id: dict[int, list[db_models.PostReaction]],
    user_by_id: dict[int, db_models.User],
    location_maps: dict,
):
    reviews = reviews_by_post_id.get(post.id, [])
    reactions = reactions_by_post_id.get(post.id, [])
    review_authors = [user_by_id[review.author_user_id] for review in reviews if review.author_user_id in user_by_id]

    review_sentiment_counter = Counter(format_sentiment_label(getattr(review, "sentiment", None)) for review in reviews)
    reaction_counter = Counter(reaction.reaction_type for reaction in reactions)
    sentiment_counter = Counter(review_sentiment_counter)
    sentiment_counter["Positive"] += (
        reaction_counter.get("like", 0)
        + reaction_counter.get("love", 0)
        + reaction_counter.get("celebrate", 0)
        + reaction_counter.get("support", 0)
    )
    sentiment_counter["Negative"] += reaction_counter.get("dislike", 0)
    sentiment_counter["Neutral"] += reaction_counter.get("insightful", 0)
    if not reviews and not reactions:
        sentiment_counter["Neutral"] = 0

    gender_counter = Counter(format_gender_label(author.gender) for author in review_authors)
    age_group_counter = Counter(age_range_for_dob(author.dob) for author in review_authors)

    subcounty_names = location_maps["subcounty_names"]
    parish_names = location_maps["parish_names"]
    parish_subcounty = location_maps["parish_subcounty"]
    subcounty_constituency = location_maps["subcounty_constituency"]

    subcounty_counter = Counter()
    parish_counter = Counter()
    for review in reviews:
        resolved_subcounty_id = review.subcounty_id
        if resolved_subcounty_id is None and review.parish_id is not None:
            resolved_subcounty_id = parish_subcounty.get(review.parish_id)

        if resolved_subcounty_id is not None:
            if user.constituency_id is None or subcounty_constituency.get(resolved_subcounty_id) == user.constituency_id:
                subcounty_counter[subcounty_names.get(resolved_subcounty_id, "Unspecified")] += 1

        if review.parish_id is not None:
            parish_counter[parish_names.get(review.parish_id, "Unspecified")] += 1

    post_payload = build_post_payload(db, post, user.id)
    total_reviews = len(reviews)
    total_reactions = len(reactions)
    total_views = post.view_count or 0
    unique_reviewers = len({review.author_user_id for review in reviews})
    engagement_score = (total_reviews * 3) + (total_reactions * 2) + total_views

    return {
        "post": post_payload,
        "performance": {
            "total_reviews": total_reviews,
            "total_reactions": total_reactions,
            "total_views": total_views,
            "unique_reviewers": unique_reviewers,
            "engagement_score": engagement_score,
            "average_reactions_per_review": round(total_reactions / total_reviews, 2) if total_reviews else 0,
        },
        "charts": {
            "sentiments": sentiment_counter_to_chart_data(sentiment_counter),
            "distributions": {
                "gender": counter_to_chart_data(gender_counter, order=GENDER_ORDER, include_zeroes=True),
                "age_groups": counter_to_chart_data(age_group_counter, order=AGE_GROUP_ORDER, include_zeroes=True),
                "subcounty": counter_to_chart_data(subcounty_counter),
                "parishes": counter_to_chart_data(parish_counter),
            },
        },
    }


def build_profile_analytics_payload(db: Session, user_id: int):
    user = ensure_user_exists(db, user_id)
    location_maps = get_location_reference_maps(db)

    posts = (
        db.query(db_models.Post)
        .filter(db_models.Post.author_user_id == user_id)
        .order_by(db_models.Post.date_added.desc(), db_models.Post.time_added.desc(), db_models.Post.id.desc())
        .all()
    )
    post_ids = [post.id for post in posts]

    post_reviews = []
    post_reactions = []
    if post_ids:
        post_reviews = (
            db.query(db_models.PostReview)
            .filter(db_models.PostReview.post_id.in_(post_ids))
            .order_by(db_models.PostReview.date_added.desc(), db_models.PostReview.time_added.desc())
            .all()
        )
        post_reactions = db.query(db_models.PostReaction).filter(db_models.PostReaction.post_id.in_(post_ids)).all()

    reviews_by_post_id: dict[int, list[db_models.PostReview]] = {}
    for review in post_reviews:
        reviews_by_post_id.setdefault(review.post_id, []).append(review)

    reactions_by_post_id: dict[int, list[db_models.PostReaction]] = {}
    for reaction in post_reactions:
        reactions_by_post_id.setdefault(reaction.post_id, []).append(reaction)

    review_author_ids = sorted({review.author_user_id for review in post_reviews})
    users_for_reviews = []
    if review_author_ids:
        users_for_reviews = db.query(db_models.User).filter(db_models.User.id.in_(review_author_ids)).all()
    user_by_id = {record.id: record for record in users_for_reviews}

    post_analytics = [
        build_profile_post_analytics(
            db,
            user,
            post,
            reviews_by_post_id=reviews_by_post_id,
            reactions_by_post_id=reactions_by_post_id,
            user_by_id=user_by_id,
            location_maps=location_maps,
        )
        for post in posts
    ]

    latest_post_analytics = post_analytics[0] if post_analytics else None
    feedbacks = (
        db.query(db_models.Feedback)
        .filter(db_models.Feedback.target_user_id == user_id)
        .order_by(db_models.Feedback.date_added.desc(), db_models.Feedback.time_added.desc(), db_models.Feedback.id.desc())
        .all()
    )
    emerging_issues = (
        db.query(db_models.EmergingIssue)
        .filter(db_models.EmergingIssue.user_id == user_id)
        .order_by(db_models.EmergingIssue.date_added.desc(), db_models.EmergingIssue.time_added.desc(), db_models.EmergingIssue.id.desc())
        .all()
    )
    modeled_emerging_issues = build_user_modeled_issue_payloads(db, user_id)

    feedback_sentiments = Counter(format_sentiment_label(feedback.sentiment) for feedback in feedbacks)
    feedback_status = Counter((feedback.status or "Pending").title() for feedback in feedbacks)
    issue_status = Counter((issue.status or "Open").title() for issue in emerging_issues)
    issue_priority = Counter((issue.priority_level or "Unspecified").title() for issue in emerging_issues)

    total_reviews = sum(len(reviews) for reviews in reviews_by_post_id.values())
    total_reactions = len(post_reactions)
    total_views = sum(post.view_count or 0 for post in posts)
    avg_reviews_per_post = round(total_reviews / len(posts), 2) if posts else 0
    reviewed_posts = sum(1 for reviews in reviews_by_post_id.values() if reviews)

    feedback_payloads = [build_feedback_payload(db, feedback) for feedback in feedbacks]

    return {
        "profile": build_user_profile_analytics_header(db, user, location_maps),
        "reviews": {
            "summary": {
                "posts_authored": len(posts),
                "reviewed_posts": reviewed_posts,
                "total_reviews": total_reviews,
                "total_reactions": total_reactions,
                "total_views": total_views,
                "average_reviews_per_post": avg_reviews_per_post,
            },
            "selected_post_id": latest_post_analytics["post"]["id"] if latest_post_analytics else None,
            "latest_post": latest_post_analytics,
            "posts": post_analytics,
        },
        "feedbacks": {
            "summary": {
                "total_feedbacks": len(feedbacks),
                "pending_feedbacks": sum(
                    1 for feedback in feedbacks if (feedback.status or "pending").lower() == "pending"
                ),
                "analysed_feedbacks": sum(
                    1 for feedback in feedbacks if (feedback.status or "").lower() == "analysed"
                ),
                "open_emerging_issues": sum(
                    1 for issue in emerging_issues if (issue.status or "open").lower() != "resolved"
                ),
                "resolved_emerging_issues": sum(
                    1 for issue in emerging_issues if (issue.status or "").lower() == "resolved"
                ),
            },
            "charts": {
                "sentiments": sentiment_counter_to_chart_data(feedback_sentiments),
                "status": counter_to_chart_data(feedback_status),
                "issue_status": counter_to_chart_data(issue_status),
                "issue_priority": counter_to_chart_data(issue_priority),
            },
            "feedbacks": feedback_payloads,
            "emerging_issues": modeled_emerging_issues or [model_to_dict(issue) for issue in emerging_issues[:8]],
        },
    }


def resolve_user_country_id(db: Session, user: Optional[db_models.User], location_maps: dict):
    if user is None:
        return None

    location = user_location_scope(user, location_maps)
    if location["country_id"] is not None:
        return location["country_id"]

    company_country = (user.company_country or "").strip()
    if not company_country:
        return None

    country = (
        db.query(db_models.Countries)
        .filter(func.lower(db_models.Countries.name) == company_country.lower())
        .first()
    )
    return country.id if country is not None else None


def build_country_modeled_issue_payloads(
    db: Session,
    *,
    country_id: Optional[int],
    location_maps: dict,
    limit: int = 250,
):
    if country_id is None:
        return []

    feedbacks = (
        db.query(db_models.Feedback)
        .filter(db_models.Feedback.issue_id.isnot(None))
        .order_by(db_models.Feedback.date_added.desc(), db_models.Feedback.time_added.desc(), db_models.Feedback.id.desc())
        .all()
    )
    author_ids = {
        feedback.author_user_id
        for feedback in feedbacks
        if feedback.author_user_id is not None
    }
    authors = db.query(db_models.User).filter(db_models.User.id.in_(author_ids)).all() if author_ids else []
    author_by_id = {author.id: author for author in authors}
    matching_feedbacks = [
        feedback
        for feedback in feedbacks
        if resolve_user_country_id(db, author_by_id.get(feedback.author_user_id), location_maps)
        == country_id
    ]
    issue_ids = {
        feedback.issue_id
        for feedback in matching_feedbacks
        if feedback.issue_id is not None
    }
    issues = db.query(db_models.Issue).filter(db_models.Issue.id.in_(issue_ids)).all() if issue_ids else []
    issue_by_id = {issue.id: issue for issue in issues}
    frequency_by_issue = Counter(feedback.issue_id for feedback in matching_feedbacks)

    payloads = []
    for issue_id, frequency in frequency_by_issue.most_common(limit):
        issue = issue_by_id.get(issue_id)
        if issue is None:
            continue
        recorded_at = issue.updated_at or issue.created_at or datetime.now()
        payloads.append(
            {
                "id": issue.id,
                "title": issue.issue_label,
                "description": ", ".join(issue.keywords or []),
                "date_added": recorded_at.date(),
                "time_added": recorded_at.time().replace(microsecond=0),
                "feedback_count": frequency,
                "priority_level": issue.priority_level or priority_for_feedback_count(frequency),
                "status": issue.status or "Pending",
                "sentiment": issue.sentiment,
                "region": location_maps["region_names"].get(issue.region_id, "Unspecified"),
                "district": location_maps["district_names"].get(issue.district_id, "Unspecified"),
                "constituency": location_maps["constituency_names"].get(issue.constituency_id, "Unspecified"),
                "division": location_maps["subcounty_names"].get(issue.subcounty_id, "Unspecified"),
                "parish": location_maps["parish_names"].get(issue.parish_id, "Unspecified"),
                "country_id": issue.country_id,
                "region_id": issue.region_id,
                "district_id": issue.district_id,
                "constituency_id": issue.constituency_id,
                "subcounty_id": issue.subcounty_id,
                "parish_id": issue.parish_id,
                "topic_id": issue.topic_id,
                "model_version": issue.model_version,
            }
        )

    return payloads


def build_national_analytics_payload(db: Session, viewer_user_id: int):
    location_maps = get_location_reference_maps(db)
    district_names = location_maps["district_names"]
    viewer = ensure_user_exists(db, viewer_user_id)
    viewer_country_id = resolve_user_country_id(db, viewer, location_maps)

    post_reviews = (
        db.query(db_models.PostReview)
        .order_by(
            db_models.PostReview.date_added.desc(),
            db_models.PostReview.time_added.desc(),
            db_models.PostReview.id.desc(),
        )
        .all()
    )
    feedbacks = (
        db.query(db_models.Feedback)
        .order_by(
            db_models.Feedback.date_added.desc(),
            db_models.Feedback.time_added.desc(),
            db_models.Feedback.id.desc(),
        )
        .all()
    )
    posts = db.query(db_models.Post).all()
    post_reactions = db.query(db_models.PostReaction).all()

    post_by_id = {post.id: post for post in posts}
    reviewed_post_ids = {review.post_id for review in post_reviews}
    user_ids = {
        review.author_user_id
        for review in post_reviews
        if review.author_user_id is not None
    }
    user_ids.update(
        user_id
        for feedback in feedbacks
        for user_id in (feedback.author_user_id, feedback.target_user_id)
        if user_id is not None
    )
    user_ids.update(
        post.author_user_id
        for post in posts
        if post.id in reviewed_post_ids and post.author_user_id is not None
    )

    users = db.query(db_models.User).filter(db_models.User.id.in_(user_ids)).all() if user_ids else []
    user_by_id = {user.id: user for user in users}

    review_sentiments = Counter(format_sentiment_label(review.sentiment) for review in post_reviews)
    review_gender = Counter(
        format_gender_label(user_by_id[review.author_user_id].gender)
        for review in post_reviews
        if review.author_user_id in user_by_id
    )
    review_age_groups = Counter(
        age_range_for_dob(user_by_id[review.author_user_id].dob)
        for review in post_reviews
        if review.author_user_id in user_by_id
    )
    review_regions = Counter()
    review_districts = Counter()
    review_constituencies = Counter()
    review_divisions = Counter()
    review_parishes = Counter()
    for review in post_reviews:
        author = user_by_id.get(review.author_user_id)
        district_id = review.district_id
        constituency_id = review.constituency_id
        subcounty_id = review.subcounty_id
        parish_id = review.parish_id
        if district_id is None and author is not None:
            district_id = author.district_id
        if constituency_id is None and author is not None:
            constituency_id = author.constituency_id
        if subcounty_id is None and author is not None:
            subcounty_id = author.subcounty_id
        if parish_id is None and author is not None:
            parish_id = author.parish_id
        if subcounty_id is None and parish_id is not None:
            subcounty_id = location_maps["parish_subcounty"].get(parish_id)
        if constituency_id is None and subcounty_id is not None:
            constituency_id = location_maps["subcounty_constituency"].get(subcounty_id)
        if district_id is None and constituency_id is not None:
            district_id = location_maps["constituency_district"].get(constituency_id)
        region_id = location_maps["district_region"].get(district_id) if district_id is not None else None
        review_regions[location_maps["region_names"].get(region_id, "Unspecified")] += 1
        review_districts[district_names.get(district_id, "Unspecified")] += 1
        review_constituencies[location_maps["constituency_names"].get(constituency_id, "Unspecified")] += 1
        review_divisions[location_maps["subcounty_names"].get(subcounty_id, "Unspecified")] += 1
        review_parishes[location_maps["parish_names"].get(parish_id, "Unspecified")] += 1

    feedback_sentiments = Counter(format_sentiment_label(feedback.sentiment) for feedback in feedbacks)
    feedback_status = Counter((feedback.status or "Pending").title() for feedback in feedbacks)
    feedback_categories = Counter((feedback.category or "Unspecified").title() for feedback in feedbacks)
    feedback_age_groups = Counter()
    feedback_regions = Counter()
    feedback_districts = Counter()
    feedback_constituencies = Counter()
    feedback_divisions = Counter()
    feedback_parishes = Counter()
    for feedback in feedbacks:
        author = user_by_id.get(feedback.author_user_id)
        feedback_age_groups[age_range_for_dob(author.dob if author is not None else None)] += 1
        region_id = None
        district_id = author.district_id if author is not None else None
        constituency_id = author.constituency_id if author is not None else None
        subcounty_id = author.subcounty_id if author is not None else None
        parish_id = author.parish_id if author is not None else None
        if district_id is None and constituency_id is not None:
            district_id = location_maps["constituency_district"].get(constituency_id)
        if constituency_id is None and subcounty_id is not None:
            constituency_id = location_maps["subcounty_constituency"].get(subcounty_id)
        if subcounty_id is None and parish_id is not None:
            subcounty_id = location_maps["parish_subcounty"].get(parish_id)
        if constituency_id is None and subcounty_id is not None:
            constituency_id = location_maps["subcounty_constituency"].get(subcounty_id)
        if district_id is None and constituency_id is not None:
            district_id = location_maps["constituency_district"].get(constituency_id)
        if district_id is not None:
            region_id = location_maps["district_region"].get(district_id)
        feedback_regions[location_maps["region_names"].get(region_id, "Unspecified")] += 1
        feedback_districts[district_names.get(district_id, "Unspecified")] += 1
        feedback_constituencies[location_maps["constituency_names"].get(constituency_id, "Unspecified")] += 1
        feedback_divisions[location_maps["subcounty_names"].get(subcounty_id, "Unspecified")] += 1
        feedback_parishes[location_maps["parish_names"].get(parish_id, "Unspecified")] += 1

    reactions_by_post_id: dict[int, list[db_models.PostReaction]] = {}
    for reaction in post_reactions:
        reactions_by_post_id.setdefault(reaction.post_id, []).append(reaction)

    review_payloads = []
    for review in post_reviews[:250]:
        post = post_by_id.get(review.post_id)
        post_author = user_by_id.get(post.author_user_id) if post is not None else None
        review_payload = model_to_dict(review)
        review_payload["author"] = user_snippet_from_record(user_by_id.get(review.author_user_id))
        review_payload["post"] = (
            {
                "id": post.id,
                "title": post.title,
                "content": post.content,
                "view_count": post.view_count,
                "author": user_snippet_from_record(post_author),
            }
            if post is not None
            else None
        )
        review_payloads.append(review_payload)

    return {
        "reviews": {
            "summary": {
                "total_reviews": len(post_reviews),
                "total_posts_reviewed": len(reviewed_post_ids),
                "unique_reviewers": len({review.author_user_id for review in post_reviews}),
                "total_reactions": sum(
                    len(reactions_by_post_id.get(post_id, []))
                    for post_id in reviewed_post_ids
                ),
                "total_views": sum(
                    (post_by_id[post_id].view_count or 0)
                    for post_id in reviewed_post_ids
                    if post_id in post_by_id
                ),
            },
            "charts": {
                "sentiments": sentiment_counter_to_chart_data(review_sentiments),
                "gender": counter_to_chart_data(review_gender, order=GENDER_ORDER, include_zeroes=True),
                "age_groups": counter_to_chart_data(review_age_groups, order=AGE_GROUP_ORDER, include_zeroes=True),
                "regions": counter_to_chart_data(review_regions),
                "districts": counter_to_chart_data(review_districts),
                "constituencies": counter_to_chart_data(review_constituencies),
                "divisions": counter_to_chart_data(review_divisions),
                "parishes": counter_to_chart_data(review_parishes),
            },
            "reviews": review_payloads,
        },
        "feedbacks": {
            "summary": {
                "total_feedbacks": len(feedbacks),
                "pending_feedbacks": sum(
                    1 for feedback in feedbacks if (feedback.status or "pending").lower() == "pending"
                ),
                "analysed_feedbacks": sum(
                    1 for feedback in feedbacks if (feedback.status or "").lower() == "analysed"
                ),
                "unique_authors": len({feedback.author_user_id for feedback in feedbacks}),
                "unique_targets": len({feedback.target_user_id for feedback in feedbacks}),
            },
            "charts": {
                "sentiments": sentiment_counter_to_chart_data(feedback_sentiments),
                "status": counter_to_chart_data(feedback_status),
                "categories": counter_to_chart_data(feedback_categories),
                "age_groups": counter_to_chart_data(feedback_age_groups, order=AGE_GROUP_ORDER, include_zeroes=True),
                "regions": counter_to_chart_data(feedback_regions),
                "districts": counter_to_chart_data(feedback_districts),
                "constituencies": counter_to_chart_data(feedback_constituencies),
                "divisions": counter_to_chart_data(feedback_divisions),
                "parishes": counter_to_chart_data(feedback_parishes),
            },
            "feedbacks": [build_feedback_payload(db, feedback) for feedback in feedbacks[:250]],
            "emerging_issues": build_country_modeled_issue_payloads(
                db,
                country_id=viewer_country_id,
                location_maps=location_maps,
            ),
        },
    }


def parse_saved_embedding(value: Optional[str]):
    if value is None:
        return None

    try:
        embedding = json.loads(value) if isinstance(value, str) else value
    except (TypeError, json.JSONDecodeError):
        return None

    if not isinstance(embedding, list) or not embedding:
        return None

    try:
        return [float(item) for item in embedding]
    except (TypeError, ValueError):
        return None


def list_feedbacks_for_topic_modeling(
    db: Session,
    *,
    target_user_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    query = (
        db.query(db_models.Feedback)
        .filter(db_models.Feedback.clean_text.isnot(None))
        .filter(db_models.Feedback.embending.isnot(None))
    )
    if target_user_id is not None:
        query = query.filter(db_models.Feedback.target_user_id == target_user_id)
    if start_date is not None:
        query = query.filter(db_models.Feedback.date_added >= start_date)
    if end_date is not None:
        query = query.filter(db_models.Feedback.date_added <= end_date)

    records = (
        query.order_by(db_models.Feedback.date_added.asc(), db_models.Feedback.time_added.asc(), db_models.Feedback.id.asc())
        .all()
    )

    feedbacks = []
    for record in records:
        clean_text = (record.clean_text or "").strip()
        embedding = parse_saved_embedding(record.embending)
        if not clean_text or embedding is None:
            continue
        feedbacks.append(
            {
                "id": record.id,
                "clean_text": clean_text,
                "embedding": embedding,
            }
        )

    return feedbacks


def list_country_feedbacks_for_topic_modeling(
    db: Session,
    *,
    country_id: int,
    location_maps: dict,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    query = (
        db.query(db_models.Feedback)
        .filter(db_models.Feedback.clean_text.isnot(None))
        .filter(db_models.Feedback.embending.isnot(None))
    )
    if start_date is not None:
        query = query.filter(db_models.Feedback.date_added >= start_date)
    if end_date is not None:
        query = query.filter(db_models.Feedback.date_added <= end_date)

    records = (
        query.order_by(db_models.Feedback.date_added.asc(), db_models.Feedback.time_added.asc(), db_models.Feedback.id.asc())
        .all()
    )
    author_ids = {
        record.author_user_id
        for record in records
        if record.author_user_id is not None
    }
    authors = db.query(db_models.User).filter(db_models.User.id.in_(author_ids)).all() if author_ids else []
    author_by_id = {author.id: author for author in authors}

    feedbacks = []
    for record in records:
        if resolve_user_country_id(db, author_by_id.get(record.author_user_id), location_maps) != country_id:
            continue
        clean_text = (record.clean_text or "").strip()
        embedding = parse_saved_embedding(record.embending)
        if not clean_text or embedding is None:
            continue
        feedbacks.append(
            {
                "id": record.id,
                "clean_text": clean_text,
                "embedding": embedding,
            }
        )

    return feedbacks


def timeframe_to_start_date(timeframe: str):
    if timeframe == "weekly":
        return date.today() - timedelta(days=7)
    if timeframe == "monthly":
        return date.today() - timedelta(days=31)
    if timeframe == "quarterly":
        return date.today() - timedelta(days=92)
    if timeframe == "yearly":
        return date.today() - timedelta(days=366)
    raise HTTPException(status_code=422, detail="Unsupported BERTopic timeframe")


def build_user_modeled_issue_payloads(db: Session, user_id: int, *, limit: int = 8):
    rows = (
        db.query(db_models.Issue, func.count(db_models.Feedback.id).label("frequency"))
        .join(db_models.Feedback, db_models.Feedback.issue_id == db_models.Issue.id)
        .filter(db_models.Feedback.target_user_id == user_id)
        .group_by(db_models.Issue.id)
        .order_by(func.count(db_models.Feedback.id).desc(), db_models.Issue.updated_at.desc())
        .limit(limit)
        .all()
    )

    payloads = []
    for issue, frequency in rows:
        recorded_at = issue.updated_at or issue.created_at or datetime.now()
        payloads.append(
            {
                "id": issue.id,
                "title": issue.issue_label,
                "description": ", ".join(issue.keywords or []),
                "date_added": recorded_at.date(),
                "time_added": recorded_at.time().replace(microsecond=0),
                "feedback_count": frequency,
                "priority_level": issue.priority_level or priority_for_feedback_count(frequency),
                "status": issue.status or "Pending",
                "sentiment": issue.sentiment,
                "topic_id": issue.topic_id,
                "model_version": issue.model_version,
            }
        )

    return payloads


def period_start_for_date(value: date, period: str):
    if period == "weekly":
        return value - timedelta(days=value.weekday())
    if period == "monthly":
        return value.replace(day=1)
    if period == "quarterly":
        quarter_month = ((value.month - 1) // 3) * 3 + 1
        return value.replace(month=quarter_month, day=1)
    if period == "yearly":
        return value.replace(month=1, day=1)
    return value


def user_location_scope(user: Optional[db_models.User], location_maps: dict):
    district_id = user.district_id if user is not None else None
    constituency_id = user.constituency_id if user is not None else None
    subcounty_id = user.subcounty_id if user is not None else None
    parish_id = user.parish_id if user is not None else None

    if subcounty_id is None and parish_id is not None:
        subcounty_id = location_maps["parish_subcounty"].get(parish_id)
    if district_id is None and constituency_id is not None:
        district_id = location_maps["constituency_district"].get(constituency_id)
    if constituency_id is None and subcounty_id is not None:
        constituency_id = location_maps["subcounty_constituency"].get(subcounty_id)
    if district_id is None and constituency_id is not None:
        district_id = location_maps["constituency_district"].get(constituency_id)

    region_id = location_maps["district_region"].get(district_id) if district_id is not None else None
    country_id = location_maps["region_country"].get(region_id) if region_id is not None else None

    return {
        "country_id": country_id,
        "region_id": region_id,
        "district_id": district_id,
        "constituency_id": constituency_id,
        "subcounty_id": subcounty_id,
        "parish_id": parish_id,
    }


def rebuild_issue_trends(db: Session):
    location_maps = get_location_reference_maps(db)
    feedbacks = (
        db.query(db_models.Feedback)
        .filter(db_models.Feedback.issue_id.isnot(None))
        .order_by(db_models.Feedback.date_added.asc(), db_models.Feedback.id.asc())
        .all()
    )
    user_ids = {
        feedback.author_user_id
        for feedback in feedbacks
        if feedback.author_user_id is not None
    }
    users = db.query(db_models.User).filter(db_models.User.id.in_(user_ids)).all() if user_ids else []
    user_by_id = {user.id: user for user in users}
    issue_ids = {feedback.issue_id for feedback in feedbacks if feedback.issue_id is not None}
    issues = db.query(db_models.Issue).filter(db_models.Issue.id.in_(issue_ids)).all() if issue_ids else []
    issue_by_id = {issue.id: issue for issue in issues}

    db.query(db_models.IssueTrend).delete()
    grouped: dict[tuple, int] = Counter()

    for feedback in feedbacks:
        issue = issue_by_id.get(feedback.issue_id)
        if issue is None or feedback.date_added is None:
            continue

        location = user_location_scope(user_by_id.get(feedback.author_user_id), location_maps)
        for period in ("weekly", "monthly", "quarterly", "yearly"):
            period_start = period_start_for_date(feedback.date_added, period)
            national_key = (
                "national",
                None,
                period,
                period_start,
                feedback.issue_id,
                issue.issue_label,
                location["country_id"],
                location["region_id"],
                location["district_id"],
                location["constituency_id"],
                location["subcounty_id"],
            )
            grouped[national_key] += 1

            user_key = (
                "user",
                feedback.target_user_id,
                period,
                period_start,
                feedback.issue_id,
                issue.issue_label,
                location["country_id"],
                location["region_id"],
                location["district_id"],
                location["constituency_id"],
                location["subcounty_id"],
            )
            grouped[user_key] += 1

    for (
        scope,
        target_user_id,
        period,
        period_start,
        issue_id,
        issue_label,
        country_id,
        region_id,
        district_id,
        constituency_id,
        subcounty_id,
    ), frequency in grouped.items():
        db.add(
            db_models.IssueTrend(
                scope=scope,
                target_user_id=target_user_id,
                period=period,
                date=period_start,
                issue_id=issue_id,
                issue_label=issue_label,
                frequency=frequency,
                country_id=country_id,
                region_id=region_id,
                district_id=district_id,
                constituency_id=constituency_id,
                subcounty_id=subcounty_id,
            )
        )


def save_bertopic_results(db: Session, result: dict):
    current_timestamp = datetime.now()
    issue_id_by_topic: dict[int, int] = {}
    model_version = result["model_version"]
    location_maps = get_location_reference_maps(db)
    feedback_ids = [
        assignment["feedback_id"]
        for assignment in result["assignments"]
        if assignment.get("feedback_id") is not None
    ]
    feedback_sentiment_by_id = {}
    feedback_location_by_id = {}
    if feedback_ids:
        feedback_rows = db.query(db_models.Feedback).filter(db_models.Feedback.id.in_(feedback_ids)).all()
        feedback_sentiment_by_id = {
            feedback.id: format_sentiment_label(feedback.sentiment)
            for feedback in feedback_rows
        }
        author_ids = {
            feedback.author_user_id
            for feedback in feedback_rows
            if feedback.author_user_id is not None
        }
        authors = db.query(db_models.User).filter(db_models.User.id.in_(author_ids)).all() if author_ids else []
        author_by_id = {author.id: author for author in authors}
        feedback_location_by_id = {
            feedback.id: user_location_scope(author_by_id.get(feedback.author_user_id), location_maps)
            for feedback in feedback_rows
        }
    sentiment_by_topic: dict[int, Counter] = {}
    location_by_topic: dict[int, dict[str, Counter]] = {}
    for assignment in result["assignments"]:
        topic_id = int(assignment["topic_id"])
        sentiment = feedback_sentiment_by_id.get(assignment["feedback_id"], "Unknown")
        sentiment_by_topic.setdefault(topic_id, Counter())[sentiment] += 1
        location = feedback_location_by_id.get(assignment["feedback_id"], {})
        topic_locations = location_by_topic.setdefault(
            topic_id,
            {
                "country_id": Counter(),
                "region_id": Counter(),
                "district_id": Counter(),
                "constituency_id": Counter(),
                "subcounty_id": Counter(),
                "parish_id": Counter(),
            },
        )
        for key in topic_locations:
            topic_locations[key][location.get(key)] += 1

    for issue in result["issues"]:
        topic_id = int(issue["topic_id"])
        record = (
            db.query(db_models.Issue)
            .filter(db_models.Issue.topic_id == topic_id)
            .filter(db_models.Issue.model_version == model_version)
            .first()
        )
        if record is None:
            record = db_models.Issue(
                topic_id=topic_id,
                model_version=model_version,
                created_at=current_timestamp,
            )
            db.add(record)

        record.issue_label = issue["issue_label"]
        record.keywords = issue["keywords"]
        record.size = issue["size"]
        record.priority_level = priority_for_feedback_count(issue["size"])
        record.status = record.status or "Pending"
        record.sentiment = dominant_binary_sentiment(sentiment_by_topic.get(topic_id, Counter()))
        topic_locations = location_by_topic.get(topic_id, {})
        record.country_id = dominant_counter_value(topic_locations.get("country_id", Counter()))
        record.region_id = dominant_counter_value(topic_locations.get("region_id", Counter()))
        record.district_id = dominant_counter_value(topic_locations.get("district_id", Counter()))
        record.constituency_id = dominant_counter_value(topic_locations.get("constituency_id", Counter()))
        record.subcounty_id = dominant_counter_value(topic_locations.get("subcounty_id", Counter()))
        record.parish_id = dominant_counter_value(topic_locations.get("parish_id", Counter()))
        record.updated_at = current_timestamp
        db.flush()
        issue_id_by_topic[topic_id] = record.id

    for assignment in result["assignments"]:
        feedback = db.query(db_models.Feedback).filter(db_models.Feedback.id == assignment["feedback_id"]).first()
        if feedback is None:
            continue
        feedback.topic_id = assignment["topic_id"]
        feedback.issue_id = issue_id_by_topic.get(assignment["topic_id"])
        feedback.topic_probability = assignment["topic_probability"]
        feedback.topic_model_version = model_version

    rebuild_issue_trends(db)
    db.commit()

    return issue_id_by_topic


def trend_window_start(period: str):
    today = date.today()
    if period == "weekly":
        return today - timedelta(days=7)
    if period == "monthly":
        return today - timedelta(days=31)
    if period == "quarterly":
        return today - timedelta(days=92)
    if period == "yearly":
        return today - timedelta(days=366)
    raise HTTPException(status_code=422, detail="Unsupported trend period")


def build_issue_analytics_payload(
    db: Session,
    *,
    scope: str,
    period: str,
    viewer_user_id: int,
    target_user_id: Optional[int],
    country_id: Optional[int],
    limit: int,
):
    if scope not in {"national", "user"}:
        raise HTTPException(status_code=422, detail="Unsupported issue analytics scope")
    if period not in {"weekly", "monthly", "quarterly", "yearly"}:
        raise HTTPException(status_code=422, detail="Unsupported trend period")

    if scope == "user":
        target_user_id = target_user_id or viewer_user_id
        require_feedback_owner(viewer_user_id, target_user_id)

    start_date = trend_window_start(period)
    trend_query = (
        db.query(db_models.IssueTrend)
        .filter(db_models.IssueTrend.scope == scope)
        .filter(db_models.IssueTrend.period == period)
        .filter(db_models.IssueTrend.date >= start_date)
    )
    feedback_query = db.query(db_models.Feedback).filter(db_models.Feedback.issue_id.isnot(None))

    if scope == "user":
        trend_query = trend_query.filter(db_models.IssueTrend.target_user_id == target_user_id)
        feedback_query = feedback_query.filter(db_models.Feedback.target_user_id == target_user_id)
    if country_id is not None:
        trend_query = trend_query.filter(db_models.IssueTrend.country_id == country_id)

    trend_rows = trend_query.all()
    issue_frequency = Counter()
    by_region = Counter()
    by_district = Counter()
    by_constituency = Counter()
    by_subcounty = Counter()
    over_time = Counter()
    issue_labels: dict[int, str] = {}

    location_maps = get_location_reference_maps(db)
    for row in trend_rows:
        issue_frequency[row.issue_id] += row.frequency
        issue_labels[row.issue_id] = row.issue_label
        over_time[(row.date, row.issue_id)] += row.frequency
        if row.region_id is not None:
            by_region[location_maps["region_names"].get(row.region_id, "Unspecified")] += row.frequency
        if row.district_id is not None:
            by_district[location_maps["district_names"].get(row.district_id, "Unspecified")] += row.frequency
        if row.constituency_id is not None:
            by_constituency[location_maps["constituency_names"].get(row.constituency_id, "Unspecified")] += row.frequency
        if row.subcounty_id is not None:
            by_subcounty[location_maps["subcounty_names"].get(row.subcounty_id, "Unspecified")] += row.frequency

    feedbacks = feedback_query.all()
    sentiment_by_issue: dict[int, Counter] = {}
    for feedback in feedbacks:
        if feedback.issue_id is None:
            continue
        sentiment_by_issue.setdefault(feedback.issue_id, Counter())[format_sentiment_label(feedback.sentiment)] += 1

    top_issues = [
        {
            "issue_id": issue_id,
            "issue_label": issue_labels.get(issue_id, "Unspecified"),
            "frequency": frequency,
        }
        for issue_id, frequency in issue_frequency.most_common(limit)
    ]

    return {
        "scope": scope,
        "period": period,
        "start_date": start_date,
        "top_issues": top_issues,
        "issue_frequency": top_issues,
        "by_region": counter_to_chart_data(by_region),
        "by_district": counter_to_chart_data(by_district),
        "by_constituency": counter_to_chart_data(by_constituency),
        "by_subcounty": counter_to_chart_data(by_subcounty),
        "sentiment_per_issue": [
            {
                "issue_id": issue_id,
                "issue_label": issue_labels.get(issue_id, "Unspecified"),
                "sentiments": sentiment_counter_to_chart_data(counter),
            }
            for issue_id, counter in sentiment_by_issue.items()
        ],
        "over_time": [
            {
                "date": recorded_date,
                "issue_id": issue_id,
                "issue_label": issue_labels.get(issue_id, "Unspecified"),
                "frequency": frequency,
            }
            for (recorded_date, issue_id), frequency in sorted(over_time.items())
        ],
    }


def build_dashboard_payload(db: Session, user_id: int):
    user = ensure_user_exists(db, user_id)
    visible_users = [record for record in db.query(db_models.User).all() if can_view_user(db, record, user_id)]
    owned_posts = db.query(db_models.Post).filter(db_models.Post.author_user_id == user_id).all()
    emerging_issues = db.query(db_models.EmergingIssue).filter(db_models.EmergingIssue.user_id == user_id).all()

    post_ids = [post.id for post in owned_posts]
    post_reviews = []
    post_reactions = []
    if post_ids:
        post_reviews = db.query(db_models.PostReview).filter(db_models.PostReview.post_id.in_(post_ids)).all()
        post_reactions = db.query(db_models.PostReaction).filter(db_models.PostReaction.post_id.in_(post_ids)).all()

    age_ranges = Counter(age_range_for_dob(record.dob) for record in visible_users)
    gender_breakdown = Counter((record.gender or "Unspecified").title() for record in visible_users)
    post_visibility = Counter((post.visibility or "public").title() for post in owned_posts)
    reaction_breakdown = Counter(reaction.reaction_type.title() for reaction in post_reactions)
    issue_status = Counter((record.status or "open").title() for record in emerging_issues)
    issue_priority = Counter((record.priority_level or "unspecified").title() for record in emerging_issues)

    activity_days = []
    for offset in range(6, -1, -1):
        activity_date = date.today().fromordinal(date.today().toordinal() - offset)
        activity_days.append(
            {
                "label": activity_date.strftime("%a"),
                "posts": sum(1 for post in owned_posts if post.date_added == activity_date),
                "emerging_issues": sum(1 for record in emerging_issues if record.date_added == activity_date),
            }
        )

    top_posts = sorted(
        [build_post_payload(db, post, user_id) for post in owned_posts],
        key=lambda payload: payload["reaction_summary"]["total"] + payload["review_count"],
        reverse=True,
    )[:5]

    return {
        "user": model_to_dict(user),
        "summary": {
            "visible_users": len(visible_users),
            "posts_authored": len(owned_posts),
            "public_posts": sum(1 for post in owned_posts if post.visibility == POST_VISIBILITY_PUBLIC),
            "constituency_posts": sum(
                1 for post in owned_posts if post.visibility == POST_VISIBILITY_CONSTITUENCY
            ),
            "private_posts": sum(1 for post in owned_posts if post.visibility == POST_VISIBILITY_PRIVATE),
            "shared_private_posts": sum(
                1
                for post in owned_posts
                if post.visibility == POST_VISIBILITY_PRIVATE and post.share_token
            ),
            "post_reviews_received": len(post_reviews),
            "emerging_issues": len(emerging_issues),
            "open_emerging_issues": sum(1 for record in emerging_issues if (record.status or "").lower() != "resolved"),
        },
        "charts": {
            "age_ranges": [{"label": label, "value": value} for label, value in age_ranges.items()],
            "gender_breakdown": [{"label": label, "value": value} for label, value in gender_breakdown.items()],
            "post_visibility": [{"label": label, "value": value} for label, value in post_visibility.items()],
            "reaction_breakdown": [{"label": label, "value": value} for label, value in reaction_breakdown.items()],
            "issue_status": [{"label": label, "value": value} for label, value in issue_status.items()],
            "issue_priority": [{"label": label, "value": value} for label, value in issue_priority.items()],
            "activity_timeline": activity_days,
        },
        "top_posts": top_posts,
        "recent_emerging_issues": [
            model_to_dict(record)
            for record in db.query(db_models.EmergingIssue)
            .filter(db_models.EmergingIssue.user_id == user_id)
            .order_by(db_models.EmergingIssue.date_added.desc(), db_models.EmergingIssue.time_added.desc())
            .limit(5)
            .all()
        ],
    }


class SignupRequest(BaseModel):
    username: str
    email: str
    password: str
    fname: Optional[str] = None
    lname: Optional[str] = None
    mobile_number: Optional[str] = None
    gender: Optional[str] = None
    dob: Optional[date] = None
    visibility: Optional[str] = "public"
    type: Optional[str] = PERSONAL_ACCOUNT_TYPE
    district_id: Optional[int] = None
    constituency_id: Optional[int] = None
    subcounty_id: Optional[int] = None
    parish_id: Optional[int] = None
    company_name: Optional[str] = None
    company_country: Optional[str] = None
    company_city: Optional[str] = None
    type_of_business: Optional[str] = None
    number_of_employees: Optional[int] = None
    parent_user_id: Optional[int] = None


class UserCreate(BaseModel):
    parent_user_id: Optional[int] = None
    username: str
    email: str
    fname: Optional[str] = None
    lname: Optional[str] = None
    password: str
    role: Optional[str] = None
    mobile_number: Optional[str] = None
    verification_status: Optional[str] = None
    status: Optional[str] = None
    visibility: Optional[str] = None
    gender: Optional[str] = None
    dob: Optional[date] = None
    district_id: Optional[int] = None
    constituency_id: Optional[int] = None
    subcounty_id: Optional[int] = None
    parish_id: Optional[int] = None
    type: Optional[str] = PERSONAL_ACCOUNT_TYPE
    number_of_employees: Optional[int] = None
    company_name: Optional[str] = None
    company_country: Optional[str] = None
    company_city: Optional[str] = None
    type_of_business: Optional[str] = None
    profile_picture: Optional[str] = None
    description: Optional[str] = None
    theme_colors: Optional[str] = None


class UserUpdate(BaseModel):
    parent_user_id: Optional[int] = None
    username: Optional[str] = None
    email: Optional[str] = None
    fname: Optional[str] = None
    lname: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    mobile_number: Optional[str] = None
    verification_status: Optional[str] = None
    status: Optional[str] = None
    visibility: Optional[str] = None
    gender: Optional[str] = None
    dob: Optional[date] = None
    district_id: Optional[int] = None
    constituency_id: Optional[int] = None
    subcounty_id: Optional[int] = None
    parish_id: Optional[int] = None
    type: Optional[str] = None
    number_of_employees: Optional[int] = None
    company_name: Optional[str] = None
    company_country: Optional[str] = None
    company_city: Optional[str] = None
    type_of_business: Optional[str] = None
    profile_picture: Optional[str] = None
    description: Optional[str] = None
    theme_colors: Optional[str] = None


class UserModerationAction(BaseModel):
    action: str


class LoginRequest(BaseModel):
    email_or_mobile_number: str
    password: str


class ParentAccountSwitchRequest(BaseModel):
    email_or_mobile_number: str
    password: str


class TopicsCreate(BaseModel):
    title: str
    description: str
    date_added: date
    time_added: time
    author_id: int
    thumbnail: Optional[str] = None
    attachment: Optional[str] = None
    feedback_expiry_date: date
    feedback_expiry_time: time


class TopicsUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date_added: Optional[date] = None
    time_added: Optional[time] = None
    author_id: Optional[int] = None
    thumbnail: Optional[str] = None
    attachment: Optional[str] = None
    feedback_expiry_date: Optional[date] = None
    feedback_expiry_time: Optional[time] = None


class ReviewCreate(BaseModel):
    topic_id: int
    author_id: int
    content: str
    district_id: Optional[int] = None
    constituency_id: Optional[int] = None
    subcounty_id: Optional[int] = None
    parish_id: Optional[int] = None
    date_added: Optional[date] = None
    time_added: Optional[time] = None
    origin_country: Optional[str] = None
    origin_city: Optional[str] = None
    origin_latitude: Optional[float] = None
    origin_longitude: Optional[float] = None
    sentiment: Optional[str] = None


class ReviewUpdate(BaseModel):
    topic_id: Optional[int] = None
    author_id: Optional[int] = None
    content: Optional[str] = None
    district_id: Optional[int] = None
    constituency_id: Optional[int] = None
    subcounty_id: Optional[int] = None
    parish_id: Optional[int] = None
    date_added: Optional[date] = None
    time_added: Optional[time] = None
    origin_country: Optional[str] = None
    origin_city: Optional[str] = None
    origin_latitude: Optional[float] = None
    origin_longitude: Optional[float] = None
    sentiment: Optional[str] = None
    edited_date: Optional[date] = None
    edited_time: Optional[time] = None


class PostReviewUpdate(BaseModel):
    content: str
    district_id: Optional[int] = None
    constituency_id: Optional[int] = None
    subcounty_id: Optional[int] = None
    parish_id: Optional[int] = None


class FeedbackCreate(BaseModel):
    author_user_id: int
    title: str
    description: str
    category: Optional[str] = None
    clean_text: Optional[str] = None
    summary: Optional[str] = None
    date_added: Optional[date] = None
    time_added: Optional[time] = None
    origin_country: Optional[str] = None
    origin_city: Optional[str] = None
    origin_latitude: Optional[float] = None
    origin_longitude: Optional[float] = None
    sentiment: Optional[str] = None
    sentiment_confidence: Optional[float] = None
    sentiment_score: Optional[str] = None
    embending: Optional[str] = None
    embedding_model: Optional[str] = None
    summar_model: Optional[str] = None
    sentiment_model: Optional[str] = None
    inference_provider: Optional[str] = None
    inference_mode: Optional[str] = None
    inference_fallback_used: Optional[bool] = None
    inference_fallback_tasks: Optional[str] = None
    inference_latency_ms: Optional[int] = None
    target_user_id: int


class FeedbackUpdate(BaseModel):
    author_user_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    clean_text: Optional[str] = None
    summary: Optional[str] = None
    date_added: Optional[date] = None
    time_added: Optional[time] = None
    origin_country: Optional[str] = None
    origin_city: Optional[str] = None
    origin_latitude: Optional[float] = None
    origin_longitude: Optional[float] = None
    sentiment: Optional[str] = None
    sentiment_confidence: Optional[float] = None
    sentiment_score: Optional[str] = None
    embending: Optional[str] = None
    embedding_model: Optional[str] = None
    summar_model: Optional[str] = None
    sentiment_model: Optional[str] = None
    inference_provider: Optional[str] = None
    inference_mode: Optional[str] = None
    inference_fallback_used: Optional[bool] = None
    inference_fallback_tasks: Optional[str] = None
    inference_latency_ms: Optional[int] = None
    target_user_id: Optional[int] = None
    status: Optional[str] = None


class UploadPresignRequest(BaseModel):
    actor_user_id: int
    filename: str
    content_type: str
    file_size: int = Field(gt=0)
    folder: str


class PostCreate(BaseModel):
    author_user_id: int
    title: str
    content: str
    category: Optional[str] = None
    visibility: Optional[str] = "public"
    district_id: Optional[int] = None
    constituency_id: Optional[int] = None
    subcounty_id: Optional[int] = None
    parish_id: Optional[int] = None
    thumbnail: Optional[str] = None
    attachment: Optional[str] = None


class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    visibility: Optional[str] = None
    district_id: Optional[int] = None
    constituency_id: Optional[int] = None
    subcounty_id: Optional[int] = None
    parish_id: Optional[int] = None
    thumbnail: Optional[str] = None
    attachment: Optional[str] = None
    status: Optional[str] = None


class PostCategoryCreate(BaseModel):
    name: str


class PostReviewCreate(BaseModel):
    author_user_id: int
    content: str
    district_id: Optional[int] = None
    constituency_id: Optional[int] = None
    subcounty_id: Optional[int] = None
    parish_id: Optional[int] = None


class PostReactionCreate(BaseModel):
    user_id: int
    reaction_type: str


class SubscriptionCreate(BaseModel):
    user_id: int
    plan: str
    amount: float
    start_date: date
    expiry_date: date


class SubscriptionUpdate(BaseModel):
    user_id: Optional[int] = None
    plan: Optional[str] = None
    amount: Optional[float] = None
    start_date: Optional[date] = None
    expiry_date: Optional[date] = None


class EmergingIssueGeneratedItem(BaseModel):
    title: str = Field(description="Short title for the generated emerging issue")
    description: Optional[str] = Field(default=None)
    date_added: date
    time_added: time
    resolution_made: Optional[str] = None
    priority_level: Optional[str] = None
    status: Optional[str] = None
    sentiment: Optional[str] = None


class FeedbackAnalysisRequest(BaseModel):
    start_date: date
    end_date: date
    feedback_ids: list[int]
    emerging_issues: list[EmergingIssueGeneratedItem]


class IssueStatusUpdate(BaseModel):
    status: str


class CountryCreate(BaseModel):
    name: str


class CountryUpdate(BaseModel):
    name: Optional[str] = None


class RegionCreate(BaseModel):
    name: str
    country_id: int


class RegionUpdate(BaseModel):
    name: Optional[str] = None
    country_id: Optional[int] = None


class DistrictCreate(BaseModel):
    name: str
    region_id: int


class DistrictUpdate(BaseModel):
    name: Optional[str] = None
    region_id: Optional[int] = None


class ConstituencyCreate(BaseModel):
    name: str
    district_id: int


class ConstituencyUpdate(BaseModel):
    name: Optional[str] = None
    district_id: Optional[int] = None


class SubcountyCreate(BaseModel):
    name: str
    constituency_id: int


class SubcountyUpdate(BaseModel):
    name: Optional[str] = None
    constituency_id: Optional[int] = None


class ParishCreate(BaseModel):
    name: str
    subcounty_id: int


class ParishUpdate(BaseModel):
    name: Optional[str] = None
    subcounty_id: Optional[int] = None


class VillageCreate(BaseModel):
    name: str
    parish_id: int


class VillageUpdate(BaseModel):
    name: Optional[str] = None
    parish_id: Optional[int] = None


@app.get("/")
def greeting():
    return {"message": "UGVOICE API"}


@app.get("/health", include_in_schema=False)
def health_check():
    return {"status": "ok"}


@app.get("/health/ready", include_in_schema=False)
def readiness_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ready", "database": "connected"}


@app.get("/ml/status", include_in_schema=False)
def ml_status():
    provider = inference_provider()
    return {
        "provider": provider,
        "configured": (
            hf_inference.is_configured()
            if provider == "huggingface"
            else provider == "local"
        ),
        "models": {
            "sentiment": hf_inference.SENTIMENT_MODEL,
            "summary": hf_inference.SUMMARY_MODEL,
            "embedding": hf_inference.EMBEDDING_MODEL,
        },
        "remote_embeddings_enabled": os.getenv(
            "HF_ENABLE_EMBEDDINGS", "true"
        ).strip().lower() in {"1", "true", "yes", "on"},
        "bertopic_enabled": bertopic_enabled(),
        "local_models_downloaded_by_api": False if provider == "huggingface" else None,
    }


@app.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(user: SignupRequest, db: Session = Depends(get_db)):
    ensure_user_identity_available(
        db,
        email=user.email,
        username=user.username,
        mobile_number=user.mobile_number,
    )
    payload = build_signup_payload(db, user)
    created = create_record(db, db_models.User, payload)
    return {"message": "Signup successful", "user": created}


@app.post("/login")
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    user = (
        db.query(db_models.User)
        .filter(
            or_(
                db_models.User.email == credentials.email_or_mobile_number,
                db_models.User.mobile_number == credentials.email_or_mobile_number,
            )
        )
        .first()
    )

    if user is None or not verify_password(credentials.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email/mobile number or password",
        )

    if user.status == "deactivated":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated",
        )

    return {"message": "Login successful", "user": model_to_dict(user)}


@app.get("/users/username-availability")
def check_username_availability(
    username: str = Query(..., min_length=3),
    db: Session = Depends(get_db),
):
    result = check_identity_availability(db, username=username)["username"]
    return {
        "username": result["value"],
        "available": result["available"],
        "message": result["message"],
    }


@app.get("/users/signup-availability")
def check_signup_availability(
    username: Optional[str] = Query(default=None),
    email: Optional[str] = Query(default=None),
    mobile_number: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    return check_identity_availability(
        db,
        username=username,
        email=email,
        mobile_number=mobile_number,
    )


@app.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    normalized_email = normalize_optional_string(user.email)
    normalized_username = normalize_optional_string(user.username)
    normalized_mobile_number = normalize_optional_string(user.mobile_number)
    ensure_user_identity_available(
        db,
        email=normalized_email,
        username=normalized_username,
        mobile_number=normalized_mobile_number,
    )
    payload = schema_dump(user)
    payload["password"] = hash_password(user.password)
    payload["email"] = normalized_email
    payload["username"] = normalized_username
    payload["mobile_number"] = normalized_mobile_number
    payload["fname"] = normalize_optional_string(payload.get("fname"))
    payload["lname"] = normalize_optional_string(payload.get("lname"))
    payload["company_name"] = normalize_optional_string(payload.get("company_name"))
    payload["company_city"] = normalize_optional_string(payload.get("company_city"))
    payload["type_of_business"] = normalize_optional_string(payload.get("type_of_business"))
    payload["role"] = payload.get("role") or "standard"
    payload["status"] = payload.get("status") or "active"
    payload["visibility"] = payload.get("visibility") or "public"
    payload["type"] = normalize_account_type(payload.get("type"))
    payload["company_country"] = ensure_valid_company_country(db, payload.get("company_country"))
    if payload.get("parent_user_id") is not None:
        payload["parent_user_id"] = resolve_parent_user_id(
            db,
            parent_user_id=payload["parent_user_id"],
        )
    payload.update(
        normalize_user_location_hierarchy(
            db,
            district_id=payload.get("district_id"),
            constituency_id=payload.get("constituency_id"),
            subcounty_id=payload.get("subcounty_id"),
            parish_id=payload.get("parish_id"),
        )
    )
    return create_record(db, db_models.User, payload)


@app.get("/users")
def list_users(
    viewer_user_id: Optional[int] = Query(default=None),
    q: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return paginated_visible_users_for_viewer(
        db,
        viewer_user_id,
        q,
        limit=limit,
        offset=offset,
    )


@app.get("/users/{user_id}")
def get_user(
    user_id: int,
    viewer_user_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    record = get_or_404(db, db_models.User, user_id)
    if not can_view_user(db, record, viewer_user_id):
        raise HTTPException(status_code=403, detail="You do not have access to this user")
    return model_to_dict(record)


@app.get("/users/{user_id}/child-accounts")
def list_child_accounts_for_user(
    user_id: int,
    viewer_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    require_feedback_owner(viewer_user_id, user_id)
    records = (
        db.query(db_models.User)
        .filter(db_models.User.parent_user_id == user_id)
        .order_by(db_models.User.company_name.asc(), db_models.User.username.asc())
        .all()
    )
    return [model_to_dict(record) for record in records]


@app.post("/users/{user_id}/switch-account")
def switch_account(
    user_id: int,
    actor_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    actor_user = ensure_user_exists(db, actor_user_id)
    target_user = ensure_user_exists(db, user_id)

    if target_user.status == "deactivated":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated",
        )

    if not can_switch_between_accounts(actor_user, target_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only switch between linked parent and child accounts",
        )

    return {
        "message": "Account switched successfully",
        "user": model_to_dict(target_user),
    }


@app.post("/users/{user_id}/switch-account-with-login")
def switch_account_with_parent_login(
    user_id: int,
    credentials: ParentAccountSwitchRequest,
    actor_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    actor_user = ensure_user_exists(db, actor_user_id)
    target_user = ensure_user_exists(db, user_id)

    if actor_user.parent_user_id != target_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a linked parent account can be restored from this child account",
        )

    if target_user.status == "deactivated":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated",
        )

    identifier = credentials.email_or_mobile_number.strip()
    matches_identifier = (
        target_user.email == identifier
        or target_user.mobile_number == identifier
    )

    if not matches_identifier or not verify_password(
        credentials.password, target_user.password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid parent account credentials",
        )

    return {
        "message": "Account switched successfully",
        "user": model_to_dict(target_user),
    }


@app.get("/users/{user_id}/dashboard")
def get_dashboard_for_user(
    user_id: int,
    viewer_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    require_feedback_owner(viewer_user_id, user_id)
    return build_dashboard_payload(db, user_id)


@app.get("/national-analytics")
def get_national_analytics(
    viewer_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    return build_national_analytics_payload(db, viewer_user_id)


@app.get("/users/{user_id}/analytics-profile")
def get_profile_analytics_for_user(
    user_id: int,
    viewer_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    require_feedback_owner(viewer_user_id, user_id)
    return build_profile_analytics_payload(db, user_id)


@app.get("/users/{user_id}/resources")
def get_resources_for_user(
    user_id: int,
    viewer_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    require_feedback_owner(viewer_user_id, user_id)
    return get_user_resources(db, user_id)


@app.get("/users/{user_id}/feedback-summary/submitted")
def list_submitted_feedback_summary_for_user(
    user_id: int,
    viewer_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    require_feedback_owner(viewer_user_id, user_id)
    return get_submitted_feedback_summary_for_user(db, user_id)


@app.get("/users/{user_id}/feedback-summary/received")
def list_received_feedback_summary_for_user(
    user_id: int,
    viewer_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    require_feedback_owner(viewer_user_id, user_id)
    return get_received_feedback_summary_for_user(db, user_id)


@app.get("/users/{user_id}/posts")
def list_posts_for_user(
    user_id: int,
    viewer_user_id: Optional[int] = Query(default=None),
    q: Optional[str] = Query(default=None),
    limit: int = Query(default=12, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    posts_query = (
        db.query(db_models.Post)
        .filter(db_models.Post.author_user_id == user_id)
    )
    if viewer_user_id != user_id:
        filters = [db_models.Post.visibility == POST_VISIBILITY_PUBLIC]
        author = ensure_user_exists(db, user_id)
        viewer_constituency_id = get_viewer_constituency_id(db, viewer_user_id)
        if (
            author.constituency_id is not None
            and viewer_constituency_id == author.constituency_id
        ):
            filters.append(db_models.Post.visibility == POST_VISIBILITY_CONSTITUENCY)
        posts_query = posts_query.filter(or_(*filters))
    if q:
        search_term = f"%{q}%"
        posts_query = posts_query.filter(
            or_(
                db_models.Post.title.ilike(search_term),
                db_models.Post.content.ilike(search_term),
            )
        )
    posts_query = posts_query.order_by(db_models.Post.date_added.desc(), db_models.Post.time_added.desc())
    posts = posts_query.offset(offset).limit(limit).all()
    return [build_post_payload(db, post, viewer_user_id) for post in posts]


@app.post("/users/{user_id}/moderation-action")
def apply_user_moderation_action(
    user_id: int,
    action_payload: UserModerationAction,
    actor_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    target_user = get_or_404(db, db_models.User, user_id)
    require_user_moderation_actor(
        db,
        actor_user_id=actor_user_id,
        target_user=target_user,
    )

    normalized_action = action_payload.action.strip().lower()
    if normalized_action == "verify":
        target_user.verification_status = "verified"
    elif normalized_action == "label_mp":
        assign_user_role_with_rules(db, target_user, "MP")
    elif normalized_action == "label_parliament":
        assign_user_role_with_rules(db, target_user, "Parliament")
    elif normalized_action == "label_constituency":
        assign_user_role_with_rules(db, target_user, "Constituency")
    else:
        raise HTTPException(status_code=400, detail="Unsupported user action")

    db.commit()
    db.refresh(target_user)
    return model_to_dict(target_user)


@app.put("/users/{user_id}")
def update_user(user_id: int, user: UserUpdate, db: Session = Depends(get_db)):
    payload = schema_dump(user, exclude_unset=True)
    if payload.get("password"):
        payload["password"] = hash_password(payload["password"])
    if "email" in payload:
        payload["email"] = normalize_optional_string(payload.get("email"))
    if "username" in payload:
        payload["username"] = normalize_optional_string(payload.get("username"))
    if "mobile_number" in payload:
        payload["mobile_number"] = normalize_optional_string(payload.get("mobile_number"))
    if "fname" in payload:
        payload["fname"] = normalize_optional_string(payload.get("fname"))
    if "lname" in payload:
        payload["lname"] = normalize_optional_string(payload.get("lname"))
    if "company_name" in payload:
        payload["company_name"] = normalize_optional_string(payload.get("company_name"))
    if "company_city" in payload:
        payload["company_city"] = normalize_optional_string(payload.get("company_city"))
    if "type_of_business" in payload:
        payload["type_of_business"] = normalize_optional_string(payload.get("type_of_business"))
    if "theme_colors" in payload:
        payload["theme_colors"] = normalize_optional_string(payload.get("theme_colors"))
    if "type" in payload:
        payload["type"] = normalize_account_type(payload.get("type"))
    ensure_user_identity_available(
        db,
        email=payload.get("email"),
        username=payload.get("username"),
        mobile_number=payload.get("mobile_number"),
        excluding_user_id=user_id,
    )
    if "parent_user_id" in payload and payload.get("parent_user_id") is not None:
        payload["parent_user_id"] = resolve_parent_user_id(
            db,
            parent_user_id=payload["parent_user_id"],
        )
    if "company_country" in payload:
        payload["company_country"] = ensure_valid_company_country(db, payload.get("company_country"))
    location_keys = {
        "district_id",
        "constituency_id",
        "subcounty_id",
        "parish_id",
        "company_country",
        "company_city",
    }
    if payload.keys() & location_keys:
        current_user = get_or_404(db, db_models.User, user_id)
        payload.update(
            normalize_user_location_hierarchy(
                db,
                district_id=payload.get("district_id", current_user.district_id),
                constituency_id=payload.get("constituency_id", current_user.constituency_id),
                subcounty_id=payload.get("subcounty_id", current_user.subcounty_id),
                parish_id=payload.get("parish_id", current_user.parish_id),
            )
        )
    user = UserUpdate(**payload)
    return update_record(db, db_models.User, user_id, user)


@app.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    actor_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    target_user = get_or_404(db, db_models.User, user_id)
    actor = require_admin_user(db, actor_user_id)
    if actor.id == target_user.id:
        raise HTTPException(
            status_code=400,
            detail="Administrators cannot delete their own signed-in account",
        )

    authored_post_ids = [
        post_id
        for (post_id,) in db.query(db_models.Post.id)
        .filter(db_models.Post.author_user_id == target_user.id)
        .all()
    ]
    if authored_post_ids:
        db.query(db_models.PostActionView).filter(
            db_models.PostActionView.post_id.in_(authored_post_ids)
        ).delete(synchronize_session=False)
        db.query(db_models.PostView).filter(
            db_models.PostView.post_id.in_(authored_post_ids)
        ).delete(synchronize_session=False)
        db.query(db_models.PostReaction).filter(
            db_models.PostReaction.post_id.in_(authored_post_ids)
        ).delete(synchronize_session=False)
        db.query(db_models.PostReview).filter(
            db_models.PostReview.post_id.in_(authored_post_ids)
        ).delete(synchronize_session=False)

    db.query(db_models.PostReaction).filter(
        db_models.PostReaction.user_id == target_user.id
    ).delete(synchronize_session=False)
    db.query(db_models.PostReview).filter(
        db_models.PostReview.author_user_id == target_user.id
    ).delete(synchronize_session=False)
    db.query(db_models.Review).filter(
        db_models.Review.author_id == target_user.id
    ).delete(synchronize_session=False)
    db.query(db_models.Feedback).filter(
        or_(
            db_models.Feedback.author_user_id == target_user.id,
            db_models.Feedback.target_user_id == target_user.id,
        )
    ).delete(synchronize_session=False)
    db.query(db_models.EmergingIssue).filter(
        db_models.EmergingIssue.user_id == target_user.id
    ).delete(synchronize_session=False)
    db.query(db_models.IssueTrend).filter(
        db_models.IssueTrend.target_user_id == target_user.id
    ).delete(synchronize_session=False)
    db.query(db_models.Subscription).filter(
        db_models.Subscription.user_id == target_user.id
    ).delete(synchronize_session=False)
    db.query(db_models.User).filter(
        db_models.User.parent_user_id == target_user.id
    ).update({db_models.User.parent_user_id: None}, synchronize_session=False)
    if authored_post_ids:
        db.query(db_models.Post).filter(
            db_models.Post.id.in_(authored_post_ids)
        ).delete(synchronize_session=False)

    db.delete(target_user)
    db.commit()
    return {"message": "User deleted successfully"}


@app.post("/countries", status_code=status.HTTP_201_CREATED)
def create_country(country: CountryCreate, db: Session = Depends(get_db)):
    return create_record(db, db_models.Countries, country)


@app.get("/countries")
def list_countries(db: Session = Depends(get_db)):
    return list_records_ordered_by_name(db, db_models.Countries)


@app.get("/countries/{country_id}")
def get_country(country_id: int, db: Session = Depends(get_db)):
    record = get_or_404(db, db_models.Countries, country_id)
    return model_to_dict(record)


@app.put("/countries/{country_id}")
def update_country(country_id: int, country: CountryUpdate, db: Session = Depends(get_db)):
    return update_record(db, db_models.Countries, country_id, country)


@app.delete("/countries/{country_id}")
def delete_country(country_id: int, db: Session = Depends(get_db)):
    return delete_record(db, db_models.Countries, country_id, "Country deleted successfully")


@app.post("/regions", status_code=status.HTTP_201_CREATED)
def create_region(region: RegionCreate, db: Session = Depends(get_db)):
    ensure_country_exists(db, region.country_id)
    return create_record(db, db_models.Regions, region)


@app.get("/regions")
def list_regions(country_id: Optional[int] = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(db_models.Regions)
    if country_id is not None:
        query = query.filter(db_models.Regions.country_id == country_id)
    records = query.order_by(db_models.Regions.name.asc()).all()
    return [model_to_dict(record) for record in records]


@app.get("/regions/{region_id}")
def get_region(region_id: int, db: Session = Depends(get_db)):
    record = get_or_404(db, db_models.Regions, region_id)
    return model_to_dict(record)


@app.put("/regions/{region_id}")
def update_region(region_id: int, region: RegionUpdate, db: Session = Depends(get_db)):
    payload = schema_dump(region, exclude_unset=True)
    if payload.get("country_id") is not None:
        ensure_country_exists(db, payload["country_id"])
    return update_record(db, db_models.Regions, region_id, RegionUpdate(**payload))


@app.delete("/regions/{region_id}")
def delete_region(region_id: int, db: Session = Depends(get_db)):
    return delete_record(db, db_models.Regions, region_id, "Region deleted successfully")


@app.post("/districts", status_code=status.HTTP_201_CREATED)
def create_district(district: DistrictCreate, db: Session = Depends(get_db)):
    ensure_region_exists(db, district.region_id)
    return create_record(db, db_models.District, district)


@app.get("/districts")
def list_districts(region_id: Optional[int] = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(db_models.District)
    if region_id is not None:
        query = query.filter(db_models.District.region_id == region_id)
    records = query.order_by(db_models.District.name.asc()).all()
    return [model_to_dict(record) for record in records]


@app.get("/districts/{district_id}")
def get_district(district_id: int, db: Session = Depends(get_db)):
    record = get_or_404(db, db_models.District, district_id)
    return model_to_dict(record)


@app.put("/districts/{district_id}")
def update_district(district_id: int, district: DistrictUpdate, db: Session = Depends(get_db)):
    payload = schema_dump(district, exclude_unset=True)
    if payload.get("region_id") is not None:
        ensure_region_exists(db, payload["region_id"])
    return update_record(db, db_models.District, district_id, DistrictUpdate(**payload))


@app.delete("/districts/{district_id}")
def delete_district(district_id: int, db: Session = Depends(get_db)):
    return delete_record(db, db_models.District, district_id, "District deleted successfully")


@app.post("/constituencies", status_code=status.HTTP_201_CREATED)
def create_constituency(constituency: ConstituencyCreate, db: Session = Depends(get_db)):
    ensure_district_exists(db, constituency.district_id)
    return create_record(db, db_models.Constituency, constituency)


@app.get("/constituencies")
def list_constituencies(district_id: Optional[int] = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(db_models.Constituency)
    if district_id is not None:
        query = query.filter(db_models.Constituency.district_id == district_id)
    records = query.order_by(db_models.Constituency.name.asc()).all()
    return [model_to_dict(record) for record in records]


@app.get("/constituencies/{constituency_id}")
def get_constituency(constituency_id: int, db: Session = Depends(get_db)):
    record = get_or_404(db, db_models.Constituency, constituency_id)
    return model_to_dict(record)


@app.put("/constituencies/{constituency_id}")
def update_constituency(constituency_id: int, constituency: ConstituencyUpdate, db: Session = Depends(get_db)):
    payload = schema_dump(constituency, exclude_unset=True)
    if payload.get("district_id") is not None:
        ensure_district_exists(db, payload["district_id"])
    return update_record(
        db,
        db_models.Constituency,
        constituency_id,
        ConstituencyUpdate(**payload),
    )


@app.delete("/constituencies/{constituency_id}")
def delete_constituency(constituency_id: int, db: Session = Depends(get_db)):
    return delete_record(
        db,
        db_models.Constituency,
        constituency_id,
        "Constituency deleted successfully",
    )


@app.post("/subcounties", status_code=status.HTTP_201_CREATED)
def create_subcounty(subcounty: SubcountyCreate, db: Session = Depends(get_db)):
    ensure_constituency_exists(db, subcounty.constituency_id)
    return create_record(db, db_models.Subcounty, subcounty)


@app.get("/subcounties")
def list_subcounties(constituency_id: Optional[int] = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(db_models.Subcounty)
    if constituency_id is not None:
        query = query.filter(db_models.Subcounty.constituency_id == constituency_id)
    records = query.order_by(db_models.Subcounty.name.asc()).all()
    return [model_to_dict(record) for record in records]


@app.get("/subcounties/{subcounty_id}")
def get_subcounty(subcounty_id: int, db: Session = Depends(get_db)):
    record = get_or_404(db, db_models.Subcounty, subcounty_id)
    return model_to_dict(record)


@app.put("/subcounties/{subcounty_id}")
def update_subcounty(subcounty_id: int, subcounty: SubcountyUpdate, db: Session = Depends(get_db)):
    payload = schema_dump(subcounty, exclude_unset=True)
    if payload.get("constituency_id") is not None:
        ensure_constituency_exists(db, payload["constituency_id"])
    return update_record(db, db_models.Subcounty, subcounty_id, SubcountyUpdate(**payload))


@app.delete("/subcounties/{subcounty_id}")
def delete_subcounty(subcounty_id: int, db: Session = Depends(get_db)):
    return delete_record(db, db_models.Subcounty, subcounty_id, "Subcounty deleted successfully")


@app.post("/parishes", status_code=status.HTTP_201_CREATED)
def create_parish(parish: ParishCreate, db: Session = Depends(get_db)):
    ensure_subcounty_exists(db, parish.subcounty_id)
    return create_record(db, db_models.Parish, parish)


@app.get("/parishes")
def list_parishes(subcounty_id: Optional[int] = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(db_models.Parish)
    if subcounty_id is not None:
        query = query.filter(db_models.Parish.subcounty_id == subcounty_id)
    records = query.order_by(db_models.Parish.name.asc()).all()
    return [model_to_dict(record) for record in records]


@app.get("/parishes/{parish_id}")
def get_parish(parish_id: int, db: Session = Depends(get_db)):
    record = get_or_404(db, db_models.Parish, parish_id)
    return model_to_dict(record)


@app.put("/parishes/{parish_id}")
def update_parish(parish_id: int, parish: ParishUpdate, db: Session = Depends(get_db)):
    payload = schema_dump(parish, exclude_unset=True)
    if payload.get("subcounty_id") is not None:
        ensure_subcounty_exists(db, payload["subcounty_id"])
    return update_record(db, db_models.Parish, parish_id, ParishUpdate(**payload))


@app.delete("/parishes/{parish_id}")
def delete_parish(parish_id: int, db: Session = Depends(get_db)):
    return delete_record(db, db_models.Parish, parish_id, "Parish deleted successfully")


@app.post("/villages", status_code=status.HTTP_201_CREATED)
def create_village(village: VillageCreate, db: Session = Depends(get_db)):
    ensure_parish_exists(db, village.parish_id)
    return create_record(db, db_models.Village, village)


@app.get("/villages")
def list_villages(parish_id: Optional[int] = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(db_models.Village)
    if parish_id is not None:
        query = query.filter(db_models.Village.parish_id == parish_id)
    records = query.order_by(db_models.Village.name.asc()).all()
    return [model_to_dict(record) for record in records]


@app.get("/villages/{village_id}")
def get_village(village_id: int, db: Session = Depends(get_db)):
    record = get_or_404(db, db_models.Village, village_id)
    return model_to_dict(record)


@app.put("/villages/{village_id}")
def update_village(village_id: int, village: VillageUpdate, db: Session = Depends(get_db)):
    payload = schema_dump(village, exclude_unset=True)
    if payload.get("parish_id") is not None:
        ensure_parish_exists(db, payload["parish_id"])
    return update_record(db, db_models.Village, village_id, VillageUpdate(**payload))


@app.delete("/villages/{village_id}")
def delete_village(village_id: int, db: Session = Depends(get_db)):
    return delete_record(db, db_models.Village, village_id, "Village deleted successfully")


@app.post("/topics", status_code=status.HTTP_201_CREATED)
def create_topic(topic: TopicsCreate, db: Session = Depends(get_db)):
    ensure_user_exists(db, topic.author_id)
    return create_record(db, db_models.Topics, topic)


@app.get("/topics")
def list_topics(db: Session = Depends(get_db)):
    return list_records(db, db_models.Topics)


@app.get("/users/{user_id}/topics")
def list_topics_for_user(user_id: int, db: Session = Depends(get_db)):
    ensure_user_exists(db, user_id)
    return list_records_by_field(db, db_models.Topics, "author_id", user_id)


@app.get("/topics/{topic_id}/reviews")
def list_reviews_for_topic_route(topic_id: int, db: Session = Depends(get_db)):
    get_or_404(db, db_models.Topics, topic_id)
    return list_reviews_for_topic(db, topic_id)


@app.post("/topics/{topic_id}/reviews", status_code=status.HTTP_201_CREATED)
def create_review_for_topic(topic_id: int, review: ReviewCreate, db: Session = Depends(get_db)):
    get_or_404(db, db_models.Topics, topic_id)
    ensure_user_exists(db, review.author_id)
    payload = schema_dump(review)
    payload["topic_id"] = topic_id
    add_date_time_defaults(payload)
    add_predicted_sentiment(payload, "content")
    payload.update(
        normalize_review_source_hierarchy(
            db,
            district_id=review.district_id,
            constituency_id=review.constituency_id,
            subcounty_id=review.subcounty_id,
            parish_id=review.parish_id,
        )
    )
    return create_record(db, db_models.Review, payload)


@app.get("/topics/{topic_id}")
def get_topic(topic_id: int, db: Session = Depends(get_db)):
    record = get_or_404(db, db_models.Topics, topic_id)
    return model_to_dict(record)


@app.put("/topics/{topic_id}")
def update_topic(topic_id: int, topic: TopicsUpdate, db: Session = Depends(get_db)):
    return update_record(db, db_models.Topics, topic_id, topic)


@app.delete("/topics/{topic_id}")
def delete_topic(topic_id: int, db: Session = Depends(get_db)):
    return delete_record(db, db_models.Topics, topic_id, "Topic deleted successfully")


@app.post("/subscriptions", status_code=status.HTTP_201_CREATED)
def create_subscription(subscription: SubscriptionCreate, db: Session = Depends(get_db)):
    ensure_user_exists(db, subscription.user_id)
    return create_record(db, db_models.Subscription, subscription)


@app.get("/subscriptions")
def list_subscriptions(db: Session = Depends(get_db)):
    return list_records(db, db_models.Subscription)


@app.get("/users/{user_id}/subscriptions")
def list_subscriptions_for_user(user_id: int, db: Session = Depends(get_db)):
    ensure_user_exists(db, user_id)
    return list_records_by_field(db, db_models.Subscription, "user_id", user_id)


@app.get("/subscriptions/{subscription_id}")
def get_subscription(subscription_id: int, db: Session = Depends(get_db)):
    record = get_or_404(db, db_models.Subscription, subscription_id)
    return model_to_dict(record)


@app.put("/subscriptions/{subscription_id}")
def update_subscription(subscription_id: int, subscription: SubscriptionUpdate, db: Session = Depends(get_db)):
    payload = schema_dump(subscription, exclude_unset=True)
    if "user_id" in payload:
        ensure_user_exists(db, payload["user_id"])
    return update_record(db, db_models.Subscription, subscription_id, subscription)


@app.delete("/subscriptions/{subscription_id}")
def delete_subscription(subscription_id: int, db: Session = Depends(get_db)):
    return delete_record(db, db_models.Subscription, subscription_id, "Subscription deleted successfully")


@app.post("/reviews", status_code=status.HTTP_201_CREATED)
def create_review(review: ReviewCreate, db: Session = Depends(get_db)):
    ensure_user_exists(db, review.author_id)
    payload = add_date_time_defaults(schema_dump(review))
    add_predicted_sentiment(payload, "content")
    payload.update(
        normalize_review_source_hierarchy(
            db,
            district_id=review.district_id,
            constituency_id=review.constituency_id,
            subcounty_id=review.subcounty_id,
            parish_id=review.parish_id,
        )
    )
    return create_record(db, db_models.Review, payload)


@app.get("/reviews")
def list_reviews(db: Session = Depends(get_db)):
    return list_records(db, db_models.Review)


@app.get("/reviews/{review_id}")
def get_review(review_id: int, db: Session = Depends(get_db)):
    record = get_or_404(db, db_models.Review, review_id)
    payload = model_to_dict(record)
    payload["is_edited"] = get_review_edited_at(record) is not None
    payload["can_edit"] = can_manage_review(record)
    payload["can_delete"] = can_manage_review(record)
    return payload


@app.put("/reviews/{review_id}")
def update_review(
    review_id: int,
    review: ReviewUpdate,
    actor_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    record = get_or_404(db, db_models.Review, review_id)
    require_review_author(actor_user_id, record.author_id)
    require_review_manage_window(record)
    payload = schema_dump(review, exclude_unset=True)
    if "content" in payload:
        add_predicted_sentiment(payload, "content")
    payload.update(
        normalize_review_source_hierarchy(
            db,
            district_id=payload.get("district_id", record.district_id),
            constituency_id=payload.get("constituency_id", record.constituency_id),
            subcounty_id=payload.get("subcounty_id", record.subcounty_id),
            parish_id=payload.get("parish_id", record.parish_id),
        )
    )
    current_date, current_time = now_parts()
    payload["edited_date"] = current_date
    payload["edited_time"] = current_time
    return update_record(db, db_models.Review, review_id, ReviewUpdate(**payload))


@app.delete("/reviews/{review_id}")
def delete_review(
    review_id: int,
    actor_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    record = get_or_404(db, db_models.Review, review_id)
    require_review_author(actor_user_id, record.author_id)
    require_review_manage_window(record)
    return delete_record(db, db_models.Review, review_id, "Review deleted successfully")


@app.post("/feedbacks", status_code=status.HTTP_201_CREATED)
def create_feedback(feedback: FeedbackCreate, db: Session = Depends(get_db)):
    ensure_user_exists(db, feedback.author_user_id)
    ensure_user_exists(db, feedback.target_user_id)
    payload = add_feedback_defaults(add_date_time_defaults(schema_dump(feedback)))
    return create_record(db, db_models.Feedback, payload)


@app.post("/users/{user_id}/feedbacks", status_code=status.HTTP_201_CREATED)
def create_feedback_for_user(user_id: int, feedback: FeedbackCreate, db: Session = Depends(get_db)):
    ensure_user_exists(db, user_id)
    ensure_user_exists(db, feedback.author_user_id)
    payload = schema_dump(feedback)
    payload["target_user_id"] = user_id
    payload = add_feedback_defaults(add_date_time_defaults(payload))
    return create_record(db, db_models.Feedback, payload)


@app.get("/feedbacks")
def list_feedbacks(
    viewer_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    records = (
        db.query(db_models.Feedback)
        .filter(
            or_(
                db_models.Feedback.author_user_id == viewer_user_id,
                db_models.Feedback.target_user_id == viewer_user_id,
            )
        )
        .order_by(db_models.Feedback.date_added.desc(), db_models.Feedback.time_added.desc())
        .all()
    )
    return [model_to_dict(record) for record in records]


@app.get("/users/{user_id}/feedbacks/received")
def list_received_feedbacks_for_user(
    user_id: int,
    viewer_user_id: int = Query(...),
    status_filter: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    require_feedback_owner(viewer_user_id, user_id)
    query = db.query(db_models.Feedback).filter(db_models.Feedback.target_user_id == user_id)
    if status_filter:
        query = query.filter(db_models.Feedback.status == status_filter)
    return [model_to_dict(record) for record in query.all()]


@app.get("/users/{user_id}/feedbacks/submitted")
def list_submitted_feedbacks_for_user(
    user_id: int,
    viewer_user_id: int = Query(...),
    status_filter: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    require_feedback_owner(viewer_user_id, user_id)
    query = db.query(db_models.Feedback).filter(db_models.Feedback.author_user_id == user_id)
    if status_filter:
        query = query.filter(db_models.Feedback.status == status_filter)
    return [model_to_dict(record) for record in query.all()]


@app.get("/users/{user_id}/feedbacks/analysis-candidates")
def list_feedback_analysis_candidates(
    user_id: int,
    viewer_user_id: int = Query(...),
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db),
):
    require_feedback_owner(viewer_user_id, user_id)
    return list_feedbacks_for_analysis(db, user_id, start_date, end_date)


@app.post("/users/{user_id}/feedbacks/analyse")
def analyse_feedbacks_for_user(
    user_id: int,
    analysis_request: FeedbackAnalysisRequest,
    db: Session = Depends(get_db),
):
    ensure_user_exists(db, user_id)
    if not analysis_request.feedback_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="feedback_ids is required",
        )

    candidate_feedbacks = (
        db.query(db_models.Feedback)
        .filter(db_models.Feedback.id.in_(analysis_request.feedback_ids))
        .filter(db_models.Feedback.target_user_id == user_id)
        .filter(db_models.Feedback.date_added >= analysis_request.start_date)
        .filter(db_models.Feedback.date_added <= analysis_request.end_date)
        .filter(db_models.Feedback.status != "analysed")
        .all()
    )

    if len(candidate_feedbacks) != len(set(analysis_request.feedback_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Some feedback records are missing, outside the selected date range, or already analysed",
        )

    created_issue_records = []
    for issue in analysis_request.emerging_issues:
        issue_record = db_models.EmergingIssue(user_id=user_id, **schema_dump(issue))
        db.add(issue_record)
        created_issue_records.append(issue_record)

    for feedback in candidate_feedbacks:
        feedback.status = "analysed"

    db.commit()
    for issue_record in created_issue_records:
        db.refresh(issue_record)

    return {
        "message": "Feedback analysed successfully",
        "analysed_feedback_ids": [feedback.id for feedback in candidate_feedbacks],
        "emerging_issues": [model_to_dict(issue_record) for issue_record in created_issue_records],
    }


@app.get("/users/{user_id}/feedbacks/both")
def list_all_feedbacks_for_user(
    user_id: int,
    viewer_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    require_feedback_owner(viewer_user_id, user_id)
    return {
        "received": list_records_by_field(db, db_models.Feedback, "target_user_id", user_id),
        "submitted": list_records_by_field(db, db_models.Feedback, "author_user_id", user_id),
    }


@app.get("/feedbacks/{feedback_id}")
def get_feedback(
    feedback_id: int,
    viewer_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    record = get_or_404(db, db_models.Feedback, feedback_id)
    if viewer_user_id not in {record.author_user_id, record.target_user_id}:
        raise HTTPException(status_code=403, detail="You do not have access to this feedback")
    return model_to_dict(record)


@app.put("/feedbacks/{feedback_id}")
def update_feedback(feedback_id: int, feedback: FeedbackUpdate, db: Session = Depends(get_db)):
    record = get_or_404(db, db_models.Feedback, feedback_id)
    payload = schema_dump(feedback, exclude_unset=True)
    if "title" in payload or "description" in payload:
        analysis_payload = {
            "title": payload.get("title", record.title),
            "description": payload.get("description", record.description),
        }
        add_feedback_analysis_fields(analysis_payload)
        payload.update(
            {
                key: analysis_payload[key]
                for key in (
                    "clean_text",
                    "summary",
                    "sentiment",
                    "sentiment_confidence",
                    "sentiment_score",
                    "embending",
                    "embedding_model",
                    "summar_model",
                    "sentiment_model",
                    "inference_provider",
                    "inference_mode",
                    "inference_fallback_used",
                    "inference_fallback_tasks",
                    "inference_latency_ms",
                )
                if key in analysis_payload
            }
        )
    return update_record(db, db_models.Feedback, feedback_id, FeedbackUpdate(**payload))


@app.delete("/feedbacks/{feedback_id}")
def delete_feedback(feedback_id: int, db: Session = Depends(get_db)):
    return delete_record(db, db_models.Feedback, feedback_id, "Feedback deleted successfully")


@app.get("/post-categories")
def list_post_categories(db: Session = Depends(get_db)):
    records = db.query(db_models.PostCategory).order_by(db_models.PostCategory.name.asc()).all()
    return [model_to_dict(record) for record in records]


@app.post("/post-categories", status_code=status.HTTP_201_CREATED)
def create_post_category(
    category: PostCategoryCreate,
    actor_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    ensure_user_exists(db, actor_user_id)
    normalized_name = normalize_post_category_name(category.name)
    if normalized_name is None:
        raise HTTPException(status_code=422, detail="Category name is required")

    existing = (
        db.query(db_models.PostCategory)
        .filter(func.lower(db_models.PostCategory.name) == normalized_name.lower())
        .first()
    )
    if existing:
        return model_to_dict(existing)

    record = db_models.PostCategory(name=normalized_name)
    db.add(record)
    db.commit()
    db.refresh(record)
    return model_to_dict(record)


@app.post("/storage/presign")
def presign_upload(payload: UploadPresignRequest, db: Session = Depends(get_db)):
    author = ensure_user_exists(db, payload.actor_user_id)
    ensure_author_can_create_post(author)

    upload_rules = {
        "post-thumbnails": (
            ALLOWED_POST_THUMBNAIL_EXTENSIONS,
            int(os.getenv("MAX_THUMBNAIL_BYTES", str(5 * 1024 * 1024))),
        ),
        "post-attachments": (
            ALLOWED_POST_ATTACHMENT_EXTENSIONS,
            int(os.getenv("MAX_ATTACHMENT_BYTES", str(20 * 1024 * 1024))),
        ),
    }
    if payload.folder not in upload_rules:
        raise HTTPException(status_code=422, detail="Unsupported upload folder")
    allowed_extensions, max_bytes = upload_rules[payload.folder]
    extension = normalize_upload_extension(payload.filename)
    if extension not in allowed_extensions:
        raise HTTPException(status_code=422, detail="Unsupported file type")
    if payload.file_size > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Uploaded file exceeds the {max_bytes // (1024 * 1024)} MB limit",
        )
    try:
        return create_presigned_upload(
            extension=extension,
            folder=payload.folder,
            content_type=payload.content_type or "application/octet-stream",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Direct upload storage is unavailable or not configured",
        ) from exc


@app.post("/posts", status_code=status.HTTP_201_CREATED)
async def create_post(request: Request, db: Session = Depends(get_db)):
    post = await parse_post_create_payload(request)
    author = ensure_user_exists(db, post.author_user_id)
    ensure_author_can_create_post(author)
    visibility = post.visibility or POST_VISIBILITY_PUBLIC
    if visibility not in POST_VISIBILITIES:
        raise HTTPException(status_code=422, detail="Unsupported visibility value")
    ensure_author_can_use_post_visibility(author, visibility)
    category = ensure_post_category(db, post.category)
    normalized_source = normalize_review_source_hierarchy(
        db,
        district_id=post.district_id,
        constituency_id=post.constituency_id,
        subcounty_id=post.subcounty_id,
        parish_id=post.parish_id,
    )

    added_date, added_time = now_parts()
    record = db_models.Post(
        author_user_id=post.author_user_id,
        title=post.title,
        content=post.content,
        category=category,
        visibility=visibility,
        district_id=normalized_source["district_id"],
        constituency_id=normalized_source["constituency_id"],
        subcounty_id=normalized_source["subcounty_id"],
        parish_id=normalized_source["parish_id"],
        share_token=generate_share_token() if visibility == POST_VISIBILITY_PRIVATE else None,
        thumbnail=post.thumbnail,
        attachment=post.attachment,
        status="published",
        view_count=0,
        date_added=added_date,
        time_added=added_time,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return build_post_payload(db, record, post.author_user_id)


@app.get("/posts")
def list_posts(
    viewer_user_id: Optional[int] = Query(default=None),
    q: Optional[str] = Query(default=None),
    scope: str = Query(default="visible"),
    sort: str = Query(default="default"),
    limit: int = Query(default=12, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    if scope not in {"visible", "public", "own"}:
        raise HTTPException(status_code=422, detail="Unsupported posts scope")
    if sort not in {"default", "featured", "latest"}:
        raise HTTPException(status_code=422, detail="Unsupported posts sort")
    return paginated_visible_posts_for_viewer(
        db,
        viewer_user_id,
        q,
        scope=scope,
        sort=sort,
        limit=limit,
        offset=offset,
    )


@app.get("/posts/{post_id}")
def get_post(
    post_id: int,
    viewer_user_id: Optional[int] = Query(default=None),
    shared_token: Optional[str] = Query(default=None),
    review_limit: int = Query(default=8, ge=1, le=100),
    review_offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    post = get_or_404(db, db_models.Post, post_id)
    if not can_view_post(db, post, viewer_user_id, shared_token):
        raise HTTPException(status_code=403, detail="You do not have access to this post")
    return build_post_detail_payload(
        db,
        post,
        viewer_user_id,
        review_limit=review_limit,
        review_offset=review_offset,
    )


@app.get("/posts/{post_id}/analytics")
def get_post_analytics(
    post_id: int,
    viewer_user_id: Optional[int] = Query(default=None),
    shared_token: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    post = get_or_404(db, db_models.Post, post_id)
    if not can_view_post(db, post, viewer_user_id, shared_token):
        raise HTTPException(status_code=403, detail="You do not have access to this post")
    return build_post_analytics(db, post_id)


@app.post("/posts/{post_id}/views")
def increment_post_views(
    post_id: int,
    viewer_user_id: Optional[int] = Query(default=None),
    viewer_key: Optional[str] = Query(default=None),
    shared_token: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    post = get_or_404(db, db_models.Post, post_id)
    if not can_view_post(db, post, viewer_user_id, shared_token):
        raise HTTPException(status_code=403, detail="You do not have access to this post")

    resolved_viewer_key = build_post_viewer_key(viewer_user_id, viewer_key)
    if resolved_viewer_key is None:
        raise HTTPException(
            status_code=422,
            detail="A viewer identifier is required to record a post view",
        )

    existing_view = (
        db.query(db_models.PostView)
        .filter(db_models.PostView.post_id == post.id)
        .filter(db_models.PostView.viewer_key == resolved_viewer_key)
        .first()
    )

    current_date, current_time = now_parts()
    current_timestamp = datetime.combine(current_date, current_time)
    if existing_view:
        last_recorded_at = get_post_view_recorded_at(existing_view)
        if current_timestamp - last_recorded_at < POST_VIEW_DEDUP_WINDOW:
            return {"post_id": post.id, "view_count": post.view_count or 0, "counted": False}

        existing_view.date_added = current_date
        existing_view.time_added = current_time
    else:
        db.add(
            db_models.PostView(
                post_id=post.id,
                viewer_key=resolved_viewer_key,
                date_added=current_date,
                time_added=current_time,
            )
        )
    post.view_count = (post.view_count or 0) + 1
    db.commit()
    db.refresh(post)
    return {"post_id": post.id, "view_count": post.view_count, "counted": True}


@app.post("/posts/{post_id}/interaction-view")
def increment_post_interaction_view(
    post_id: int,
    viewer_user_id: Optional[int] = Query(default=None),
    viewer_key: Optional[str] = Query(default=None),
    shared_token: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    post = get_or_404(db, db_models.Post, post_id)
    if not can_view_post(db, post, viewer_user_id, shared_token):
        raise HTTPException(status_code=403, detail="You do not have access to this post")

    resolved_viewer_key = build_post_viewer_key(viewer_user_id, viewer_key)
    if resolved_viewer_key is None:
        raise HTTPException(
            status_code=422,
            detail="A viewer identifier is required to record a post interaction view",
        )

    existing_view = (
        db.query(db_models.PostActionView)
        .filter(db_models.PostActionView.post_id == post.id)
        .filter(db_models.PostActionView.viewer_key == resolved_viewer_key)
        .first()
    )
    if existing_view:
        return {"post_id": post.id, "view_count": post.view_count or 0, "counted": False}

    current_date, current_time = now_parts()
    db.add(
        db_models.PostActionView(
            post_id=post.id,
            viewer_key=resolved_viewer_key,
            date_added=current_date,
            time_added=current_time,
        )
    )
    post.view_count = (post.view_count or 0) + 1
    db.commit()
    db.refresh(post)
    return {"post_id": post.id, "view_count": post.view_count, "counted": True}


@app.get("/posts/{post_id}/reviews")
def list_post_reviews(
    post_id: int,
    viewer_user_id: Optional[int] = Query(default=None),
    shared_token: Optional[str] = Query(default=None),
    limit: int = Query(default=8, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    post = get_or_404(db, db_models.Post, post_id)
    if not can_view_post(db, post, viewer_user_id, shared_token):
        raise HTTPException(status_code=403, detail="You do not have access to this post")
    reviews = (
        db.query(db_models.PostReview)
        .filter(db_models.PostReview.post_id == post_id)
        .order_by(db_models.PostReview.date_added.desc(), db_models.PostReview.time_added.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [build_post_review_payload(db, review) for review in reviews]


@app.post("/posts/{post_id}/reviews", status_code=status.HTTP_201_CREATED)
def create_post_review(
    post_id: int,
    review: PostReviewCreate,
    shared_token: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    post = get_or_404(db, db_models.Post, post_id)
    ensure_user_exists(db, review.author_user_id)
    if not can_view_post(db, post, review.author_user_id, shared_token):
        raise HTTPException(status_code=403, detail="You do not have access to this post")
    existing_review = (
        db.query(db_models.PostReview)
        .filter(db_models.PostReview.post_id == post_id)
        .filter(db_models.PostReview.author_user_id == review.author_user_id)
        .first()
    )
    if existing_review:
        raise HTTPException(
            status_code=400,
            detail="You can only review once on a post",
        )
    added_date, added_time = now_parts()
    sentiment = predict_sentiment_label(review.content)
    record = db_models.PostReview(
        post_id=post_id,
        author_user_id=review.author_user_id,
        content=review.content,
        sentiment=sentiment,
        **normalize_review_source_hierarchy(
            db,
            district_id=review.district_id,
            constituency_id=review.constituency_id,
            subcounty_id=review.subcounty_id,
            parish_id=review.parish_id,
        ),
        date_added=added_date,
        time_added=added_time,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return build_post_review_payload(db, record)


@app.put("/posts/{post_id}/reviews/{review_id}")
def update_post_review(
    post_id: int,
    review_id: int,
    review: PostReviewUpdate,
    actor_user_id: int = Query(...),
    shared_token: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    post = get_or_404(db, db_models.Post, post_id)
    if not can_view_post(db, post, actor_user_id, shared_token):
        raise HTTPException(status_code=403, detail="You do not have access to this post")
    record = get_or_404(db, db_models.PostReview, review_id)
    if record.post_id != post_id:
        raise HTTPException(status_code=404, detail="Review not found for this post")
    require_review_author(actor_user_id, record.author_user_id)
    require_review_manage_window(record)
    normalized_source = normalize_review_source_hierarchy(
        db,
        district_id=review.district_id if review.district_id is not None else record.district_id,
        constituency_id=review.constituency_id if review.constituency_id is not None else record.constituency_id,
        subcounty_id=review.subcounty_id if review.subcounty_id is not None else record.subcounty_id,
        parish_id=review.parish_id if review.parish_id is not None else record.parish_id,
    )
    current_date, current_time = now_parts()
    record.content = review.content
    record.sentiment = predict_sentiment_label(review.content)
    record.district_id = normalized_source["district_id"]
    record.constituency_id = normalized_source["constituency_id"]
    record.subcounty_id = normalized_source["subcounty_id"]
    record.parish_id = normalized_source["parish_id"]
    record.edited_date = current_date
    record.edited_time = current_time
    db.commit()
    db.refresh(record)
    return build_post_review_payload(db, record)


@app.delete("/posts/{post_id}/reviews/{review_id}")
def delete_post_review(
    post_id: int,
    review_id: int,
    actor_user_id: int = Query(...),
    shared_token: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    post = get_or_404(db, db_models.Post, post_id)
    if not can_view_post(db, post, actor_user_id, shared_token):
        raise HTTPException(status_code=403, detail="You do not have access to this post")
    record = get_or_404(db, db_models.PostReview, review_id)
    if record.post_id != post_id:
        raise HTTPException(status_code=404, detail="Review not found for this post")
    require_review_author(actor_user_id, record.author_user_id)
    require_review_manage_window(record)
    db.delete(record)
    db.commit()
    return {"message": "Review deleted successfully"}


@app.post("/posts/{post_id}/reactions")
def react_to_post(
    post_id: int,
    reaction: PostReactionCreate,
    shared_token: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    post = get_or_404(db, db_models.Post, post_id)
    ensure_user_exists(db, reaction.user_id)
    if reaction.reaction_type not in POST_REACTIONS:
        raise HTTPException(status_code=422, detail="Unsupported reaction type")
    if not can_view_post(db, post, reaction.user_id, shared_token):
        raise HTTPException(status_code=403, detail="You do not have access to this post")

    existing = (
        db.query(db_models.PostReaction)
        .filter(db_models.PostReaction.post_id == post_id)
        .filter(db_models.PostReaction.user_id == reaction.user_id)
        .first()
    )

    action = "created"
    if existing and existing.reaction_type == reaction.reaction_type:
        db.delete(existing)
        action = "removed"
    else:
        added_date, added_time = now_parts()
        if existing:
            existing.reaction_type = reaction.reaction_type
            existing.date_added = added_date
            existing.time_added = added_time
            action = "updated"
        else:
            record = db_models.PostReaction(
                post_id=post_id,
                user_id=reaction.user_id,
                reaction_type=reaction.reaction_type,
                date_added=added_date,
                time_added=added_time,
            )
            db.add(record)

    db.commit()
    return {"action": action, "reaction_summary": build_post_reaction_summary(db, post_id)}


@app.put("/posts/{post_id}")
def update_post(
    post_id: int,
    post: PostUpdate,
    actor_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    record = get_or_404(db, db_models.Post, post_id)
    require_post_author(actor_user_id, record)
    payload = schema_dump(post, exclude_unset=True)
    if "category" in payload:
        payload["category"] = ensure_post_category(db, payload.get("category"))
    if "visibility" in payload:
        next_visibility = payload["visibility"] or POST_VISIBILITY_PUBLIC
        if next_visibility not in POST_VISIBILITIES:
            raise HTTPException(status_code=422, detail="Unsupported visibility value")
        author = ensure_user_exists(db, record.author_user_id)
        ensure_author_can_use_post_visibility(author, next_visibility)
        payload["visibility"] = next_visibility
    location_keys = {"district_id", "constituency_id", "subcounty_id", "parish_id"}
    if payload.keys() & location_keys:
        payload.update(
            normalize_review_source_hierarchy(
                db,
                district_id=payload.get("district_id", record.district_id),
                constituency_id=payload.get("constituency_id", record.constituency_id),
                subcounty_id=payload.get("subcounty_id", record.subcounty_id),
                parish_id=payload.get("parish_id", record.parish_id),
            )
        )

    for field, value in payload.items():
        setattr(record, field, value)

    if record.visibility == "private" and not record.share_token:
        record.share_token = generate_share_token()

    db.commit()
    db.refresh(record)
    return build_post_payload(db, record, record.author_user_id)


@app.delete("/posts/{post_id}")
def delete_post(
    post_id: int,
    actor_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    record = get_or_404(db, db_models.Post, post_id)
    require_post_author(actor_user_id, record)
    return delete_record(db, db_models.Post, post_id, "Post deleted successfully")


@app.get("/search")
def search(
    q: str = Query(...),
    viewer_user_id: Optional[int] = Query(default=None),
    limit: int = Query(default=12, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return {
        "users": paginated_visible_users_for_viewer(
            db,
            viewer_user_id,
            q,
            limit=limit,
            offset=offset,
        ),
        "posts": paginated_visible_posts_for_viewer(
            db,
            viewer_user_id,
            q,
            limit=limit,
            offset=offset,
        ),
    }


@app.get("/search/users")
def search_users(
    q: str = Query(...),
    viewer_user_id: Optional[int] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return paginated_visible_users_for_viewer(
        db,
        viewer_user_id,
        q,
        limit=limit,
        offset=offset,
    )


@app.get("/search/posts")
def search_posts(
    q: str = Query(...),
    viewer_user_id: Optional[int] = Query(default=None),
    limit: int = Query(default=12, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return paginated_visible_posts_for_viewer(
        db,
        viewer_user_id,
        q,
        limit=limit,
        offset=offset,
    )


@app.get("/emerging-issues")
def list_emerging_issues(db: Session = Depends(get_db)):
    return list_records(db, db_models.EmergingIssue)


@app.get("/users/{user_id}/emerging-issues")
def list_emerging_issues_for_user(
    user_id: int,
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    ensure_user_exists(db, user_id)
    records = (
        db.query(db_models.EmergingIssue)
        .filter(db_models.EmergingIssue.user_id == user_id)
        .order_by(db_models.EmergingIssue.date_added.desc(), db_models.EmergingIssue.time_added.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [model_to_dict(record) for record in records]


@app.get("/emerging-issues/{issue_id}")
def get_emerging_issue(issue_id: int, db: Session = Depends(get_db)):
    record = get_or_404(db, db_models.EmergingIssue, issue_id)
    return model_to_dict(record)


@app.put("/issues/{issue_id}/status")
def update_modeled_issue_status(
    issue_id: int,
    status_payload: IssueStatusUpdate,
    viewer_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    viewer = ensure_user_exists(db, viewer_user_id)
    issue = get_or_404(db, db_models.Issue, issue_id)
    allowed_statuses = {"pending": "Pending", "in progress": "In Progress", "inprogress": "In Progress", "resolved": "Resolved"}
    normalized = allowed_statuses.get(status_payload.status.strip().lower())
    if normalized is None:
        raise HTTPException(status_code=422, detail="Status must be Pending, In Progress, or Resolved")

    location_maps = get_location_reference_maps(db)
    viewer_country_id = resolve_user_country_id(db, viewer, location_maps)
    if viewer_country_id is not None and issue.country_id is not None and issue.country_id != viewer_country_id:
        raise HTTPException(status_code=403, detail="You can only update emerging issues from your country")

    issue.status = normalized
    issue.updated_at = datetime.now()
    db.commit()
    db.refresh(issue)
    return model_to_dict(issue)


@app.get("/emerging-issues/{issue_id}/feedbacks")
def list_feedbacks_for_emerging_issue(
    issue_id: int,
    viewer_user_id: int = Query(...),
    scope: str = Query(default="user"),
    target_user_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    if scope not in {"user", "national"}:
        raise HTTPException(status_code=422, detail="Unsupported issue feedback scope")

    viewer = ensure_user_exists(db, viewer_user_id)
    query = db.query(db_models.Feedback).filter(db_models.Feedback.issue_id == issue_id)

    if scope == "user":
        resolved_target_user_id = target_user_id or viewer_user_id
        require_feedback_owner(viewer_user_id, resolved_target_user_id)
        query = query.filter(db_models.Feedback.target_user_id == resolved_target_user_id)
    else:
        location_maps = get_location_reference_maps(db)
        viewer_country_id = resolve_user_country_id(db, viewer, location_maps)
        if viewer_country_id is None:
            raise HTTPException(
                status_code=422,
                detail="Your country could not be resolved for national issue feedbacks",
            )
        feedbacks = (
            query.order_by(
                db_models.Feedback.date_added.desc(),
                db_models.Feedback.time_added.desc(),
                db_models.Feedback.id.desc(),
            )
            .all()
        )
        author_ids = {
            feedback.author_user_id
            for feedback in feedbacks
            if feedback.author_user_id is not None
        }
        authors = db.query(db_models.User).filter(db_models.User.id.in_(author_ids)).all() if author_ids else []
        author_by_id = {author.id: author for author in authors}
        return [
            build_feedback_payload(db, feedback)
            for feedback in feedbacks
            if resolve_user_country_id(db, author_by_id.get(feedback.author_user_id), location_maps)
            == viewer_country_id
        ]

    records = (
        query.order_by(
            db_models.Feedback.date_added.desc(),
            db_models.Feedback.time_added.desc(),
            db_models.Feedback.id.desc(),
        )
        .all()
    )
    return [build_feedback_payload(db, record) for record in records]


@app.get("/issue-analytics")
def get_issue_analytics(
    viewer_user_id: int = Query(...),
    scope: str = Query(default="national"),
    period: str = Query(default="weekly"),
    target_user_id: Optional[int] = Query(default=None),
    country_id: Optional[int] = Query(default=None),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    ensure_user_exists(db, viewer_user_id)
    return build_issue_analytics_payload(
        db,
        scope=scope,
        period=period,
        viewer_user_id=viewer_user_id,
        target_user_id=target_user_id,
        country_id=country_id,
        limit=limit,
    )


@app.get("/predict")
def predict_sentiment():
    #sentiment = predict_sentiment_class('More details about the issue being faced. It is really bad and I am not happy with the service.')
    sentiment = process_feedback("The health centre has had no medicine for three weeks.")
    return sentiment

@app.post("/admin/run-bertopic")
def run_bertopic(
    actor_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    require_admin_user(db, actor_user_id)
    require_ml_enabled()
    feedbacks = list_feedbacks_for_topic_modeling(db)
    if len(feedbacks) < 10:
        raise HTTPException(
            status_code=422,
            detail="BERTopic requires at least 10 feedback records with clean_text and saved embeddings",
        )

    result = train_bertopic(feedbacks)
    issue_id_by_topic = save_bertopic_results(db, result)

    return {
        "message": "BERTopic completed",
        "total_feedbacks": len(feedbacks),
        "topics_found": len(result["issues"]),
        "model_version": result["model_version"],
        "model_path": result["model_path"],
        "issues_saved": len(issue_id_by_topic),
    }


@app.post("/admin/initialize-db-with-seed-data")
def initialize_db_with_seed_data(
    actor_user_id: Optional[int] = Query(default=None),
    setup_token: Optional[str] = Query(default=None),
):
    from seed_dummy_data import (
        DEMO_SEED_TAG,
        ensure_primary_admin,
        get_uganda_location_paths,
        label_existing_seed_data,
        seed_emerging_issues,
        seed_feedbacks,
        seed_posts_reviews_and_reactions,
        seed_skylab_analytics_data,
        seed_subscriptions,
        seed_topics_and_reviews,
        seed_users,
        update_legacy_bulk_posts,
    )

    initialize_database(include_reference_data=True)
    db = SessionLocal()
    try:
        authorize_database_admin_action(
            db,
            actor_user_id=actor_user_id,
            setup_token=setup_token,
        )
        label_existing_seed_data(db)
        users = seed_users(db)
        ensure_primary_admin(db, get_uganda_location_paths(db))
        seed_topics_and_reviews(db, users)
        seed_feedbacks(db, users)
        seed_skylab_analytics_data(db, users)
        update_legacy_bulk_posts(db)
        seed_posts_reviews_and_reactions(db, users)
        seed_subscriptions(db, users)
        seed_emerging_issues(db, users)
        db.commit()
        return {
            "message": "Database initialized with seed data",
            "seed_tag": DEMO_SEED_TAG,
            "counts": {
                "users": db.query(db_models.User).filter(db_models.User.seed_tag == DEMO_SEED_TAG).count(),
                "topics": db.query(db_models.Topics).filter(db_models.Topics.seed_tag == DEMO_SEED_TAG).count(),
                "feedbacks": db.query(db_models.Feedback).filter(db_models.Feedback.seed_tag == DEMO_SEED_TAG).count(),
                "posts": db.query(db_models.Post).filter(db_models.Post.seed_tag == DEMO_SEED_TAG).count(),
                "emerging_issues": db.query(db_models.EmergingIssue).filter(db_models.EmergingIssue.seed_tag == DEMO_SEED_TAG).count(),
            },
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@app.post("/admin/initialize-db")
def initialize_db(
    actor_user_id: Optional[int] = Query(default=None),
    setup_token: Optional[str] = Query(default=None),
    include_reference_data: bool = Query(default=True),
):
    initialize_database(include_reference_data=include_reference_data)
    db = SessionLocal()
    try:
        authorize_database_admin_action(
            db,
            actor_user_id=actor_user_id,
            setup_token=setup_token,
        )
        return {
            "message": "Database initialized",
            "include_reference_data": include_reference_data,
        }
    finally:
        db.close()


@app.delete("/admin/seed-data")
def remove_seed_data(
    actor_user_id: Optional[int] = Query(default=None),
    setup_token: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    seed_tag = "ugvoice_demo_seed"
    from seed_dummy_data import label_existing_seed_data

    initialize_database(include_reference_data=False)
    authorize_database_admin_action(
        db,
        actor_user_id=actor_user_id,
        setup_token=setup_token,
    )
    label_existing_seed_data(db)

    seed_post_ids = [
        post_id
        for (post_id,) in db.query(db_models.Post.id)
        .filter(db_models.Post.seed_tag == seed_tag)
        .all()
    ]
    seed_user_ids = [
        user_id
        for (user_id,) in db.query(db_models.User.id)
        .filter(db_models.User.seed_tag == seed_tag)
        .all()
    ]

    deleted = {}
    if seed_post_ids:
        deleted["post_action_views"] = db.query(db_models.PostActionView).filter(db_models.PostActionView.post_id.in_(seed_post_ids)).delete(synchronize_session=False)
        deleted["post_views"] = db.query(db_models.PostView).filter(db_models.PostView.post_id.in_(seed_post_ids)).delete(synchronize_session=False)
    else:
        deleted["post_action_views"] = 0
        deleted["post_views"] = 0

    deleted["post_reactions"] = db.query(db_models.PostReaction).filter(db_models.PostReaction.seed_tag == seed_tag).delete(synchronize_session=False)
    deleted["post_reviews"] = db.query(db_models.PostReview).filter(db_models.PostReview.seed_tag == seed_tag).delete(synchronize_session=False)
    deleted["posts"] = db.query(db_models.Post).filter(db_models.Post.seed_tag == seed_tag).delete(synchronize_session=False)
    deleted["feedbacks"] = db.query(db_models.Feedback).filter(db_models.Feedback.seed_tag == seed_tag).delete(synchronize_session=False)
    deleted["reviews"] = db.query(db_models.Review).filter(db_models.Review.seed_tag == seed_tag).delete(synchronize_session=False)
    deleted["emerging_issues"] = db.query(db_models.EmergingIssue).filter(db_models.EmergingIssue.seed_tag == seed_tag).delete(synchronize_session=False)
    deleted["subscriptions"] = db.query(db_models.Subscription).filter(db_models.Subscription.seed_tag == seed_tag).delete(synchronize_session=False)
    deleted["topics"] = db.query(db_models.Topics).filter(db_models.Topics.seed_tag == seed_tag).delete(synchronize_session=False)

    if seed_user_ids:
        db.query(db_models.User).filter(db_models.User.parent_user_id.in_(seed_user_ids)).update(
            {db_models.User.parent_user_id: None},
            synchronize_session=False,
        )
    deleted["users"] = db.query(db_models.User).filter(db_models.User.seed_tag == seed_tag).delete(synchronize_session=False)

    db.commit()
    return {
        "message": "Seed data removed",
        "seed_tag": seed_tag,
        "deleted": deleted,
    }


@app.post("/users/{user_id}/run-bertopic")
def run_user_bertopic(
    user_id: int,
    actor_user_id: int = Query(...),
    timeframe: str = Query(default="monthly"),
    db: Session = Depends(get_db),
):
    require_feedback_owner(actor_user_id, user_id)
    require_ml_enabled()
    start_date = timeframe_to_start_date(timeframe)
    feedbacks = list_feedbacks_for_topic_modeling(
        db,
        target_user_id=user_id,
        start_date=start_date,
        end_date=date.today(),
    )
    if len(feedbacks) < 10:
        raise HTTPException(
            status_code=422,
            detail="There is no enough information to generate emerging issues, you need to have at least 10 received feedbacks.",
        )

    result = train_bertopic(feedbacks, model_version=f"user-{user_id}-{timeframe}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}")
    issue_id_by_topic = save_bertopic_results(db, result)

    return {
        "message": "Emerging issues refreshed",
        "timeframe": timeframe,
        "start_date": start_date,
        "total_feedbacks": len(feedbacks),
        "topics_found": len(result["issues"]),
        "model_version": result["model_version"],
        "model_path": result["model_path"],
        "issues_saved": len(issue_id_by_topic),
    }


@app.post("/national/run-bertopic")
def run_country_bertopic(
    actor_user_id: int = Query(...),
    timeframe: str = Query(default="monthly"),
    db: Session = Depends(get_db),
):
    actor = ensure_user_exists(db, actor_user_id)
    require_ml_enabled()
    location_maps = get_location_reference_maps(db)
    country_id = resolve_user_country_id(db, actor, location_maps)
    if country_id is None:
        raise HTTPException(
            status_code=422,
            detail="Your country could not be resolved, so national emerging issues cannot be generated.",
        )

    start_date = timeframe_to_start_date(timeframe)
    feedbacks = list_country_feedbacks_for_topic_modeling(
        db,
        country_id=country_id,
        location_maps=location_maps,
        start_date=start_date,
        end_date=date.today(),
    )
    if len(feedbacks) < 10:
        raise HTTPException(
            status_code=422,
            detail="There is no enough information to generate national emerging issues, you need at least 10 feedbacks from your country.",
        )

    result = train_bertopic(
        feedbacks,
        model_version=f"national-country-{country_id}-{timeframe}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
    )
    issue_id_by_topic = save_bertopic_results(db, result)

    return {
        "message": "National emerging issues refreshed",
        "timeframe": timeframe,
        "start_date": start_date,
        "country_id": country_id,
        "total_feedbacks": len(feedbacks),
        "topics_found": len(result["issues"]),
        "model_version": result["model_version"],
        "model_path": result["model_path"],
        "issues_saved": len(issue_id_by_topic),
    }
