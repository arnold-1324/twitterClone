export function attachmentDetails(name, bytes) {
  const safeName = (name || "Attachment").replace(/[\u0000-\u001f\u007f/\\\u202a-\u202e\u2066-\u2069]/g, "").slice(0, 160) || "Attachment";
  const extension = safeName.match(/\.([a-z\d]{1,10})$/i)?.[1]?.toLowerCase() || "";
  const kind = ["pdf", "docx", "xlsx", "csv", "txt", "md", "json", "log", "tsv"].includes(extension) ? extension : "file";
  return { name: safeName, size: bytes, extension, kind };
}
