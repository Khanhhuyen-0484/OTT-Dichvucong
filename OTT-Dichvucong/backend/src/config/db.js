const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("DB Atlas connected ?o.");
  } catch (err) {
    console.log("DB l?-i ?O", err);
  }
};
module.exports = connectDB;