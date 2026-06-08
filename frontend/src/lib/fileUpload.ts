import { api } from "@/lib/api";

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function uploadImage(file: File) {
  const dataBase64 = await readFileAsBase64(file);
  const result = await api<{ url: string }>("/uploads/image", {
    method: "POST",
    body: JSON.stringify({ filename: file.name, mimeType: file.type, dataBase64 })
  });
  return result.url;
}
