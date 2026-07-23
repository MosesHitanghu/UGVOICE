from datetime import date, datetime, time, timedelta
import os

import db_models
from database import (
    SessionLocal,
    initialize_database,
)
from security import hash_password
from username_utils import username_base


DEFAULT_PASSWORD = "Pass1234"
DEFAULT_PASSWORD_HASH = hash_password(DEFAULT_PASSWORD)
PRIMARY_ADMIN_EMAIL = os.getenv("UGVOICE_ADMIN_EMAIL", "hmosesm@gmail.com").strip().lower()
PRIMARY_ADMIN_PASSWORD = os.getenv("UGVOICE_ADMIN_PASSWORD")
DEMO_SEED_TAG = "ugvoice_demo_seed"
USER_COUNT = 140
TOPIC_COUNT = 120
FEEDBACK_COUNT = 240
POST_COUNT = 190
ISSUE_COUNT = 125

FIRST_NAMES = [
    "Amina", "Brian", "Clara", "Dennis", "Esther", "Frank", "Grace", "Hakim",
    "Ivy", "Joel", "Kevin", "Lydia", "Moses", "Naomi", "Oscar", "Patricia",
    "Quincy", "Ruth", "Samuel", "Tracy",
]
LAST_NAMES = [
    "Owino", "Kato", "Njeri", "Okello", "Mutoni", "Bwire", "Namuli", "Ssemanda",
    "Asiimwe", "Kiptoo", "Mwangi", "Achieng", "Tumwine", "Nakato", "Odongo",
    "Mugisha", "Atwine", "Kemboi", "Nabukeera", "Mutesi",
]
COMPANIES = [
    "Insight Loop Africa", "Lakeview Services", "Kampala Product Circle",
    "Civic Insights Collective", "Public Service Studio", "Member Success Lab",
    "Regional Service Ops", "Citizen Voice Hub", "Service Quality Board",
    "Transit Feedback Lab",
]
COUNTRIES = ["Uganda"]
BUSINESSES = [
    "Research", "Healthcare", "Technology", "Nonprofit", "Consulting",
    "Operations", "Support", "Transport", "Public Service", "Community Programs",
]
PROFILE_TYPES = ["personal", "government organization"]
ORG_COMPANIES = {
    "government organization": [
        "Public Service Directorate",
        "City Transport Authority",
        "National Service Board",
        "Urban Planning Council",
    ],
}
REACTION_TYPES = ["like", "dislike", "love", "celebrate", "insightful", "support"]
SENTIMENTS = ["positive", "neutral", "negative"]
ISSUE_PRIORITIES = ["low", "medium", "high"]
ISSUE_STATUSES = ["open", "monitoring", "resolved"]
SKYLAB_PROFILE = {
    "username": "skylab.parliamentary.feedback.desk",
    "email": "skylab@ugvoice.test",
    "fname": "Skylab",
    "lname": "Parliament",
    "mobile_number": "0700001999",
    "type": "government organization",
    "company_name": "Skylab Parliamentary Feedback Desk",
    "company_country": "Uganda",
    "company_city": "Kampala",
    "type_of_business": "Parliamentary Feedback",
    "role": "Parliament",
    "description": (
        "Skylab coordinates parliamentary feedback intake, constituency "
        "submissions, and issue monitoring for public-service analytics."
    ),
}
SKYLAB_FEEDBACK_THEMES = [
    {
        "title": "Medicine stock-outs at regional health facilities",
        "category": "Healthcare",
        "sentiment": "negative",
        "status": "analysed",
        "description": (
            "Residents report repeated medicine stock-outs at public health centres, "
            "especially malaria treatment, maternity supplies, and diabetes medicine. "
            "They want Parliament to follow up on procurement delays and district-level accountability."
        ),
        "city": "Gulu",
        "lat": 2.7746,
        "lng": 32.2990,
    },
    {
        "title": "Feeder roads affecting access to markets",
        "category": "Roads and Transport",
        "sentiment": "negative",
        "status": "analysed",
        "description": (
            "Farmers say impassable feeder roads are increasing transport costs and delaying produce "
            "from reaching markets. They request clearer road fund reporting and repair timelines."
        ),
        "city": "Masaka",
        "lat": -0.3411,
        "lng": 31.7361,
    },
    {
        "title": "Youth skills funding needs constituency follow-up",
        "category": "Youth Employment",
        "sentiment": "neutral",
        "status": "pending",
        "description": (
            "Youth groups welcome skills development proposals but need practical information on "
            "eligibility, training centres, startup support, and monitoring of promised funds."
        ),
        "city": "Jinja",
        "lat": 0.4479,
        "lng": 33.2026,
    },
    {
        "title": "School inspection and UPE classroom congestion",
        "category": "Education",
        "sentiment": "negative",
        "status": "analysed",
        "description": (
            "Parents report overcrowded classrooms, delayed teacher replacement, and inconsistent "
            "school inspection. They want committee follow-up on UPE funding and learning conditions."
        ),
        "city": "Mbarara",
        "lat": -0.6072,
        "lng": 30.6545,
    },
    {
        "title": "Rural electrification connection delays",
        "category": "Electricity and Energy",
        "sentiment": "negative",
        "status": "pending",
        "description": (
            "Households near completed electricity lines say connection fees and delayed meter installation "
            "are limiting rural electrification benefits. They ask for utility accountability hearings."
        ),
        "city": "Lira",
        "lat": 2.2499,
        "lng": 32.8999,
    },
    {
        "title": "Water point repairs and sanitation concerns",
        "category": "Water and Sanitation",
        "sentiment": "neutral",
        "status": "analysed",
        "description": (
            "Village leaders report broken boreholes, long repair timelines, and sanitation concerns around "
            "trading centres. They request a transparent district maintenance response plan."
        ),
        "city": "Mbale",
        "lat": 1.0806,
        "lng": 34.1750,
    },
    {
        "title": "PDM beneficiary selection transparency",
        "category": "Corruption and Accountability",
        "sentiment": "negative",
        "status": "analysed",
        "description": (
            "Constituents want clearer Parish Development Model beneficiary lists, appeals channels, "
            "and reporting on SACCO disbursements to reduce perceptions of favouritism."
        ),
        "city": "Kampala",
        "lat": 0.3476,
        "lng": 32.5825,
    },
    {
        "title": "Agricultural extension support for coffee farmers",
        "category": "Agriculture",
        "sentiment": "positive",
        "status": "pending",
        "description": (
            "Coffee farmers appreciate proposed sector support but ask Parliament to improve extension "
            "worker coverage, input quality checks, and market information at subcounty level."
        ),
        "city": "Fort Portal",
        "lat": 0.6710,
        "lng": 30.2750,
    },
    {
        "title": "Digital service access for national IDs",
        "category": "Digital Services",
        "sentiment": "neutral",
        "status": "analysed",
        "description": (
            "Citizens welcome digital public services but report slow national ID updates, limited help desks, "
            "and unclear escalation channels for online service failures."
        ),
        "city": "Entebbe",
        "lat": 0.0611,
        "lng": 32.4693,
    },
    {
        "title": "Land compensation and dispute resolution delays",
        "category": "Land",
        "sentiment": "negative",
        "status": "analysed",
        "description": (
            "Families affected by public works projects report delayed compensation, unclear valuation "
            "processes, and limited access to fair land dispute resolution."
        ),
        "city": "Hoima",
        "lat": 1.4319,
        "lng": 31.3525,
    },
    {
        "title": "Security lighting and police response near markets",
        "category": "Security",
        "sentiment": "neutral",
        "status": "pending",
        "description": (
            "Market vendors request better street lighting, regular police patrols, and a practical channel "
            "for reporting repeated theft around busy trading areas."
        ),
        "city": "Arua",
        "lat": 3.0201,
        "lng": 30.9111,
    },
    {
        "title": "Cost of living pressure on household essentials",
        "category": "Taxation and Cost of Living",
        "sentiment": "negative",
        "status": "analysed",
        "description": (
            "Households ask Parliament to review tax and price pressures affecting fuel, food, school materials, "
            "and small business operating costs."
        ),
        "city": "Kampala",
        "lat": 0.3476,
        "lng": 32.5825,
    },
]
SKYLAB_POSTS = [
    {
        "title": "Skylab opens public submissions on health service delivery",
        "content": (
            "Skylab is collecting citizen and MP-recorded feedback on medicine stock-outs, facility staffing, "
            "maternity care, and district health accountability for parliamentary follow-up."
        ),
        "category": "Healthcare",
    },
    {
        "title": "Skylab consultation on roads, markets, and constituency access",
        "content": (
            "Residents are invited to document priority feeder roads, bridge repairs, transport costs, "
            "and evidence needed for committee oversight of infrastructure funding."
        ),
        "category": "Roads and Transport",
    },
    {
        "title": "Skylab youth employment and skills feedback window",
        "content": (
            "Young people, training institutions, and employers can share feedback on apprenticeships, "
            "vocational training, startup finance, and job placement support."
        ),
        "category": "Youth Employment",
    },
]
SKYLAB_ISSUES = [
    {
        "title": "Health facility medicine availability",
        "description": "Analysed feedback shows repeated concerns about medicine stock-outs, procurement timelines, and public health facility accountability.",
        "priority_level": "high",
        "status": "open",
        "sentiment": "negative",
        "resolution_made": "Prepare a committee brief requesting district stock status, procurement timelines, and follow-up dates.",
    },
    {
        "title": "Feeder road maintenance transparency",
        "description": "Constituents repeatedly connect poor feeder roads to market access, higher transport costs, and unclear road fund reporting.",
        "priority_level": "high",
        "status": "monitoring",
        "sentiment": "negative",
        "resolution_made": "Track named road sections and request district maintenance schedules for public reporting.",
    },
    {
        "title": "PDM beneficiary and SACCO reporting",
        "description": "Feedback highlights calls for transparent PDM beneficiary lists, appeals channels, and SACCO disbursement reporting.",
        "priority_level": "medium",
        "status": "open",
        "sentiment": "negative",
        "resolution_made": "Collect constituency evidence and prepare questions for the responsible ministry.",
    },
    {
        "title": "Youth skills programme access",
        "description": "Youth groups need clearer information on eligibility, training locations, startup support, and monitoring of promised skills funds.",
        "priority_level": "medium",
        "status": "resolved",
        "sentiment": "neutral",
        "resolution_made": "Publish a simplified constituency guidance note and referral contact list.",
    },
]
PARLIAMENT_TOPICS = [
    {
        "title": "National Budget Framework Paper consultations",
        "description": "Public feedback on budget priorities, revenue proposals, and allocations to health, education, roads, and local government services.",
        "category": "Budget",
    },
    {
        "title": "Parish Development Model implementation oversight",
        "description": "Citizen views on access to PDM funds, beneficiary selection, SACCO reporting, and gaps requiring parliamentary follow-up.",
        "category": "Oversight",
    },
    {
        "title": "Public health service delivery in regional hospitals",
        "description": "Feedback on medicine stock-outs, staffing, ambulance access, maternity care, and referral hospital performance across Uganda.",
        "category": "Health",
    },
    {
        "title": "Road maintenance and district infrastructure funding",
        "description": "Constituency input on feeder roads, bridges, urban potholes, and accountability for road fund releases.",
        "category": "Infrastructure",
    },
    {
        "title": "Education financing and school inspection",
        "description": "Citizen comments on UPE and USE funding, classroom congestion, teacher deployment, school meals, and inspection standards.",
        "category": "Education",
    },
    {
        "title": "Youth employment and skills development bill",
        "description": "Public submissions on apprenticeships, vocational training, startup support, and employment pathways for young Ugandans.",
        "category": "Bill",
    },
    {
        "title": "Land amendment proposals and dispute resolution",
        "description": "Feedback on land rights, evictions, compensation, customary tenure, and access to fair dispute resolution.",
        "category": "Amendment",
    },
    {
        "title": "Electricity access and tariff oversight",
        "description": "Community views on rural electrification, connection costs, reliability, tariffs, and service provider accountability.",
        "category": "Oversight",
    },
    {
        "title": "Agricultural extension and coffee sector regulation",
        "description": "Farmer feedback on extension workers, inputs, market access, coffee quality rules, and value addition support.",
        "category": "Agriculture",
    },
    {
        "title": "Anti-corruption reporting and public accountability",
        "description": "Citizen concerns on misuse of public funds, procurement transparency, local government accountability, and whistleblower protection.",
        "category": "Accountability",
    },
]
PARLIAMENT_POST_SOURCES = [
    "Parliament of Uganda",
    "Committee on Health",
    "Committee on Education and Sports",
    "Committee on Physical Infrastructure",
    "Committee on Agriculture",
    "Committee on Gender, Labour and Social Development",
    "Committee on Legal and Parliamentary Affairs",
    "Committee on Natural Resources",
    "Public Accounts Committee",
    "MP Constituency Office",
]
PARLIAMENT_POST_FRAMES = [
    {
        "title": "Parliament invites public views on the National Budget Framework Paper",
        "source": "Parliament of Uganda",
        "content": "Parliament is receiving citizen views on budget priorities, revenue proposals, and allocations to health, education, roads, agriculture, and local government services.",
        "category": "Budget",
    },
    {
        "title": "MP update on Parish Development Model implementation gaps",
        "source": "MP Constituency Office",
        "content": "The constituency office is collecting public feedback on PDM beneficiary selection, SACCO reporting, delayed disbursements, and practical support needed by households.",
        "category": "Oversight",
    },
    {
        "title": "Health Committee seeks experiences from regional referral hospitals",
        "source": "Committee on Health",
        "content": "Citizens are invited to share experiences on medicine availability, staffing levels, maternal care, ambulance access, and referral hospital service standards.",
        "category": "Health",
    },
    {
        "title": "Constituency consultation on feeder roads and bridge repairs",
        "source": "Constituency Development Forum",
        "content": "Residents are asked to identify priority road sections, unsafe bridges, drainage challenges, and accountability concerns around district road maintenance funds.",
        "category": "Infrastructure",
    },
    {
        "title": "Public submissions requested on school funding and inspection",
        "source": "Committee on Education and Sports",
        "content": "Parliamentary education stakeholders are gathering views on UPE and USE funding, teacher deployment, classroom congestion, school meals, and inspection follow-up.",
        "category": "Education",
    },
    {
        "title": "Youth employment and skills development proposal open for comment",
        "source": "Committee on Gender, Labour and Social Development",
        "content": "Young people, employers, and training institutions are invited to comment on apprenticeships, vocational training, startup finance, and job placement support.",
        "category": "Bill",
    },
    {
        "title": "Land rights and compensation concerns before committee review",
        "source": "Committee on Legal and Parliamentary Affairs",
        "content": "Citizens can submit concerns on evictions, compensation delays, customary tenure, land administration, and access to fair dispute resolution.",
        "category": "Amendment",
    },
    {
        "title": "Electricity access and tariff concerns from rural communities",
        "source": "Committee on Natural Resources",
        "content": "The committee is receiving feedback on connection costs, reliability, rural electrification progress, tariff pressure, and utility service accountability.",
        "category": "Oversight",
    },
    {
        "title": "Farmers asked to comment on extension services and coffee regulation",
        "source": "Committee on Agriculture",
        "content": "Agricultural communities are sharing views on extension workers, input quality, market access, coffee standards, value addition, and farmer protection.",
        "category": "Agriculture",
    },
    {
        "title": "Public accountability hearing on procurement and local government spending",
        "source": "Public Accounts Committee",
        "content": "Citizens are invited to report concerns about procurement transparency, misuse of public funds, delayed projects, and whistleblower protection.",
        "category": "Accountability",
    },
]


