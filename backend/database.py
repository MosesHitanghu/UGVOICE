import json
import os
from importlib.resources import files
from pathlib import Path
from urllib.parse import quote_plus
from uuid import uuid4

import db_models
from sqlalchemy import bindparam, create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR.parent / ".env.local")
load_dotenv(BACKEND_DIR / ".env.local")
load_dotenv(BACKEND_DIR / ".env")

DB_NAME = "mambo_db"
DB_USER = "postgres"
DB_PASS = "Goodness"
DB_HOST = "localhost"
DB_PORT = "5432"

DATABASE_URL_ENV_NAMES = (
    "trueplot_DATABASE_URL",
    "trueplot_POSTGRES_URL",
    "DATABASE_URL",
    "POSTGRES_URL",
    "DATABASE_URL_UNPOOLED",
    "POSTGRES_URL_NON_POOLING",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL_NO_SSL",
    "NEON_DATABASE_URL",
    "NEON_POSTGRES_URL",
)

DATABASE_COMPONENT_PREFIXES = (
    "trueplot_DATABASE_URL",
    "trueplot_POSTGRES_URL",
    "POSTGRES",
    "NEON",
)


def normalize_database_url(value: str) -> str:
    normalized = value.strip().strip("'\"")
    if normalized.startswith("postgres://"):
        normalized = normalized.replace("postgres://", "postgresql://", 1)
    return normalized


def is_valid_database_url(value: str) -> bool:
    if "://" not in value:
        return False
    try:
        make_url(value)
    except Exception:
        return False
    return True


def build_database_url_from_components(prefix: str) -> str | None:
    user = os.getenv(f"{prefix}_USER") or os.getenv(f"{prefix}_PGUSER")
    password = os.getenv(f"{prefix}_PASSWORD") or os.getenv(f"{prefix}_PGPASSWORD")
    host = os.getenv(f"{prefix}_HOST") or os.getenv(f"{prefix}_PGHOST")
    database = (
        os.getenv(f"{prefix}_DATABASE")
        or os.getenv(f"{prefix}_PGDATABASE")
        or os.getenv(f"{prefix}_DB")
    )
    port = os.getenv(f"{prefix}_PORT") or os.getenv(f"{prefix}_PGPORT") or "5432"

    if not all([user, password, host, database]):
        return None

    return (
        f"postgresql://{quote_plus(user)}:{quote_plus(password)}"
        f"@{host}:{port}/{quote_plus(database)}?sslmode=require"
    )


def get_database_url_and_source() -> tuple[str | None, str | None]:
    for env_name in DATABASE_URL_ENV_NAMES:
        value = os.getenv(env_name)
        if not value:
            continue
        database_url = normalize_database_url(value)
        if is_valid_database_url(database_url):
            return database_url, env_name

    for prefix in DATABASE_COMPONENT_PREFIXES:
        database_url = build_database_url_from_components(prefix)
        if database_url and is_valid_database_url(database_url):
            return database_url, f"{prefix}_* components"

    return None, None


def get_database_url() -> str | None:
    database_url, _ = get_database_url_and_source()
    return database_url


LOCAL_DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
CONFIGURED_DATABASE_URL, DATABASE_URL_SOURCE = get_database_url_and_source()
SQLALCHEMY_DATABASE_URL = CONFIGURED_DATABASE_URL or LOCAL_DATABASE_URL

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
    poolclass=NullPool,
    connect_args={
        "connect_timeout": int(os.getenv("DB_CONNECT_TIMEOUT_SECONDS", "10")),
    },
)


def database_configuration_summary() -> dict:
    url = make_url(SQLALCHEMY_DATABASE_URL)
    return {
        "configured": CONFIGURED_DATABASE_URL is not None,
        "source": DATABASE_URL_SOURCE or "local fallback",
        "driver": url.drivername,
        "host": url.host,
        "port": url.port,
        "database": url.database,
        "sslmode": url.query.get("sslmode"),
    }


COUNTRIES_SOURCE_PATH = files("tzdata.zoneinfo").joinpath("iso3166.tab")
UGANDA_HIERARCHY_PATH = BACKEND_DIR / "uganda_administrative_hierarchy.json"
KAMPALA_HIERARCHY_PATH = BACKEND_DIR / "kampala_administrative_structure.json"
DEFAULT_POST_CATEGORIES = [
    "Bill",
    "Amendment",
    "Oversight",
    "Accountability",
    "Reports",
    "Recommendations",
    "Adjournment",
    "Suspension Motions",
    "Petitions",
    "Impeachment",
]


