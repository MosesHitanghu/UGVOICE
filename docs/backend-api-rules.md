# Backend API Rules

This file stores project-specific backend rules and naming decisions for the UGVoice app.
The canonical project-wide rules file is [`system-rules.md`](./system-rules.md).

Use [`system-rules.md`](./system-rules.md) for future cross-system updates, and keep this file aligned with it for backend-specific reference.

## Core Naming

- Use `users` instead of `profiles` in backend code, API routes, and database table naming.
- The main user table is `users`.
- Use `user_id` for foreign keys that point to the `users` table.
- Do not introduce new `profile_id` columns or `profiles` route names.

## User Model Rules

- User CRUD routes must use `/users`.
- Login uses `email` or `mobile_number` with `password`.
- Signup uses `/signup` and should collect only the essential first-step fields.
- New signed-up users default to `role = standard`.
- New signed-up users default to `status = active`.
- `mobile_number` is optional on users.
- `role` is optional on users.
- `verification_status` is optional on users.
- `status` is optional on users and can be used for states like `active` or `deactivated`.
- `visibility` can be `public`, `constituency`, or `private`.
- `type` should support at least `individual`, `business`, `ngo`, and `government organization`.
- User search and profile visibility are no longer organization-scoped.
- Never return the stored `password` field in API responses.

## Feedback Rules

- Feedback shown in the frontend must follow the naming pattern `submitted` and `received`.
- Do not use mixed naming like `authored` for new frontend-facing routes.
- Use grouped feedback routes for user dashboards when helpful.

### Reviews

- Reviews are feedback left on topics.
- Reviews are topic-owned resources through `reviews.topic_id`.
- Reviews still store `author_id` so the app knows who wrote them, but review routing should be topic-scoped.
- `sentiment` for reviews is not expected from the frontend for now.
- The backend currently assigns a temporary random sentiment placeholder until the sentiment-analysis model is integrated.
- Preferred review routes:
  - `POST /reviews`
  - `GET /reviews`
  - `GET /reviews/{review_id}`
  - `PUT /reviews/{review_id}`
  - `DELETE /reviews/{review_id}`
  - `GET /topics/{topic_id}/reviews`
  - `POST /topics/{topic_id}/reviews`

### Feedbacks

- Feedbacks must use `author_user_id` and `target_user_id` in both Python code and the database.
- Feedbacks submitted by a user means records where `author_user_id = user_id`.
- Feedbacks received by a user means records where `target_user_id = user_id`.
- Feedbacks sent to a user profile are private and should only be visible to the target user.
- `sentiment` for feedbacks is not expected from the frontend for now.
- The backend currently assigns a temporary random sentiment placeholder until the sentiment-analysis model is integrated.
- Feedbacks have a `status` field.
- New feedback should start with `status = pending`.
- Once feedback has been analysed to generate emerging issues, its status must change to `analysed`.
- Feedback with `status = analysed` must not be analysed again for emerging issue generation.
- Feedback analysis happens for a specific user within a selected date range.
- Preferred feedback routes:
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

#### Analysis Request Contract

- `POST /users/{user_id}/feedbacks/analyse` is intended for the sentiment/emerging-issue analysis pipeline.
- The request body must include:
  - `start_date`
  - `end_date`
  - `feedback_ids`
  - `emerging_issues`
- `feedback_ids` must refer only to that user's received feedback in the selected date range.
- Feedback already marked as `analysed` must not be sent again.
- Example request body:

```json
{
  "start_date": "2026-04-01",
  "end_date": "2026-04-08",
  "feedback_ids": [4, 7, 9],
  "emerging_issues": [
    {
      "title": "Rising transport complaints",
      "description": "Multiple feedback items mention unreliable transport in the last week.",
      "date_added": "2026-04-08",
      "time_added": "09:30:00",
      "priority_level": "high",
      "status": "open"
    },
    {
      "title": "Water access concern",
      "description": "Residents repeatedly reported delayed water access in the selected period.",
      "date_added": "2026-04-08",
      "time_added": "09:35:00",
      "priority_level": "medium",
      "status": "open"
    }
  ]
}
```

