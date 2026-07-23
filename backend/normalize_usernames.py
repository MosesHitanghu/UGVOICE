"""Audit or normalize usernames using account names and organization titles.

Run without arguments for a read-only audit, or pass --apply to save changes.
"""

import argparse
from collections import Counter

import db_models
from database import SessionLocal
from username_utils import PLACEHOLDER_USERNAME_PATTERN, unique_username, username_base


def expected_usernames(users) -> dict[int, str]:
    used: set[str] = set()
    expected: dict[int, str] = {}
    for user in users:
        base = username_base(
            fname=user.fname,
            lname=user.lname,
            account_type=user.type,
            company_name=user.company_name,
            role=user.role,
            fallback=user.username or f"member {user.id}",
        )
        expected[user.id] = unique_username(base, used)
    return expected


def audit(users, expected: dict[int, str]) -> dict[str, int]:
    current = [(user.username or "").strip() for user in users]
    counts = Counter(value.casefold() for value in current if value)
    return {
        "total": len(users),
        "blank": sum(not value for value in current),
        "placeholder_like": sum(
            bool(PLACEHOLDER_USERNAME_PATTERN.search(value)) for value in current
        ),
        "duplicate_groups": sum(count > 1 for count in counts.values()),
        "not_canonical": sum(
            (user.username or "").strip().casefold() != expected[user.id].casefold()
            for user in users
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="save canonical usernames")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        users = db.query(db_models.User).order_by(db_models.User.id).all()
        expected = expected_usernames(users)
        before = audit(users, expected)
        changed = [
            (user, expected[user.id])
            for user in users
            if (user.username or "").strip() != expected[user.id]
        ]
        print(f"before={before}")
        print(
            "change_sample="
            + repr([(user.id, user.username, target) for user, target in changed[:12]])
        )

        if args.apply:
            for user, target in changed:
                user.username = target
            db.commit()
            users = db.query(db_models.User).order_by(db_models.User.id).all()
            print(f"updated={len(changed)}")
            print(f"after={audit(users, expected_usernames(users))}")
        else:
            db.rollback()
            print("read_only=True; pass --apply to save these changes")
    finally:
        db.close()


if __name__ == "__main__":
    main()
