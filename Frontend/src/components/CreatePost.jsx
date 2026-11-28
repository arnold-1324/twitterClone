import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import { AddIcon } from "@chakra-ui/icons";
import {
    Button,
    CloseButton,
    Flex,
    FormControl,
    Image,
    IconButton,
    Input,
    Modal,
    ModalCloseButton,
    ModalContent,
    ModalHeader,
    ModalOverlay,
    Text,
    Textarea,
    useColorModeValue,
    useDisclosure,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { BsFillImageFill } from "react-icons/bs";
import { useAppState, useAppValue } from "../state/store";
import userAtom from "../atom/userAtom";
import useShowToast from "../hooks/useShowToast";
import postsAtom from "../atom/postsAtom";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import ContentTags from "./ContentTags";
import MusicSettings from "./MusicSettings";
import useComposerDraft from "../hooks/useComposerDraft";
import { musicPayload } from "../lib/music";

const emptyDraft = { files: [], postText: "", tags: [], music: null };
const hasContent = ({ files, postText, tags, music }) => Boolean(files.length || postText || tags.length || music);

const MAX_CHAR = 280;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const CreatePost = ({ inline = false, page = false, onCreated }) => {
    const [previews, setPreviews] = useState([]);
    const { isOpen, onOpen, onClose } = useDisclosure();
    const fileRef = useRef(null);
    const user = useAppValue(userAtom);
    const showToast = useShowToast();
    const [loading, setLoading] = useState(false);
    const [, setPosts] = useAppState(postsAtom);
    const { pathname, search, state } = useLocation();
    const source = page ? state?.source : null;
    const [kind, setKind] = useState(() => new URLSearchParams(search).get("type") === "reel" ? "reel" : "post");
    const draft = useComposerDraft(user?._id, kind, source, emptyDraft, hasContent);
    const { files, postText, tags, music } = draft.value;
    const setFiles = (value) => draft.set("files", value);
    const reel = kind === "reel";
    const canPublish = source || files.length || (!reel && (postText.trim() || music));

    useEffect(() => {
        const urls = files.map((file) => URL.createObjectURL(file));
        setPreviews(urls);
        return () => urls.forEach((url) => URL.revokeObjectURL(url));
    }, [files]);
    const navigate = useNavigate();
    const panelColor = useColorModeValue("white", "gray.800");
    const profile = matchPath("/:username", pathname);

    function handleMediaChange(event) {
        const added = Array.from(event.target.files);
        event.target.value = "";
        if (!added.length) return;
        const allowed = reel ? ["video/mp4", "video/webm"] : ["image/jpeg", "image/png", "image/gif", "image/webp"];
        const max = reel ? 20 * 1024 * 1024 : MAX_IMAGE_BYTES;
        if (added.some((file) => !allowed.includes(file.type) || file.size > max) || (!reel && files.length + added.length > 6)) {
            showToast("Invalid media", reel ? "Choose one MP4 or WebM up to 20 MB." : "Choose up to six JPEG, PNG, GIF or WebP photos up to 4 MB each.", "error");
            return;
        }
        setFiles((current) => reel ? added.slice(0, 1) : [...current, ...added].slice(0, 6));
    }

    function changeKind(event) {
        setKind(event.target.value);
    }

    const handleCreatePost = async (e) => {
        e.preventDefault();
        if (loading || !draft.ready || !canPublish) return;
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append("caption", postText);
            if (source) formData.append("source", `${source.type}:${source.id}`);
            if (tags.length) formData.append("tags", tags.map(({ _id }) => _id).join(","));
            if (music) formData.append("music", JSON.stringify(musicPayload(music)));
            files.forEach((file) => formData.append(reel ? "video" : "media", file));

            const res = await apiFetch(reel ? "/api/posts/reels" : "/api/posts/create", {
                method: "POST",
                body: formData,
            });

            const data = await readApiJson(res);
            if (!res.ok) {
                showToast("Error", data.error || "Could not publish your post.", "error");
                return;
            }
            showToast("Success", "Post created successfully", "success");
            if (!reel && (pathname === "/" || profile?.params.username === user.username)) {
                setPosts((current) => [{ ...data, postedBy: user }, ...current]);
            }
            onCreated?.();
            draft.clear();
            if (page || reel) navigate(reel ? "/reels" : "/");
            else onClose();
        } catch (error) {
            showToast("Error creating post", "Please try again.", "error");
        } finally {
            setLoading(false);
        }
    };

    const composer = !draft.ready ? <p role="status">Loading draft…</p> : (
        <form className="post-form" onSubmit={handleCreatePost}>
            <label className="post-kind">
                <span>Publish as</span>
                <select value={kind} onChange={changeKind} disabled={loading}>
                    <option value="post">Post</option><option value="reel" disabled={source && !source.video}>Reel</option>
                </select>
            </label>
            {source && <p className="reshare-credit">Sharing @{source.username}’s {source.kind}</p>}
            <FormControl>
                <Textarea placeholder="What would you like to share? Add #topics to help people find it." aria-label="Post caption"
                    maxLength={MAX_CHAR} onChange={(event) => draft.set("postText", event.target.value)}
                    value={postText} rows={page ? 6 : 4} />
                <Text fontSize="xs" textAlign="right" mt={2}>{postText.length}/{MAX_CHAR}</Text>
                <Input type="file" multiple={!reel} accept={reel ? "video/mp4,video/webm" : "image/jpeg,image/png,image/gif,image/webp"}
                    hidden ref={fileRef} onChange={handleMediaChange} />
                {!source && <Button type="button" variant="ghost" leftIcon={<BsFillImageFill />}
                    onClick={() => fileRef.current.click()}>{reel ? "Attach video" : "Add photos"}</Button>}
            </FormControl>
            {previews.length > 0 && <div className="composer-media">
                {previews.map((url, index) => <div key={url}>
                    {reel ? <video src={url} controls playsInline preload="metadata" />
                        : <Image src={url} alt={`Selected photo ${index + 1}`} />}
                    <CloseButton type="button" aria-label={`Remove attachment ${index + 1}`}
                        onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} />
                </div>)}
            </div>}
            <ContentTags tags={tags} onChange={(value) => draft.set("tags", value)} viewer={user?._id} disabled={loading} />
            <MusicSettings music={music} onChange={(value) => draft.set("music", value)} />
            {draft.error && <p role="alert" className="ephemeral-error">{draft.error}</p>}
            {draft.hasDraft && <div className="composer-draft-row">
                <small>{draft.error ? "Draft is open in this editor." : "Draft saved on this device for 7 days after the last edit."}</small>
                <Button type="button" size="sm" variant="ghost" onClick={draft.clear} isDisabled={loading}>Discard draft</Button>
            </div>}
            <Flex mt={5} gap={2} justify="flex-end">
                <Button type="button" onClick={page ? () => navigate("/") : onClose} variant="ghost">Cancel</Button>
                <Button type="submit" className="dayline-primary" isDisabled={!canPublish} isLoading={loading}>
                    {reel ? "Publish reel" : "Post"}
                </Button>
            </Flex>
        </form>
    );

    if (page) {
        return <main className="dayline-tool-page"><h1>Create a post</h1><div className="social-panel">{composer}</div></main>;
    }
    return (
        <>
            {inline ? (
                <Button className="feed-compose-button" onClick={onOpen} leftIcon={<AddIcon />}>Create post</Button>
            ) : (
                <IconButton className="feed-compose-button floating-compose" aria-label="Create post"
                    onClick={onOpen} icon={<AddIcon />} />
            )}
            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalOverlay />
                <ModalContent bg={panelColor}>
                    <ModalHeader>Create a post</ModalHeader>
                    <ModalCloseButton />
                    {composer}
                </ModalContent>
            </Modal>
        </>
    );
};

export default CreatePost;
