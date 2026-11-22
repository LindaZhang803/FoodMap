const assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const User = require("../../accounts/models/User");
const Post = require("../../posts/models/Post");
const PostLike = require("../../posts/models/PostLike");
const app = require("../../../server");

const inboxPath = "/api/notifications";

const testUri = process.env.NOTIFICATION_TEST_MONGO_URI;

describe("notification inbox with MongoDB", { skip: !testUri }, () => {
  let author, actor, post, notifications, previousSecret;

  function makePost(authorId) {
    return Post.create({
      authorId,
      restaurantId: new mongoose.Types.ObjectId(),
      reviewId: new mongoose.Types.ObjectId(),
      title: "Noodles",
      imageUrls: ["https://example.test/noodles.jpg"],
    });
  }

  function as(user, method, path) {
    const token = jwt.sign({ id: String(user._id), tokenVersion: 0 }, process.env.JWT_SECRET);
    return request(app)[method](path).set("Authorization", "Bearer " + token);
  }

  function inbox(user = author, query = "") {
    return as(user, "get", inboxPath + query);
  }

  function like(user = actor) {
    return as(user, "put", `/api/posts/${post.id}/like`);
  }

  function comment(user = actor) {
    return as(user, "post", `/api/posts/${post.id}/comments`).send({ content: "Looks good!" });
  }

  async function addLikeAlert(createdAt, recipient = author) {
    const _id = new mongoose.Types.ObjectId();
    await notifications.insertOne({
      _id,
      recipientId: recipient._id,
      actorId: actor._id,
      type: "like",
      postId: post._id,
      createdAt,
      readAt: null,
      eventKey: `fixture:${_id}`,
    });
    return String(_id);
  }

  before(async () => {
    const uri = new URL(testUri);
    if (uri.protocol !== "mongodb:" || uri.hostname !== "127.0.0.1") {
      throw new Error("Use a disposable local MongoDB URI for NOTIFICATION_TEST_MONGO_URI.");
    }
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "notification-test-secret";
    await mongoose.connect(testUri, {
      dbName: `foodmap_notifications_test_${process.pid}_${Date.now()}`,
      serverSelectionTimeoutMS: 5000,
    });
    await PostLike.init();
    notifications = mongoose.connection.db.collection("notifications");
    [author, actor] = await User.create([
      { username: "Sam", email: "sam@example.test", passwordHash: "unused" },
      { username: "Alex", email: "alex@example.test", passwordHash: "unused" },
    ]);
  }, { timeout: 15000 });

  beforeEach(async () => {
    await Promise.all([
      notifications.deleteMany({}),
      Post.deleteMany({}),
      PostLike.deleteMany({}),
      mongoose.models.PostComment.deleteMany({}),
    ]);
    post = await makePost(author._id);
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  it("a transient index build failure does not prevent later alerts", async t => {
    const log = t.mock.method(console, "error", () => {});
    t.mock.method(mongoose.models.Notification, "createIndexes", async () => {
      throw new Error("Index build failed");
    }, { times: 1 });
    await like().expect(200);
    assert.deepEqual((await inbox().expect(200)).body.items, []);

    const response = await comment().expect(201);
    const { body } = await inbox().expect(200);
    assert.equal(body.unreadCount, 1);
    assert.equal(body.items[0].commentId, response.body.id);
    assert.equal(log.mock.callCount(), 1);
  });

  it("concurrent likes and re-likes preserve one alert and its first read time", async () => {
    await Promise.all(Array.from({ length: 8 }, () => like().expect(200)));
    const first = await inbox().expect(200);
    const [item] = first.body.items;
    assert.match(item.id, /^[a-f0-9]{24}$/i);
    assert.ok(Number.isFinite(Date.parse(item.createdAt)));
    assert.deepEqual(first.body, {
      items: [{
        id: item.id,
        type: "like",
        title: "New Like",
        message: "Alex liked your post.",
        createdAt: item.createdAt,
        readAt: null,
        postId: post.id,
      }],
      unreadCount: 1,
      nextCursor: null,
    });
    const path = `${inboxPath}/${item.id}/read`;
    const reads = await Promise.all([
      as(author, "patch", path).expect(200),
      as(author, "patch", path).expect(200),
    ]);
    assert.ok(Number.isFinite(Date.parse(reads[0].body.readAt)));
    assert.deepEqual(reads[0].body, { id: item.id, readAt: reads[0].body.readAt, unreadCount: 0 });
    assert.deepEqual(reads[1].body, reads[0].body);
    await as(actor, "delete", `/api/posts/${post.id}/like`).expect(200);
    await as(actor, "put", `/api/posts/${post.id.toUpperCase()}/like`).expect(200);
    const after = await inbox().expect(200);
    assert.deepEqual(after.body, {
      items: [{ ...item, readAt: reads[0].body.readAt }],
      unreadCount: 0,
      nextCursor: null,
    });
  });

  it("saves an alert for each saved comment and suppresses self-actions", async () => {
    await like(author).expect(200);
    await comment(author).expect(201);
    const [first, second] = await Promise.all([comment().expect(201), comment().expect(201)]);
    const response = await inbox().expect(200);
    assert.equal(response.body.unreadCount, 2);
    assert.deepEqual(
      response.body.items.map(({ commentId }) => commentId).sort(),
      [first.body.id, second.body.id].sort(),
    );
    for (const { type, title, message, postId, readAt } of response.body.items) {
      assert.deepEqual({ type, title, message, postId, readAt }, {
        type: "comment", title: "New Comment", message: "Alex commented on your post.",
        postId: post.id, readAt: null,
      });
    }
  });

  it("scopes reads and writes to the authenticated recipient", async () => {
    await like().expect(200);
    const { body } = await inbox().expect(200);
    const read = id => as(actor, "patch", `${inboxPath}/${id}/read`).expect(404);
    const other = await read(body.items[0].id);
    const missing = await read(String(new mongoose.Types.ObjectId()));
    assert.deepEqual(other.body, missing.body);
    const empty = await inbox(actor, `?recipientId=${author.id}`).expect(200);
    assert.deepEqual(empty.body, { items: [], unreadCount: 0, nextCursor: null });
    const count = await as(actor, "get", inboxPath + "/unread-count").expect(200);
    assert.deepEqual(count.body, { unreadCount: 0 });
    await as(actor, "patch", inboxPath + "/read-all").expect(200, { unreadCount: 0 });
    await as(author, "get", inboxPath + "/unread-count").expect(200, { unreadCount: 1 });
  });

  it("uses descending IDs to paginate tied timestamps and counts all unread items", async () => {
    const firstDate = new Date("2026-11-01T00:00:00.000Z");
    const secondDate = new Date("2026-11-02T00:00:00.000Z");
    const older = await addLikeAlert(firstDate);
    const lowId = await addLikeAlert(secondDate);
    const highId = await addLikeAlert(secondDate);
    await addLikeAlert(secondDate, actor);

    const page = await inbox(author, "?limit=1").expect(200);
    assert.deepEqual(page.body.items.map(item => item.id), [highId]);
    assert.equal(page.body.unreadCount, 3);
    const next = await inbox(author, `?limit=2&cursor=${page.body.nextCursor}`).expect(200);
    assert.deepEqual(next.body.items.map(item => item.id), [lowId, older]);
    assert.equal(next.body.nextCursor, null);
    assert.equal(next.body.unreadCount, 3);
  });

  it("mark-all covers older pages and preserves alerts arriving during authentication", async t => {
    await addLikeAlert(new Date("2026-11-01T00:00:00.000Z"));
    await addLikeAlert(new Date("2026-11-02T00:00:00.000Z"));
    const previous = await inbox(author, "?limit=1").expect(200);
    assert.equal(previous.body.unreadCount, 2);

    let newer;
    const findUser = User.findById.bind(User);
    t.mock.method(User, "findById", async (...args) => {
      await new Promise(resolve => setTimeout(resolve, 20));
      newer = await addLikeAlert(new Date());
      return findUser(...args);
    }, { times: 1 });
    await as(author, "patch", inboxPath + "/read-all").expect(200, { unreadCount: 1 });
    const after = await inbox().expect(200);
    assert.deepEqual(
      after.body.items.filter(item => item.readAt === null).map(item => item.id),
      [newer],
    );
  });

  for (const query of [
    "?limit=0", "?limit=101", "?limit=1.5", "?limit=1&limit=2",
    "?cursor=", "?cursor=%2F", "?cursor=e30",
  ]) {
    it(`rejects malformed inbox options ${query}`, async () => {
      await inbox(author, query).expect(400);
    });
  }

  it("rejects malformed read IDs", async () => {
    await as(author, "patch", inboxPath + "/wrong/read").expect(400);
  });

  it("interaction write failures produce no alerts", async t => {
    t.mock.method(console, "error", () => {});
    t.mock.method(PostLike.collection, "insertOne", async () => {
      throw new Error("Like write failed");
    });
    t.mock.method(mongoose.models.PostComment.collection, "insertOne", async () => {
      throw new Error("Comment write failed");
    });
    await like().expect(500);
    await comment().expect(500);
    const response = await inbox().expect(200);
    assert.deepEqual(response.body, { items: [], unreadCount: 0, nextCursor: null });
  });

  it("alert write failures leave likes and comments saved", async t => {
    const log = t.mock.method(console, "error", () => {});
    t.mock.method(mongoose.models.Notification.collection, "insertOne", async () => {
      throw new Error("Notification write failed");
    });
    const response = await like().expect(200);
    const saved = await comment().expect(201);
    assert.equal(response.body.likedByMe, true);
    assert.equal(response.body.likeCount, 1);
    assert.equal(await PostLike.countDocuments({ postId: post._id }), 1);
    assert.ok(await mongoose.models.PostComment.exists({ _id: saved.body.id }));
    assert.deepEqual((await inbox().expect(200)).body.items, []);
    assert.equal(log.mock.callCount(), 2);
  });
});
