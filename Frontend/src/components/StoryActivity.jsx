import { useEffect, useState } from "react";
import { Avatar, Button, Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay, Spinner } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { apiFetch, readApiJson } from "../lib/apiFetch";

export default function StoryActivity({ id, onClose }) {
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await apiFetch(`/api/stories/${id}/activity?offset=${offset}`, { signal: request.signal });
        const page = await readApiJson(response);
        if (!response.ok) throw new Error(page.error || "Could not load activity.");
        if (request.signal.aborted) return;
        setData((old) => offset && old ? { ...page, viewers: [...old.viewers, ...page.viewers] } : page);
      } catch (error) {
        if (!request.signal.aborted) setError(error.message);
      } finally {
        if (!request.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => request.abort();
  }, [id, offset, retry]);

  return <Modal isOpen isCentered onClose={onClose} scrollBehavior="inside">
    <ModalOverlay />
    <ModalContent className="ephemeral-dialog" mx={3} maxH="min(80dvh, 620px)">
      <ModalHeader>Story activity</ModalHeader>
      <ModalCloseButton aria-label="Close story activity" />
      <ModalBody className="story-activity">
        {data && <>
          <p>{data.views} views · {data.likes + data.reactions} reactions · {data.replies} replies · {data.shares} shares</p>
          {data.viewers.length ? <ol aria-label="Story viewers, most recent first">
            {data.viewers.map(({ viewer, viewedAt, liked, reaction, replied, shared }) => <li key={viewer._id}>
              <Avatar size="sm" name={viewer.fullName || viewer.username} src={viewer.profileImg} />
              <span><Link to={`/${encodeURIComponent(viewer.username)}`}>@{viewer.username}</Link>
                {viewedAt && <small><time dateTime={viewedAt}>{new Date(viewedAt).toLocaleString()}</time></small>}</span>
              <small>{[liked && "♥", reaction, replied && `${replied} replies`, shared && `${shared} shares`].filter(Boolean).join(" · ")}</small>
            </li>)}
          </ol> : <p>No viewers yet.</p>}
          {data.next !== null && <Button size="sm" isDisabled={loading} onClick={() => setOffset(data.next)}>Load earlier activity</Button>}
        </>}
        {loading && <Spinner size="sm" label="Loading story activity" />}
        {error && <p role="alert">{error} <Button size="xs" onClick={() => setRetry((value) => value + 1)}>Retry</Button></p>}
      </ModalBody>
    </ModalContent>
  </Modal>;
}
