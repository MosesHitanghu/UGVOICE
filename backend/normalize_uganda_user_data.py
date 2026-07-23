"""Audit or normalize every UGVoice user to a valid Uganda location path."""

from __future__ import annotations

import argparse

import db_models
from database import SessionLocal
from seed_dummy_data import get_uganda_location_paths


def audit_users(db) -> dict:
    users = db.query(db_models.User).order_by(db_models.User.id.asc()).all()
    location_paths = get_uganda_location_paths(db)
    valid_paths = {
        (
            path.district_id,
            path.constituency_id,
            path.subcounty_id,
            path.parish_id,
        )
        for path in location_paths
    }
    district_name_by_id = {
        path.district_id: path.district_name
        for path in location_paths
    }
    invalid_hierarchy = sum(
        (
            user.district_id,
            user.constituency_id,
            user.subcounty_id,
            user.parish_id,
        )
        not in valid_paths
        for user in users
    )
    non_uganda_country = sum(
        (user.company_country or "").strip().lower() != "uganda"
        for user in users
    )
    incomplete_hierarchy = sum(
        any(
            value is None
            for value in (
                user.district_id,
                user.constituency_id,
                user.subcounty_id,
                user.parish_id,
            )
        )
        for user in users
    )
    city_district_mismatch = sum(
        (user.company_city or "").strip().lower()
        != (district_name_by_id.get(user.district_id) or "").strip().lower()
        for user in users
    )
    return {
        "total_users": len(users),
        "non_uganda_country": non_uganda_country,
        "incomplete_hierarchy": incomplete_hierarchy,
        "invalid_hierarchy": invalid_hierarchy,
        "city_district_mismatch": city_district_mismatch,
    }


def normalize_users(db) -> dict:
    before = audit_users(db)
    users = db.query(db_models.User).order_by(db_models.User.id.asc()).all()
    location_paths = get_uganda_location_paths(db)
    districts_used = set()

    for index, user in enumerate(users):
        path = location_paths[index % len(location_paths)]
        user.company_country = "Uganda"
        user.company_city = path.district_name
        user.district_id = path.district_id
        user.constituency_id = path.constituency_id
        user.subcounty_id = path.subcounty_id
        user.parish_id = path.parish_id
        districts_used.add(path.district_id)

    db.commit()
    return {
        "before": before,
        "after": audit_users(db),
        "users_updated": len(users),
        "districts_used": len(districts_used),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Persist Uganda locations")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        result = normalize_users(db) if args.apply else audit_users(db)
        print(result)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
