# Deploy public website

Project này nên deploy thành 2 phần:

- Backend: Render Web Service hoặc một VPS Node.js, vì backend dùng Express + Socket.IO.
- Frontend: Vercel hoặc Netlify static site, vì frontend là Vite React.

## 1. Deploy backend lên Render

1. Đưa project lên GitHub.
2. Vào Render, tạo `New Web Service`.
3. Chọn repository.
4. Cấu hình:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Thêm Environment Variables theo `backend/.env.example`.
6. Deploy xong, lấy domain backend dạng:
   - `https://your-backend.onrender.com`
7. Kiểm tra:
   - `https://your-backend.onrender.com/api/health`

## 2. Deploy frontend lên Vercel

1. Vào Vercel, tạo `New Project`.
2. Chọn cùng repository.
3. Cấu hình:
   - Root Directory: `fontend`
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Thêm Environment Variables:
   - `VITE_API_BASE_URL=https://your-backend.onrender.com/api`
   - `VITE_SOCKET_URL=https://your-backend.onrender.com`
5. Deploy xong, lấy domain frontend dạng:
   - `https://your-project.vercel.app`

## 3. Cập nhật backend sau khi có frontend domain

Trong Render backend, cập nhật:

```env
FRONTEND_BASE_URL=https://your-project.vercel.app
```

Sau đó redeploy backend để link reset password gửi đúng domain frontend.

## 4. Test sau deploy

- Mở frontend public URL.
- Đăng ký tài khoản và kiểm tra OTP email.
- Đăng nhập.
- Xem danh sách dịch vụ.
- Vào chi tiết dịch vụ: chưa đăng nhập chỉ xem thông tin, đăng nhập mới nộp hồ sơ.
- Test chat sau khi đăng nhập.
- Test video call bằng 2 tài khoản trên 2 trình duyệt khác nhau.

## Lưu ý

- Không commit file `backend/.env`.
- Video call cần HTTPS. Vercel và Render đều có HTTPS mặc định.
- Nếu dùng Gmail, `EMAIL_PASS` phải là App Password, không phải mật khẩu Gmail thường.
