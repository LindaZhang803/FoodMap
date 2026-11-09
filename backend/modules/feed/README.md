# Member 4 Favorites backend

`createFavoritesModule` uses the host's existing Mongoose connection, canonical
Accounts authentication middleware and existing Restaurant/Dish readers.
Ownership comes only from authenticated `req.user.id`.

## Ready mount for the shared server owner

`mountFavoritesModule` preserves those existing exports and adds an idempotent
mount on an existing Express app. It waits for the compound unique index before
mounting `/api/favorites`. Concurrent/repeated calls for the same app share the
initialization; an index failure leaves the route unmounted and permits a retry.
It neither connects to MongoDB nor starts a listener.

After the server's existing `mountReviewModule` has returned its real `Dish`
model, its owner must use this order in the existing initialization path:

```js
const { mountFavoritesModule } = require('./modules/feed');

await connectDB();
await mountFavoritesModule(app, {
  connection: mongoose.connection,
  authenticate,
  Restaurant,
  Dish,
});
// Begin listening only after the awaited initialization succeeds.
```

`authenticate` must be the existing
`modules/accounts/middleware/authMiddleware` used by Reviews. Reuse the Dish
returned by the one existing `mountReviewModule` call. The shared server owner
must expose this same initialization path to its integration tests and preserve
its direct-run/exported-app behavior. No second connection, schema, login
implementation or server is introduced here.

**The shared `backend/server.js` remains unchanged and does not mount Favorites
yet. Normal-app `/api/favorites` requests still return 404 until its owner adds
this mount.** The module integration test assembles a disposable host from the
unchanged real owner modules; it is not proof that the shared server is wired.

## HTTP contract

- `GET /api/favorites`: `200 { items: [...] }`, newest first.
- `PUT /api/favorites/:targetType/:targetId`: `200` saved item; repeated saves
  retain one record and its original creation date.
- `DELETE /api/favorites/:targetType/:targetId`: `204`, including repeated removal.

Targets are `restaurant` or `dish` with canonical MongoDB IDs. Responses retain
restaurant `_id` or dish `dishId` and exact `restaurantId`. Deleted targets
hydrate as `target: null` and remain removable. Catalog hydration is batched.

## Test runner and dependency boundary

Feed tests use `.node.js` filenames and explicit `node --test` commands.
This prevents root Jest from discovering Node-runner tests without editing
the shared Jest configuration. Existing test contents remain unchanged when
renamed. Root Accounts/restaurant Jest and separate Reviews commands keep their
existing configuration.

From `backend/modules/feed/`:

```sh
npm run test:unit
npm run test:mongo
npm run test:host
npm test
```

The real-owner host test needs the existing root backend installation as well
as this module's disposable MongoDB test dependency. Feed CI installs both
current lockfiles explicitly, runs root Jest, then the feed suites. It does not
silently skip a missing shared lockfile. This is an interim ownership boundary,
not the requested single-install consolidation.

The shared backend owner still needs to add `mongodb-memory-server` to the
canonical root dev dependencies and lockfile, add a root `test:feed` script,
and retire redundant nested dependencies. Root-only clean installation of the
feed suites cannot be claimed until that owner change is made.

`host.integration.node.js` uses an automatically created local MongoDB database,
the real `connectDB`, real Restaurant/Dish/User models, Accounts login/logout
routes, and canonical authentication. It assigns only synthetic test settings,
imports no shared `server.js` or `.env`, and tests unique indexing, startup
ordering, duplicate mounts, persistence, account isolation, deleted targets,
and token revocation. The older MongoDB tests remain separate synthetic
auth/catalog contract coverage.

## Protected files

Only this module, `Mobile/src/modules/feed/` and `.github/workflows/feed-ci.yml`
are editable in this repair. Shared server/manifests, Accounts, Restaurants,
Reviews and other members' workflows remain unchanged. See the mobile feed
README for the branch ownership comparison and remaining UI/data handoffs.
