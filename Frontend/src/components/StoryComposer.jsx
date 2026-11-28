import { useEffect, useRef, useState } from "react";
import { Button, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay } from "@chakra-ui/react";
import { FiUpload } from "react-icons/fi";
import { apiFetch, readApiJson } from "../lib/apiFetch";
import ContentTags from "./ContentTags";
import StoryEditor from "./StoryEditor";
import useComposerDraft from "../hooks/useComposerDraft";
import { musicPayload } from "../lib/music";

const emptyDraft = { file: null, caption: "", composition: { background: "#152236", layers: [] }, music: null, tags: [] };
const hasContent = ({ file, caption, composition, music, tags }) => Boolean(
  file || caption || composition.layers.length || composition.background !== emptyDraft.composition.background || music || tags.length,
);

export default function StoryComposer({ user, source, onClose, onPublished }) {
  const draft = useComposerDraft(user?._id, "story", source, emptyDraft, hasContent);
  const { file, caption, composition, music, tags } = draft.value;
  const [preview, setPreview] = useState(null);
  const attachment = preview?.file === file ? preview : null;
  const layers = composition.layers.filter(({ text }) => text.trim());
  const canPublish = file || source || layers.length || music;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const input = useRef(null);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview({ file, url, video: file.type.startsWith("video/") });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function select(event) {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm"].includes(file.type)
      || file.size > 25 * 1024 * 1024) {
      setError("Choose a supported photo or video up to 25 MB.");
      return;
    }
    draft.set("file", file);
    setError("");
  }

  async function publish(event) {
    event.preventDefault();
    if (!draft.ready || !canPublish || saving) return;
    setSaving(true);
    setError("");
    try {
      const payload = new FormData();
      if (file) payload.append("media", file);
      if (source) payload.append("source", `${source.type}:${source.id}`);
      if (tags.length) payload.append("tags", tags.map(({ _id }) => _id).join(","));
      payload.append("caption", caption);
      payload.append("composition", JSON.stringify({ ...composition, layers }));
      if (music) payload.append("music", JSON.stringify(musicPayload(music)));
      const response = await apiFetch("/api/stories", { method: "POST", body: payload });
      const data = await readApiJson(response);
      if (!response.ok) throw new Error(data.error || "Could not publish your story.");
      draft.clear();
      onPublished(data);
      onClose();
    } catch (error) {
      setError(error.message);
      setSaving(false);
    }
  }

  return <Modal isOpen isCentered size="3xl" onClose={onClose} closeOnEsc={!saving} closeOnOverlayClick={!saving}>
    <ModalOverlay />
    <ModalContent className="ephemeral-dialog story-editor-dialog" mx={3} maxH="92dvh" overflowY="auto">
      <form onSubmit={publish}>
        <ModalHeader>Add to your story</ModalHeader>
        <ModalCloseButton isDisabled={saving} />
        {draft.ready ? <ModalBody className="story-compose-body">
          <input hidden ref={input} aria-label="Story photo or video" type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm" onChange={select} />
          <StoryEditor attachment={attachment} source={source} composition={composition} music={music}
            onComposition={(value) => draft.set("composition", value)} onMusic={(value) => draft.set("music", value)} chooseMedia={() => input.current?.click()} />
          <label className="ephemeral-field">Caption <input value={caption} maxLength={220} onChange={(event) => draft.set("caption", event.target.value)} /></label>
          <ContentTags tags={tags} onChange={(value) => draft.set("tags", value)} viewer={user?._id} disabled={saving} />
          <small>{source?.type === "story" ? "Available while the original story is active." : "Visible for 24 hours. Videos can be up to 60 seconds."}</small>
          {error && <p role="alert" className="ephemeral-error">{error}</p>}
          {draft.error && <p role="alert" className="ephemeral-error">{draft.error}</p>}
          {draft.hasDraft && <div className="composer-draft-row">
            <small>{draft.error ? "Draft is open in this editor." : "Draft saved on this device for 7 days after the last edit."}</small>
            <Button type="button" variant="ghost" size="sm" onClick={draft.clear} isDisabled={saving}>Discard draft</Button>
          </div>}
        </ModalBody> : <ModalBody><p role="status">Loading draft…</p></ModalBody>}
        <ModalFooter><Button type="submit" leftIcon={<FiUpload />} colorScheme="teal" isDisabled={!draft.ready || !canPublish} isLoading={saving}>Publish story</Button></ModalFooter>
      </form>
    </ModalContent>
  </Modal>;
}