def sync_table_id_sequence(connection, table_name: str):
    sequence_name = connection.execute(
        text("SELECT pg_get_serial_sequence(:table_name, 'id')"),
        {"table_name": table_name},
    ).scalar()

    if not sequence_name:
        return

    max_id = connection.execute(
        text(f"SELECT COALESCE(MAX(id), 0) FROM {table_name}")
    ).scalar()

    connection.execute(
        text("SELECT setval(:sequence_name, :sequence_value, :is_called)"),
        {
            "sequence_name": sequence_name,
            "sequence_value": max_id if max_id > 0 else 1,
            "is_called": max_id > 0,
        },
    )


def ensure_database_exists():
    # Managed PostgreSQL providers provision the database and commonly deny
    # CREATE DATABASE. Only local development creates it implicitly by default.
    create_database = os.getenv(
        "UGVOICE_CREATE_DATABASE",
        "false" if CONFIGURED_DATABASE_URL else "true",
    ).strip().lower() in {"1", "true", "yes", "on"}
    if not create_database:
        return

    # Connect to a known admin database first so we can create the app database if it is missing.
    url = make_url(SQLALCHEMY_DATABASE_URL)
    target_database = url.database
    admin_database = "postgres" if target_database != "postgres" else "template1"
    admin_engine = create_engine(
        url.set(database=admin_database),
        isolation_level="AUTOCOMMIT",
        pool_pre_ping=True,
    )

    try:
        with admin_engine.connect() as connection:
            database_exists = connection.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :database_name"),
                {"database_name": target_database},
            ).scalar()

            if not database_exists:
                safe_database_name = target_database.replace('"', '""')
                connection.execute(text(f'CREATE DATABASE "{safe_database_name}"'))
    except OperationalError as exc:
        raise RuntimeError(
            f"Unable to connect to PostgreSQL to create or verify database '{target_database}'."
        ) from exc
    finally:
        admin_engine.dispose()


def ensure_users_table():
    # Rename the legacy profiles table so the physical database matches the app terminology.
    with engine.begin() as connection:
        profiles_exists = connection.execute(
            text("SELECT to_regclass('public.profiles')")
        ).scalar()
        users_exists = connection.execute(
            text("SELECT to_regclass('public.users')")
        ).scalar()

        if profiles_exists and users_exists:
            raise RuntimeError(
                "Both 'profiles' and 'users' tables exist. Please merge them manually before startup."
            )

        if profiles_exists and not users_exists:
            connection.execute(text("ALTER TABLE profiles RENAME TO users"))


def ensure_reviews_table():
    # Rename or merge the legacy topic-feedback table so topic feedback uses the reviews name.
    with engine.begin() as connection:
        legacy_table_exists = connection.execute(
            text("SELECT to_regclass('public.feedbackfortopics')")
        ).scalar()
        comments_exists = connection.execute(
            text("SELECT to_regclass('public.comments')")
        ).scalar()
        reviews_exists = connection.execute(
            text("SELECT to_regclass('public.reviews')")
        ).scalar()

        if legacy_table_exists and reviews_exists:
            connection.execute(
                text(
                    """
                    INSERT INTO reviews (
                        id,
                        topic_id,
                        author_id,
                        content,
                        date_added,
                        time_added,
                        origin_country,
                        origin_city,
                        origin_latitude,
                        origin_longitude,
                        sentiment
                    )
                    SELECT
                        id,
                        topic_id,
                        author_id,
                        content,
                        date_added,
                        time_added,
                        origin_country,
                        origin_city,
                        origin_latitude,
                        origin_longitude,
                        sentiment
                    FROM feedbackfortopics
                    ON CONFLICT (id) DO NOTHING
                    """
                )
            )
        elif legacy_table_exists and not reviews_exists:
            connection.execute(text("ALTER TABLE feedbackfortopics RENAME TO reviews"))

        if comments_exists and reviews_exists:
            connection.execute(
                text(
                    """
                    INSERT INTO reviews (
                        id,
                        topic_id,
                        author_id,
                        content,
                        date_added,
                        time_added,
                        origin_country,
                        origin_city,
                        origin_latitude,
                        origin_longitude,
                        sentiment
                    )
                    SELECT
                        id,
                        topic_id,
                        author_id,
                        content,
                        date_added,
                        time_added,
                        origin_country,
                        origin_city,
                        origin_latitude,
                        origin_longitude,
                        sentiment
                    FROM comments
                    ON CONFLICT (id) DO NOTHING
                    """
                )
            )
            return

        if comments_exists and not reviews_exists:
            connection.execute(text("ALTER TABLE comments RENAME TO reviews"))


