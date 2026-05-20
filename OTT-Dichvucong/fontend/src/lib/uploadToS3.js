import { api } from "./api.js";

export async function uploadToS3(file) {
  if (!file) throw new Error("Không có file để upload.");

  const formData = new FormData();
  formData.append("file", file);

<<<<<<< HEAD
  const { data } = await api.post("/chat/media/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });

  return {
    key: data?.key || "",
    url: data?.url || "",
=======
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
>>>>>>> 51cc27517d280490b4c1eb1cd5d570b82366995d
    contentType: data?.contentType || file.type
  };
}

<<<<<<< HEAD
export default uploadToS3;
=======
export default uploadToS3;
>>>>>>> 51cc27517d280490b4c1eb1cd5d570b82366995d
