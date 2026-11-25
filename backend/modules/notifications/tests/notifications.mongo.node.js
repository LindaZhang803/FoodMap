const assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const User = require("../../accounts/models/User");
const Post = require("../../posts/models/Post");
const PostLike = require("../../posts/models/PostLike");
const notificationService = require("../services/notificationService");
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

  function makeReview() {
    return mongoose.models.Review.create({
      userId: author._id,
      restaurantId: new mongoose.Types.ObjectId(),
      reviewType: "restaurant",
      rating: 5,
      comment: "Loved the noodles",
    });
  }

  function reply(review, user = actor) {
    return as(user, "post", `/api/reviews/${review.id}/replies`).send({ comment: "Thanks for sharing!" });
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
    await Promise.all([PostLike.init(), mongoose.models.ReviewLike.init()]);
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
      mongoose.models.ReviewReply.deleteMany({}),
      mongoose.models.ReviewLike.deleteMany({}),
      mongoose.models.Review.deleteMany({}),
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
        isRead: false,
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
    assert.deepEqual(reads[0].body, { id: item.id, readAt: reads[0].body.readAt, isRead: true, unreadCount: 0 });
    assert.deepEqual(reads[1].body, reads[0].body);
    await as(actor, "delete", `/api/posts/${post.id}/like`).expect(200);
    await as(actor, "put", `/api/posts/${post.id.toUpperCase()}/like`).expect(200);
    const after = await inbox().expect(200);
    assert.deepEqual(after.body, {
      items: [{ ...item, readAt: reads[0].body.readAt, isRead: true }],
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

  it("notifies only the review author about another user's reply", async () => {
    const review = await makeReview();
    await reply(review, author).expect(201);
    assert.deepEqual((await inbox().expect(200)).body.items, []);

    const { body: saved } = await reply(review).expect(201);
    const { body } = await inbox().expect(200);
    assert.equal(body.unreadCount, 1);
    assert.equal(body.items.length, 1);
    const [item] = body.items;
    assert.equal(item.type, "review_reply");
    assert.equal(item.title, "New Review Reply");
    assert.equal(item.message, "Alex replied to your review.");
    assert.equal(item.reviewId, review.id);
    assert.equal(item.replyId, saved.reply.id);
    assert.equal(item.readAt, null);
    assert.equal(item.isRead, false);
    assert.equal(Object.hasOwn(item, "postId"), false);
    assert.deepEqual((await inbox(actor).expect(200)).body.items, []);

    await notificationService.addReviewNotification({
      type: "review_reply",
      recipientId: author._id,
      actorId: actor._id,
      reviewId: review._id,
      replyId: saved.reply.id,
    });
    assert.equal((await inbox().expect(200)).body.items.length, 1);

    const read = await as(author, "patch", `${inboxPath}/${item.id}/read`).expect(200);
    assert.ok(Number.isFinite(Date.parse(read.body.readAt)));
    assert.equal(read.body.isRead, true);
    const reread = await inbox().expect(200);
    assert.equal(reread.body.unreadCount, 0);
    assert.deepEqual(reread.body.items, [{ ...item, readAt: read.body.readAt, isRead: true }]);
  });

  it("notifies the review author once across repeated and concurrent likes", async () => {
    const review = await makeReview();
    const path = `/api/reviews/${review.id}/like`;
    await as(author, "post", path).expect(200, { likeCount: 1, likedByMe: true });
    await as(actor, "delete", path).expect(200, { likeCount: 1, likedByMe: false });
    assert.deepEqual((await inbox().expect(200)).body.items, []);

    await Promise.all(Array.from({ length: 6 }, () =>
      as(actor, "post", path).expect(200, { likeCount: 2, likedByMe: true })
    ));
    const { body } = await inbox().expect(200);
    assert.equal(body.unreadCount, 1);
    assert.equal(body.items.length, 1);
    const [item] = body.items;
    assert.equal(item.type, "review_like");
    assert.equal(item.title, "Review Liked");
    assert.equal(item.message, "Alex liked your review.");
    assert.equal(item.reviewId, review.id);
    assert.equal(item.readAt, null);
    assert.equal(item.isRead, false);
    assert.equal(Object.hasOwn(item, "postId"), false);
    assert.equal(Object.hasOwn(item, "replyId"), false);
    assert.deepEqual((await inbox(actor).expect(200)).body.items, []);

    const read = await as(author, "patch", `${inboxPath}/${item.id}/read`).expect(200);
    assert.equal(read.body.isRead, true);
    await as(actor, "delete", path).expect(200, { likeCount: 1, likedByMe: false });
    const upperCasePath = `/api/reviews/${review.id.toUpperCase()}/like`;
    await as(actor, "post", upperCasePath).expect(200, { likeCount: 2, likedByMe: true });
    await notificationService.addReviewNotification({
      type: "review_like",
      recipientId: author._id,
      actorId: actor._id,
      reviewId: review._id,
    });

    const after = await inbox().expect(200);
    assert.deepEqual(after.body.items, [{ ...item, readAt: read.body.readAt, isRead: true }]);
    assert.equal(after.body.unreadCount, 0);
  });

  it("preserves committed review replies and likes if the alert write fails", async t => {
    const review = await makeReview();
    const log = t.mock.method(console, "error", () => {});
    t.mock.method(mongoose.models.Notification.collection, "insertOne", async () => {
      throw new Error("Notification write failed");
    });

    const { body: saved } = await reply(review).expect(201);
    assert.ok(await mongoose.models.ReviewReply.exists({ _id: saved.reply.id }));
    await as(actor, "post", `/api/reviews/${review.id}/like`).expect(200, { likeCount: 1, likedByMe: true });
    assert.ok(await mongoose.models.ReviewLike.exists({ reviewId: review.id, userId: actor._id }));
    assert.deepEqual((await inbox().expect(200)).body.items, []);
    assert.equal(log.mock.callCount(), 2);
  });

  it("does not send review alerts when the transaction rolls back", async t => {
    const review = await makeReview();
    const transaction = mongoose.connection.transaction.bind(mongoose.connection);
    t.mock.method(mongoose.connection, "transaction", callback =>
      transaction(async session => {
        await callback(session);
        throw new Error("Abort after writing the reply");
      })
    );

    await reply(review).expect(500);
    await as(actor, "post", `/api/reviews/${review.id}/like`).expect(500);
    assert.equal(await mongoose.models.ReviewReply.countDocuments({ reviewId: review.id }), 0);
    assert.equal(await mongoose.models.ReviewLike.countDocuments({ reviewId: review.id }), 0);
    assert.deepEqual((await inbox().expect(200)).body.items, []);
  });

  it("persists system notification read state across logout and login", async () => {
    const credentials = { email: "inbox-session@example.test", password: "NewMember-2026!" };
    const registration = await request(app).post("/api/auth/register").send({
      username: "New member",
      ...credentials,
      confirmPassword: credentials.password,
    }).expect(201);
    await notificationService.addSystemNotification({
      recipientId: registration.body.user.id,
      title: "FoodMap update",
      message: "The menu has been updated.",
    });
    const login = await request(app).post("/api/auth/login").send(credentials).expect(200);
    const readInbox = token => request(app).get(inboxPath).auth(token, { type: "bearer" }).expect(200);
    const { body } = await readInbox(login.body.token);
    assert.equal(body.unreadCount, 1);
    assert.equal(body.items[0].type, "system");
    assert.equal(body.items[0].title, "FoodMap update");
    assert.deepEqual((await inbox().expect(200)).body.items, []);

    const readPath = `${inboxPath}/${body.items[0].id}/read`;
    await request(app).patch(readPath).auth(login.body.token, { type: "bearer" }).expect(200);
    await request(app).post("/api/auth/logout").auth(login.body.token, { type: "bearer" }).expect(200);
    for (const token of ["invalid", login.body.token]) {
      await request(app).get(inboxPath).auth(token, { type: "bearer" }).expect(401);
      await request(app).patch(readPath).auth(token, { type: "bearer" }).expect(401);
    }

    const nextLogin = await request(app).post("/api/auth/login").send(credentials).expect(200);
    const reopened = await readInbox(nextLogin.body.token);
    assert.equal(reopened.body.unreadCount, 0);
    assert.equal(reopened.body.items[0].id, body.items[0].id);
    assert.equal(reopened.body.items[0].isRead, true);
  });

  it("saves actorless system text and deduplicates an explicit event key", async () => {
    const alert = {
      recipientId: author._id,
      title: "Scheduled maintenance",
      message: "FoodMap will restart tonight.",
      eventKey: "system:maintenance",
    };
    await Promise.all([
      notificationService.addSystemNotification(alert),
      notificationService.addSystemNotification(alert),
    ]);

    const { body } = await inbox().expect(200);
    assert.equal(body.unreadCount, 1);
    assert.equal(body.items.length, 1);
    const [item] = body.items;
    assert.equal(item.type, "system");
    assert.equal(item.title, alert.title);
    assert.equal(item.message, alert.message);
    assert.equal(item.readAt, null);
    assert.equal(item.isRead, false);
    for (const target of ["postId", "commentId", "reviewId", "replyId"]) {
      assert.equal(Object.hasOwn(item, target), false, target);
    }
    assert.equal(await notifications.countDocuments({ type: "system", actorId: null }), 1);
    assert.deepEqual((await inbox(actor).expect(200)).body.items, []);
  });

  it("keeps separate system events generated at the same time", async t => {
    const now = Date.now();
    const clock = t.mock.method(Date, "now", () => now);
    try {
      await Promise.all(["First system message", "Second system message"].map(message =>
        notificationService.addSystemNotification({
          recipientId: author._id,
          title: "FoodMap update",
          message,
        })
      ));
    } finally {
      clock.mock.restore();
    }

    const { body } = await inbox().expect(200);
    assert.equal(body.unreadCount, 2);
    assert.deepEqual(body.items.map(item => item.message).sort(), [
      "First system message",
      "Second system message",
    ]);
  });

  it("deduplicates the same system event separately for each recipient", async () => {
    const event = { title: "Maintenance", message: "Tonight's update", eventKey: "system:release" };
    await Promise.all([author, actor, author, actor].map(user =>
      notificationService.addSystemNotification({ ...event, recipientId: user._id })
    ));

    for (const recipient of [author, actor]) {
      const { body } = await inbox(recipient).expect(200);
      assert.equal(body.unreadCount, 1);
      assert.deepEqual(body.items.map(item => item.title), [event.title]);
    }
  });

  it("keeps the read state of a system event stored with a legacy key", async () => {
    const eventKey = "system:previous-release";
    const readAt = new Date("2026-11-04T12:00:00.000Z");
    const previous = await notifications.insertOne({
      type: "system", recipientId: author._id, eventKey, title: "Previous release",
      createdAt: readAt, readAt,
    });
    await notificationService.addSystemNotification({
      recipientId: author._id, eventKey, title: "Previous release",
    });

    const { body } = await inbox().expect(200);
    assert.equal(body.unreadCount, 0);
    assert.deepEqual(body.items.map(item => item.id), [String(previous.insertedId)]);
    assert.equal(body.items[0].readAt, readAt.toISOString());
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
