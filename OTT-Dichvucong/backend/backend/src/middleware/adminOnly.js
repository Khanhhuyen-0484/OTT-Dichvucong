module.exports = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "B?n kh?ng c? quy?n truy c?p khu v?c admin" });
  }
  return next();
};
