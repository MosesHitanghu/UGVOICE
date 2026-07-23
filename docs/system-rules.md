# UGVoice System Rules

This file is the main source of truth for agreed system rules across backend, frontend, API, data model, and UI behavior.
It should be updated whenever we add or change a project convention.

## Source Of Truth

- This file is the canonical rules file for the project.
- Future updates should prefer updating this file first.
- [`backend-api-rules.md`](backend-api-rules.md) is kept for compatibility, but it should stay aligned with this file.

## Core Product Scope

- The active product scope is centered on `users`, `posts`, `feedbacks`, `reviews`, `subscriptions`, and `emerging issues`.
- Private messaging and chat are not part of the product scope. Do not add messaging UI, API routes, models, or database tables.
- Organization features and organization-based visibility logic should not be extended further.
- New private-access work should prefer shared-link post access instead of group membership rules.

## Naming Rules

- Use `users` instead of `profiles` in backend code, routes, and database naming.
- The main user table is `users`.
- Use `user_id` for foreign keys that point to `users`.
- Do not introduce new `profile_id` columns or `profiles` route names.

## User Rules

- User CRUD routes must use `/users`.
- Login uses `email` or `mobile_number` with `password`.
- The home login drawer should temporarily disable credential entry after 5 failed login attempts.
- The current login lockout window is 15 minutes.
- Signup uses `/signup` and collects only essential first-step fields.
- The signup drawer should provide separate `Personal` and `Organization` tabs.
- Personal signup requires first name and last name.
- Organization signup on the homepage should be able to create independent organization accounts without requiring an owner email.
- Logged-in personal users should be able to add child organization accounts from the app-bar profile dropdown.
- Public profile pages should show `Switch Account` instead of `Give feedback` when the viewed profile is directly linked to the signed-in profile through the parent/child account relationship.
- Account switching should replace the current authenticated profile with the selected linked account without requiring the child account password while the user is already inside the parent account flow.
- The app-bar profile dropdown should expose linked-account actions such as `Switch account`, `Your profile`, `Complete your profile`, and `Add child account`.
- Parent-to-child switching may happen directly from the linked account menus.
- Child-to-parent switching must require the parent account credentials through a popup drawer before the session changes.
- New signed-up users default to `role = standard`.
- New signed-up users default to `status = active`.
- `mobile_number` is optional.
- `role` is optional.
- `verification_status` is optional.
- `status` is optional and can carry values like `active` or `deactivated`.
- `visibility` can be `public`, `constituency`, or `private`.
- `parent_user_id` is optional on `users`.
- Personal accounts keep `parent_user_id = null`.
- Independent organization signups may keep `parent_user_id = null`.
- Organization child accounts created by a logged-in parent must store the owning personal account in `parent_user_id`.
- `type` supports `personal` and `government organization` only.
- Legacy `individual` values normalize to `personal`.
- `business` and `ngo` account types are not supported and must not be seeded or accepted by the API.
- All users are Uganda-based and must have a complete, valid Uganda district, constituency, subcounty/division, and parish hierarchy.
- User `company_country` is normalized to `Uganda`, and `company_city` follows the selected Uganda district.
- Seeded and normalized personal usernames are derived from first and last names.
- Seeded and normalized government-organization usernames are derived from the organization title.
- Usernames must not use placeholder labels such as `demo`, `dummy`, `sample`, or generic numbered `user` values.
- Repeated name- or title-based usernames receive a numeric suffix and remain unique case-insensitively.
- Never return the stored `password` field in API responses.

## Visibility Rules

- Public users are discoverable by other users in the system.
- Private users are not meant for broad public discovery.
- Public posts are visible in the shared system feed.
- Private posts are visible to the author by default.
- Private posts can also be viewed through a valid shared-link token.

## Feedback Rules

- Frontend-facing feedback naming should use `submitted` and `received`.
- Do not introduce new frontend naming like `authored` for the same concept.
- Vercel production inference uses named Hugging Face models through remote APIs and must not download model weights.
- Feedback analysis must persist the inference provider, mode, exact model IDs, latency, and whether any fallback was used.
- A fallback result must be labelled as a fallback and must never be presented as model-generated output.
- BERTopic may only be labelled as active when the optional local or worker pipeline actually executes BERTopic.

### Reviews

- Reviews are feedback on topics.
- Reviews are topic-owned resources through `reviews.topic_id`.
- Reviews still store `author_id` for authorship.
- Review routing should be topic-scoped.
- `sentiment` for reviews is not expected from the frontend for now.
- The backend may assign a temporary random sentiment placeholder until the sentiment-analysis model is integrated.