def bootstrap_database():
    initialize_database(include_reference_data=True)


def with_seed_tag(payload: dict):
    return {**payload, "seed_tag": DEMO_SEED_TAG}


def days_ago(days: int) -> tuple[date, time]:
    moment = datetime.now() - timedelta(days=days)
    return moment.date(), moment.time().replace(microsecond=0)


def get_uganda_location_paths(db):
    paths = (
        db.query(
            db_models.District.id.label("district_id"),
            db_models.District.name.label("district_name"),
            db_models.Constituency.id.label("constituency_id"),
            db_models.Subcounty.id.label("subcounty_id"),
            db_models.Parish.id.label("parish_id"),
        )
        .join(
            db_models.Regions,
            db_models.Regions.id == db_models.District.region_id,
        )
        .join(
            db_models.Countries,
            db_models.Countries.id == db_models.Regions.country_id,
        )
        .join(
            db_models.Constituency,
            db_models.Constituency.district_id == db_models.District.id,
        )
        .join(
            db_models.Subcounty,
            db_models.Subcounty.constituency_id == db_models.Constituency.id,
        )
        .join(
            db_models.Parish,
            db_models.Parish.subcounty_id == db_models.Subcounty.id,
        )
        .filter(db_models.Countries.name.ilike("Uganda"))
        .order_by(
            db_models.District.name.asc(),
            db_models.Constituency.name.asc(),
            db_models.Subcounty.name.asc(),
            db_models.Parish.name.asc(),
        )
        .all()
    )
    if not paths:
        raise RuntimeError("Uganda administrative hierarchy must be seeded before users")

    paths_by_district = {}
    for path in paths:
        paths_by_district.setdefault(path.district_id, []).append(path)

    diverse_paths = []
    path_index = 0
    while True:
        added_path = False
        for district_paths in paths_by_district.values():
            if path_index < len(district_paths):
                diverse_paths.append(district_paths[path_index])
                added_path = True
        if not added_path:
            break
        path_index += 1
    return diverse_paths


