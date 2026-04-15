# TODO.md - Fix /api/login 400 Error Plan Implementation

## Plan Summary
Add debug logging to:
1. `backend/src/controllers/authController.js` (login handler)
2. `backend/src/store/userStore.js` (findByEmail with ScanCommand)

## Steps
- [x] Step 1: Edit authController.js to add logs before/after findByEmail and bcrypt.compare
- [x] Step 2: Edit userStore.js to add logs in findByEmail (input email, scan result)
- [ ] Step 3: Test by restarting backend server and calling /api/login
- [ ] Step 4: Analyze logs, fix env/AWS issues if needed (creds, table data)
- [ ] Step 5: Remove debug logs after resolution
- [ ] Step 6: Complete task

