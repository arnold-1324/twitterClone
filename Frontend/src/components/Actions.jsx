import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import {
    Box,
    Button,
    Flex,
    FormControl,
    Input,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    Text,
    useDisclosure,
    IconButton,
    Spinner,
    Stack,
    Checkbox,
    Avatar,
    Textarea,
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import userAtom from "../atom/userAtom";
import useShowToast from "../hooks/useShowToast";
import savedPostsAtom from "../atom/savedPostsAtom";
import postsAtom from "../atom/postsAtom";
import { LuSend } from "react-icons/lu";
import { FiBookmark, FiHeart, FiLink, FiMessageCircle } from "react-icons/fi";

const Actions = ({ post }) => {
    const user = useRecoilValue(userAtom);
    const [liked, setLiked] = useState(() => post.likes.some((like) => (like?._id ?? like) === user?._id));
    const [, setPosts] = useRecoilState(postsAtom);
    const [savedIds, setSavedIds] = useRecoilState(savedPostsAtom);
    const [saving, setSaving] = useState(false);
    const saved = savedIds?.includes(post._id) ?? false;
    const [isLiking, setIsLiking] = useState(false);
    const [isReplying, setIsReplying] = useState(false);
    const [reply, setReply] = useState("");
    const [shareQuery, setShareQuery] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [conversations, setConversations] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [text, setText] = useState("");
    const [loadingConversations, setLoadingConversations] = useState(false);
    const [conversationError, setConversationError] = useState("");
    const [isSharing, setIsSharing] = useState(false);

    const showToast = useShowToast();
    const { isOpen, onOpen, onClose } = useDisclosure();

    useEffect(() => {
        if (!showModal || !user?._id) return;
        const request = new AbortController();
        const getConversations = async () => {
            setLoadingConversations(true);
            setConversationError("");
            try {
                const response = await apiFetch("/api/messages/getConvo/user", { signal: request.signal });
                if (!response.ok) throw new Error("Could not load conversations. Reopen the share menu to try again.");
                const data = await readApiJson(response);
                if (!request.signal.aborted) setConversations(data);
            } catch (error) {
                if (!request.signal.aborted) setConversationError(error.message);
            } finally {
                if (!request.signal.aborted) setLoadingConversations(false);
            }
        };
        getConversations();
        return () => request.abort();
    }, [showModal, user?._id]);

    useEffect(() => {

        if (user && post.likes) {
          setLiked(post.likes.some((like) => (like?._id ?? like) === user._id));
        }
      }, [user, post.likes]);

      const handleLikeAndUnlike = async () => {
        if (!user) return showToast("Error", "You must be logged in to like a post", "error");
        if (isLiking) return;

        setIsLiking(true);

        const updatedPost = {
          ...post,
          likes: liked
            ? post.likes.filter((like) => (like?._id ?? like) !== user._id)
            : [
                ...post.likes,
                {
                  _id: user._id,
                  username: user.username,
                  profileImg: user.profileImg,
                },
              ],
        };


        setPosts((prevPosts) =>
          prevPosts.map((p) => (p._id === post._id ? updatedPost : p))
        );


        setLiked((prevLiked) => !prevLiked);

        try {
          const res = await apiFetch("/api/posts/like/" + post._id, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ liked: !liked }),
          });
          const data = await readApiJson(res);
          if (!res.ok) throw new Error(data.error || "Could not update like");
        } catch (error) {
          showToast("Error", error.message, "error");
          setLiked(liked);
          setPosts((prevPosts) =>
            prevPosts.map((p) => (p._id === post._id ? post : p))
          );
        } finally {
          setIsLiking(false);
        }
      };


    const handleReply = async () => {
        if (!user) return showToast("Error", "You must be logged in to reply to a post", "error");
        if (isReplying) return;
        setIsReplying(true);
        try {
            const res = await apiFetch("/api/posts/reply/" + post._id, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ comment: reply }),
            });
            const data = await readApiJson(res);
            if (!res.ok) throw new Error(data.error || data.message || "Could not post reply");
            setPosts((items) => items.map((item) => item._id === post._id
                ? { ...item, replies: [...item.replies, data] } : item));
            showToast("Success", "Reply posted successfully", "success");
            onClose();
            setReply("");
        } catch (error) {
            showToast("Error", error.message, "error");
        } finally {
            setIsReplying(false);
        }
    };

    const handleUserSelect = (convoId) => {
        setSelectedUsers((prev) =>
            prev.includes(convoId)
                ? prev.filter((id) => id !== convoId)
                : [...prev, convoId]
        );
    };

    function closeShare() {
        if (isSharing) return;
        setShowModal(false);
        setSelectedUsers([]);
        setText("");
    }

    async function copyPostLink() {
        try {
            const path = `/${encodeURIComponent(post.postedBy?.username || "post")}/post/${post._id}`;
            await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
            showToast("Link copied", "The post link is ready to share.", "success");
        } catch {
            showToast("Could not copy link", "Open the post to copy its address.", "error");
        }
    }

    async function handleShare() {
        if (!user || !selectedUsers.length || isSharing) return;
        setIsSharing(true);
        try {
            const results = await Promise.allSettled(selectedUsers.map(async (conversationId) => {
                const response = await apiFetch("/api/posts/sharepost", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ postId: post._id, conversationId, text }),
                });
                if (!response.ok) throw new Error("The message could not be sent.");
            }));
            const failed = selectedUsers.filter((_, index) => results[index].status === "rejected");
            const sent = selectedUsers.length - failed.length;
            if (sent) {
                setPosts((items) => items.map((item) => item._id === post._id
                    ? { ...item, shareCount: (item.shareCount || 0) + sent } : item));
            }
            if (failed.length) {
                setSelectedUsers(failed);
                showToast("Some messages could not be sent", "Try again for the conversations still selected.", "error");
            } else {
                showToast("Post shared", "Your message was sent.", "success");
                closeShare();
            }
        } finally {
            setIsSharing(false);
        }
    }

    async function toggleSaved() {
        if (!user || saving || savedIds === null) return;
        setSaving(true);
        try {
            const response = await apiFetch(`/api/posts/${post._id}/save`, {
                method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ saved: !saved }),
            });
            const result = await readApiJson(response);
            if (!response.ok) throw new Error(result.error);
            setSavedIds((ids) => result.saved ? [...new Set([...(ids ?? []), post._id])] : (ids ?? []).filter((id) => id !== post._id));
        } catch (error) {
            showToast("Could not update saved posts", error.message, "error");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Flex direction="column">
            <Flex gap={1}>
                <IconButton size="sm" variant="ghost" aria-label={liked ? "Unlike" : "Like"}
                    aria-pressed={liked} isDisabled={isLiking} onClick={handleLikeAndUnlike}
                    color={liked ? "var(--dayline-accent)" : undefined}
                    icon={<FiHeart fill={liked ? "currentColor" : "none"} />} />
                <IconButton size="sm" variant="ghost" aria-label="Comment" onClick={onOpen} icon={<FiMessageCircle />} />
                <IconButton size="sm" variant="ghost" aria-label="Share post" onClick={() => { setShareQuery(""); setShowModal(true); }} icon={<LuSend />} />
                {user && <IconButton size="sm" variant="ghost" aria-label={saved ? "Remove from saved" : "Save post"}
                    aria-pressed={saved} isDisabled={saving || savedIds === null} onClick={toggleSaved}
                    icon={<FiBookmark fill={saved ? "currentColor" : "none"} />} />}
            </Flex>

            <Flex gap={2} alignItems={"center"}>
                <Text color="var(--dayline-dim)" fontSize="sm">
                    {post.likes.length} {post.likes.length === 1 ? "like" : "likes"}
                </Text>
                <Box w={0.5} h={0.5} borderRadius={"full"} bg={"gray.light"}></Box>
                <Text color="var(--dayline-dim)" fontSize="sm">
                    {post.replies.length} {post.replies.length === 1 ? "reply" : "replies"}
                </Text>
                <Text color="var(--dayline-dim)" fontSize="sm">
                    {post.shareCount || 0} {post.shareCount === 1 ? "share" : "shares"}
                </Text>
            </Flex>

            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Reply to post</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody pb={6}>
                        <FormControl>
                            <Input
                                aria-label='Reply text' placeholder='Write a reply…'
                                value={reply}
                                onChange={(e) => setReply(e.target.value)}
                            />
                        </FormControl>
                    </ModalBody>

                    <ModalFooter>
                        <Button className="dayline-primary" size="sm" isLoading={isReplying} isDisabled={!reply.trim()} onClick={handleReply}>
                            Reply
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            <Modal isOpen={showModal} onClose={closeShare}>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Share post</ModalHeader>
                    <ModalCloseButton isDisabled={isSharing} />
                    <ModalBody>
                        {!user ? <Text>Sign in to send this post to a conversation.</Text> : conversationError
                            ? <Text role="alert">{conversationError}</Text> : loadingConversations ? (
                            <Box textAlign="center" py={4}>
                                <Spinner size="lg" />
                                <Text mt={2}>Loading conversations...</Text>
                            </Box>
                        ) : (
                            <Stack>
                                <Input aria-label="Filter conversations" placeholder="Find a conversation" value={shareQuery}
                                  onChange={(event) => setShareQuery(event.target.value)} />
                                <div className="share-destinations">
                                    {conversations.map((chat) => {
                                        const person = chat.participants?.find((member) => member._id !== user?._id);
                                        return { id: chat._id, title: chat.isGroup ? chat.groupInfo?.name : person?.username,
                                            image: chat.isGroup ? chat.groupInfo?.profileImage : person?.profileImg };
                                    }).filter(({ title }) => title?.toLowerCase().includes(shareQuery.trim().toLowerCase()))
                                        .map(({ id, title, image }) => (
                                            <Checkbox key={id} isChecked={selectedUsers.includes(id)} isDisabled={isSharing} onChange={() => handleUserSelect(id)}>
                                                <span className="share-destination"><Avatar name={title} src={image} size="sm" />{title}</span>
                                            </Checkbox>
                                        ))}
                                    {!conversations.length && <Text fontSize="sm">Start a conversation to share posts here.</Text>}
                                </div>
                            </Stack>
                        )}
                    </ModalBody>

                    {selectedUsers.length > 0 && (
                        <Box px={6} py={4}>
                            <Textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                aria-label="Add a message" placeholder="Add a message (optional)" isDisabled={isSharing} maxLength={4000}
                                size="sm"
                                resize="none"
                                borderRadius="md"
                                border="1px solid"
                                borderColor="gray.300"
                                mb={4}
                            />
                        </Box>
                    )}

                    <ModalFooter gap={3}>
                        <Button variant="outline" onClick={copyPostLink} leftIcon={<FiLink />}>Copy link</Button>
                        {user && <Button className="dayline-primary" onClick={handleShare} isLoading={isSharing}
                            isDisabled={!selectedUsers.length || loadingConversations || Boolean(conversationError)}>Send</Button>}
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </Flex>
    );
};

export default Actions;