def user_location_payload(location_path):
    return {
        "company_country": "Uganda",
        "company_city": location_path.district_name,
        "district_id": location_path.district_id,
        "constituency_id": location_path.constituency_id,
        "subcounty_id": location_path.subcounty_id,
        "parish_id": location_path.parish_id,
    }


def get_or_create_user(db, payload: dict):
    record = db.query(db_models.User).filter(db_models.User.email == payload["email"]).first()
    if record is None:
        record = db_models.User(**payload)
        db.add(record)
        db.flush()
        return record

    for field, value in payload.items():
        setattr(record, field, value)
    db.flush()
    return record


def ensure_primary_admin(db, location_paths):
    record = (
        db.query(db_models.User)
        .filter(db_models.User.email.ilike(PRIMARY_ADMIN_EMAIL))
        .first()
    )

    if record is None:
        if not PRIMARY_ADMIN_PASSWORD:
            raise RuntimeError(
                "UGVOICE_ADMIN_PASSWORD must be set when the primary admin account "
                f"{PRIMARY_ADMIN_EMAIL} does not already exist"
            )

        username = os.getenv("UGVOICE_ADMIN_USERNAME", "moshe").strip() or "moshe"
        existing_username = (
            db.query(db_models.User)
            .filter(db_models.User.username == username)
            .first()
        )
        if existing_username is not None:
            raise RuntimeError(
                f"UGVOICE_ADMIN_USERNAME '{username}' is already used by another account"
            )

        location_path = location_paths[0]
        record = db_models.User(
            username=username,
            email=PRIMARY_ADMIN_EMAIL,
            fname=os.getenv("UGVOICE_ADMIN_FIRST_NAME", "Moshe").strip() or "Moshe",
            password=hash_password(PRIMARY_ADMIN_PASSWORD),
            role="admin",
            mobile_number=None,
            verification_status="verified",
            status="active",
            visibility="public",
            type="personal",
            description="UGVoice system administrator.",
            **user_location_payload(location_path),
        )
        db.add(record)

    record.role = "admin"
    record.status = "active"
    record.verification_status = "verified"
    db.flush()
    return record


