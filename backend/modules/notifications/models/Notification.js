const mongoose = require("mongoose");

const { Schema } = mongoose;
const systemNotificationLimits = Object.freeze({ title: 120, message: 2000, eventKey: 160 });
const systemEventPrefixLength = "system::".length + 24;

const notificationSchema = new Schema({
  recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  actorId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required() { return this.type !== "system"; },
  },
  type: {
    type: String,
    enum: ["like", "comment", "review_like", "review_reply", "system"],
    required: true,
  },
  postId: {
    type: Schema.Types.ObjectId,
    ref: "Post",
    required() { return this.type === "like" || this.type === "comment"; },
  },
  commentId: { type: Schema.Types.ObjectId, ref: "PostComment" },
  reviewId: {
    type: Schema.Types.ObjectId,
    ref: "Review",
    required() { return this.type === "review_like" || this.type === "review_reply"; },
  },
  replyId: {
    type: Schema.Types.ObjectId,
    ref: "ReviewReply",
    required() { return this.type === "review_reply"; },
  },
  restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant" },
  dishId: { type: Schema.Types.ObjectId, ref: "Dish" },
  reviewType: { type: String, enum: ["restaurant", "dish"] },
  title: { type: String, trim: true, maxlength: systemNotificationLimits.title },
  message: { type: String, trim: true, maxlength: systemNotificationLimits.message },
  createdAt: { type: Date, default: Date.now, immutable: true },
  readAt: { type: Date, default: null },
  eventKey: {
    type: String, trim: true, required: true, unique: true, immutable: true,
    maxlength: systemEventPrefixLength + systemNotificationLimits.eventKey,
  },
}, { autoIndex: false });

notificationSchema.index({ recipientId: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ recipientId: 1, readAt: 1 });
notificationSchema.index({ recipientId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
module.exports.systemNotificationLimits = systemNotificationLimits;