def ensure_post_reviews_table():
    # Rename or merge the legacy post_comments table so post reviews use the new naming.
    with engine.begin() as connection:
        post_comments_exists = connection.execute(
            text("SELECT to_regclass('public.post_comments')")
        ).scalar()
        post_reviews_exists = connection.execute(
            text("SELECT to_regclass('public.post_reviews')")
        ).scalar()

        if post_comments_exists and post_reviews_exists:
            connection.execute(
                text(
                    """
                    INSERT INTO post_reviews (
                        id,
                        post_id,
                        author_user_id,
                        content,
                        date_added,
                        time_added
                    )
                    SELECT
                        id,
                        post_id,
                        author_user_id,
                        content,
                        date_added,
                        time_added
                    FROM post_comments
                    ON CONFLICT (id) DO NOTHING
                    """
                )
            )
            return

        if post_comments_exists and not post_reviews_exists:
            connection.execute(text("ALTER TABLE post_comments RENAME TO post_reviews"))


def drop_obsolete_messaging_tables():
    """Remove the retired private-messaging schema and all stored chat data."""
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                DROP TABLE IF EXISTS
                    messaging_conversation_participants,
                    messaging_messages,
                    messaging_conversations
                CASCADE
                """
            )
        )


def ensure_primary_key_sequences():
    # Keep serial/identity sequences aligned after table renames, merges, or manual seeded inserts.
    with engine.begin() as connection:
        tables = [
            "users",
            "topics",
            "reviews",
            "feedbacks",
            "posts",
            "post_reviews",
            "post_reactions",
            "post_action_views",
            "subscriptions",
            '"emergingIssues"',
            "issues",
            "issue_trends",
            "countries",
            "regions",
            "districts",
            "constituencies",
            "subcounties",
            "parishes",
            "villages",
        ]

        for table_name in tables:
            exists = connection.execute(
                text(f"SELECT to_regclass('public.{table_name}')")
            ).scalar()
            if exists:
                sync_table_id_sequence(connection, table_name)


def ensure_feedbacks_table():
    # Rename or merge the legacy openFeedbacks table so open feedback uses the simpler feedbacks name.
    with engine.begin() as connection:
        legacy_table_exists = connection.execute(
            text("""SELECT to_regclass('public."openFeedbacks"')""")
        ).scalar()
        feedbacks_exists = connection.execute(
            text("SELECT to_regclass('public.feedbacks')")
        ).scalar()

        if legacy_table_exists and feedbacks_exists:
            author_user_id_exists = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'openFeedbacks'
                      AND column_name = 'author_user_id'
                    """
                )
            ).scalar()
            target_user_id_exists = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'openFeedbacks'
                      AND column_name = 'target_user_id'
                    """
                )
            ).scalar()

            author_column = "author_user_id" if author_user_id_exists else "author_profile_id"
            target_column = "target_user_id" if target_user_id_exists else "target_profile_id"

            connection.execute(
                text(
                    f"""
                    INSERT INTO feedbacks (
                        id,
                        author_user_id,
                        title,
                        description,
                        date_added,
                        time_added,
                        origin_country,
                        origin_city,
                        origin_latitude,
                        origin_longitude,
                        sentiment,
                        target_user_id,
                        status
                    )
                    SELECT
                        id,
                        {author_column},
                        title,
                        description,
                        date_added,
                        time_added,
                        origin_country,
                        origin_city,
                        origin_latitude,
                        origin_longitude,
                        sentiment,
                        {target_column},
                        COALESCE(status, 'pending')
                    FROM "openFeedbacks"
                    ON CONFLICT (id) DO NOTHING
                    """
                )
            )
            return

        if legacy_table_exists and not feedbacks_exists:
            connection.execute(text('ALTER TABLE "openFeedbacks" RENAME TO feedbacks'))


def ensure_users_role_column():
    # Small startup migration for older databases created before the role field existed.
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR")
        )


def ensure_users_mobile_number_column():
    # Small startup migration for older databases created before the mobile number field existed.
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR")
        )


def ensure_users_verification_status_column():
    # Small startup migration for older databases created before the verification status field existed.
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status VARCHAR")
        )


def ensure_users_status_column():
    # Small startup migration for older databases created before the user activity status field existed.
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR")
        )
        connection.execute(
            text("UPDATE users SET status = 'active' WHERE status IS NULL")
        )


def ensure_users_visibility_column():
    # Small startup migration for older databases created before user visibility was introduced.
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS visibility VARCHAR")
        )
        connection.execute(
            text("UPDATE users SET visibility = 'public' WHERE visibility IS NULL")
        )


def ensure_users_gender_column():
    # Small startup migration for older databases created before gender was tracked.
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR")
        )


def ensure_users_theme_colors_column():
    # Profile-specific dashboard palette settings are stored as normalized JSON.
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_colors TEXT")
        )


def ensure_users_personal_account_type():
    # Rename the legacy "individual" account type to "personal" in existing databases.
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS type VARCHAR")
        )
        connection.execute(
            text("UPDATE users SET type = 'personal' WHERE type IS NULL OR lower(type) = 'individual'")
        )
        connection.execute(
            text("ALTER TABLE users ALTER COLUMN type SET DEFAULT 'personal'")
        )


def ensure_parliament_profile_name():
    """Rename the legacy Skylab seed identity and its public demo content."""
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                UPDATE users
                SET username = CASE
                        WHEN lower(username) = 'skylab.parliamentary.feedback.desk'
                        THEN 'parliament'
                        ELSE username
                    END,
                    email = CASE
                        WHEN lower(email) = 'skylab@ugvoice.test'
                        THEN 'parliament@ugvoice.test'
                        ELSE email
                    END,
                    fname = 'Parliament',
                    lname = '',
                    company_name = 'Parliament',
                    description = replace(description, 'Skylab', 'Parliament')
                WHERE lower(username) IN (
                        'parliament',
                        'skylab.parliamentary.feedback.desk'
                    )
                   OR lower(email) IN (
                        'parliament@ugvoice.test',
                        'skylab@ugvoice.test'
                    )
                   OR (
                        lower(fname) = 'skylab'
                        AND lower(lname) = 'parliament'
                    )
                """
            )
        )

        for table_name, columns in (
            ("feedbacks", ("title", "description", "summary")),
            ("posts", ("title", "content")),
            ("post_reviews", ("content",)),
            ('"emergingIssues"', ("title", "description")),
        ):
            for column_name in columns:
                connection.execute(
                    text(
                        f"""
                        UPDATE {table_name}
                        SET {column_name} = replace(
                            {column_name},
                            'Skylab',
                            'Parliament'
                        )
                        WHERE seed_tag = :seed_tag
                          AND {column_name} LIKE '%Skylab%'
                        """
                    ),
                    {"seed_tag": "ugvoice_demo_seed"},
                )