def get_or_create_topic(db, payload: dict):
    record = (
        db.query(db_models.Topics)
        .filter(db_models.Topics.title == payload["title"])
        .first()
    )
    if record is None:
        record = db_models.Topics(**payload)
        db.add(record)
        db.flush()
        return record

    for field, value in payload.items():
        setattr(record, field, value)
    db.flush()
    return record


def get_or_create_review(db, payload: dict):
    record = (
        db.query(db_models.Review)
        .filter(db_models.Review.topic_id == payload["topic_id"])
        .filter(db_models.Review.author_id == payload["author_id"])
        .filter(db_models.Review.content == payload["content"])
        .first()
    )
    if record is None:
        record = db_models.Review(**payload)
        db.add(record)
        db.flush()
        return record

    for field, value in payload.items():
        setattr(record, field, value)
    db.flush()
    return record


def get_or_create_feedback(db, payload: dict):
    record = (
        db.query(db_models.Feedback)
        .filter(db_models.Feedback.author_user_id == payload["author_user_id"])
        .filter(db_models.Feedback.target_user_id == payload["target_user_id"])
        .filter(db_models.Feedback.title == payload["title"])
        .first()
    )
    if record is None:
        record = db_models.Feedback(**payload)
        db.add(record)
        db.flush()
        return record

    for field, value in payload.items():
        setattr(record, field, value)
    db.flush()
    return record


def get_or_create_post(db, payload: dict):
    record = (
        db.query(db_models.Post)
        .filter(db_models.Post.author_user_id == payload["author_user_id"])
        .filter(db_models.Post.title == payload["title"])
        .first()
    )
    if record is None and payload.get("share_token"):
        record = (
            db.query(db_models.Post)
            .filter(db_models.Post.share_token == payload["share_token"])
            .first()
        )
    if record is None:
        record = db_models.Post(**payload)
        db.add(record)
        db.flush()
        return record

    for field, value in payload.items():
        setattr(record, field, value)
    db.flush()
    return record


def get_or_create_post_review(db, payload: dict):
    record = (
        db.query(db_models.PostReview)
        .filter(db_models.PostReview.post_id == payload["post_id"])
        .filter(db_models.PostReview.author_user_id == payload["author_user_id"])
        .filter(db_models.PostReview.content == payload["content"])
        .first()
    )
    if record is None:
        record = db_models.PostReview(**payload)
        db.add(record)
        db.flush()
        return record

    for field, value in payload.items():
        setattr(record, field, value)
    db.flush()
    return record


def get_or_create_post_reaction(db, payload: dict):
    record = (
        db.query(db_models.PostReaction)
        .filter(db_models.PostReaction.post_id == payload["post_id"])
        .filter(db_models.PostReaction.user_id == payload["user_id"])
        .first()
    )
    if record is None:
        record = db_models.PostReaction(**payload)
        db.add(record)
        db.flush()
        return record

    for field, value in payload.items():
        setattr(record, field, value)
    db.flush()
    return record


