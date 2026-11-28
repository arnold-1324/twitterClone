import { useState } from "react";
import { Button, Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay } from "@chakra-ui/react";
import { apiFetch, readApiJson } from "../lib/apiFetch";
import { contentLink } from "../lib/contentLinks";
import PeopleSearch from "./PeopleSearch";
import ReshareActions from "./ReshareActions";

export default function StoryShareDialog({ source, viewer, onClose }) {
  const [recipient, setRecipient] = useState(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState(null);

  async function send() {
    if (!recipient || pending) return;
    setPending(true);
    setStatus(null);
    try {
      const response = await apiFetch("/api/messages/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharedStoryId: source.id, recipientId: recipient._id }),
      });
      if (!response.ok) throw new Error((await readApiJson(response)).error || "Could not send the story.");
      setStatus({ text: `Sent to @${recipient.username}.` });
      setRecipient(null);
    } catch (error) {
      setStatus({ text: error.message, error: true });
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(contentLink(source), location.origin).href);
      setStatus({ text: "Story link copied." });
      void apiFetch(`/api/stories/${source.id}/link-share`, { method: "POST" }).catch(() => {});
    } catch {
      setStatus({ text: "Could not copy the story link.", error: true });
    }
  }

  return <Modal isOpen isCentered onClose={onClose} scrollBehavior="inside">
    <ModalOverlay />
    <ModalContent className="ephemeral-dialog" mx={3} maxH="88dvh">
      <ModalHeader>Share story</ModalHeader>
      <ModalCloseButton />
      <ModalBody className="story-share-dialog">
        <PeopleSearch label="Find someone to send this story to" exclude={[viewer]} onSelect={setRecipient} />
        {recipient && <Button size="sm" isLoading={pending} onClick={send}>Send to @{recipient.username}</Button>}
        <ReshareActions source={source} onNavigate={onClose} />
        <Button size="sm" variant="ghost" onClick={copy}>Copy story link</Button>
        {status && <p role={status.error ? "alert" : "status"}>{status.text}</p>}
      </ModalBody>
    </ModalContent>
  </Modal>;
}
