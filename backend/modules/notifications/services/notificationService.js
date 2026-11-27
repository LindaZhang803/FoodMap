const { randomUUID } = require("node:crypto");
const Notification = require("../models/Notification");

const createdAtType = { $type: "$createdAt" };
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
    })) return true;

    await Notification.create(notification).catch(error => {
      if (error?.code !== 11000) throw error;
    });
    return true;
  } catch (error) {
    console.error("Notification write failed:", notification.type, error);
    return false;
  }
}

async function addReviewNotification({ recipientId, actorId, reviewId, replyId, type, restaurantId, dishId, reviewType }) {
  if (!recipientId || String(recipientId) === String(actorId)) return;

  const isReply = type === "review_reply" || Boolean(replyId);
  return saveNotification({
    type: isReply ? "review_reply" : "review_like",
    eventKey: isReply ? `review_reply:${replyId}` : `review_like:${reviewId}:${actorId}`,
    recipientId,
    actorId,
    reviewId,
    restaurantId,
    dishId,
    reviewType,
    replyId: isReply ? replyId : undefined,
  });
}

async function addSystemNotification({ recipientId, title, message, eventKey, restaurantId, reviewId }) {
  if (!recipientId) return;

  // The same event can be delivered once to each recipient.
  const recipientKey = String(recipientId).toLowerCase();
  return saveNotification({
    type: "system",
    eventKey: `system:${recipientKey}:${eventKey || randomUUID()}`,
    recipientId,
    restaurantId,
    reviewId,
    title,
    message,
  }, eventKey);
}

function unreadCount(recipientId) {
  return Notification.countDocuments({ recipientId, readAt: null });
}

function serializeItem(notification) {
  const {
    _id, type, actorId, createdAt, readAt = null, postId, commentId,
    reviewId, replyId, restaurantId, dishId, reviewType,
  } = notification;
  const actorObjectId = actorId?._id ?? actorId;
  const actorName = actorId?.username ?? "Someone";
  const hasDisplayDate = createdAt instanceof Date ||
    (typeof createdAt === "string" && Number.isFinite(Date.parse(createdAt)));
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
    createdAt: hasDisplayDate ? createdAt : null,
    readAt,
    isRead: readAt !== null,
    ...(actorObjectId && { actorId: String(actorObjectId) }),
    ...(postId && { postId: String(postId) }),
    ...(commentId && { commentId: String(commentId) }),
    ...(reviewId && { reviewId: String(reviewId) }),
    ...(replyId && { replyId: String(replyId) }),
    ...(restaurantId && { restaurantId: String(restaurantId) }),
    ...(dishId && { dishId: String(dishId) }),
    ...(reviewType && { reviewType }),
  };
}

function findInboxRecords(filter, sort, limit) {
  return Notification.find(filter).sort(sort).limit(limit)
    .populate({ path: "actorId", select: "username", transform: (user, id) => user ?? id })
    .lean();
}

async function findInboxPage(recipientId, limit, cursor) {
  const undatedCursor = cursor?.createdAt === null;
  let records = [];
  if (!undatedCursor) {
    const filter = { recipientId, $expr: { $eq: [createdAtType, "date"] } };
    if (cursor) {
      const { createdAt, id } = cursor;
      filter.$or = [
        { createdAt: { $lt: createdAt } },
        { createdAt, _id: { $lt: id } },
      ];
    }
    records = await findInboxRecords(filter, { createdAt: -1, _id: -1 }, limit);
  }

  // Date comparisons cannot seek across BSON types. Continue undated alerts by ID.
  if (records.length < limit) {
    const filter = { recipientId, $expr: { $ne: [createdAtType, "date"] } };
    if (undatedCursor) filter._id = { $lt: cursor.id };
    const undated = await findInboxRecords(filter, { _id: -1 }, limit - records.length);
    records.push(...undated);
  }
  return records;
}

async function listInbox(recipientId, { limit, cursor }) {
  const [records, count] = await Promise.all([
    findInboxPage(recipientId, limit + 1, cursor),
    unreadCount(recipientId),
  ]);
  const items = records.slice(0, limit).map(serializeItem);
  let nextCursor = null;
  if (records.length > limit) {
    const { createdAt, id } = items.at(-1);
    const date = createdAt instanceof Date ? createdAt.toJSON() : null;
    nextCursor = Buffer.from(JSON.stringify([date, id])).toString("base64url");
  }

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
    {
      recipientId,
      readAt: null,
      $or: [
        { createdAt: { $lte: requestStart } },
        { $expr: { $ne: [createdAtType, "date"] } },
      ],
    },
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
