from sqlalchemy import (
    Column,
    DateTime,
    Date,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    parent_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    username = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    fname = Column(String, nullable=True)
    lname = Column(String, nullable=True)
    password = Column(String)
    role = Column(String, nullable=False, default="standard")
    mobile_number = Column(String, nullable=True)
    verification_status = Column(String, nullable=True)
    status = Column(String, nullable=False, default="active")
    visibility = Column(String, nullable=False, default="public")
    gender = Column(String, nullable=True)
    dob = Column(Date, nullable=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    constituency_id = Column(Integer, ForeignKey("constituencies.id"), nullable=True)
    subcounty_id = Column(Integer, ForeignKey("subcounties.id"), nullable=True)
    parish_id = Column(Integer, ForeignKey("parishes.id"), nullable=True)
    type = Column(String, nullable=False, default="personal")
    number_of_employees = Column(Integer, nullable=True)
    company_name = Column(String, nullable=True)
    company_country = Column(String, nullable=True)
    company_city = Column(String, nullable=True)
    type_of_business = Column(String, nullable=True)
    profile_picture = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    seed_tag = Column(String, nullable=True, index=True)


class Topics(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text)
    date_added = Column(Date)
    time_added = Column(Time)
    seed_tag = Column(String, nullable=True, index=True)
    


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"))
    author_id = Column(Integer, ForeignKey("users.id"))
    content = Column(Text)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    constituency_id = Column(Integer, ForeignKey("constituencies.id"), nullable=True)
    subcounty_id = Column(Integer, ForeignKey("subcounties.id"), nullable=True)
    parish_id = Column(Integer, ForeignKey("parishes.id"), nullable=True)
    date_added = Column(Date)
    time_added = Column(Time)
    origin_country = Column(String, nullable=True)
    origin_city = Column(String, nullable=True)
    origin_latitude = Column(Float, nullable=True)
    origin_longitude = Column(Float, nullable=True)
    sentiment = Column(String, nullable=True)
    edited_date = Column(Date, nullable=True)
    edited_time = Column(Time, nullable=True)
    seed_tag = Column(String, nullable=True, index=True)


class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    author_user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, index=True)
    description = Column(Text)
    category = Column(String, nullable=True)
    clean_text = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    date_added = Column(Date)
    time_added = Column(Time)
    origin_country = Column(String, nullable=True)
    origin_city = Column(String, nullable=True)
    origin_latitude = Column(Float, nullable=True)
    origin_longitude = Column(Float, nullable=True)
    sentiment = Column(String, nullable=True)
    sentiment_confidence = Column(Float, nullable=True)
    sentiment_score = Column(Text, nullable=True)
    embending = Column(Text, nullable=True)
    embedding_model = Column(String, nullable=True)
    summar_model = Column(String, nullable=True)
    sentiment_model = Column(String, nullable=True)
    topic_id = Column(Integer, nullable=True)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=True)
    topic_probability = Column(Float, nullable=True)
    topic_model_version = Column(String, nullable=True)
    target_user_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, nullable=False, default="pending")
    seed_tag = Column(String, nullable=True, index=True)


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    author_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=True, index=True)
    content = Column(Text, nullable=False)
    category = Column(String, nullable=True)
    visibility = Column(String, nullable=False, default="public")
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    constituency_id = Column(Integer, ForeignKey("constituencies.id"), nullable=True)
    subcounty_id = Column(Integer, ForeignKey("subcounties.id"), nullable=True)
    parish_id = Column(Integer, ForeignKey("parishes.id"), nullable=True)
    share_token = Column(String, unique=True, index=True, nullable=True)
    thumbnail = Column(String, nullable=True)
    attachment = Column(String, nullable=True)
    status = Column(String, nullable=False, default="published")
    view_count = Column(Integer, nullable=False, default=0)
    date_added = Column(Date, nullable=False)
    time_added = Column(Time, nullable=False)
    seed_tag = Column(String, nullable=True, index=True)


class PostCategory(Base):
    __tablename__ = "post_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)


class PostReview(Base):
    __tablename__ = "post_reviews"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    author_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    constituency_id = Column(Integer, ForeignKey("constituencies.id"), nullable=True)
    subcounty_id = Column(Integer, ForeignKey("subcounties.id"), nullable=True)
    parish_id = Column(Integer, ForeignKey("parishes.id"), nullable=True)
    date_added = Column(Date, nullable=False)
    time_added = Column(Time, nullable=False)
    sentiment = Column(String, nullable=True)
    edited_date = Column(Date, nullable=True)
    edited_time = Column(Time, nullable=True)
    seed_tag = Column(String, nullable=True, index=True)