def ensure_seed_tag_columns():
    # Demo rows use this marker so they can be removed before production.
    seed_tag_tables = [
        "users",
        "topics",
        "reviews",
        "feedbacks",
        "posts",
        "post_reviews",
        "post_reactions",
        "subscriptions",
        '"emergingIssues"',
    ]
    with engine.begin() as connection:
        for table_name in seed_tag_tables:
            connection.execute(
                text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS seed_tag VARCHAR")
            )
            index_table_name = table_name.replace('"', "")
            connection.execute(
                text(
                    f"CREATE INDEX IF NOT EXISTS ix_{index_table_name}_seed_tag "
                    f"ON {table_name} (seed_tag)"
                )
            )


def ensure_users_constituency_column():
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS constituency_id INTEGER")
        )
        connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'users_constituency_id_fkey'
                    ) THEN
                        ALTER TABLE users
                        ADD CONSTRAINT users_constituency_id_fkey
                        FOREIGN KEY (constituency_id) REFERENCES constituencies(id);
                    END IF;
                END
                $$;
                """
            )
        )


def ensure_users_district_column():
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS district_id INTEGER")
        )
        connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'users_district_id_fkey'
                    ) THEN
                        ALTER TABLE users
                        ADD CONSTRAINT users_district_id_fkey
                        FOREIGN KEY (district_id) REFERENCES districts(id);
                    END IF;
                END
                $$;
                """
            )
        )


def ensure_users_subcounty_column():
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS subcounty_id INTEGER")
        )
        connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'users_subcounty_id_fkey'
                    ) THEN
                        ALTER TABLE users
                        ADD CONSTRAINT users_subcounty_id_fkey
                        FOREIGN KEY (subcounty_id) REFERENCES subcounties(id);
                    END IF;
                END
                $$;
                """
            )
        )


def ensure_users_parish_column():
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS parish_id INTEGER")
        )
        connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'users_parish_id_fkey'
                    ) THEN
                        ALTER TABLE users
                        ADD CONSTRAINT users_parish_id_fkey
                        FOREIGN KEY (parish_id) REFERENCES parishes(id);
                    END IF;
                END
                $$;
                """
            )
        )


