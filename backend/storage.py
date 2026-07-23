"""Persistent upload storage with local-development and DigitalOcean Spaces backends."""

from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4


BACKEND_DIR = Path(__file__).resolve().parent
LOCAL_UPLOADS_DIR = BACKEND_DIR / "uploads"


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def storage_backend() -> str:
    configured = os.getenv("UGVOICE_STORAGE_BACKEND", "").strip().lower()
    if configured:
        return configured
    if os.getenv("VERCEL"):
        return "spaces"
    return "spaces" if os.getenv("SPACES_BUCKET") else "local"


def using_local_storage() -> bool:
    return storage_backend() == "local"


def ensure_local_upload_directories() -> None:
    for folder in ("post-thumbnails", "post-attachments"):
        (LOCAL_UPLOADS_DIR / folder).mkdir(parents=True, exist_ok=True)


def _spaces_client():
    try:
        import boto3
        from botocore.config import Config
    except ImportError as exc:
        raise RuntimeError("boto3 is required when UGVOICE_STORAGE_BACKEND=spaces") from exc

    region = os.environ["SPACES_REGION"]
    endpoint = os.getenv("SPACES_ENDPOINT") or f"https://{region}.digitaloceanspaces.com"
    return boto3.client(
        "s3",
        region_name=region,
        endpoint_url=endpoint,
        aws_access_key_id=os.environ["SPACES_KEY"],
        aws_secret_access_key=os.environ["SPACES_SECRET"],
        config=Config(signature_version="s3v4"),
    )


def _spaces_public_url(object_key: str) -> str:
    base_url = os.getenv("SPACES_CDN_ENDPOINT", "").strip().rstrip("/")
    if not base_url:
        region = os.environ["SPACES_REGION"]
        bucket = os.environ["SPACES_BUCKET"]
        base_url = f"https://{bucket}.{region}.digitaloceanspaces.com"
    return f"{base_url}/{object_key}"


def create_presigned_upload(
    *,
    extension: str,
    folder: str,
    content_type: str,
    expires_in: int = 900,
) -> dict[str, object]:
    if storage_backend() != "spaces":
        raise RuntimeError("Direct uploads require DigitalOcean Spaces")

    stored_name = f"{uuid4().hex}{extension}"
    object_key = f"{folder}/{stored_name}"
    parameters = {
        "Bucket": os.environ["SPACES_BUCKET"],
        "Key": object_key,
        "ContentType": content_type,
    }
    headers = {"Content-Type": content_type}
    if _env_bool("SPACES_PUBLIC_FILES", default=True):
        parameters["ACL"] = "public-read"
        headers["x-amz-acl"] = "public-read"
    upload_url = _spaces_client().generate_presigned_url(
        "put_object",
        Params=parameters,
        ExpiresIn=expires_in,
        HttpMethod="PUT",
    )
    return {
        "upload_url": upload_url,
        "public_url": _spaces_public_url(object_key),
        "headers": headers,
        "expires_in": expires_in,
    }


def save_upload(
    file_bytes: bytes,
    *,
    extension: str,
    folder: str,
    content_type: str | None,
) -> str:
    stored_name = f"{uuid4().hex}{extension}"
    object_key = f"{folder}/{stored_name}"

    if using_local_storage():
        ensure_local_upload_directories()
        (LOCAL_UPLOADS_DIR / object_key).write_bytes(file_bytes)
        return f"/uploads/{object_key}"

    if storage_backend() != "spaces":
        raise RuntimeError(
            "UGVOICE_STORAGE_BACKEND must be either 'local' or 'spaces'"
        )

    extra_args = {"ContentType": content_type or "application/octet-stream"}
    if _env_bool("SPACES_PUBLIC_FILES", default=True):
        extra_args["ACL"] = "public-read"
    _spaces_client().put_object(
        Bucket=os.environ["SPACES_BUCKET"],
        Key=object_key,
        Body=file_bytes,
        **extra_args,
    )
    return _spaces_public_url(object_key)
