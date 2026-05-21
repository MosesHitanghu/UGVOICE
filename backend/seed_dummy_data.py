from datetime import date, datetime, time, timedelta

import db_models
from database import (
    SessionLocal,
    initialize_database,
)


DEFAULT_PASSWORD = "Pass1234"
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
COUNTRIES = ["Uganda", "Kenya", "Rwanda", "Tanzania"]
CITIES = ["Kampala", "Entebbe", "Nairobi", "Gulu", "Kigali", "Jinja", "Mbarara", "Masaka"]
BUSINESSES = [
    "Research", "Healthcare", "Technology", "Nonprofit", "Consulting",
    "Operations", "Support", "Transport", "Public Service", "Community Programs",
]
PROFILE_TYPES = ["personal", "business", "ngo", "government organization"]
ORG_COMPANIES = {
    "business": [
        "Insight Loop Africa",
        "Lakeview Services",
        "Kampala Product Circle",
        "Member Success Lab",
    ],
    "ngo": [
        "Citizen Voice Hub",
        "Regional Relief Network",
        "Community Action Forum",
        "Youth Impact Initiative",
    ],
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
    preview_users = [
        ("amina.owino", "amina.owino@ugvoice.test", "Amina", "Owino", "0700001001", "personal", None),
        ("brian.kato", "brian.kato@ugvoice.test", "Brian", "Kato", "0700001002", "business", "Lakeview Services"),
        ("clara.njeri", "clara.njeri@ugvoice.test", "Clara", "Njeri", "0700001003", "ngo", "Citizen Voice Hub"),
        ("esther.mutoni", "esther.mutoni@ugvoice.test", "Esther", "Mutoni", "0700001004", "government organization", "Public Service Directorate"),
        ("frank.bwire", "frank.bwire@ugvoice.test", "Frank", "Bwire", "0700001005", "business", "Member Success Lab"),
        ("grace.namuli", "grace.namuli@ugvoice.test", "Grace", "Namuli", "0700001006", "personal", None),
    ]

    for index, (username, email, fname, lname, mobile_number, profile_type, company_name) in enumerate(preview_users, start=1):
        get_or_create_user(
            db,
            with_seed_tag({
                "username": username,
                "email": email,
                "fname": fname,
                "lname": lname,
                "password": DEFAULT_PASSWORD,
                "role": "standard",
                "mobile_number": mobile_number,
                "verification_status": "verified",
                "status": "active",
                "visibility": "public",
                "gender": "female" if index % 2 else "male",
                "dob": date(1988 + index, 1 + (index % 12), 1 + (index % 28)),
                "type": profile_type,
                "company_name": company_name if profile_type != "personal" else COMPANIES[index % len(COMPANIES)],
                "company_country": COUNTRIES[index % len(COUNTRIES)],
                "company_city": CITIES[index % len(CITIES)],
                "type_of_business": BUSINESSES[index % len(BUSINESSES)],
                "description": (
                    f"{fname} uses UGVoice for public profile, feed, and insight demos."
                    if profile_type == "personal"
                    else f"{company_name} uses UGVoice for public profile, feed, and insight demos."
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
            else COMPANIES[index % len(COMPANIES)]
        )
        get_or_create_user(
            db,
            with_seed_tag({
                "username": f"demo.user.{index:03d}",
                "email": f"demo.user.{index:03d}@ugvoice.test",
                "fname": first_name,
                "lname": last_name,
                "password": DEFAULT_PASSWORD,
                "role": "standard",
                "mobile_number": f"0755{index:06d}",
                "verification_status": "verified" if index % 3 else "pending",
                "status": "active",
                "visibility": "public",
                "gender": "female" if index % 2 == 0 else "male",
                "dob": date(1982 + (index % 19), 1 + (index % 12), 1 + (index % 28)),
                "type": profile_type,
                "company_name": company_name,
                "company_country": COUNTRIES[index % len(COUNTRIES)],
                "company_city": CITIES[index % len(CITIES)],
                "type_of_business": BUSINESSES[index % len(BUSINESSES)],
                "description": (
                    f"Bulk demo user {index:03d} for previewing search, posts, and dashboard analytics."
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
            .filter(db_models.Topics.author_id == author.id)
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
                    "origin_city": CITIES[(index + offset) % len(CITIES)],
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
                "origin_city": CITIES[index % len(CITIES)],
                "origin_latitude": 0.3476 + ((index % 5) * 0.02),
                "origin_longitude": 32.5825 + ((index % 5) * 0.02),
                "sentiment": SENTIMENTS[index % len(SENTIMENTS)],
                "status": "analysed" if index % 5 == 0 else "pending",
            }),
        )


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
        seed_topics_and_reviews(db, users)
        seed_feedbacks(db, users)
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


if __name__ == "__main__":
    main()
