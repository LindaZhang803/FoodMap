const assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../../../server");
const User = require("../../accounts/models/User");
const Restaurant = require("../../restaurants/models/Restaurant");
const Post = require("../models/Post");

const postPath = "/api/posts/507f1f77bcf86cd799439011";

for (const [method, path] of [
  ["post", "/api/posts"],
  ["delete", postPath],
  ["put", postPath + "/like"],
  ["delete", postPath + "/like"],
  ["post", postPath + "/comments"],
  ["put", postPath + "/favorite"],
  ["delete", postPath + "/favorite"],
  ["get", "/api/posts/eligible-reviews"],
]) {
  it(`${method.toUpperCase()} ${path} requires authentication`, async () => {
    await request(app)[method](path).expect(401);
  });
}

const mongoUri = process.env.POSTS_TEST_MONGO_URI;
describe("posts against disposable MongoDB", { skip: !mongoUri }, () => {
  const { Dish, Review, Notification, PostLike } = mongoose.models;
  let previousSecret;
  let owner, actor, post, actorToken, restaurant;

  function token(user) {
    return jwt.sign({ id: user.id, tokenVersion: 0 }, process.env.JWT_SECRET);
  }

  function authenticated(method, path, accessToken = actorToken) {
    return request(app)[method](path).auth(accessToken, { type: "bearer" });
  }

  before(async () => {
    const uri = new URL(mongoUri);
    if (uri.protocol !== "mongodb:" || uri.hostname !== "127.0.0.1") {
      throw new Error("Use a disposable local MongoDB URI for POSTS_TEST_MONGO_URI.");
    }
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "posts-integration-test-only";
    await mongoose.connect(mongoUri, {
      dbName: `foodmap_posts_test_${process.pid}_${Date.now()}`,
      serverSelectionTimeoutMS: 5000,
    });
    await PostLike.init();
    [owner, actor] = await User.create([
      { username: "Owner", email: "owner@example.test", passwordHash: "unused" },
      {
        username: "Reader",
        email: "reader@example.test",
        passwordHash: "unused",
        spicinessQuestionnaire: {
          version: 1,
          answers: { preferredSpiciness: 2, maximumSpiciness: 4, spicyFoodFrequency: "sometimes" },
          savedAt: new Date(),
        },
      },
    ]);
    actorToken = token(actor);
    restaurant = await Restaurant.create({ name: "Noodle House", latitude: 34, longitude: -117 });
    const dish = await Dish.create({
      restaurantId: restaurant.id,
      name: "Chili noodles",
      medianSpiciness: 5,
      spicinessRatingCount: 7,
      spicinessRanking: { median: 1, sampleCount: 3 },
    });
    const review = await Review.create({
      userId: owner.id,
      restaurantId: restaurant.id,
      dishId: dish.id,
      reviewType: "dish",
      rating: 5,
      spicinessRating: 3,
      comment: "Spicy noodles",
    });
    post = await Post.create({
      authorId: owner.id,
      restaurantId: restaurant.id,
      reviewId: review.id,
      title: "Noodles",
      imageUrls: ["https://example.test/noodles.jpg"],
    });
  }, { timeout: 20000 });

  after(async () => {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  it("another user cannot delete the owner's post", async () => {
    await authenticated("delete", `/api/posts/${post.id}`).expect(404);
    await request(app).get(`/api/posts/${post.id}`).expect(200);
  });

  it("logout revokes a token on protected post routes", async () => {
    const user = await User.create({
      username: "Logout tester", email: "logout@example.test", passwordHash: "unused",
    });
    const accessToken = token(user);
    await authenticated("get", "/api/posts/eligible-reviews", accessToken).expect(200);
    await authenticated("post", "/api/auth/logout", accessToken).expect(200);
    await authenticated("get", "/api/posts/eligible-reviews", accessToken).expect(401);
    await authenticated("put", `/api/posts/${post.id}/like`, accessToken).expect(401);
  });

  for (const category of ["forYou", "trending", "nearby"]) {
    it(`varies ${category} responses by authorization`, async () => {
      const path = `/api/posts?category=${category}&latitude=34&longitude=-117`;
      const guest = await request(app).get(path).expect(200);
      const reader = await authenticated("get", path).expect(200);
      assert.match(guest.headers.vary ?? "", /\bAuthorization\b/i);
      assert.match(reader.headers.vary ?? "", /\bAuthorization\b/i);
      assert.equal(reader.headers["cache-control"], "private, no-store");
      assert.equal(reader.body.items[0].review.spicinessRating, 3);

      const guestDish = guest.body.items[0].dish;
      const readerDish = reader.body.items[0].dish;
      assert.equal(guestDish.spicinessCompatibility, "Unknown");
      assert.equal(readerDish.spicinessCompatibility, category === "forYou" ? "Above Preference" : "Unknown");
      assert.match(guestDish.spicinessCompatibilityNote, /community ratings.*not a medical or allergen safety guarantee/);
      assert.equal(readerDish.spicinessCompatibilityNote, guestDish.spicinessCompatibilityNote);
    });
  }

  it("personalizes post detail while withholding questionnaire answers", async () => {
    const path = `/api/posts/${post.id}`;
    const guest = await request(app).get(path).expect(200);
    const reader = await authenticated("get", path).expect(200);
    assert.match(guest.headers.vary ?? "", /\bAuthorization\b/i);
    assert.match(reader.headers.vary ?? "", /\bAuthorization\b/i);
    assert.equal(reader.headers["cache-control"], "private, no-store");
    assert.equal(guest.body.post.dish.spicinessCompatibility, "Unknown");
    assert.equal(reader.body.post.dish.spicinessCompatibility, "Above Preference");
    assert.equal(reader.body.post.review.spicinessRating, 3);
    assert.equal(Object.hasOwn(reader.body.post, "spicinessQuestionnaire"), false);
  });

  it("notifies the post owner of another user's like and comment only", async () => {
    const path = `/api/posts/${post.id}`;
    await authenticated("put", path + "/like").expect(200);
    await authenticated("put", path + "/like").expect(200);
    await authenticated("post", path + "/comments").send({ content: "Looks good!" }).expect(201);
    await authenticated("put", path + "/like", token(owner)).expect(200);
    await authenticated("post", path + "/comments", token(owner)).send({ content: "Thanks!" }).expect(201);

    const alerts = await Notification.find({ postId: post.id }).sort({ type: 1 }).lean();
    assert.deepEqual(
      alerts.map(({ type, recipientId, actorId }) => [type, String(recipientId), String(actorId)]),
      [["comment", owner.id, actor.id], ["like", owner.id, actor.id]],
    );
  });
});
