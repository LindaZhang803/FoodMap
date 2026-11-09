const crypto = require("crypto");

function requireAdmin(req, res, next) {
  const configuredKey = process.env.ADMIN_API_KEY;
  const providedKey = req.get("x-admin-key");

  if (!configuredKey) {
    return res.status(503).json({
      message: "Admin authentication is not configured",
    });
  }

  if (!providedKey) {
    return res.status(401).json({
      message: "Admin authentication required",
    });
  }

  const expected = Buffer.from(
    crypto.createHash("sha256").update(configuredKey).digest()
  );

  const actual = Buffer.from(
    crypto.createHash("sha256").update(providedKey).digest()
  );

  if (!crypto.timingSafeEqual(expected, actual)) {
    return res.status(403).json({
      message: "Access denied",
    });
  }

  next();
}

module.exports = requireAdmin;