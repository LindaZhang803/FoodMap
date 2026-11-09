# Dish & Review — Core API Proposal

MongoDB is confirmed. Mongoose, API formats, and the integration details below still require team agreement. No API endpoints or database connection have been implemented.

## Week 1 data design

| Model | Core fields |
|---|---|
| Dish | id, restaurantId, name, description, imageUrl, averageRating, reviewCount, createdAt, updatedAt |
| Review | id, userId, restaurantId, dishId (optional), reviewType, rating, comment, photoUrls, createdAt, updatedAt |
| ReviewLike | reviewId, userId; unique pair to prevent duplicate likes |

Proposed conventions: MongoDB ObjectIds serialized as strings; ISO UTC timestamps. Review responses include public author information, likeCount, and likedByMe. Unrated dishes have averageRating=null and reviewCount=0.

## Core behavior

- `reviewType` is `restaurant` or `dish`. Dish reviews require a dish belonging to the specified restaurant; restaurant reviews have no dishId.
- Restaurant and dish ratings are calculated separately and updated after review creation, rating edits, and deletion.
- Reading is public. Creating reviews and liking require authentication; editing and deleting require ownership. The server obtains userId from authentication, not request input.
- Initial defaults: integer 1–5 stars, required comments up to 2,000 characters, and up to 5 photos. Review frequency per user/target remains undecided; no uniqueness rule is implemented yet.
- Use synthetic dish/review fixtures for independent development until shared services are ready.

## Core APIs

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/dishes?restaurantId=... | List dishes; allow all-dish queries for Feed |
| GET | /api/dishes/:id | Dish details |
| GET | /api/reviews | Filter by restaurantId, dishId, reviewType, or userId |
| POST | /api/reviews | Create a review |
| PUT / DELETE | /api/reviews/:id | Edit / delete own review |
| POST / DELETE | /api/reviews/:id/like | Like / unlike a review |

Support newest/most-liked review sorting and highest-rated/most-reviewed dish sorting. Proposed responses: `{data: ...}` for success and `{error: {code, message}}` for failures. Agree on shared formats before connecting modules.

## Essential team coordination

- **Shared setup:** confirm Mongoose, the shared MongoDB connection, and API conventions.
- **Member 1:** match Restaurant IDs and navigation; agree who updates restaurant rating fields and how imported ratings differ from FoodMap ratings.
- **Member 3:** agree on authentication middleware, authenticated user ID, and public author information.
- **Member 4:** confirm required dish fields and access to dish lists/details.
- **Later:** agree on image storage before implementing photo uploads.
