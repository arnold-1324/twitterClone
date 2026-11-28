import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button, Progress } from "@chakra-ui/react";
import { FiArchive, FiUploadCloud } from "react-icons/fi";
import { apiFetch, readApiJson } from "../lib/apiFetch";

const base = "/api/music/admin";
const categories = [["tamil", "Tamil"], ["tamil-christian", "Tamil Christian"], ["english", "English"],
  ["hindi", "Hindi"], ["malayalam", "Malayalam"]];

async function request(path, options) {
  const response = await apiFetch(base + path, options);
  if (response.status === 204) return null;
  if (!response.ok) {
    const body = await readApiJson(response).catch(() => null);
    throw new Error(body?.error ?? "Could not complete the music import request.");
  }
  return readApiJson(response);
}

export default function MusicImportPanel({ userId }) {
  const [authorized, setAuthorized] = useState(false);
  const [file, setFile] = useState(null);
  const [pack, setPack] = useState("music");
  const [category, setCategory] = useState("tamil");
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setAuthorized(false);
    setJob(null);
    request("/access", { signal: controller.signal }).then(async (result) => {
      if (controller.signal.aborted || !result.allowed) return;
      setAuthorized(true);
      const current = await request("/imports", { signal: controller.signal });
      if (!controller.signal.aborted) setJob(current);
    }).catch(() => {});
    return () => controller.abort();
  }, [userId]);

  useEffect(() => {
    if (job?.stage !== "processing") return;
    const controller = new AbortController();
    const id = setInterval(() => {
      request("/imports", { signal: controller.signal }).then((current) => {
        if (!controller.signal.aborted) setJob(current);
      }).catch(() => {});
    }, 2800);
    return () => { controller.abort(); clearInterval(id); };
  }, [job?.stage]);

  const isUploading = job?.stage === "uploading";
  const isProcessing = job?.stage === "processing";
  const matches = isUploading && file && file.name === job.name && file.size === job.bytes;
  const total = isProcessing ? job.result?.total : job?.bytes;
  const completed = isProcessing ? (job.result?.imported ?? 0) + (job.result?.failed ?? 0) : job?.received;
  const percent = total ? Math.floor(100 * completed / total) : 0;

  async function upload(event) {
    event.preventDefault();
    if (!file || busy || isProcessing) return;
    setBusy(true);
    setError("");
    try {
      let current = matches ? job : await request("/imports", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, bytes: file.size, category, pack }),
      });
      setJob(current);
      while (current.received < file.size) {
        const offset = current.received;
        current = await request(`/imports/${current.id}/chunks/${offset}`, {
          method: "PUT", headers: { "Content-Type": "application/octet-stream" },
          body: file.slice(offset, offset + current.chunkBytes),
        });
        setJob(current);
      }
      setJob(await request(`/imports/${current.id}/process`, { method: "POST" }));
    } catch (failure) {
      setError(failure.message);
      const status = await request("/imports").catch(() => undefined);
      if (status !== undefined) setJob(status);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (busy) return;
    setBusy(true);
    try {
      await request(`/imports/${job.id}`, { method: "DELETE" });
      setJob(null);
      setError("");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  if (!authorized) return null;
  return <section className="music-import-panel" aria-labelledby="music-import-title">
    <Link to="/admin" className="admin-settings-link">Open admin dashboard</Link>
    <div className="music-import-header">
      <span><FiArchive aria-hidden="true" /></span><div><h2 id="music-import-title">Library imports</h2>
        <p>Import music or replace the active sticker pack.</p></div>
    </div>
    <form onSubmit={upload}>
      <label className="music-import-file"><FiUploadCloud aria-hidden="true" />
        <span><strong>{file?.name ?? (pack === "stickers" ? "Choose a sticker ZIP" : "Choose a ZIP or audio file")}</strong><small>{pack === "stickers" ? "PNG, JPEG, GIF, or WebP content · Any filename extension" : "ZIP up to 1 GB · Audio up to 128 MB"}</small></span>
        <input type="file" key={pack} accept={pack === "stickers" ? ".zip" : ".zip,.mp3,.flac,.m4a,.wav,.ogg,.opus,.aac"} aria-label="Music import file"
          disabled={busy || isProcessing} onChange={(event) => { setFile(event.target.files[0] ?? null); setError(""); }} />
      </label>
      <div className="music-import-actions">
        <label>Import type
          <select value={pack} disabled={busy || isUploading || isProcessing} onChange={(event) => { setPack(event.target.value); setFile(null); }}>
            <option value="music">Music</option><option value="stickers">Replacement sticker pack</option>
          </select>
        </label>
        {pack === "music" && <label>Default category
          <select value={category} disabled={busy || isUploading || isProcessing} onChange={(event) => setCategory(event.target.value)}>
            {categories.map(([value, name]) => <option value={value} key={value}>{name}</option>)}
          </select>
        </label>}
        <Button type="submit" colorScheme="teal" size="sm" isDisabled={!file || isProcessing || (isUploading && !matches)}
          isLoading={busy}>{matches ? "Resume upload" : pack === "stickers" ? "Replace sticker pack" : "Import music"}</Button>
        {isUploading && <Button type="button" variant="ghost" size="sm" onClick={reset} isDisabled={busy}>Discard upload</Button>}
      </div>
    </form>
    {(isUploading || isProcessing) && <div className="music-import-progress">
      <p role="status">{isProcessing ? `Importing ${job.name}` : `Uploading ${job.name}`} · {percent}%</p>
      <Progress value={percent} size="sm" colorScheme="teal" aria-label="Music import progress" />
    </div>}
    {job?.stage === "finished" && <div className="music-import-progress" role="status">
      <p>{job.result.imported} added · {job.result.failed} failed</p>
      {job.result.errors.length > 0 && <ul>{job.result.errors.map(({ title, message }, index) =>
        <li key={index}><strong>{title}</strong> · {message}</li>)}</ul>}
    </div>}
    {(error || job?.error) && <p role="alert" className="ephemeral-error">{error || job.error}</p>}
  </section>;
}
