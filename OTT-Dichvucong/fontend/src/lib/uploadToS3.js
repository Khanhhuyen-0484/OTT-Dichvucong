import { api } from "./api.js";

export async function uploadToS3(file) {
  if (!file) throw new Error("Không có file để upload.");

  const formData = new FormData();
  formData.append("file", file);

  let data;
  try {
    // Let browser set multipart boundary automatically.
    const uploadRes = await api.post("/chat/media/upload", formData);
    data = uploadRes.data;
  } catch (err) {
    // Fallback: presigned PUT flow when direct upload route fails.
    const presignRes = await api.post("/chat/media/presign", {
      fileName: file.name,
      contentType: file.type
    });
    const uploadUrl = presignRes.data?.uploadUrl;
    if (!uploadUrl) throw err;
    await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type
      },
      body: file
    });
    data = {
      key: presignRes.data?.key || "",
      url: presignRes.data?.publicUrl || "",
      contentType: file.type
    };
  }

  return {
    key: data?.key || "",
    url: data?.publicUrl || data?.url || "",
    contentType: data?.contentType || file.type
  };
}

export default uploadToS3;