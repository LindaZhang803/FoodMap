const request = require("supertest");
const app = require("../../../server");

test.each([
  ["get", ""],
  ["get", "/unread-count"],
  ["patch", "/507f1f77bcf86cd799439011/read"],
  ["patch", "/read-all"],
])("requires a session for %s %s", async (method, suffix) => {
  await request(app)[method]("/api/notifications" + suffix).expect(401);
});
