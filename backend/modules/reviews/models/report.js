const REPORT_REASONS = [
  'Spam',
  'Harassment',
  'Irrelevant Content',
  'Misleading Information'
];

function createReportModel(mongoose) {
  const { Schema } = mongoose;

  const reportSchema = new Schema({
    reviewId: {
      type: Schema.Types.ObjectId,
      ref: 'Review',
      required: true
    },

    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    reason: {
      type: String,
      required: true,
      enum: REPORT_REASONS
    },

    status: {
      type: String,
      required: true,
      enum: ['pending', 'resolved', 'dismissed'],
      default: 'pending'
    },

    resolvedAt: {
      type: Date,
      default: null
    }
  }, {
    timestamps: true
  });

  // Each user can report the same review only once.
  reportSchema.index(
    { reviewId: 1, reportedBy: 1 },
    { unique: true }
  );

  reportSchema.index({
    status: 1,
    createdAt: -1
  });

  return mongoose.models.ReviewReport ||
    mongoose.model('ReviewReport', reportSchema);
}

module.exports = {
  createReportModel,
  REPORT_REASONS
};