def ensure_users_parent_user_id_column():
    # Personal accounts have no parent; organization child accounts point back to the owning user.
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_user_id INTEGER")
        )
        connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'users_parent_user_id_fkey'
                    ) THEN
                        ALTER TABLE users
                        ADD CONSTRAINT users_parent_user_id_fkey
                        FOREIGN KEY (parent_user_id) REFERENCES users(id);
                    END IF;
                END
                $$;
                """
            )
        )


def ensure_feedback_user_columns():
    # Rename legacy profile-based foreign key columns so the DB matches the current user terminology.
    with engine.begin() as connection:
        author_profile_id_exists = connection.execute(
            text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'feedbacks'
                  AND column_name = 'author_profile_id'
                """
            )
        ).scalar()
        author_user_id_exists = connection.execute(
            text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'feedbacks'
                  AND column_name = 'author_user_id'
                """
            )
        ).scalar()
        target_profile_id_exists = connection.execute(
            text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'feedbacks'
                  AND column_name = 'target_profile_id'
                """
            )
        ).scalar()
        target_user_id_exists = connection.execute(
            text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'feedbacks'
                  AND column_name = 'target_user_id'
                """
            )
        ).scalar()

        if author_profile_id_exists and author_user_id_exists:
            raise RuntimeError(
                "Both 'author_profile_id' and 'author_user_id' exist in 'feedbacks'. "
                "Please merge them manually before startup."
            )

        if target_profile_id_exists and target_user_id_exists:
            raise RuntimeError(
                "Both 'target_profile_id' and 'target_user_id' exist in 'feedbacks'. "
                "Please merge them manually before startup."
            )

        if author_profile_id_exists and not author_user_id_exists:
            connection.execute(
                text("ALTER TABLE feedbacks RENAME COLUMN author_profile_id TO author_user_id")
            )

        if target_profile_id_exists and not target_user_id_exists:
            connection.execute(
                text("ALTER TABLE feedbacks RENAME COLUMN target_profile_id TO target_user_id")
            )


def ensure_feedback_status_column():
    # Track whether feedback has already been processed into emerging issues.
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS status VARCHAR")
        )
        connection.execute(
            text("UPDATE feedbacks SET status = 'pending' WHERE status IS NULL")
        )


def ensure_feedback_category_column():
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS category VARCHAR")
        )


def ensure_feedback_analysis_columns():
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS clean_text TEXT")
        )
        connection.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS summary TEXT")
        )
        connection.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS sentiment_confidence DOUBLE PRECISION")
        )
        connection.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS sentiment_score TEXT")
        )
        connection.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS embending TEXT")
        )
        connection.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS embedding_model VARCHAR")
        )
        connection.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS summar_model VARCHAR")
        )
        connection.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS sentiment_model VARCHAR")
        )
        connection.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS inference_provider VARCHAR")
        )
        connection.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS inference_mode VARCHAR")
        )
        connection.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS inference_fallback_used BOOLEAN")
        )
        connection.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS inference_fallback_tasks TEXT")
        )
        connection.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS inference_latency_ms INTEGER")
        )


def ensure_issue_modeling_tables():
    with engine.begin() as connection:
        db_models.Issue.__table__.create(bind=connection, checkfirst=True)
        db_models.IssueTrend.__table__.create(bind=connection, checkfirst=True)
        connection.execute(
            text("ALTER TABLE issues ADD COLUMN IF NOT EXISTS sentiment VARCHAR")
        )
        connection.execute(
            text("ALTER TABLE issues ADD COLUMN IF NOT EXISTS priority_level VARCHAR")
        )
        connection.execute(
            text("ALTER TABLE issues ADD COLUMN IF NOT EXISTS status VARCHAR")
        )
        connection.execute(
            text("ALTER TABLE issues ADD COLUMN IF NOT EXISTS country_id INTEGER")
        )
        connection.execute(
            text("ALTER TABLE issues ADD COLUMN IF NOT EXISTS region_id INTEGER")
        )
        connection.execute(
            text("ALTER TABLE issues ADD COLUMN IF NOT EXISTS district_id INTEGER")
        )
        connection.execute(
            text("ALTER TABLE issues ADD COLUMN IF NOT EXISTS constituency_id INTEGER")
        )
        connection.execute(
            text("ALTER TABLE issues ADD COLUMN IF NOT EXISTS subcounty_id INTEGER")
        )
        connection.execute(
            text("ALTER TABLE issues ADD COLUMN IF NOT EXISTS parish_id INTEGER")
        )
        connection.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS topic_id INTEGER")
        )
        connection.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS issue_id INTEGER")
        )
        connection.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS topic_probability DOUBLE PRECISION")
        )
        connection.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS topic_model_version VARCHAR")
        )
        connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'feedbacks_issue_id_fkey'
                    ) THEN
                        ALTER TABLE feedbacks
                        ADD CONSTRAINT feedbacks_issue_id_fkey
                        FOREIGN KEY (issue_id) REFERENCES issues(id);
                    END IF;
                END
                $$;
                """
            )
        )
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS ix_issues_topic_model ON issues (topic_id, model_version)")
        )
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS ix_feedbacks_issue_id ON feedbacks (issue_id)")
        )
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS ix_feedbacks_topic_model_version ON feedbacks (topic_model_version)")
        )
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS ix_issue_trends_dashboard ON issue_trends (scope, period, date, issue_id)")
        )


