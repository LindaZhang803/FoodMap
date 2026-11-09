# Member 4: Discover, Want to Try and Wheel

This module owns the recommendation-aware Discover cards, live Favorites state,
saved-item UI, and Decision Wheel. Synthetic catalog data is confined to tests
and the explicitly labeled `dev/` preview.

## Scope of the November 8 repair

Only `Mobile/src/modules/feed/`, `backend/modules/feed/` and
`.github/workflows/feed-ci.yml` may change. Shared app/server entry points,
root manifests/lockfiles, and Restaurants, Reviews and Accounts code remain
read-only. The normal app does not currently mount the feed.

The branch/history comparison confirmed Member 4's implementation commits are
authored by `szang005-ucr`. Other branches can contain merged copies of those
files; their presence there does not transfer ownership. Current remote heads
checked during this repair:

| Branch | Head | Ownership used for this repair |
| --- | --- | --- |
| `szang005-test` | `24b8cb1` | Current clean implementation baseline |
| `szang005` | `4fe5521` | Member 4 feed implementation history |
| `yzhan949` | `2395f5a` | Restaurants |
| `yzhan949-2` | `ce295c2` | New restaurant/shared UI work; do not overwrite |
| `skim1108` | `fce3058` | Dishes and Reviews |
| `qsun036` | `e76c804` | Accounts |
| `qsun036-test` | `7975a9c` | Current Accounts integration history |

## Entry points for the shared app owner

`FoodMapFeed`, exported from `index.js`, binds `FeedExperience` to the real
Member 1 restaurant reader, Member 2 unfiltered dish reader, shared `API_ORIGIN`,
and Member 1 filtering helper. Reader identities remain stable across renders.
It accepts the existing Accounts **auth state**, not a second authentication
hook. It never stores credentials or creates a session.

The shared owner must supply these existing host interfaces:

- `auth`: the state from the one live `useAuthSession()` owner. Only `signedIn`
  exposes a feed session. `signingOut`, account changes and other phases hide
  private data immediately.
- `readSelfProfile({ token, origin, signal })`: an authenticated self-read
  returning the Accounts `{ user: { id, flavorTargets } }` envelope, or the
  agreed `{ userId, flavorTargets }` result. Errors retain their HTTP status.
  Keep the reader stable until its actual inputs change.
- `onLoginRequired()`: open the existing Accounts screen.
- `onSessionExpired()`: invoke the Accounts owner's existing cleanup behavior.
  The current hook exposes `logout`, but no dedicated invalidation interface;
  the Accounts owner must connect this without adding a second session owner.
- `onRestaurantPress(restaurantId)`: open the existing restaurant detail screen.
- `renderDetail(experience)`: optionally render host details and reuse
  `experience.renderRestaurantActions(restaurant)` and
  `experience.renderDishActions({ dishId, restaurantId, ...dish })` there.
  These actions use the same confirmed Favorites state as Want to Try and Wheel.
- `userLocation` and `onRequestLocation`: optional existing host interfaces.
  The feed requests no location automatically; Wheel asks only when a distance
  criterion needs it.
- `preferenceRevision`: optional revision to refresh changed numeric preferences.

Discover and Wheel share one public candidate snapshot. Discover, detail actions,
Want to Try and Wheel imports share one live Favorites owner. Restaurant `_id`
is preserved; the dish reader's `id` becomes `dishId`, keeping its exact parent
`restaurantId`. Guests can browse and use the manual Wheel.

Do not supply `onDishPress` until the host has an exact-dish route accepting
`(dishId, restaurantId)`. In this checkout `DishBrowserScreen` only accepts the
restaurant ID and keeps the selected dish internally. The Reviews owner needs
an optional initial dish-ID prop or a dedicated dish-detail route. Saved dishes
and dish Wheel results remain saveable/importable; their exact-detail actions
are unavailable without that callback. A restaurant's dish list is not a
substitute for an exact-dish action.

## Personalization contracts

Only explicit `flavorTargets: null` is an unset profile. Empty objects, missing
fields, partial vectors, strings and nonfinite/out-of-range values are
unavailable. Valid vectors have exactly `spicy`, `sweet`, `sour`, `salty`,
`bitter` and `umami`, each a finite number from 0 to 5; zero is valid.

Accounts must save and return numeric `flavorTargets`. Dishes must save and
return measured `flavorIntensities`. Reviews must maintain the restaurant
rating/count fields used by fallback sorting. These owner data changes are
outside this repair. Missing numeric data preserves fallback recommendations,
unscored dishes and restaurants without dishes. Taste filtering remains gated.

## Dependency handoff

The root Mobile installation must eventually become canonical. Its owner must
add the runtime/test dependencies already declared in this module's
`package.json` using versions compatible with the installed Expo SDK, update
the root lockfile and test/preview commands, and remove the nested React
installation together with the feed manifest transition. Do not use React
aliases to conceal two installations.

That transition cannot be completed within the allowed files: the root
manifest currently lacks feed packages, and the root test run discovers feed
tests across separate React installations. Isolated feed checks passing do not
mean the shared mobile test/dependency integration passes.

## Local verification

The current real-reader binding tests also need the existing root Mobile
installation: sibling owner sources resolve their Babel runtime from there.
Feed CI explicitly installs that root lockfile and then the feed lockfile.
The standalone preview itself can still build from the feed installation alone.

From this directory, after `npm ci` at the Mobile root and the current locked
feed installation:

```sh
pnpm test --ci
EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 pnpm run export:web
```

`foodMapFeed.test.js` uses the real owner catalog readers and Member 4 clients
with synthetic HTTP responses. It checks stable bulk reads, exact restaurant
IDs, guest login delegation, both saved target types across remounts, common
Wheel imports, fallback browsing and expired-session delegation. It does not
claim that the normal app is mounted or that a native device was exercised.
