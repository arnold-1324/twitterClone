const decoder = new TextDecoder();
const textKinds = ["csv", "txt", "md", "json", "log", "tsv"];
const xmlElements = (document, name) => [...document.getElementsByTagNameNS("*", name)];

function readXml(bytes) {
  if (!bytes) return null;
  const xml = decoder.decode(bytes);
  if (/<!DOCTYPE\b/i.test(xml)) throw new Error("This document cannot be previewed.");
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (xmlElements(document, "parsererror").length) throw new Error("This document cannot be previewed.");
  return document;
}

async function officePreview(bytes, kind) {
  const { unzipSync } = await import("fflate");
  let sheetName;
  let expanded = 0;
  const files = unzipSync(bytes, { filter({ name, originalSize }) {
    const worksheet = !sheetName && /^xl\/worksheets\/sheet\d+\.xml$/.test(name);
    const needed = kind === "docx" ? name === "word/document.xml" : worksheet || name === "xl/sharedStrings.xml";
    if (!needed) return false;
    expanded += originalSize;
    if (expanded > 4 * 1024 * 1024) throw new Error("This document is too large to preview.");
    if (worksheet) sheetName = name;
    return true;
  } });
  if (kind === "docx") {
    const document = readXml(files["word/document.xml"]);
    if (!document) throw new Error("This document cannot be previewed.");
    const text = xmlElements(document, "p").slice(0, 80)
      .map((paragraph) => xmlElements(paragraph, "t").map((part) => part.textContent).join("")).join("\n").slice(0, 16000);
    return { text: text.trim() || "No text was found in this document." };
  }
  const sheet = readXml(files[sheetName]);
  if (!sheet) throw new Error("No worksheet could be previewed.");
  const stringsFile = readXml(files["xl/sharedStrings.xml"]);
  const strings = stringsFile ? xmlElements(stringsFile, "si")
    .map((item) => xmlElements(item, "t").map((part) => part.textContent).join("")) : [];
  const rows = xmlElements(sheet, "row").slice(0, 20).map((row) => {
    const values = Array(10).fill("");
    for (const cell of xmlElements(row, "c").slice(0, 14)) {
      const column = cell.getAttribute("r")?.match(/^([A-Z]+)/)?.[1];
      const index = column?.length === 1 ? column.charCodeAt(0) - 65 : -1;
      if (index < 0 || index >= values.length) continue;
      const value = xmlElements(cell, "v")[0]?.textContent || "";
      const type = cell.getAttribute("t");
      const label = type === "s" ? strings[Number(value)] ?? "" : type === "inlineStr"
        ? xmlElements(cell, "t").map((part) => part.textContent).join("") : value;
      values[index] = label.slice(0, 200);
    }
    return values;
  });
  const width = Math.max(1, ...rows.map((row) => row.findLastIndex(Boolean) + 1));
  return { rows: rows.map((row) => row.slice(0, width)) };
}

export function previewByteLimit(kind) {
  return textKinds.includes(kind) ? 64000 : 12 * 1024 * 1024;
}

export async function parseDocument(bytes, kind) {
  if (textKinds.includes(kind)) return { text: decoder.decode(bytes).slice(0, 16000) };
  return officePreview(bytes, kind);
}