def ensure_emerging_issues_user_column():
    # Link emerging issues to users so user-specific issue feeds can be queried directly.
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE \"emergingIssues\" ADD COLUMN IF NOT EXISTS user_id INTEGER")
        )
        connection.execute(
            text("ALTER TABLE \"emergingIssues\" ADD COLUMN IF NOT EXISTS sentiment VARCHAR")
        )
        connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'emergingIssues_user_id_fkey'
                    ) THEN
                        ALTER TABLE "emergingIssues"
                        ADD CONSTRAINT "emergingIssues_user_id_fkey"
                        FOREIGN KEY (user_id) REFERENCES users(id);
                    END IF;
                END
                $$;
                """
            )
        )


def ensure_posts_share_token_column():
    # Private posts can be shared through a unique token instead of organization membership.
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS share_token VARCHAR")
        )
        connection.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS ix_posts_share_token
                ON posts (share_token)
                WHERE share_token IS NOT NULL
                """
            )
        )

        private_post_ids = connection.execute(
            text(
                """
                SELECT id
                FROM posts
                WHERE visibility = 'private'
                  AND (share_token IS NULL OR share_token = '')
                """
            )
        ).scalars().all()

        for post_id in private_post_ids:
            connection.execute(
                text("UPDATE posts SET share_token = :share_token WHERE id = :post_id"),
                {"share_token": uuid4().hex, "post_id": post_id},
            )


def ensure_posts_media_columns():
    # Older databases may be missing the post thumbnail and attachment columns.
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS thumbnail VARCHAR")
        )
        connection.execute(
            text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS attachment VARCHAR")
        )


def ensure_posts_category_column():
    # Older databases may be missing the post category used by parliament content.
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS category VARCHAR")
        )


def ensure_post_categories_table():
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS post_categories (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR NOT NULL UNIQUE
                )
                """
            )
        )
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS ix_post_categories_name ON post_categories (name)")
        )
        for category in DEFAULT_POST_CATEGORIES:
            connection.execute(
                text(
                    """
                    INSERT INTO post_categories (name)
                    VALUES (:name)
                    ON CONFLICT (name) DO NOTHING
                    """
                ),
                {"name": category},
            )


def ensure_posts_view_count_column():
    # Older databases may be missing the post view counter used by the article page.
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS view_count INTEGER")
        )
        connection.execute(
            text("UPDATE posts SET view_count = 0 WHERE view_count IS NULL")
        )


def ensure_review_edit_columns():
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS edited_date DATE")
        )
        connection.execute(
            text("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS edited_time TIME")
        )
        connection.execute(
            text("ALTER TABLE post_reviews ADD COLUMN IF NOT EXISTS edited_date DATE")
        )
        connection.execute(
            text("ALTER TABLE post_reviews ADD COLUMN IF NOT EXISTS edited_time TIME")
        )


def ensure_review_source_columns():
    with engine.begin() as connection:
        for table_name in ("reviews", "post_reviews"):
            connection.execute(
                text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS district_id INTEGER")
            )
            connection.execute(
                text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS constituency_id INTEGER")
            )
            connection.execute(
                text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS subcounty_id INTEGER")
            )
            connection.execute(
                text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS parish_id INTEGER")
            )
            connection.execute(
                text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS sentiment VARCHAR")
            )

        connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'reviews_district_id_fkey'
                    ) THEN
                        ALTER TABLE reviews
                        ADD CONSTRAINT reviews_district_id_fkey
                        FOREIGN KEY (district_id) REFERENCES districts(id);
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'reviews_constituency_id_fkey'
                    ) THEN
                        ALTER TABLE reviews
                        ADD CONSTRAINT reviews_constituency_id_fkey
                        FOREIGN KEY (constituency_id) REFERENCES constituencies(id);
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'reviews_subcounty_id_fkey'
                    ) THEN
                        ALTER TABLE reviews
                        ADD CONSTRAINT reviews_subcounty_id_fkey
                        FOREIGN KEY (subcounty_id) REFERENCES subcounties(id);
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'reviews_parish_id_fkey'
                    ) THEN
                        ALTER TABLE reviews
                        ADD CONSTRAINT reviews_parish_id_fkey
                        FOREIGN KEY (parish_id) REFERENCES parishes(id);
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'post_reviews_district_id_fkey'
                    ) THEN
                        ALTER TABLE post_reviews
                        ADD CONSTRAINT post_reviews_district_id_fkey
                        FOREIGN KEY (district_id) REFERENCES districts(id);
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'post_reviews_constituency_id_fkey'
                    ) THEN
                        ALTER TABLE post_reviews
                        ADD CONSTRAINT post_reviews_constituency_id_fkey
                        FOREIGN KEY (constituency_id) REFERENCES constituencies(id);
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'post_reviews_subcounty_id_fkey'
                    ) THEN
                        ALTER TABLE post_reviews
                        ADD CONSTRAINT post_reviews_subcounty_id_fkey
                        FOREIGN KEY (subcounty_id) REFERENCES subcounties(id);
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'post_reviews_parish_id_fkey'
                    ) THEN
                        ALTER TABLE post_reviews
                        ADD CONSTRAINT post_reviews_parish_id_fkey
                        FOREIGN KEY (parish_id) REFERENCES parishes(id);
                    END IF;
                END
                $$;
                """
            )
        )


