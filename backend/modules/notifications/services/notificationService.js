const { randomUUID } = require("node:crypto");
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

async function saveNotification(notification, legacyEventKey) {
  try {
    await ensureIndexes();
    if (legacyEventKey && await Notification.exists({
      recipientId: notification.recipientId,
      type: notification.type,
      eventKey: legacyEventKey,
    })) return;

    await Notification.create(notification).catch(error => {
      if (error?.code !== 11000) throw error;
    });
  } catch (error) {
    console.error("Notification write failed:", notification.type, error);
  }
}

async function addReviewNotification({ recipientId, actorId, reviewId, replyId, type }) {
  if (!recipientId || String(recipientId) === String(actorId)) return;

  const isReply = type === "review_reply" || Boolean(replyId);
  return saveNotification({
    type: isReply ? "review_reply" : "review_like",
    eventKey: isReply ? `review_reply:${replyId}` : `review_like:${reviewId}:${actorId}`,
    recipientId,
    actorId,
    reviewId,
    replyId: isReply ? replyId : undefined,
  });
}

async function addSystemNotification({ recipientId, title, message, eventKey }) {
  if (!recipientId) return;

  // The same event can be delivered once to each recipient.
  const recipientKey = String(recipientId).toLowerCase();
  return saveNotification({
    type: "system",
    eventKey: `system:${recipientKey}:${eventKey || randomUUID()}`,
    recipientId,
    title,
    message,
  }, eventKey);
}

function unreadCount(recipientId) {
  return Notification.countDocuments({ recipientId, readAt: null });
}

function serializeItem(notification) {
  const { _id, type, actorId, createdAt, readAt = null, postId, commentId, reviewId, replyId } = notification;
  const actorName = actorId?.username ?? "Someone";
  let title = "New Notification";
  let message = "";

  switch (type) {
    case "like":
      title = "New Like";
      message = `${actorName} liked your post.`;
      break;
    case "comment":
      title = "New Comment";
      message = `${actorName} commented on your post.`;
      break;
    case "review_like":
      title = "Review Liked";
      message = `${actorName} liked your review.`;
      break;
    case "review_reply":
      title = "New Review Reply";
      message = `${actorName} replied to your review.`;
      break;
    case "system":
      title = notification.title || "System Notification";
      message = notification.message || "";
      break;
  }

  return {
    id: String(_id),
    type,
    title,
    message,
    createdAt,
    readAt,
    isRead: readAt !== null,
    ...(postId && { postId: String(postId) }),
    ...(commentId && { commentId: String(commentId) }),
    ...(reviewId && { reviewId: String(reviewId) }),
    ...(replyId && { replyId: String(replyId) }),
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
    isRead: notification.readAt != null,
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

module.exports = {
  addPostNotification,
  addReviewNotification,
  addSystemNotification,
  unreadCount,
  listInbox,
  markRead,
  markAllRead,
};