### Combined Feedback Routes

- Preferred combined summary routes:
  - `GET /users/{user_id}/feedback-summary/submitted`
  - `GET /users/{user_id}/feedback-summary/received`
- These summary routes currently cover only direct user-to-user feedbacks, not topic reviews.

## Topics

- Topics belong to users through `topics.author_id`.
- Reviews should be fetched from topics, not from users.
- Preferred user-scoped topic route:
  - `GET /users/{user_id}/topics`
- Preferred topic-scoped review routes:
  - `GET /topics/{topic_id}/reviews`
  - `POST /topics/{topic_id}/reviews`

## Posts

- Use `posts` for the social feed layer.
- Posts can be `public`, `constituency`, or `private`.
- Public posts are visible to all signed-in users and public discovery views.
- Constituency posts are visible only to the author and users whose profile constituency matches the author's constituency.
- Private posts are visible only to the post author by default.
- Private posts can also be viewed through a matching shared link token.
- Posts no longer depend on organizations or team-group membership.
- Posts support reviews, reactions, search, and analytics.
- Post title is required.
- Post attachments are limited to PDF files only.
- Reactions should support at least likes, dislikes, and emoji-style response types.
- Preferred routes:
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

## Search

- Posts and user profiles must be searchable from the frontend.
- Search results must respect visibility rules for both users and posts.
- Preferred routes:
  - `GET /search`
  - `GET /search/users`
  - `GET /search/posts`

## Dashboard

- The professional dashboard should use profile-wide analytics for the signed-in user.
- Dashboard analytics should include age ranges, gender demography, post visibility, emerging issue trends, and engagement trends when available.
- Preferred route:
  - `GET /users/{user_id}/dashboard`

## Frontend Form Validation

- All active frontend forms must use MUI field-level validation through `TextField` `error` and `helperText`.
- Required-field and format validation should happen before submit, not only after a failed API request.
- Form-specific validation messages should stay inside that form container, dialog, or drawer instead of leaking into unrelated page-level alerts when possible.
- Submit actions should be disabled or blocked when client-side validation fails.
- New forms should follow the same validation pattern used in login, signup, post publishing, profile feedback, and profile editing.

## Subscriptions

- Subscriptions are user-owned resources.
- The subscriptions table uses:
  - `id` as the primary key
  - `user_id` as a foreign key to `users.id`
  - `plan`
  - `amount`
  - `start_date`
  - `expiry_date`
- Preferred routes:
  - `POST /subscriptions`
  - `GET /subscriptions`
  - `GET /subscriptions/{subscription_id}`
  - `PUT /subscriptions/{subscription_id}`
  - `DELETE /subscriptions/{subscription_id}`
  - `GET /users/{user_id}/subscriptions`

## Emerging Issues

- Emerging issues are user-owned resources.
- Emerging issues do not follow the `submitted` and `received` pattern.
- Each emerging issue belongs to a specific user through `emergingIssues.user_id`.
- Emerging issues are not created from frontend input forms.
- Emerging issues are created from feedback analysis results.
- Preferred routes:
  - `GET /users/{user_id}/emerging-issues`

## User Resource Bundle

- The frontend can use a bundled user resource route when it needs a single payload for dashboard data.
- Preferred route:
  - `GET /users/{user_id}/resources`

## Scope Direction

- The active frontend flow is being simplified around users, posts, and emerging issues.
- Organization features and organization-based visibility logic should not be extended further.
- New private-access work should prefer shared-link post access instead of group membership rules.

## Update Rule

- When new backend conventions are agreed on, update [`system-rules.md`](./system-rules.md) in the same task whenever possible.
- Keep this file aligned with the shared rules document instead of creating a conflicting second rule set.
