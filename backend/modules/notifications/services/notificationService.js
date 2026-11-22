const Notification = require("../models/Notification");

let indexesReady;

function ensureIndexes() {
  // Share the build across requests and retry after a transient failure.
  indexesReady ??= Notification.createIndexes().catch(error => {
    indexesReady = undefined;
    throw error;
  });
  return indexesReady;
}

async function addPostNotification({ recipientId, actorId, postId, commentId }) {
  if (!recipientId || String(recipientId) === String(actorId)) return;

  const type = commentId ? "comment" : "like";
  const eventKey = commentId ? `comment:${commentId}` : `like:${postId}:${actorId}`;
  try {
    await ensureIndexes();
    await Notification.create({ type, eventKey, recipientId, actorId, postId, commentId })
      .catch(error => {
        if (error?.code !== 11000) throw error;
      });
  } catch (error) {
    console.error("Post notification write failed:", error);
  }
}

function unreadCount(recipientId) {
  return Notification.countDocuments({ recipientId, readAt: null });
}

function serializeItem(notification) {
  const { _id, type, actorId, createdAt, readAt, postId, commentId } = notification;
  const isComment = type === "comment";
  const actorName = actorId?.username ?? "Someone";
  return {
    id: String(_id),
    type,
    title: isComment ? "New Comment" : "New Like",
    message: isComment ? `${actorName} commented on your post.` : `${actorName} liked your post.`,
    createdAt,
    readAt,
    postId: String(postId),
    ...(isComment && { commentId: String(commentId) }),
  };
}

async function listInbox(recipientId, { limit, cursor }) {
  const filter = { recipientId };
  if (cursor) {
    const { createdAt, id } = cursor;
    filter.$or = [
      { createdAt: { $lt: createdAt } },
      { createdAt, _id: { $lt: id } },
    ];
  }

  const [records, count] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate("actorId", "username")
      .lean(),
    unreadCount(recipientId),
  ]);
  const items = records.slice(0, limit).map(serializeItem);
  const last = items.at(-1);
  const nextCursor = records.length > limit
    ? Buffer.from(JSON.stringify([last.createdAt.toISOString(), last.id])).toString("base64url")
    : null;

  return { items, unreadCount: count, nextCursor };
}

async function markRead(recipientId, id) {
  const filter = { recipientId, _id: id };
  const updated = await Notification.findOneAndUpdate(
    { ...filter, readAt: null },
    { $set: { readAt: new Date() } },
    { returnDocument: "after" }
  ).select("readAt").lean();
  const notification = updated ?? await Notification.findOne(filter).select("readAt").lean();

  if (!notification) return null;

  return {
    id: String(notification._id),
    readAt: notification.readAt,
    unreadCount: await unreadCount(recipientId),
  };
}

async function markAllRead(recipientId, requestStart) {
  await Notification.updateMany(
    { recipientId, readAt: null, createdAt: { $lte: requestStart } },
    { $set: { readAt: new Date() } }
  );
  return unreadCount(recipientId);
}

module.exports = { addPostNotification, unreadCount, listInbox, markRead, markAllRead };
