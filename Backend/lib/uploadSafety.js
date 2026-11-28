import { spawn, execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const checker = fileURLToPath(new URL("../scripts/document-check.py", import.meta.url));
const textTypes = new Set(["csv", "txt", "md", "json", "log", "tsv"]);
const invalid = (message, status = 415) => Object.assign(new Error(message), { status });
function completePng(buffer) {
  let offset = 8;
  for (let count = 0; count < 10000 && offset <= buffer.length - 12; count++) {
    const size = buffer.readUInt32BE(offset);
    const end = offset + 12 + size;
    if (end > buffer.length) return false;
    if (buffer.toString("ascii", offset + 4, offset + 8) === "IEND") return size === 0 && end === buffer.length;
    offset = end;
  }
  return false;
}
const jpegEnd = Buffer.from("ffd9", "hex");

export function rasterFormat(buffer) {
  if (buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "png";
  if (buffer.subarray(0, 3).toString("hex") === "ffd8ff") return "jpeg";
  if (/^GIF8[79]a$/.test(buffer.subarray(0, 6).toString("ascii"))) return "gif";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  throw invalid("Image signature is unsupported. Use PNG, JPEG, GIF, or WebP.");
}

export function validateImageContainer(buffer, format = rasterFormat(buffer)) {
  const invalidEnd = format === "png" ? !completePng(buffer)
    : format === "jpeg" ? !buffer.subarray(-2).equals(jpegEnd)
    : format === "gif" ? buffer.at(-1) !== 0x3b
    : format === "webp" ? buffer.length < 12 || buffer.readUInt32LE(4) + 8 !== buffer.length
    : true;
  if (invalidEnd) throw invalid("Image container is invalid or contains data after its end marker.");
}

function office(buffer, kind, signal) {
  return new Promise((resolve, reject) => {
    const process = spawn("python3", [checker, kind], { signal, stdio: ["pipe", "ignore", "pipe"] });
    const timer = setTimeout(() => process.kill("SIGKILL"), 8000);
    let message = "";
    process.stderr.on("data", (chunk) => {
      if (message.length < 800) message += chunk.toString("utf8");
    });
    process.stdin.on("error", () => {});
    process.on("error", (error) => {
      clearTimeout(timer);
      reject(error.name === "AbortError" ? error : invalid("Document inspection is temporarily unavailable.", 503));
    });
    process.on("close", (code, stopped) => {
      clearTimeout(timer);
      if (code === 0) return resolve();
      reject(invalid(stopped ? "Document exceeded the inspection deadline." : message.trim().slice(0, 250) || "Office document could not be checked."));
    });
    process.stdin.end(buffer);
  });
}

async function pdf(buffer, directory, signal) {
  if (buffer.subarray(0, 5).toString() !== "%PDF-" || !/%%EOF\s*$/.test(buffer.subarray(-32).toString())) {
    throw invalid("PDF header or end marker is invalid.");
  }
  const target = join(directory, "pdf-inspect");
  await writeFile(target, buffer);
  let parsed;
  try {
    const { stdout } = await run("qpdf", ["--json", "--json-key=qpdf", "--json-key=encrypt", "--json-stream-data=none", target],
      { timeout: 8000, signal, maxBuffer: 8 * 1024 * 1024 });
    parsed = JSON.parse(stdout);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    if (error.code === "ENOENT") throw invalid("PDF inspection is temporarily unavailable.", 503);
    throw invalid("PDF is malformed, encrypted, or exceeds the inspection limit.");
  }
  if (!Array.isArray(parsed.qpdf)) throw invalid("PDF structure could not be checked.");
  if (parsed.encrypt?.encrypted) throw invalid("PDF is encrypted and cannot be checked.");
  const active = new Set(["/JS", "/JavaScript", "/AA", "/OpenAction", "/Launch", "/URI", "/RichMedia", "/EmbeddedFile",
    "/EmbeddedFiles", "/Filespec", "/XFA", "/SubmitForm", "/ImportData", "/GoToR", "/GoToE", "/Rendition", "/Sound"]);
  const stack = [parsed.qpdf];
  while (stack.length) {
    const value = stack.pop();
    if (active.has(value)) throw invalid("PDF contains scripting, an external action, or an embedded file.");
    if (!value || typeof value !== "object") continue;
    for (const [key, entry] of Object.entries(value)) {
      if (active.has(key)) throw invalid("PDF contains scripting, an external action, or an embedded file.");
      stack.push(entry);
    }
  }
}

function text(buffer) {
  let content;
  try { content = new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
  catch { throw invalid("Text attachment must be valid UTF-8."); }
  if (/[\u0000-\u0008\u000e-\u001f]/.test(content)) throw invalid("Text attachment contains binary control characters.");
  const markup = /<\s*(?:script|iframe|object|embed|svg|html)\b|javascript\s*:|data\s*:\s*text\/html/i;
  const normalized = content.replace(/%([\da-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&(?:lt|#0*60|#x0*3c);/gi, "<").replace(/&(?:gt|#0*62|#x0*3e);/gi, ">");
  if (markup.test(normalized) || /(?:PHNjcmlwd|PGh0bWw|PHN2Zy)/i.test(content)) {
    throw invalid("Text attachment contains active markup or encoded HTML.");
  }
}

export async function validateDocument(file, attachment, directory, signal) {
  const { buffer } = file;
  const { extension } = attachment;
  if (!buffer.length) throw invalid("The attachment is empty.");
  if (textTypes.has(extension)) return text(buffer);
  if (["docx", "xlsx"].includes(extension)) return office(buffer, extension, signal);
  if (extension === "pdf") return pdf(buffer, directory, signal);
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) {
    throw invalid("General archives are not accepted in chat. Use the dedicated music or sticker ZIP importer.");
  }
  throw invalid("Unsupported attachment format. Use an image, video, audio, PDF, DOCX, XLSX, or UTF-8 text file.");
}
