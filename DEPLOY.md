# Deploy public website

Project này nên deploy thành 2 phần:

- Backend: Render Web Service, vì backend dùng Express + Socket.IO.
- Frontend: Vercel, vì frontend là Vite React static app.

## 1. Backend trên Render

1. Vào Render và tạo `New Blueprint`.
2. Chọn repository `Khanhhuyen-0484/OTT-Dichvucong`.
3. Chọn branch `codex-public-deploy`.
4. Render sẽ đọc file `render.yaml` ở root và tạo service `ott-dichvucong-backend`.
5. Điền các biến môi trường đang để `sync: false`:
   - `EMAIL_USER`
   - `EMAIL_PASS`
   - `AWS_REGION`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `S3_BUCKET`
   - `OPENAI_API_KEY` nếu dùng AI thật
   - thông tin thanh toán nếu dùng SePay/VietQR
6. Deploy xong, kiểm tra:
   - `https://<backend-domain>/api/health`

## 2. Frontend trên Vercel

1. Vào Vercel, tạo `New Project`.
2. Chọn repository `Khanhhuyen-0484/OTT-Dichvucong`.
3. Chọn branch `codex-public-deploy`.
4. Cấu hình:
   - Root Directory: `fontend`
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Thêm Environment Variables:
   - `VITE_API_BASE_URL=https://<backend-domain>/api`
   - `VITE_SOCKET_URL=https://<backend-domain>`
6. Deploy xong, lấy domain frontend dạng:
   - `https://<project>.vercel.app`

## 3. Cập nhật lại backend

Sau khi có domain frontend, quay lại Render và sửa:

```env
FRONTEND_BASE_URL=https://<project>.vercel.app
```

Redeploy backend để link reset password trỏ đúng về website thật.

## 4. Test sau deploy

- Mở frontend public URL.
- Đăng ký tài khoản và kiểm tra OTP email.
- Đăng nhập.
- Xem danh sách dịch vụ công.
- Khi chưa đăng nhập: chỉ xem thông tin dịch vụ, không nộp hồ sơ hoặc chat hỗ trợ.
- Khi đã đăng nhập: nộp hồ sơ, chat, gửi vị trí, gọi video.
- Kiểm tra `/api/health` của backend.

## Lưu ý bảo mật

- Không commit `backend/.env`.
- Không commit `backend/src/config/ngrok.yml`.
- `EMAIL_PASS` phải là Gmail App Password, không phải mật khẩu Gmail thường.
- Nếu đã gửi mật khẩu trong chat, nên đổi mật khẩu ngay.