def ensure_post_source_columns():
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS district_id INTEGER")
        )
        connection.execute(
            text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS constituency_id INTEGER")
        )
        connection.execute(
            text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS subcounty_id INTEGER")
        )
        connection.execute(
            text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS parish_id INTEGER")
        )
        connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'posts_district_id_fkey'
                    ) THEN
                        ALTER TABLE posts
                        ADD CONSTRAINT posts_district_id_fkey
                        FOREIGN KEY (district_id) REFERENCES districts(id);
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'posts_constituency_id_fkey'
                    ) THEN
                        ALTER TABLE posts
                        ADD CONSTRAINT posts_constituency_id_fkey
                        FOREIGN KEY (constituency_id) REFERENCES constituencies(id);
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'posts_subcounty_id_fkey'
                    ) THEN
                        ALTER TABLE posts
                        ADD CONSTRAINT posts_subcounty_id_fkey
                        FOREIGN KEY (subcounty_id) REFERENCES subcounties(id);
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'posts_parish_id_fkey'
                    ) THEN
                        ALTER TABLE posts
                        ADD CONSTRAINT posts_parish_id_fkey
                        FOREIGN KEY (parish_id) REFERENCES parishes(id);
                    END IF;
                END
                $$;
                """
            )
        )


def ensure_location_indexes():
    with engine.begin() as connection:
        connection.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS uq_countries_name_ci ON countries ((lower(name)))")
        )
        connection.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_regions_country_name_ci
                ON regions (country_id, (lower(name)))
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_districts_region_name_ci
                ON districts (region_id, (lower(name)))
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_constituencies_district_name_ci
                ON constituencies (district_id, (lower(name)))
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_subcounties_constituency_name_ci
                ON subcounties (constituency_id, (lower(name)))
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_parishes_subcounty_name_ci
                ON parishes (subcounty_id, (lower(name)))
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_villages_parish_name_ci
                ON villages (parish_id, (lower(name)))
                """
            )
        )


def load_world_countries() -> list[str]:
    if not COUNTRIES_SOURCE_PATH.exists():
        raise RuntimeError(f"Countries source file not found at {COUNTRIES_SOURCE_PATH}")

    countries: list[str] = []
    seen: set[str] = set()
    for raw_line in COUNTRIES_SOURCE_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        parts = line.split("\t")
        if len(parts) < 2:
            continue

        country_name = parts[1].strip()
        if not country_name:
            continue

        normalized_name = country_name.lower()
        if normalized_name in seen:
            continue

        seen.add(normalized_name)
        countries.append(country_name)

    return sorted(countries, key=str.casefold)


def get_or_create_named_location(connection, table_name: str, name: str, *, parent_field: str | None = None, parent_id: int | None = None) -> int:
    cleaned_name = name.strip()
    if not cleaned_name:
        raise RuntimeError(f"Cannot insert blank name into {table_name}")

    query = f"SELECT id FROM {table_name} WHERE lower(name) = lower(:name)"
    params: dict[str, object] = {"name": cleaned_name}
    if parent_field:
        query += f" AND {parent_field} = :parent_id"
        params["parent_id"] = parent_id

    existing_id = connection.execute(text(query), params).scalar()
    if existing_id is not None:
        return int(existing_id)

    columns = ["name"]
    values = [":name"]
    if parent_field:
        columns.append(parent_field)
        values.append(":parent_id")

    inserted_id = connection.execute(
        text(
            f"""
            INSERT INTO {table_name} ({", ".join(columns)})
            VALUES ({", ".join(values)})
            RETURNING id
            """
        ),
        params,
    ).scalar_one()
    return int(inserted_id)


def seed_countries():
    country_names = load_world_countries()
    with engine.begin() as connection:
        for country_name in country_names:
            get_or_create_named_location(connection, "countries", country_name)


