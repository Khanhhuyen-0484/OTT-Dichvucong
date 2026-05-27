const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("DB Atlas connected ✅");
  } catch (err) {
    console.log("DB lỗi ❌", err);
  }
};
module.exports = connectDB;