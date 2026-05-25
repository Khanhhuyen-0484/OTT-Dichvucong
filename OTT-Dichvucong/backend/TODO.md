# Task: Enhance Support Chat Messages with Sender Info

## Status: In Progress

### Step 1: ✅ Create this TODO.md

### Step 2: ✅ Update supportConversationsStore.js\n- Add optional `sender` param to `sendMessage()`\n- Message: `{id, from, text, createdAt, sender}`\n- Keep existing DynamoDB list_append logic\n\n### Step 3: ✅ Update adminStore.js\n- Modify `addConversationMessage()` to accept `sender` and pass to `sendMessage()`\n\n### Step 4: ✅ Update adminController.js (supportSendMessage)\n- Import userStore.findById\n- Fetch adminUser = await findById(req.user.id)\n- Build sender: id, fullName (fallback \"Admin hỗ trợ\"), avatarUrl (ui-avatars.com if missing)\n- Pass sender to addConversationMessage()\n\n### Step 5: [Optional] Update chatController.js (staffSend for citizen messages)\n- Similar sender enrichment\n\n### Step 6: Test\n- Run backend, POST /admin/support/conversations/{id}/messages\n- Verify DynamoDB messages have sender\n- Frontend receives correct format\n\n### Step 7: Complete task

**Notes:**
- No schema/DB changes
- Avatar: https://ui-avatars.com/api/?name={fullName}&size=128
- Legacy messages: frontend fallback sender?.fullName || citizenName

