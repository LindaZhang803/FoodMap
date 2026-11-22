const express = require("express");
const authenticate = require("../../accounts/middleware/authMiddleware");
const controller = require("../controllers/notificationController");

const router = express.Router();

router.use((req, res, next) => {
  res.locals.notificationRequestStart = new Date();
  res.set("Cache-Control", "private, no-store");
  next();
});
router.use(authenticate);

router.get("/", controller.list);
router.get("/unread-count", controller.unreadCount);
router.patch("/read-all", controller.markAllRead);
router.patch("/:id/read", controller.markRead);

router.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  console.error("Notifications API error:", error);
  return res.status(500).json({ message: "Internal server error." });
});

module.exports = router;
