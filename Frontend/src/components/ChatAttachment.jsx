import { lazy, Suspense, useState } from "react";
import { Spinner } from "@chakra-ui/react";
import { FiDownload, FiFileText } from "react-icons/fi";

const PreviewDialog = lazy(() => import("./AttachmentPreviewDialog"));

export default function ChatAttachment({ url, attachment }) {
  const [open, setOpen] = useState(false);
  const file = attachment?.name ? attachment : { name: "Attachment", kind: "file" };
  const size = Number.isFinite(file.size) ? ` · ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
    .format(file.size < 1024 * 1024 ? file.size / 1024 : file.size / (1024 * 1024))} ${file.size < 1024 * 1024 ? "KB" : "MB"}` : "";
  const label = `${file.extension?.toUpperCase() || "File"}${size}`;
  const canPreview = file.kind !== "file" && /^\/api\/media\/[a-f0-9]{64}$/.test(url);
  return <div className="chat-file-card">
    <span className="chat-file-icon"><FiFileText aria-hidden="true" /></span>
    {canPreview ? <button type="button" className="chat-file-title" aria-label={`Preview ${file.name}`} onClick={() => setOpen(true)}>
      <strong>{file.name}</strong><small>{label}</small>
    </button> : <span className="chat-file-title"><strong>{file.name}</strong><small>{label}</small></span>}
    <a className="chat-file-save" href={url} download={file.name} aria-label={`Download ${file.name}`}><FiDownload /></a>
    {open && <Suspense fallback={<Spinner size="sm" label="Loading preview tools" />}>
      <PreviewDialog key={url} file={file} url={url} onClose={() => setOpen(false)} />
    </Suspense>}
  </div>;
}
