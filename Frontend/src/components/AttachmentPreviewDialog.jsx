import { useEffect, useRef, useState } from "react";
import { Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Spinner } from "@chakra-ui/react";
import { apiFetch } from "../lib/apiFetch";
import { parseDocument, previewByteLimit } from "../lib/documentPreview";

export default function AttachmentPreviewDialog({ file, url, onClose }) {
  const canvas = useRef(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let pdf;
    let rendering;
    async function load() {
      try {
        const limit = previewByteLimit(file.kind);
        const response = await apiFetch(url, { signal: controller.signal, headers: { Range: `bytes=0-${limit - 1}` } });
        if (!response.ok) throw new Error("This attachment is unavailable.");
        const fullSize = Number(response.headers.get("Content-Range")?.split("/").at(-1) || response.headers.get("Content-Length"));
        if (fullSize > limit && ["pdf", "docx", "xlsx"].includes(file.kind)) {
          await response.body?.cancel();
          throw new Error("This document is too large to preview.");
        }
        const data = new Uint8Array(await response.arrayBuffer());
        if (controller.signal.aborted) return;
        if (data.length > limit) throw new Error("This document is too large to preview.");
        if (file.kind !== "pdf") {
          const preview = await parseDocument(data, file.kind);
          if (!controller.signal.aborted) setResult(preview);
          return;
        }
        const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
        if (controller.signal.aborted) return;
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        pdf = pdfjs.getDocument({ data, stopAtErrors: true, maxImageSize: 10000000, canvasMaxAreaInBytes: 16000000 });
        const document = await pdf.promise;
        const page = await document.getPage(1);
        if (controller.signal.aborted) return;
        const size = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 800 / Math.max(size.width, size.height) });
        const output = canvas.current;
        output.width = Math.ceil(viewport.width);
        output.height = Math.ceil(viewport.height);
        rendering = page.render({ canvas: output, viewport });
        await rendering.promise;
        if (!controller.signal.aborted) setResult({ pdf: true });
      } catch (failure) {
        if (!controller.signal.aborted) {
          setError(failure.message?.length < 160 ? failure.message : "This document cannot be previewed.");
        }
      }
    }

    void load();
    return () => {
      controller.abort();
      rendering?.cancel();
      void pdf?.destroy().catch(() => {});
    };
  }, [url, file.kind]);

  return <Modal isOpen onClose={onClose} isCentered scrollBehavior="inside" size="2xl">
    <ModalOverlay />
    <ModalContent className="ephemeral-dialog attachment-dialog" mx={3} maxH="87dvh">
      <ModalHeader>{file.name}</ModalHeader>
      <ModalCloseButton />
      <ModalBody>
        {!result && !error && <Spinner label="Loading document preview" />}
        {error && <p role="status">{error}</p>}
        {file.kind === "pdf" && <canvas ref={canvas} hidden={!result?.pdf} aria-label="First page of the PDF" />}
        {result?.text !== undefined && <pre>{result.text || "This file is empty."}</pre>}
        {result?.rows && (result.rows.length ? <div className="attachment-table">
          <table aria-label="Worksheet preview"><tbody>{result.rows.map((row, index) =>
            <tr key={index}>{row.map((cell, col) => <td key={col}>{cell}</td>)}</tr>)}</tbody></table>
        </div> : <p>This worksheet is empty.</p>)}
      </ModalBody>
      <ModalFooter><a className="attachment-download" href={url} download={file.name}>Download original</a></ModalFooter>
    </ModalContent>
  </Modal>;
}
