const { REPORT_REASONS } = require('../models/report');

const isId = value =>
  typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function serializeReport(document) {
  const report = typeof document.toObject === 'function'
    ? document.toObject()
    : document;

  return {
    id: String(report._id),
    reviewId: String(report.reviewId),
    reportedBy: String(report.reportedBy),
    reason: report.reason,
    status: report.status,
    resolvedAt: report.resolvedAt ?? null,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt
  };
}

function createReportService({
  mongoose,
  Review,
  ReviewReport
}) {
  return {
    async submit(reviewId, input, userId) {
      if (!isId(userId)) {
        fail(401, 'Authentication required');
      }

      if (!isId(reviewId)) {
        fail(400, 'Invalid review ID');
      }

      if (
        !input ||
        typeof input !== 'object' ||
        Array.isArray(input) ||
        Object.keys(input).length !== 1 ||
        !Object.hasOwn(input, 'reason') ||
        !REPORT_REASONS.includes(input.reason)
      ) {
        fail(400, 'Choose a valid report reason');
      }

      try {
        return await mongoose.connection.transaction(async session => {
          const review = await Review.findById(reviewId)
            .session(session)
            .lean();

          if (!review) {
            fail(404, 'Review not found');
          }

          // Coordinate report creation with review deletion.
          await Review.updateOne(
            { _id: reviewId },
            { $inc: { __v: 1 } },
            { session }
          );

          const [report] = await ReviewReport.create(
            [{
              reviewId,
              reportedBy: userId,
              reason: input.reason,
              status: 'pending'
            }],
            { session }
          );

          // Reporting does not automatically delete the review.
          return {
            report: serializeReport(report)
          };
        });
      } catch (error) {
        if (error.code === 11000) {
          fail(409, 'You already reported this review');
        }

        throw error;
      }
    },

    // Accessible through the administrator router.
    async list(query = {}) {
      const status = query.status ?? 'pending';
      const page = query.page === undefined
        ? 1
        : Number(query.page);
      const limit = 20;

      if (!['pending', 'resolved', 'dismissed'].includes(status)) {
        fail(400, 'Invalid report status');
      }

      if (!Number.isSafeInteger(page) || page < 1 || page > 10000) {
        fail(400, 'Invalid page');
      }

      const filter = { status };

      const [reports, total] = await Promise.all([
        ReviewReport.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        ReviewReport.countDocuments(filter)
      ]);

      return {
        reports: reports.map(serializeReport),
        pagination: { page, limit, total }
      };
    },

    // Administrators can resolve or dismiss a report.
    async resolve(reportId, input) {
      if (!isId(reportId)) {
        fail(400, 'Invalid report ID');
      }

      if (
        !input ||
        typeof input !== 'object' ||
        Array.isArray(input) ||
        Object.keys(input).length !== 1 ||
        !Object.hasOwn(input, 'status') ||
        !['resolved', 'dismissed'].includes(input.status)
      ) {
        fail(400, 'Report status must be resolved or dismissed');
      }

      const report = await ReviewReport.findOneAndUpdate(
        { _id: reportId },
        {
          $set: {
            status: input.status,
            resolvedAt: new Date()
          }
        },
        { new: true, runValidators: true }
      ).lean();

      if (!report) {
        fail(404, 'Report not found');
      }

      return {
        report: serializeReport(report)
      };
    }
  };
}

module.exports = { createReportService };