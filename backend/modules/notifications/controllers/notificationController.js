const service = require("../services/notificationService");

const idPattern = /^[a-f0-9]{24}$/i;

function parseCursor(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,120}$/.test(value)) return null;

  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) return null;

  try {
    const fields = JSON.parse(decoded.toString("utf8"));
    if (!Array.isArray(fields) || fields.length !== 2) return null;

    const [date, id] = fields;
    if (typeof id !== "string" || !idPattern.test(id)) return null;
    if (date === null) return { createdAt: null, id };
    if (typeof date !== "string") return null;

    const createdAt = new Date(date);
    if (!Number.isFinite(createdAt.getTime()) || createdAt.toISOString() !== date) return null;

    return { createdAt, id };
  } catch {
    return null;
  }
}

async function list(req, res) {
  const limitParam = req.query.limit ?? "20";
  if (typeof limitParam !== "string" || !/^\d{1,3}$/.test(limitParam)) {
    return res.status(400).json({ message: "Invalid notification limit." });
  }
  const limit = Number(limitParam);
  if (limit < 1 || limit > 100) {
    return res.status(400).json({ message: "Invalid notification limit." });
  }

  const cursor = parseCursor(req.query.cursor);
  if (req.query.cursor !== undefined && !cursor) {
    return res.status(400).json({ message: "Invalid notification cursor." });
  }

  return res.json(await service.listInbox(req.user.id, { limit, cursor }));
}

async function unreadCount(req, res) {
  return res.json({ unreadCount: await service.unreadCount(req.user.id) });
}

async function markRead(req, res) {
  if (!idPattern.test(req.params.id)) {
    return res.status(400).json({ message: "Invalid notification ID." });
  }

  const result = await service.markRead(req.user.id, req.params.id);
  if (!result) return res.status(404).json({ message: "Notification not found." });

  return res.json(result);
}

async function markAllRead(req, res) {
  const count = await service.markAllRead(req.user.id, res.locals.notificationRequestStart);
  return res.json({ unreadCount: count });
}

module.exports = { list, unreadCount, markRead, markAllRead };
