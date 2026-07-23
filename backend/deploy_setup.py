"""Run idempotent schema and Uganda reference-data setup before deployment."""

import os

from database import initialize_database


def env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


if __name__ == "__main__":
    initialize_database(
        include_reference_data=env_flag("UGVOICE_SEED_REFERENCE_DATA", True)
    )
    print("UGVoice database schema and reference data are ready")
