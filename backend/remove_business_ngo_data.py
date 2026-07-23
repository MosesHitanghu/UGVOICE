"""Audit or remove users whose account type is ``business`` or ``ngo``.

Run without arguments for a read-only audit. Pass ``--apply`` to delete the
matching users and every dependent row that would otherwise retain or block
their removal, including records in legacy tables still present in older
UGVoice databases.
"""

from __future__ import annotations

import argparse

from sqlalchemy import text

from database import engine


TARGET_TYPES_SQL = "'business', 'ngo'"


def table_exists(connection, table_name: str) -> bool:
    return connection.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = :table_name
            )
            """
        ),
        {"table_name": table_name},
    ).scalar() is True


def scalar_count(connection, statement: str) -> int:
    return int(connection.execute(text(statement)).scalar() or 0)


def audit(connection) -> dict:
    counts = {
        "business_users": scalar_count(
            connection, "SELECT COUNT(*) FROM users WHERE lower(type) = 'business'"
        ),
        "ngo_users": scalar_count(
            connection, "SELECT COUNT(*) FROM users WHERE lower(type) = 'ngo'"
        ),
    }

    direct_references = {
        "topics": "author_id",
        "emergingIssues": "user_id",
        "openFeedbacks": "author_user_id",
        "feedbackfortopics": "author_id",
        "subscriptions": "user_id",
        "comments": "author_id",
        "reviews": "author_id",
        "organizations": "owner_user_id",
        "organization_members": "user_id",
        "post_reactions": "user_id",
        "post_comments": "author_user_id",
        "posts": "author_user_id",
        "post_reviews": "author_user_id",
        "listings": "owner_id",
        "audit_logs": "actor_id",
        "offers": "user_id",
        "notes": "user_id",
        "feedbacks": "author_user_id",
        "issue_trends": "target_user_id",
    }
    for table_name, column_name in direct_references.items():
        if not table_exists(connection, table_name):
            continue
        quoted_table = f'"{table_name}"'
        counts[f"{table_name}.{column_name}"] = scalar_count(
            connection,
            f"""
            SELECT COUNT(*) FROM {quoted_table}
            WHERE {column_name} IN (
                SELECT id FROM users WHERE lower(type) IN ({TARGET_TYPES_SQL})
            )
            """,
        )
    if table_exists(connection, "feedbacks"):
        counts["feedbacks.target_user_id"] = scalar_count(
            connection,
            f"""
            SELECT COUNT(*) FROM feedbacks
            WHERE target_user_id IN (
                SELECT id FROM users WHERE lower(type) IN ({TARGET_TYPES_SQL})
            )
            """,
        )
    return counts


def remove(connection) -> dict:
    before = audit(connection)
    if before["business_users"] + before["ngo_users"] == 0:
        return before

    connection.execute(
        text(
            f"""
            CREATE TEMP TABLE removed_user_ids ON COMMIT DROP AS
            SELECT id FROM users WHERE lower(type) IN ({TARGET_TYPES_SQL})
            """
        )
    )

    if table_exists(connection, "organizations"):
        connection.execute(
            text(
                """
                CREATE TEMP TABLE removed_organization_ids ON COMMIT DROP AS
                SELECT id FROM organizations
                WHERE owner_user_id IN (SELECT id FROM removed_user_ids)
                """
            )
        )
    if table_exists(connection, "posts"):
        organization_filter = (
            "OR organization_id IN (SELECT id FROM removed_organization_ids)"
            if table_exists(connection, "organizations")
            else ""
        )
        connection.execute(
            text(
                f"""
                CREATE TEMP TABLE removed_post_ids ON COMMIT DROP AS
                SELECT id FROM posts
                WHERE author_user_id IN (SELECT id FROM removed_user_ids)
                {organization_filter}
                """
            )
        )
    if table_exists(connection, "topics"):
        connection.execute(
            text(
                """
                CREATE TEMP TABLE removed_topic_ids ON COMMIT DROP AS
                SELECT id FROM topics
                WHERE author_id IN (SELECT id FROM removed_user_ids)
                """
            )
        )
    if table_exists(connection, "listings"):
        connection.execute(
            text(
                """
                CREATE TEMP TABLE removed_listing_ids ON COMMIT DROP AS
                SELECT id FROM listings
                WHERE owner_id IN (SELECT id FROM removed_user_ids)
                """
            )
        )
    if table_exists(connection, "offers"):
        listing_filter = (
            "OR listing_id IN (SELECT id FROM removed_listing_ids)"
            if table_exists(connection, "listings")
            else ""
        )
        connection.execute(
            text(
                f"""
                CREATE TEMP TABLE removed_offer_ids ON COMMIT DROP AS
                SELECT id FROM offers
                WHERE user_id IN (SELECT id FROM removed_user_ids)
                {listing_filter}
                """
            )
        )
    if table_exists(connection, "site_visits") and table_exists(connection, "listings"):
        connection.execute(
            text(
                """
                CREATE TEMP TABLE removed_site_visit_ids ON COMMIT DROP AS
                SELECT id FROM site_visits
                WHERE listing_id IN (SELECT id FROM removed_listing_ids)
                """
            )
        )

    deleted: dict[str, int] = {}

    def delete_if_present(table_name: str, where_clause: str) -> None:
        if not table_exists(connection, table_name):
            return
        result = connection.execute(text(f'DELETE FROM "{table_name}" WHERE {where_clause}'))
        deleted[table_name] = deleted.get(table_name, 0) + max(result.rowcount or 0, 0)

    note_filters = ["user_id IN (SELECT id FROM removed_user_ids)"]
    if table_exists(connection, "listings"):
        note_filters.append("listing_id IN (SELECT id FROM removed_listing_ids)")
    if table_exists(connection, "offers"):
        note_filters.append("offer_id IN (SELECT id FROM removed_offer_ids)")
    if table_exists(connection, "site_visits") and table_exists(connection, "listings"):
        note_filters.append("site_visit_id IN (SELECT id FROM removed_site_visit_ids)")
    delete_if_present("notes", " OR ".join(note_filters))

    if table_exists(connection, "listings"):
        delete_if_present("features", "listing_id IN (SELECT id FROM removed_listing_ids)")
        delete_if_present("site_visits", "listing_id IN (SELECT id FROM removed_listing_ids)")
    if table_exists(connection, "offers"):
        delete_if_present("offers", "id IN (SELECT id FROM removed_offer_ids)")
    if table_exists(connection, "listings"):
        delete_if_present("listings", "id IN (SELECT id FROM removed_listing_ids)")

    if table_exists(connection, "posts"):
        post_or_user = (
            "post_id IN (SELECT id FROM removed_post_ids) "
            "OR user_id IN (SELECT id FROM removed_user_ids)"
        )
        delete_if_present("post_action_views", "post_id IN (SELECT id FROM removed_post_ids)")
        delete_if_present("post_views", "post_id IN (SELECT id FROM removed_post_ids)")
        delete_if_present("post_reactions", post_or_user)
        delete_if_present(
            "post_comments",
            "post_id IN (SELECT id FROM removed_post_ids) "
            "OR author_user_id IN (SELECT id FROM removed_user_ids)",
        )
        delete_if_present(
            "post_reviews",
            "post_id IN (SELECT id FROM removed_post_ids) "
            "OR author_user_id IN (SELECT id FROM removed_user_ids)",
        )
        delete_if_present("posts", "id IN (SELECT id FROM removed_post_ids)")

    if table_exists(connection, "topics"):
        topic_or_author = (
            "topic_id IN (SELECT id FROM removed_topic_ids) "
            "OR author_id IN (SELECT id FROM removed_user_ids)"
        )
        delete_if_present("feedbackfortopics", topic_or_author)
        delete_if_present("comments", topic_or_author)
        delete_if_present("reviews", topic_or_author)
        delete_if_present("topics", "id IN (SELECT id FROM removed_topic_ids)")

    if table_exists(connection, "organizations"):
        delete_if_present(
            "organization_members",
            "organization_id IN (SELECT id FROM removed_organization_ids) "
            "OR user_id IN (SELECT id FROM removed_user_ids)",
        )
        delete_if_present("organizations", "id IN (SELECT id FROM removed_organization_ids)")

    delete_if_present(
        "openFeedbacks",
        "author_user_id IN (SELECT id FROM removed_user_ids) "
        "OR target_user_id IN (SELECT id FROM removed_user_ids)",
    )
    delete_if_present(
        "feedbacks",
        "author_user_id IN (SELECT id FROM removed_user_ids) "
        "OR target_user_id IN (SELECT id FROM removed_user_ids)",
    )
    delete_if_present("emergingIssues", "user_id IN (SELECT id FROM removed_user_ids)")
    delete_if_present("subscriptions", "user_id IN (SELECT id FROM removed_user_ids)")
    delete_if_present("issue_trends", "target_user_id IN (SELECT id FROM removed_user_ids)")
    delete_if_present("audit_logs", "actor_id IN (SELECT id FROM removed_user_ids)")

    connection.execute(
        text(
            """
            UPDATE users SET parent_user_id = NULL
            WHERE parent_user_id IN (SELECT id FROM removed_user_ids)
            """
        )
    )
    result = connection.execute(
        text("DELETE FROM users WHERE id IN (SELECT id FROM removed_user_ids)")
    )
    deleted["users"] = max(result.rowcount or 0, 0)
    return {"audit": before, "deleted": deleted}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Permanently delete matching data")
    args = parser.parse_args()

    context = engine.begin() if args.apply else engine.connect()
    with context as connection:
        result = remove(connection) if args.apply else audit(connection)
    print(result)


if __name__ == "__main__":
    main()
