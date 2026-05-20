<<<<<<< HEAD
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  isVerified: {
    type: Boolean,
    default: false
  }
});

=======
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  isVerified: {
    type: Boolean,
    default: false
  }
});

>>>>>>> 51cc27517d280490b4c1eb1cd5d570b82366995d
module.exports = mongoose.model("User", userSchema);