const jwt = require("jsonwebtoken");
const axios = require("axios");

// Set the JWT secret to match backend
process.env.JWT_SECRET = "abc123";

// User ID from users.json
const userId = "u_1775766651629";
const userEmail = "ttkh1310@gmail.com";

// Create token
const token = jwt.sign(
  { id: userId, email: userEmail },
  process.env.JWT_SECRET,
  { expiresIn: "1h" }
);

console.log("Token created:", token);

// Test GET /me
async function testGetMe() {
  try {
    const res = await axios.get("http://localhost:3000/api/me", {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("\n✅ GET /me success:", res.data);
    return true;
  } catch (err) {
    console.error(
      "\n❌ GET /me failed:",
      err.response?.status,
      err.response?.data
    );
    return false;
  }
}

// Test PATCH /me with various data
async function testPatchMe(data, description) {
  try {
    const res = await axios.patch("http://localhost:3000/api/me", data, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`✅ PATCH /me ${description} success:`, res.data);
  } catch (err) {
    console.error(
      `❌ PATCH /me ${description} failed:`,
      err.response?.status,
      err.response?.data
    );
  }
}

async function runTests() {
  console.log("🧪 Testing Profile Update API\n");

  // Test 1: Valid update
  await testPatchMe(
    { fullName: "Nguyễn Văn A", phone: "0987654321", address: "TP HCM" },
    "(valid data)"
  );

  // Test 2: Only fullName
  await testPatchMe({ fullName: "Test User" }, "(only fullName)");

  // Test 3: Empty phone (should be allowed)
  await testPatchMe(
    { phone: "" },
    "(empty phone)"
  );

  // Test 4: Invalid phone format (with letters)
  await testPatchMe(
    { phone: "abc def 123" },
    "(invalid phone - only letters)"
  );

  // Test 5: Invalid phone (too short)
  await testPatchMe({ phone: "123" }, "(too short)");

  // Test 6: Valid phone with formatting
  await testPatchMe(
    { phone: "09 8765 4321" },
    "(phone with spaces)"
  );

  // Test: Get final state
  console.log("\nFinal state:");
  await testGetMe();
}

// Run if this is the main file
if (require.main === module) {
  runTests();
}

module.exports = { token, userId };
