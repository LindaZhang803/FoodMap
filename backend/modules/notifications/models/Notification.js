const mongoose = require("mongoose");

const { Schema } = mongoose;

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
  title: { type: String, trim: true },
  message: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now, immutable: true },
  readAt: { type: Date, default: null },
  eventKey: { type: String, required: true, unique: true, immutable: true },
}, { autoIndex: false });

notificationSchema.index({ recipientId: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ recipientId: 1, readAt: 1 });
notificationSchema.index({ recipientId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
