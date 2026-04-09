const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    let token = req.headers.authorization;

    if (!token) {
      return res.status(401).json({ message: "Không có token" });
    }

    if (typeof token === "string" && token.startsWith("Bearer ")) {
      token = token.slice(7).trim();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (err) {
    return res.status(401).json({ message: "Token không hợp lệ" });
  }
};