def build_parliament_post_payload(index: int):
    frame = PARLIAMENT_POST_FRAMES[(index - 1) % len(PARLIAMENT_POST_FRAMES)]
    source = frame.get("source") or PARLIAMENT_POST_SOURCES[(index - 1) % len(PARLIAMENT_POST_SOURCES)]
    phase = ((index - 1) // len(PARLIAMENT_POST_FRAMES)) + 1
    title = frame["title"] if phase == 1 else f"{frame['title']} - consultation phase {phase}"
    content = (
        f"{source}: {frame['content']} Submissions should include the affected district or constituency, "
        "specific evidence, and recommended action for parliamentary follow-up."
    )
    return {
        "title": title,
        "content": content,
        "category": frame["category"],
    }


def update_legacy_bulk_posts(db):
    frame_titles = tuple(frame["title"] for frame in PARLIAMENT_POST_FRAMES)
    demo_posts = (
        db.query(db_models.Post)
        .order_by(db_models.Post.id.asc())
        .all()
    )
    matching_posts = [
        post
        for post in demo_posts
        if (post.title or "").startswith("Bulk Post ")
        or any((post.title or "").startswith(frame_title) for frame_title in frame_titles)
    ]
    for index, post in enumerate(matching_posts, start=1):
        payload = build_parliament_post_payload(index)
        post.title = payload["title"]
        post.content = payload["content"]
        post.category = payload["category"]
        post.seed_tag = DEMO_SEED_TAG
    if matching_posts:
        db.flush()


def label_existing_seed_data(db):
    db.query(db_models.User).filter(db_models.User.email.ilike("%@ugvoice.test")).update(
        {db_models.User.seed_tag: DEMO_SEED_TAG},
        synchronize_session=False,
    )
    db.query(db_models.Topics).filter(
        db_models.Topics.title.ilike("Bulk Topic %")
    ).update({db_models.Topics.seed_tag: DEMO_SEED_TAG}, synchronize_session=False)
    db.query(db_models.Review).filter(
        db_models.Review.content.ilike("Bulk review %")
    ).update({db_models.Review.seed_tag: DEMO_SEED_TAG}, synchronize_session=False)
    db.query(db_models.Feedback).filter(
        db_models.Feedback.title.ilike("Bulk Feedback %")
    ).update({db_models.Feedback.seed_tag: DEMO_SEED_TAG}, synchronize_session=False)
    db.query(db_models.Post).filter(
        db_models.Post.title.ilike("Bulk Post %")
    ).update({db_models.Post.seed_tag: DEMO_SEED_TAG}, synchronize_session=False)
    update_legacy_bulk_posts(db)

    seed_post_ids = [
        post_id
        for (post_id,) in db.query(db_models.Post.id)
        .filter(db_models.Post.seed_tag == DEMO_SEED_TAG)
        .all()
    ]
    seed_user_ids = [
        user_id
        for (user_id,) in db.query(db_models.User.id)
        .filter(db_models.User.seed_tag == DEMO_SEED_TAG)
        .all()
    ]

    db.query(db_models.PostReview).filter(
        db_models.PostReview.content.ilike("Bulk post review %")
    ).update({db_models.PostReview.seed_tag: DEMO_SEED_TAG}, synchronize_session=False)
    db.query(db_models.EmergingIssue).filter(
        db_models.EmergingIssue.title.ilike("Bulk Emerging Issue %")
    ).update({db_models.EmergingIssue.seed_tag: DEMO_SEED_TAG}, synchronize_session=False)

    if seed_post_ids:
        db.query(db_models.PostReview).filter(db_models.PostReview.post_id.in_(seed_post_ids)).update(
            {db_models.PostReview.seed_tag: DEMO_SEED_TAG},
            synchronize_session=False,
        )
        db.query(db_models.PostReaction).filter(db_models.PostReaction.post_id.in_(seed_post_ids)).update(
            {db_models.PostReaction.seed_tag: DEMO_SEED_TAG},
            synchronize_session=False,
        )
    if seed_user_ids:
        db.query(db_models.Subscription).filter(db_models.Subscription.user_id.in_(seed_user_ids)).update(
            {db_models.Subscription.seed_tag: DEMO_SEED_TAG},
            synchronize_session=False,
        )
        db.query(db_models.PostReaction).filter(db_models.PostReaction.user_id.in_(seed_user_ids)).update(
            {db_models.PostReaction.seed_tag: DEMO_SEED_TAG},
            synchronize_session=False,
        )
    db.flush()


def get_or_create_subscription(db, payload: dict):
    record = (
        db.query(db_models.Subscription)
        .filter(db_models.Subscription.user_id == payload["user_id"])
        .filter(db_models.Subscription.plan == payload["plan"])
        .first()
    )
    if record is None:
        record = db_models.Subscription(**payload)
        db.add(record)
        db.flush()
        return record

    for field, value in payload.items():
        setattr(record, field, value)
    db.flush()
    return record


def get_or_create_emerging_issue(db, payload: dict):
    record = (
        db.query(db_models.EmergingIssue)
        .filter(db_models.EmergingIssue.user_id == payload["user_id"])
        .filter(db_models.EmergingIssue.title == payload["title"])
        .first()
    )
    if record is None:
        record = db_models.EmergingIssue(**payload)
        db.add(record)
        db.flush()
        return record

    for field, value in payload.items():
        setattr(record, field, value)
    db.flush()
    return record


def seed_users(db):
    location_paths = get_uganda_location_paths(db)
    preview_users = [
        ("amina.owino", "amina.owino@ugvoice.test", "Amina", "Owino", "0700001001", "personal", None),
        ("brian.kato", "brian.kato@ugvoice.test", "Brian", "Kato", "0700001002", "personal", None),
        ("clara.njeri", "clara.njeri@ugvoice.test", "Clara", "Njeri", "0700001003", "personal", None),
        ("public.service.directorate", "esther.mutoni@ugvoice.test", "Esther", "Mutoni", "0700001004", "government organization", "Public Service Directorate"),
        ("frank.bwire", "frank.bwire@ugvoice.test", "Frank", "Bwire", "0700001005", "personal", None),
        ("grace.namuli", "grace.namuli@ugvoice.test", "Grace", "Namuli", "0700001006", "personal", None),
    ]

    for index, (username, email, fname, lname, mobile_number, profile_type, company_name) in enumerate(preview_users, start=1):
        location_path = location_paths[(index - 1) % len(location_paths)]
        get_or_create_user(
            db,
            with_seed_tag({
                "username": username,
                "email": email,
                "fname": fname,
                "lname": lname,
                "password": DEFAULT_PASSWORD_HASH,
                "role": "standard",
                "mobile_number": mobile_number,
                "verification_status": "verified",
                "status": "active",
                "visibility": "public",
                "gender": "female" if index % 2 else "male",
                "dob": date(1988 + index, 1 + (index % 12), 1 + (index % 28)),
                "type": profile_type,
                "company_name": company_name,
                **user_location_payload(location_path),
                "type_of_business": (
                    BUSINESSES[index % len(BUSINESSES)]
                    if profile_type != "personal"
                    else None
                ),
                "description": (
                    f"{fname} uses UGVoice for a public profile, community posts, and service insights."
                    if profile_type == "personal"
                    else f"{company_name} uses UGVoice for public engagement and service insights."
                ),
            }),
        )

    for index in range(1, USER_COUNT + 1):
        first_name = FIRST_NAMES[index % len(FIRST_NAMES)]
        last_name = LAST_NAMES[(index * 3) % len(LAST_NAMES)]
        profile_type = PROFILE_TYPES[index % len(PROFILE_TYPES)]
        company_name = (
            ORG_COMPANIES[profile_type][index % len(ORG_COMPANIES[profile_type])]
            if profile_type != "personal"
            else None
        )
        location_path = location_paths[(index + len(preview_users) - 1) % len(location_paths)]
        base_username = username_base(
            fname=first_name,
            lname=last_name,
            account_type=profile_type,
            company_name=company_name,
        )
        username = f"{base_username}.{index:03d}"
        get_or_create_user(
            db,
            with_seed_tag({
                "username": username,
                "email": f"demo.user.{index:03d}@ugvoice.test",
                "fname": first_name,
                "lname": last_name,
                "password": DEFAULT_PASSWORD_HASH,
                "role": "standard",
                "mobile_number": f"0755{index:06d}",
                "verification_status": "verified" if index % 3 else "pending",
                "status": "active",
                "visibility": "public",
                "gender": "female" if index % 2 == 0 else "male",
                "dob": date(1982 + (index % 19), 1 + (index % 12), 1 + (index % 28)),
                "type": profile_type,
                "company_name": company_name,
                **user_location_payload(location_path),
                "type_of_business": (
                    BUSINESSES[index % len(BUSINESSES)]
                    if profile_type != "personal"
                    else None
                ),
                "description": (
                    f"{first_name} {last_name} shares community priorities and public-service feedback on UGVoice."
                    if profile_type == "personal"
                    else f"{company_name} uses UGVoice to preview organization-style profiles, posts, and analytics."
                ),
            }),
        )

    return db.query(db_models.User).order_by(db_models.User.id).all()


def seed_topics_and_reviews(db, users):
    for index in range(1, TOPIC_COUNT + 1):
        author = users[index % len(users)]
        added_date, added_time = days_ago(1 + (index % 45))
        topic_template = PARLIAMENT_TOPICS[(index - 1) % len(PARLIAMENT_TOPICS)]
        cycle = ((index - 1) // len(PARLIAMENT_TOPICS)) + 1
        title = f"{topic_template['title']} - round {cycle}"
        legacy_topic = (
            db.query(db_models.Topics)
            .filter(db_models.Topics.title == f"Bulk Topic {index:03d}")
            .first()
        )
        if legacy_topic is not None:
            legacy_topic.title = title
            legacy_topic.description = topic_template["description"]
            legacy_topic.date_added = added_date
            legacy_topic.time_added = added_time
            db.flush()
        topic = get_or_create_topic(
            db,
            with_seed_tag({
                "title": title,
                "description": topic_template["description"],
                "date_added": added_date,
                "time_added": added_time,
            }),
        )

        for offset in range(3):
            reviewer = users[(index + offset + 7) % len(users)]
            get_or_create_review(
                db,
                with_seed_tag({
                    "topic_id": topic.id,
                    "author_id": reviewer.id,
                    "content": (
                        f"Constituency submission {offset + 1}: residents want clearer timelines, "
                        f"budget transparency, and parliamentary follow-up on {topic_template['title'].lower()}."
                    ),
                    "date_added": added_date,
                    "time_added": added_time,
                    "origin_country": COUNTRIES[(index + offset) % len(COUNTRIES)],
                    "origin_city": "Kampala",
                    "origin_latitude": 0.3476 + (offset * 0.01),
                    "origin_longitude": 32.5825 + (offset * 0.01),
                    "sentiment": SENTIMENTS[(index + offset) % len(SENTIMENTS)],
                }),
            )


def seed_feedbacks(db, users):
    for index in range(1, FEEDBACK_COUNT + 1):
        author = users[index % len(users)]
        target = users[(index + 13) % len(users)]
        feedback_date, feedback_time = days_ago(index % 35)
        get_or_create_feedback(
            db,
            with_seed_tag({
                "author_user_id": author.id,
                "target_user_id": target.id,
                "title": f"Bulk Feedback {index:03d}",
                "description": (
                    f"Bulk feedback {index:03d} helps preview received and submitted "
                    "feedback flows and analysis states."
                ),
                "date_added": feedback_date,
                "time_added": feedback_time,
                "origin_country": COUNTRIES[index % len(COUNTRIES)],
                "origin_city": "Kampala",
                "origin_latitude": 0.3476 + ((index % 5) * 0.02),
                "origin_longitude": 32.5825 + ((index % 5) * 0.02),
                "sentiment": SENTIMENTS[index % len(SENTIMENTS)],
                "status": "analysed" if index % 5 == 0 else "pending",
            }),
        )


def get_or_create_skylab_user(db):
    skylab = (
        db.query(db_models.User)
        .filter(
            db_models.User.username.ilike("%skylab%")
            | db_models.User.email.ilike("%skylab%")
        )
        .order_by(db_models.User.id.asc())
        .first()
    )
    location_paths = get_uganda_location_paths(db)
    location_path = next(
        (
            path
            for path in location_paths
            if path.district_name.strip().lower() == "kampala"
        ),
        location_paths[0],
    )
    payload = with_seed_tag({
        **SKYLAB_PROFILE,
        **user_location_payload(location_path),
        "password": DEFAULT_PASSWORD_HASH,
        "verification_status": "verified",
        "status": "active",
        "visibility": "public",
        "gender": "male",
        "dob": date(1990, 6, 15),
    })

    if skylab is None:
        return get_or_create_user(db, payload)

    preserved_email = skylab.email
    preserved_username = skylab.username
    for field, value in payload.items():
        if field == "email" and preserved_email != SKYLAB_PROFILE["email"]:
            continue
        if field == "username" and preserved_username != SKYLAB_PROFILE["username"]:
            continue
        setattr(skylab, field, value)
    db.flush()
    return skylab


def reassign_skylab_seed_rows(db, skylab_id: int):
    db.query(db_models.Feedback).filter(
        db_models.Feedback.seed_tag == DEMO_SEED_TAG,
        db_models.Feedback.title.ilike("Skylab Feedback%"),
    ).update(
        {db_models.Feedback.target_user_id: skylab_id},
        synchronize_session=False,
    )
    db.query(db_models.Post).filter(
        db_models.Post.seed_tag == DEMO_SEED_TAG,
        db_models.Post.title.ilike("Skylab%"),
    ).update(
        {db_models.Post.author_user_id: skylab_id},
        synchronize_session=False,
    )
    db.query(db_models.EmergingIssue).filter(
        db_models.EmergingIssue.seed_tag == DEMO_SEED_TAG,
        db_models.EmergingIssue.title.ilike("Skylab Issue:%"),
    ).update(
        {db_models.EmergingIssue.user_id: skylab_id},
        synchronize_session=False,
    )
    db.flush()


def seed_skylab_analytics_data(db, users):
    skylab = get_or_create_skylab_user(db)
    reassign_skylab_seed_rows(db, skylab.id)
    authors = [user for user in users if user.id != skylab.id]
    if not authors:
        authors = [skylab]

    for index, theme in enumerate(SKYLAB_FEEDBACK_THEMES, start=1):
        author = authors[(index * 5) % len(authors)]
        feedback_date, feedback_time = days_ago(index + (index % 6))
        get_or_create_feedback(
            db,
            with_seed_tag({
                "author_user_id": author.id,
                "target_user_id": skylab.id,
                "title": theme["title"],
                "description": theme["description"],
                "category": theme["category"],
                "date_added": feedback_date,
                "time_added": feedback_time,
                "origin_country": "Uganda",
                "origin_city": theme["city"],
                "origin_latitude": theme["lat"],
                "origin_longitude": theme["lng"],
                "sentiment": theme["sentiment"],
                "sentiment_confidence": 0.72 + ((index % 4) * 0.05),
                "status": theme["status"],
            }),
        )

    for index, post_payload in enumerate(SKYLAB_POSTS, start=1):
        post_date, post_time = days_ago(index * 3)
        post = get_or_create_post(
            db,
            with_seed_tag({
                "author_user_id": skylab.id,
                "title": post_payload["title"],
                "content": post_payload["content"],
                "category": post_payload["category"],
                "visibility": "public",
                "share_token": None,
                "attachment": None,
                "status": "published",
                "view_count": 34 + (index * 17),
                "date_added": post_date,
                "time_added": post_time,
            }),
        )

        for offset in range(4):
            reviewer = authors[(index + offset * 7) % len(authors)]
            get_or_create_post_review(
                db,
                with_seed_tag({
                    "post_id": post.id,
                    "author_user_id": reviewer.id,
                    "content": (
                        "This Skylab consultation should capture constituency evidence, "
                        "publish the response timeline, and show how the feedback informs Parliament."
                    ),
                    "date_added": post_date,
                    "time_added": post_time,
                    "sentiment": SENTIMENTS[(index + offset) % len(SENTIMENTS)],
                }),
            )

        for offset in range(6):
            reacting_user = authors[(index + offset * 3) % len(authors)]
            get_or_create_post_reaction(
                db,
                with_seed_tag({
                    "post_id": post.id,
                    "user_id": reacting_user.id,
                    "reaction_type": REACTION_TYPES[(index + offset) % len(REACTION_TYPES)],
                    "date_added": post_date,
                    "time_added": post_time,
                }),
            )

    for index, issue_payload in enumerate(SKYLAB_ISSUES, start=1):
        issue_date, issue_time = days_ago(index * 4)
        get_or_create_emerging_issue(
            db,
            with_seed_tag({
                "user_id": skylab.id,
                "title": f"Skylab Issue: {issue_payload['title']}",
                "description": issue_payload["description"],
                "date_added": issue_date,
                "time_added": issue_time,
                "resolution_made": issue_payload["resolution_made"],
                "priority_level": issue_payload["priority_level"],
                "status": issue_payload["status"],
                "sentiment": issue_payload["sentiment"],
            }),
        )

    return skylab


def seed_posts_reviews_and_reactions(db, users):
    for index in range(1, POST_COUNT + 1):
        author = users[index % len(users)]
        post_date, post_time = days_ago(index % 30)
        is_private = index % 3 == 0
        post_template = build_parliament_post_payload(index)
        title = post_template["title"]
        content = post_template["content"]
        legacy_post = (
            db.query(db_models.Post)
            .filter(db_models.Post.author_user_id == author.id)
            .filter(db_models.Post.title == f"Bulk Post {index:03d}")
            .first()
        )
        if legacy_post is not None:
            legacy_post.title = title
            legacy_post.content = content
            legacy_post.category = post_template["category"]
            legacy_post.date_added = post_date
            legacy_post.time_added = post_time
            legacy_post.seed_tag = DEMO_SEED_TAG
            db.flush()
        post = get_or_create_post(
            db,
            with_seed_tag({
                "author_user_id": author.id,
                "title": title,
                "content": content,
                "category": post_template["category"],
                "visibility": "private" if is_private else "public",
                "share_token": f"share-post-{index:04d}-{author.id}" if is_private else None,
                "attachment": None,
                "status": "published",
                "date_added": post_date,
                "time_added": post_time,
            }),
        )

        for offset in range(2):
            reviewer = users[(index + offset + 9) % len(users)]
            get_or_create_post_review(
                db,
                with_seed_tag({
                    "post_id": post.id,
                    "author_user_id": reviewer.id,
                    "content": (
                        f"Public response {offset + 1}: this matter should reflect real district needs, "
                        "publish clear next steps, and show how citizen feedback shapes the final position."
                    ),
                    "date_added": post_date,
                    "time_added": post_time,
                }),
            )

        for offset in range(4):
            reacting_user = users[(index + offset + 19) % len(users)]
            get_or_create_post_reaction(
                db,
                with_seed_tag({
                    "post_id": post.id,
                    "user_id": reacting_user.id,
                    "reaction_type": REACTION_TYPES[(index + offset) % len(REACTION_TYPES)],
                    "date_added": post_date,
                    "time_added": post_time,
                }),
            )


def seed_subscriptions(db, users):
    plans = [("Starter", 0.0), ("Professional", 29.0), ("Enterprise", 120.0)]
    for index, user in enumerate(users[:121], start=1):
        plan, amount = plans[index % len(plans)]
        get_or_create_subscription(
            db,
            with_seed_tag({
                "user_id": user.id,
                "plan": plan,
                "amount": amount,
                "start_date": date.today() - timedelta(days=30 + index),
                "expiry_date": date.today() + timedelta(days=20 + (index % 15)),
            }),
        )


def seed_emerging_issues(db, users):
    for index in range(1, ISSUE_COUNT + 1):
        issue_date, issue_time = days_ago(index % 25)
        get_or_create_emerging_issue(
            db,
            with_seed_tag({
                "user_id": users[index % len(users)].id,
                "title": f"Bulk Emerging Issue {index:03d}",
                "description": (
                    f"Bulk emerging issue {index:03d} was generated from analysed feedback "
                    "to populate issue previews and dashboards."
                ),
                "date_added": issue_date,
                "time_added": issue_time,
                "resolution_made": f"Resolution plan {index:03d} includes owners, timelines, and review checkpoints.",
                "priority_level": ISSUE_PRIORITIES[index % len(ISSUE_PRIORITIES)],
                "status": ISSUE_STATUSES[index % len(ISSUE_STATUSES)],
            }),
        )


def print_table_counts(db):
    print("Table counts after seeding:")
    print(f"  users: {db.query(db_models.User).count()}")
    print(f"  topics: {db.query(db_models.Topics).count()}")
    print(f"  reviews: {db.query(db_models.Review).count()}")
    print(f"  feedbacks: {db.query(db_models.Feedback).count()}")
    print(f"  posts: {db.query(db_models.Post).count()}")
    print(f"  post_reviews: {db.query(db_models.PostReview).count()}")
    print(f"  post_reactions: {db.query(db_models.PostReaction).count()}")
    print(f"  subscriptions: {db.query(db_models.Subscription).count()}")
    print(f"  emerging_issues: {db.query(db_models.EmergingIssue).count()}")


def main():
    bootstrap_database()
    db = SessionLocal()
    try:
        label_existing_seed_data(db)
        users = seed_users(db)
        ensure_primary_admin(db, get_uganda_location_paths(db))
        seed_topics_and_reviews(db, users)
        seed_feedbacks(db, users)
        skylab_user = seed_skylab_analytics_data(db, users)
        update_legacy_bulk_posts(db)
        seed_posts_reviews_and_reactions(db, users)
        seed_subscriptions(db, users)
        seed_emerging_issues(db, users)
        db.commit()
        print_table_counts(db)
    finally:
        db.close()

    print("Dummy data seeded successfully.")
    print("Preview login credentials:")
    print("  amina.owino@ugvoice.test / Pass1234")
    print("  brian.kato@ugvoice.test / Pass1234")
    print("  clara.njeri@ugvoice.test / Pass1234")
    print("  esther.mutoni@ugvoice.test / Pass1234")
    print("  frank.bwire@ugvoice.test / Pass1234")
    print("  grace.namuli@ugvoice.test / Pass1234")
    print(f"  {skylab_user.email} / Pass1234")


if __name__ == "__main__":
    main()