Preferred review routes:
- `POST /reviews`
- `GET /reviews`
- `GET /reviews/{review_id}`
- `PUT /reviews/{review_id}`
- `DELETE /reviews/{review_id}`
- `GET /topics/{topic_id}/reviews`
- `POST /topics/{topic_id}/reviews`

### Feedbacks

- Feedbacks use `author_user_id` and `target_user_id` in both Python code and the database.
- Submitted feedback means `author_user_id = user_id`.
- Received feedback means `target_user_id = user_id`.
- Feedbacks sent to a user are private and should only be visible to the target user.
- `sentiment` for feedbacks is not expected from the frontend for now.
- The backend may assign a temporary random sentiment placeholder until the sentiment-analysis model is integrated.
- Feedbacks have a `status` field.
- New feedback starts with `status = pending`.
- After analysis into emerging issues, feedback must change to `status = analysed`.
- Analysed feedback must not be analysed again.

Preferred feedback routes:
- `POST /feedbacks`
- `GET /feedbacks`
- `GET /feedbacks/{feedback_id}`
- `PUT /feedbacks/{feedback_id}`
- `DELETE /feedbacks/{feedback_id}`
- `GET /users/{user_id}/feedbacks/submitted`
- `GET /users/{user_id}/feedbacks/received`
- `GET /users/{user_id}/feedbacks/both`
- `GET /users/{user_id}/feedbacks/analysis-candidates`
- `POST /users/{user_id}/feedbacks/analyse`

### Feedback Analysis Contract

- `POST /users/{user_id}/feedbacks/analyse` is for the sentiment/emerging-issue pipeline.
- The request body must include:
  - `start_date`
  - `end_date`
  - `feedback_ids`
  - `emerging_issues`
- `feedback_ids` must belong to that user's received feedback in the selected date range.
- Already-analysed feedback must not be sent again.

## Topics Rules

- Topics belong to users through `topics.author_id`.
- Reviews should be fetched from topics, not from users.

Preferred topic routes:
- `GET /users/{user_id}/topics`
- `GET /topics/{topic_id}/reviews`
- `POST /topics/{topic_id}/reviews`

## Posts Rules

- Use `posts` for the social feed layer.
- Posts can be `public`, `constituency`, or `private`.
- Constituency posts are visible only to the author and users whose profile constituency matches the author's constituency.
- Posts no longer depend on organizations or team-group membership.
- Post title is required.
- Posts support:
  - reviews
  - reactions
  - search
  - analytics
  - thumbnails
  - document attachments
  - view counts
- Post attachments are limited to PDF files only.
- Post thumbnails should display at the top of post cards before the rest of the content.
- Posts without thumbnails should display a default thumbnail image.
- Reactions should support at least likes, dislikes, and emoji-style response types.
- A user can review only once per post.
- Post analytics dialogs should place the sentiment chart at the top and avoid repeating like, dislike, and review counts already shown on the post card.
- Post analytics dialogs should use `Post sentiments` as the chart title, place a divider below the chart, and omit `insightful`, `support`, and `love` from the modal analytics chips.
- Post sentiment charts should use theme semantic colors: `success` for positive, `primary` for neutral, and `warning` for negative.
- If a post has no sentiment values yet, the analytics modal should show `No Sentiments` instead of an empty chart.
- Post analytics dialogs should use one borderless grouped metric button set at the bottom for reviews, visibility, and the visible reaction insights.
- In post analytics dialogs, the author may toggle the visibility button between `Public`, `My constituency`, and `Private`; private posts remain visible only to the author unless opened with a valid shared link.
- Wherever the post author is the logged-in user, display `By you` instead of the author name.
- Author-owned post cards should show a three-dot menu with `Edit`, `Hide`, and `Delete`.
- In the current visibility model, `Hide` means changing the post visibility to `private`.

Preferred post routes:
- `POST /posts`
- `GET /posts`
- `GET /posts/{post_id}`
- `PUT /posts/{post_id}`
- `DELETE /posts/{post_id}`
- `GET /posts/{post_id}/reviews`
- `POST /posts/{post_id}/reviews`
- `POST /posts/{post_id}/reactions`
- `GET /posts/{post_id}/analytics`
- `GET /users/{user_id}/posts`

## Emerging Issues Rules

- Emerging issues are user-owned resources.
- Emerging issues do not follow the `submitted` and `received` pattern.
- Each emerging issue belongs to a specific user through `emergingIssues.user_id`.
- Emerging issues are not created from frontend forms.
- Emerging issues are created from feedback analysis results.

Preferred route:
- `GET /users/{user_id}/emerging-issues`

## Subscriptions Rules