class PostReaction(Base):
    __tablename__ = "post_reactions"
    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_post_reaction_user"),
    )

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reaction_type = Column(String, nullable=False)
    date_added = Column(Date, nullable=False)
    time_added = Column(Time, nullable=False)
    seed_tag = Column(String, nullable=True, index=True)


class PostView(Base):
    __tablename__ = "post_views"
    __table_args__ = (
        UniqueConstraint("post_id", "viewer_key", name="uq_post_view_viewer"),
    )

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    viewer_key = Column(String, nullable=False, index=True)
    date_added = Column(Date, nullable=False)
    time_added = Column(Time, nullable=False)


class PostActionView(Base):
    __tablename__ = "post_action_views"
    __table_args__ = (
        UniqueConstraint("post_id", "viewer_key", name="uq_post_action_view_viewer"),
    )

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    viewer_key = Column(String, nullable=False, index=True)
    date_added = Column(Date, nullable=False)
    time_added = Column(Time, nullable=False)


class EmergingIssue(Base):
    __tablename__ = "emergingIssues"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String, index=True)
    description = Column(Text, nullable=True)
    date_added = Column(Date)
    time_added = Column(Time)
    resolution_made = Column(Text, nullable=True)
    priority_level = Column(String, nullable=True)
    status = Column(String, nullable=True)
    sentiment = Column(String, nullable=True)
    seed_tag = Column(String, nullable=True, index=True)


class Issue(Base):
    __tablename__ = "issues"

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, nullable=True, index=True)
    issue_label = Column(Text, nullable=True)
    keywords = Column(ARRAY(Text), nullable=True)
    size = Column(Integer, nullable=True)
    priority_level = Column(String, nullable=True)
    status = Column(String, nullable=True)
    sentiment = Column(String, nullable=True)
    country_id = Column(Integer, ForeignKey("countries.id"), nullable=True, index=True)
    region_id = Column(Integer, ForeignKey("regions.id"), nullable=True, index=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True, index=True)
    constituency_id = Column(Integer, ForeignKey("constituencies.id"), nullable=True, index=True)
    subcounty_id = Column(Integer, ForeignKey("subcounties.id"), nullable=True, index=True)
    parish_id = Column(Integer, ForeignKey("parishes.id"), nullable=True, index=True)
    model_version = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)


class IssueTrend(Base):
    __tablename__ = "issue_trends"

    id = Column(Integer, primary_key=True, index=True)
    scope = Column(String, nullable=True, index=True)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    period = Column(String, nullable=True, index=True)
    date = Column(Date, nullable=True, index=True)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=True, index=True)
    issue_label = Column(Text, nullable=True)
    frequency = Column(Integer, nullable=True)
    country_id = Column(Integer, ForeignKey("countries.id"), nullable=True, index=True)
    region_id = Column(Integer, ForeignKey("regions.id"), nullable=True, index=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True, index=True)
    constituency_id = Column(Integer, ForeignKey("constituencies.id"), nullable=True, index=True)
    subcounty_id = Column(Integer, ForeignKey("subcounties.id"), nullable=True, index=True)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    plan = Column(String)
    amount = Column(Float)
    start_date = Column(Date)
    expiry_date = Column(Date)
    seed_tag = Column(String, nullable=True, index=True)

class Countries(Base):
    __tablename__ = "countries"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)

class Regions(Base):
    __tablename__ = "regions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    country_id = Column(Integer, ForeignKey("countries.id"), nullable=False)


class District(Base):
    __tablename__ = "districts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    region_id = Column(Integer, ForeignKey("regions.id"), nullable=False)


class Constituency(Base):
    __tablename__ = "constituencies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=False)


class Subcounty(Base):
    __tablename__ = "subcounties"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    constituency_id = Column(Integer, ForeignKey("constituencies.id"), nullable=False)


class Parish(Base):
    __tablename__ = "parishes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    subcounty_id = Column(Integer, ForeignKey("subcounties.id"), nullable=False)


class Village(Base):
    __tablename__ = "villages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    parish_id = Column(Integer, ForeignKey("parishes.id"), nullable=False)
