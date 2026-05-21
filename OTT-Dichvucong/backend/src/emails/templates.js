const COLORS = {
  navy: "#1e3a8a",
  red: "#b91c1c",
  white: "#ffffff",
  slate: "#0f172a",
  border: "#e5e7eb",
  muted: "#475569"
};

function layout({ title, preheader, bodyHtml }) {
  const safePreheader = preheader ? String(preheader) : "";
  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { margin:0; padding:0; background:${COLORS.white}; font-family: Arial, Helvetica, sans-serif; color:${COLORS.slate}; }
      .container { width:100%; background:${COLORS.white}; padding:24px 12px; }
      .card { max-width:620px; margin:0 auto; border:1px solid ${COLORS.border}; border-radius:14px; overflow:hidden; }
      .topbar { background:linear-gradient(90deg, ${COLORS.navy} 0%, ${COLORS.navy} 70%, ${COLORS.red} 100%); padding:16px 20px; }
      .brand { color:${COLORS.white}; font-weight:700; letter-spacing:.2px; font-size:16px; }
      .content { padding:22px 20px 18px 20px; }
      h1 { margin:0 0 10px 0; font-size:20px; line-height:1.35; }
      p { margin:0 0 12px 0; line-height:1.55; color:${COLORS.slate}; font-size:14px; }
      .muted { color:${COLORS.muted}; font-size:12.5px; }
      .otp { font-size:26px; font-weight:800; letter-spacing:6px; color:${COLORS.navy}; text-align:center; padding:14px 12px; border:1px dashed ${COLORS.border}; border-radius:12px; background:#f8fafc; }
      .btn { display:inline-block; background:${COLORS.navy}; color:${COLORS.white}; text-decoration:none; padding:12px 16px; border-radius:10px; font-weight:700; font-size:14px; }
      .btn:visited { color:${COLORS.white}; }
      .footer { padding:14px 20px 18px 20px; border-top:1px solid ${COLORS.border}; background:#fafafa; }
      .flag { display:inline-block; width:10px; height:10px; border-radius:2px; background:${COLORS.red}; margin-right:6px; vertical-align:middle; }
      .preheader { display:none !important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; overflow:hidden; }
      @media (max-width: 480px) {
        .content { padding:18px 14px; }
        .topbar { padding:14px 14px; }
      }
    </style>
  </head>
  <body>
    <div class="preheader">${escapeHtml(safePreheader)}</div>
    <div class="container">
      <div class="card">
        <div class="topbar">
          <div class="brand">Cổng Dịch vụ công — Thông báo hệ thống</div>
        </div>
        <div class="content">
          ${bodyHtml}
        </div>
        <div class="footer">
          <p class="muted"><span class="flag"></span>Vui lòng không chia sẻ mã/đường dẫn này cho bất kỳ ai. Nếu bạn không thực hiện yêu cầu, hãy bỏ qua email này.</p>
          <p class="muted">© ${new Date().getFullYear()} Cổng Dịch vụ công</p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function otpEmail({ otp, minutes = 5 }) {
  const title = "Mã OTP xác minh đăng ký";
  return layout({
    title,
    preheader: `Mã OTP của bạn có hiệu lực ${minutes} phút`,
    bodyHtml: `
      <h1>${escapeHtml(title)}</h1>
      <p>Chúng tôi đã nhận được yêu cầu xác minh email cho tài khoản của bạn.</p>
      <p class="muted">Mã OTP (hiệu lực ${escapeHtml(String(minutes))} phút):</p>
      <div class="otp">${escapeHtml(String(otp))}</div>
      <p class="muted" style="margin-top:12px;">Nếu bạn không yêu cầu mã OTP, vui lòng bỏ qua email này.</p>
    `
  });
}

function resetPasswordEmail({ resetUrl }) {
  const title = "Yêu cầu đặt lại mật khẩu";
  return layout({
    title,
    preheader: "Nhấn nút để đặt lại mật khẩu",
    bodyHtml: `
      <h1>${escapeHtml(title)}</h1>
      <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
      <p>Nhấn nút bên dưới để tiếp tục:</p>
      <p style="margin:16px 0 18px 0;">
        <a class="btn" href="${escapeAttr(resetUrl)}" target="_blank" rel="noreferrer">Đặt lại mật khẩu</a>
      </p>
      <p class="muted">Nếu nút không hoạt động, hãy sao chép và dán đường dẫn sau vào trình duyệt:</p>
      <p class="muted" style="word-break:break-all;">${escapeHtml(resetUrl)}</p>
    `
  });
}

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(input) {
  return escapeHtml(input).replace(/`/g, "&#096;");
}

module.exports = { otpEmail, resetPasswordEmail };

