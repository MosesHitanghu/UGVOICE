import re
import unicodedata


PLACEHOLDER_USERNAME_PATTERN = re.compile(
    r"(^|[._-])(demo|dummy|sample|test)([._-]|$)|^user(?:[._-]|\d)",
    re.IGNORECASE,
)


def slugify_username(value: str | None) -> str:
    """Convert a person's name or organization title to a readable username."""
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii").lower()
    return ".".join(re.findall(r"[a-z0-9]+", ascii_value))


def username_base(
    *,
    fname: str | None,
    lname: str | None,
    account_type: str | None,
    company_name: str | None = None,
    role: str | None = None,
    fallback: str | None = None,
) -> str:
    """Build the canonical base from a personal name or organization title."""
    is_personal = (account_type or "personal").strip().lower() == "personal"
    full_name = " ".join(part.strip() for part in (fname or "", lname or "") if part.strip())
    if is_personal:
        sources = (full_name, company_name, fallback, role)
    else:
        sources = (company_name, full_name, fallback, role)

    for source in sources:
        candidate = slugify_username(source)
        if candidate and not PLACEHOLDER_USERNAME_PATTERN.search(candidate):
            return candidate
    return "ugvoice.member"


def unique_username(base: str, used: set[str]) -> str:
    """Return a case-insensitively unique username, adding .2, .3, and so on."""
    candidate = base
    suffix = 2
    while candidate.casefold() in used:
        candidate = f"{base}.{suffix}"
        suffix += 1
    used.add(candidate.casefold())
    return candidate
