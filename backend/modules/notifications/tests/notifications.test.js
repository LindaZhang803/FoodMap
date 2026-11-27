const request = require("supertest");
const app = require("../../../server");
const Notification = require("../models/Notification");
const { listInbox } = require("../services/notificationService");

test.each([
  ["get", ""],
  ["get", "/unread-count"],
  ["patch", "/507f1f77bcf86cd799439011/read"],
  ["patch", "/read-all"],
])("requires a session for %s %s", async (method, suffix) => {
  await request(app)[method]("/api/notifications" + suffix).expect(401);
});

test.each([
  [new Date("2026-11-04T12:00:00.000Z"), "2026-11-04T12:00:00.000Z", "2026-11-04T12:00:00.000Z"],
  ["2026-11-04T12:00:00.000Z", "2026-11-04T12:00:00.000Z", null],
  ["not a timestamp", null, null],
])("paginates an inbox timestamp of %s", async (createdAt, displayedDate, cursorDate) => {
  const id = "507f1f77bcf86cd799439011";
  const cursor = cursorDate === null ? { createdAt: null, id: "507f1f77bcf86cd799439012" } : undefined;
  const find = jest.spyOn(Notification, "find").mockReturnValue({
    sort() { return this; },
    limit() { return this; },
    populate() { return this; },
    lean: async () => [{ _id: id, type: "system", createdAt }, { type: "system" }],
  });
  const count = jest.spyOn(Notification, "countDocuments").mockResolvedValue(2);

  try {
    const { items, nextCursor } = await listInbox(id, { limit: 1, cursor });
    expect(items).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(items[0])).createdAt).toBe(displayedDate);
    expect(JSON.parse(Buffer.from(nextCursor, "base64url").toString())).toEqual([cursorDate, id]);
  } finally {
    find.mockRestore();
    count.mockRestore();
  }
});
