import { api } from "./api.js";

export async function uploadToS3(file) {
  if (!file) throw new Error("Không có file để upload.");

  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post("/chat/media/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });

  return {
    key: data?.key || "",
    url: data?.url || "",
    contentType: data?.contentType || file.type
  };
}

export default uploadToS3;