def seed_uganda_administrative_hierarchy():
    if not UGANDA_HIERARCHY_PATH.exists():
        raise RuntimeError(f"Uganda hierarchy file not found at {UGANDA_HIERARCHY_PATH}")

    hierarchy = json.loads(UGANDA_HIERARCHY_PATH.read_text(encoding="utf-8"))
    country_name = str(hierarchy.get("country") or "Uganda").strip()

    with engine.begin() as connection:
        country_id = get_or_create_named_location(connection, "countries", country_name)

        for region in hierarchy.get("regions", []):
            region_id = get_or_create_named_location(
                connection,
                "regions",
                region["name"],
                parent_field="country_id",
                parent_id=country_id,
            )

            for district in region.get("districts", []):
                district_id = get_or_create_named_location(
                    connection,
                    "districts",
                    district["name"],
                    parent_field="region_id",
                    parent_id=region_id,
                )

                for constituency in district.get("constituencies", []):
                    constituency_id = get_or_create_named_location(
                        connection,
                        "constituencies",
                        constituency["name"],
                        parent_field="district_id",
                        parent_id=district_id,
                    )

                    for subcounty in constituency.get("subcounties", []):
                        subcounty_id = get_or_create_named_location(
                            connection,
                            "subcounties",
                            subcounty["name"],
                            parent_field="constituency_id",
                            parent_id=constituency_id,
                        )

                        for parish_name in subcounty.get("parishes", []):
                            get_or_create_named_location(
                                connection,
                                "parishes",
                                parish_name,
                                parent_field="subcounty_id",
                                parent_id=subcounty_id,
                            )


def seed_kampala_administrative_hierarchy():
    if not KAMPALA_HIERARCHY_PATH.exists():
        raise RuntimeError(f"Kampala hierarchy file not found at {KAMPALA_HIERARCHY_PATH}")

    hierarchy = json.loads(KAMPALA_HIERARCHY_PATH.read_text(encoding="utf-8"))

    with engine.begin() as connection:
        country_id = get_or_create_named_location(connection, "countries", "Uganda")
        region_id = get_or_create_named_location(
            connection,
            "regions",
            hierarchy.get("region", "Central"),
            parent_field="country_id",
            parent_id=country_id,
        )
        district_id = get_or_create_named_location(
            connection,
            "districts",
            hierarchy.get("district", "Kampala"),
            parent_field="region_id",
            parent_id=region_id,
        )

        for division in hierarchy.get("divisions", []):
            division_name = str(division.get("name") or "").strip()
            if not division_name:
                continue

            constituency_names = []
            if division.get("constituency"):
                constituency_names.append(str(division["constituency"]).strip())
            constituency_names.extend(
                str(name).strip()
                for name in division.get("constituencies", [])
                if str(name).strip()
            )

            parish_names = [
                str(name).strip()
                for name in division.get("parishes", [])
                if str(name).strip()
            ]

            for constituency_name in constituency_names:
                constituency_id = get_or_create_named_location(
                    connection,
                    "constituencies",
                    constituency_name,
                    parent_field="district_id",
                    parent_id=district_id,
                )
                subcounty_id = get_or_create_named_location(
                    connection,
                    "subcounties",
                    division_name,
                    parent_field="constituency_id",
                    parent_id=constituency_id,
                )
                for parish_name in parish_names:
                    get_or_create_named_location(
                        connection,
                        "parishes",
                        parish_name,
                        parent_field="subcounty_id",
                        parent_id=subcounty_id,
                    )
                connection.execute(
                    text(
                        """
                        DELETE FROM parishes
                        WHERE subcounty_id = :subcounty_id
                          AND lower(name) NOT IN :parish_names
                        """
                    ).bindparams(
                        bindparam("parish_names", expanding=True)
                    ),
                    {
                        "subcounty_id": subcounty_id,
                        "parish_names": tuple(name.lower() for name in parish_names) or ("",),
                    },
                )


def initialize_database(*, include_reference_data: bool = True):
    ensure_database_exists()
    drop_obsolete_messaging_tables()
    ensure_users_table()
    ensure_reviews_table()
    ensure_post_reviews_table()
    ensure_feedbacks_table()
    ensure_feedback_user_columns()
    ensure_post_categories_table()
    db_models.Base.metadata.create_all(bind=engine)
    ensure_primary_key_sequences()
    ensure_feedback_status_column()
    ensure_feedback_category_column()
    ensure_feedback_analysis_columns()
    ensure_issue_modeling_tables()
    ensure_users_role_column()
    ensure_users_mobile_number_column()
    ensure_users_parent_user_id_column()
    ensure_users_verification_status_column()
    ensure_users_status_column()
    ensure_users_visibility_column()
    ensure_users_gender_column()
    ensure_users_theme_colors_column()
    ensure_users_personal_account_type()
    ensure_users_district_column()
    ensure_users_constituency_column()
    ensure_users_subcounty_column()
    ensure_users_parish_column()
    ensure_emerging_issues_user_column()
    ensure_posts_share_token_column()
    ensure_posts_media_columns()
    ensure_posts_category_column()
    ensure_post_categories_table()
    ensure_post_source_columns()
    ensure_posts_view_count_column()
    ensure_review_edit_columns()
    ensure_review_source_columns()
    ensure_location_indexes()
    ensure_seed_tag_columns()
    ensure_parliament_profile_name()

    if include_reference_data:
        seed_countries()
        seed_uganda_administrative_hierarchy()
        seed_kampala_administrative_hierarchy()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    # FastAPI dependency that provides one database session per request.
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