- Subscriptions are user-owned resources.
- The subscriptions table uses:
  - `id` as the primary key
  - `user_id` as a foreign key to `users.id`
  - `plan`
  - `amount`
  - `start_date`
  - `expiry_date`

Preferred routes:
- `POST /subscriptions`
- `GET /subscriptions`
- `GET /subscriptions/{subscription_id}`
- `PUT /subscriptions/{subscription_id}`
- `DELETE /subscriptions/{subscription_id}`
- `GET /users/{user_id}/subscriptions`

## Search Rules

- Posts and user profiles must be searchable from the frontend.
- Search results must respect visibility rules.
- Post search should support title, content/description, and author identity.

Preferred routes:
- `GET /search`
- `GET /search/users`
- `GET /search/posts`

## Dashboard Rules

- The professional dashboard uses profile-wide analytics for the signed-in user.
- Dashboard analytics should include age ranges, gender demography, post visibility, emerging issue trends, and engagement trends when available.
- The analytics dashboard still exists as a dedicated page.
- The feed should be the default landing view after login.

Preferred route:
- `GET /users/{user_id}/dashboard`

## Frontend Navigation Rules

- After login or signup, users should land on the feed by default.
- `/dashboard` should redirect to the feed.
- The analytics overview should remain available as its own route.
- In the sidebar:
  - `Home` points to the feed
  - `Dashboard` points to the analytics overview
- The `Home` icon should use a home-style icon.

## Feed UI Rules

- The feed header should show a `Create Pose` action before the search field.
- The post composer should open in a drawer instead of rendering inline on the page.
- The post drawer should render above the app bar.
- Drawer validation and success messages for post publishing must stay inside the drawer.
- The post drawer should not close automatically after submit.
- The feed page section title is `Posts for review`.
- The feed should provide tabs for:
  - `Public`
  - `Featured`
  - `Latest`
  - `By you`
- The default tab is `Public`.
- A divider should appear before the tabs.

## Post Card UI Rules

- Show the post thumbnail at the top of the card.
- Below the thumbnail, show the title, author label, content, and actions.
- Keep the main post actions focused on:
  - like
  - dislike
  - reviews
  - analytics
  - share
- The post-card `Reviews` action should open a compose modal instead of expanding previous reviews inline.
- Full review lists belong on the full article page.
- Post cards should show views, reviews, relative post age, and a `View full article` action.
- The full article page should show the full post content, the review list, and a button to open the attached PDF when present.
- Like and dislike should be presented as grouped buttons.
- Post action buttons should be rounded and borderless where already adopted.

## Public Profile UI Rules

- Public profile pages should have:
  - a top profile/header card
  - a public profile information card
  - a posts section
- On large screens, the first two top cards should display in two columns.
- Public profile posts should follow the same structure as feed posts.
- Public profile posts should support search.
- Public profile posts should display in a 3-column layout on large screens.
- The public profile header card should include a `Give feedback` button for visiting users.

## App Bar Rules

- The dashboard app bar should include a notifications icon with a badge for new posts.
- The notification badge should reflect newer public posts.
- Clicking the notification icon should take the user to the feed.
- The profile action should live in the app bar and open the profile experience in a right-side drawer.

## Session Rules

- Signed-in users should be logged out after 30 minutes of inactivity.
- Inactivity logout is currently enforced on the frontend session layer and should clear the stored user session before redirecting back to the home page.

## Thumbnails And Assets Rules

- Uploaded post thumbnails should resolve correctly from backend `/uploads/...` URLs.
- Some demo posts may use curated real-photo fallback thumbnails for preview purposes when no uploaded thumbnail exists.
- Demo profile pictures may be used for selected seed users.
- Users without a profile picture should fall back to colored initials avatars.

## Form Validation Rules

- All active frontend forms must use MUI field-level validation through `TextField` `error` and `helperText`.
- Required-field and format validation should happen before submit, not only after a failed API request.
- Form-specific validation messages should stay inside that form container, dialog, or drawer when possible.
- Submit actions should be disabled or blocked when client-side validation fails.
- New forms should follow the same validation pattern used in:
  - login
  - signup
  - post publishing
  - profile feedback
  - profile editing

## Resource Bundle Rules

- The frontend may use a bundled user resource route when a single payload is helpful.

Preferred route:
- `GET /users/{user_id}/resources`

## Seed Data Rules

- Seed data should provide enough variety for meaningful UI previews and testing.
- Seeded users should cover multiple `type` values, not just `individual`.
- Seeded data should be rich enough to exercise posts, reactions, reviews, feedbacks, subscriptions, and emerging issues.

## Update Rule

- When new conventions are agreed on, update this file in the same task whenever possible.
