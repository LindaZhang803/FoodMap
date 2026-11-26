const express = require("express");
const requireAdmin = require("../middleware/requireAdmin");
const { systemNotificationLimits } = require("../../notifications/models/Notification");
const { addSystemNotification } = require("../../notifications/services/notificationService");

const router = express.Router();
const objectIdPattern = /^[a-f0-9]{24}$/i;
const maxRecipients = 500;

router.post("/", requireAdmin, async (req, res) => {
  const { recipientIds, ...input } = req.body ?? {};

  if (!Array.isArray(recipientIds) || recipientIds.length < 1 || recipientIds.length > maxRecipients ||
      recipientIds.some(id => typeof id !== "string" || !objectIdPattern.test(id))) {
    return res.status(400).json({ message: "recipientIds must contain 1 to 500 valid ObjectIds." });
  }

  const notification = {};
  for (const [field, maxLength] of Object.entries(systemNotificationLimits)) {
    const value = typeof input[field] === "string" ? input[field].trim() : "";
    if (!value || value.length > maxLength) {
      return res.status(400).json({ message: `${field} must contain 1 to ${maxLength} characters.` });
    }
    notification[field] = value;
  }

  const recipients = [...new Set(recipientIds.map(id => id.toLowerCase()))];
  const delivered = await Promise.all(recipients.map(recipientId =>
    addSystemNotification({ ...notification, recipientId })
  ));
  if (delivered.some(success => !success)) {
    return res.status(503).json({ message: "Some notifications could not be sent. Retry with the same eventKey." });
  }

  return res.status(201).json({ recipientCount: recipients.length });
});

module.exports = router;
