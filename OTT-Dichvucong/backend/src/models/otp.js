<<<<<<< HEAD
const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  email: String,
  otp: String,
  expiresAt: Date
});

=======
const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  email: String,
  otp: String,
  expiresAt: Date
});

>>>>>>> 51cc27517d280490b4c1eb1cd5d570b82366995d
module.exports = mongoose.model("Otp", otpSchema);