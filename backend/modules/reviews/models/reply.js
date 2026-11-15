function createReplyModel(mongoose) {
  const { Schema } = mongoose;

  const replySchema = new Schema({
    reviewId: {
      type: Schema.Types.ObjectId,
      ref: 'Review',
      required: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 1000
    }
  }, {
    timestamps: true
  });

  replySchema.index({
    reviewId: 1,
    createdAt: 1,
    _id: 1
  });

  return mongoose.models.ReviewReply ||
    mongoose.model('ReviewReply', replySchema);
}

module.exports = { createReplyModel };