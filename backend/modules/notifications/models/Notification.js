const mongoose = require("mongoose");

const { Schema } = mongoose;

const notificationSchema = new Schema({
  recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["like", "comment"], required: true },
  postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
  commentId: { type: Schema.Types.ObjectId, ref: "PostComment" },
  createdAt: { type: Date, default: Date.now, immutable: true },
  readAt: { type: Date, default: null },
  eventKey: { type: String, required: true, unique: true, immutable: true },
}, { autoIndex: false });

notificationSchema.index({ recipientId: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ recipientId: 1, readAt: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
