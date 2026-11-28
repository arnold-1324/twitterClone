import { Avatar, Button, IconButton, Input, Menu, MenuButton, MenuItem, MenuList, Portal, Spinner, Textarea } from "@chakra-ui/react";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { FiBookmark, FiHeart, FiLink, FiMessageCircle, FiMoreHorizontal, FiRepeat, FiSearch, FiSend, FiShare2 } from "react-icons/fi";
import { Link } from "react-router-dom";
import { apiFetch, readApiJson } from "../lib/apiFetch";
import { useAppState, useAppValue } from "../state/store";
import postsAtom from "../atom/postsAtom";
import savedPostsAtom from "../atom/savedPostsAtom";
import userAtom from "../atom/userAtom";
import useShowToast from "../hooks/useShowToast";
import EngagementSheet from "./EngagementSheet";
import PostCommentSheet from "./PostCommentSheet";
import ReshareActions from "./ReshareActions";

const idOf = (value) => value?._id ?? value;

export default function Actions({ post, reel = false, likeActionRef, onOverlayChange }) {
  const user = useAppValue(userAtom);
  const [, setPosts] = useAppState(postsAtom);
  const [savedIds, setSavedIds] = useAppState(savedPostsAtom);
  const [sheet, setSheet] = useState(null);
  const [conversations, setConversations] = useState(null);
  const [conversationError, setConversationError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [busy, setBusy] = useState({});
  const inFlight = useRef(new Set());
  const toast = useShowToast();
  const likes = post.likes ?? [];
  const replies = post.replies ?? [];
  const reposts = post.repostedBy ?? [];
  const liked = likes.some((value) => idOf(value) === user?._id);
  const reposted = reposts.includes(user?._id);
  const saved = Boolean(savedIds?.includes(post._id));
  const path = `/${encodeURIComponent(post.postedBy?.username || "post")}/post/${post._id}`;
  const contentUrl = new URL(path, location.origin).href;
  const contentType = post.kind === "reel" ? "reel" : "post";

  useEffect(() => {
    if (sheet !== "share" || !user?._id) return;
    const request = new AbortController();
    setConversations(null);
    setConversationError("");
    apiFetch("/api/messages/getConvo/user", { signal: request.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Could not load conversations.");
      const data = await readApiJson(response);
      if (!request.signal.aborted) setConversations(data);
    }).catch((error) => {
      if (!request.signal.aborted) setConversationError(error.message);
    });
    return () => request.abort();
  }, [sheet, user?._id, retryCount]);

  function show(next) {
    setSheet(next);
    onOverlayChange?.(next);
  }

  function closeShare() {
    show(null);
    setQuery("");
    setSelected([]);
    setMessage("");
  }

  function changePost(update) {
    setPosts((items) => items.map((item) => item._id === post._id ? update(item) : item));
  }

  async function put(endpoint, body) {
    const response = await apiFetch(endpoint, {
      method: "PUT", ...(body instanceof FormData ? { body } : {
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }),
    });
    const data = await readApiJson(response);
    if (!response.ok) throw new Error(data.error || data.message || "Try again in a moment.");
    return data;
  }

  function reactTo(key, run, failure, rollback) {
    if (!user || inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setBusy((previous) => ({ ...previous, [key]: true }));
    void run().catch((error) => {
      rollback();
      toast(failure, error.message, "error");
    }).finally(() => {
      inFlight.current.delete(key);
      setBusy((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
    });
  }

  function withViewer(values = [], value) {
    const next = values.filter((item) => idOf(item) !== user._id);
    if (value !== undefined) next.push(value);
    return next;
  }

  function setLike(next) {
    if (!user) {
      toast("Sign in to like this", "Log in to use post actions.", "error");
      return;
    }
    if (next === liked) return;
    const previous = likes.find((item) => idOf(item) === user._id);
    const update = (value) => changePost((item) => ({ ...item, likes: withViewer(item.likes, value) }));
    reactTo("like", async () => {
      update(next ? { _id: user._id, username: user.username, profileImg: user.profileImg } : undefined);
      await put(`/api/posts/like/${post._id}`, { liked: next });
    }, "Could not update like", () => update(previous));
  }

  useImperativeHandle(likeActionRef, () => ({ like: () => setLike(true) }));

  function toggleRepost() {
    const update = (next) => changePost((item) => ({ ...item, repostedBy: withViewer(item.repostedBy, next ? user._id : undefined) }));
    reactTo("repost", async () => {
      update(!reposted);
      await put(`/api/posts/${post._id}/repost`, { reposted: !reposted });
    }, "Could not update repost", () => update(reposted));
  }

  function toggleSave() {
    if (!Array.isArray(savedIds)) return;
    const update = (next) => setSavedIds((ids) => {
      const values = (ids ?? []).filter((id) => id !== post._id);
      return next ? [...values, post._id] : values;
    });
    reactTo("save", async () => {
      update(!saved);
      const data = await put(`/api/posts/${post._id}/save`, { saved: !saved });
      update(data.saved);
    }, "Could not update saved posts", () => update(saved));
  }

  function toggleCommentLike(reply) {
    const wasLiked = reply.likes?.includes(user._id);
    const update = (next) => changePost((item) => ({ ...item, replies: item.replies.map((row) =>
      row._id === reply._id ? { ...row, likes: withViewer(row.likes, next ? user._id : undefined) } : row) }));
    reactTo(reply._id, async () => {
      update(!wasLiked);
      await put(`/api/posts/${post._id}/replies/${reply._id}/like`, { liked: !wasLiked });
    }, "Could not update comment reaction", () => update(wasLiked));
  }

  async function sendReply(text, parentId, file, preview) {
    if (!user || inFlight.current.has("reply")) return false;
    inFlight.current.add("reply");
    setIsReplying(true);
    const pending = { _id: `pending-${crypto.randomUUID()}`, username: user.username, profileImg: user.profileImg,
      comment: text.trim(), parentId, mediaUrl: preview, pending: true };
    changePost((item) => ({ ...item, replies: [...(item.replies ?? []), pending] }));
    function settleReply(result) {
      changePost((item) => {
        const remaining = (item.replies ?? []).filter(({ _id }) => _id !== pending._id && (!result || _id !== result._id));
        return { ...item, replies: result ? [...remaining, result] : remaining };
      });
    }
    try {
      let body = { comment: text, parentId };
      if (file) {
        body = new FormData();
        body.set("comment", text);
        if (parentId) body.set("parentId", parentId);
        body.set("media", file);
      }
      const reply = await put(`/api/posts/reply/${post._id}`, body);
      settleReply(reply);
      return true;
    } catch (error) {
      settleReply();
      toast("Could not send comment", error.message, "error");
      return false;
    } finally {
      setIsReplying(false);
      inFlight.current.delete("reply");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(contentUrl);
      toast("Link copied", undefined, "success");
    } catch {
      toast("Could not copy link", "Open the post to copy its address.", "error");
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ url: contentUrl });
    } catch (error) {
      if (error.name !== "AbortError") toast("Could not open sharing", "You can still copy the link.", "error");
    }
  }

  async function sendShare() {
    if (!user || !selected.length || inFlight.current.has("share")) return;
    inFlight.current.add("share");
    setIsSending(true);
    try {
      const results = await Promise.allSettled(selected.map(async (conversationId) => {
        const response = await apiFetch("/api/posts/sharepost", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: post._id, conversationId, text: message }),
        });
        if (!response.ok) throw new Error("Could not share.");
      }));
      const failed = selected.filter((_, index) => results[index].status === "rejected");
      const sent = selected.length - failed.length;
      if (sent) changePost((item) => ({ ...item, shareCount: (item.shareCount || 0) + sent }));
      if (failed.length) {
        setSelected(failed);
        toast(sent ? "Some messages were sent" : "Could not send", "Retry for the conversations still selected.", "error");
      } else {
        closeShare();
        toast("Sent", sent === 1 ? `Your ${contentType} was sent.` : `Sent to ${sent} conversations.`, "success");
      }
    } finally {
      inFlight.current.delete("share");
      setIsSending(false);
    }
  }

  const recipients = (conversations ?? []).map((chat) => {
    const person = chat.participants?.find((member) => member._id !== user?._id);
    return { id: chat._id, title: chat.isGroup ? chat.groupInfo?.name : person?.username,
      image: chat.isGroup ? chat.groupInfo?.profileImage : person?.profileImg };
  }).filter(({ title }) => title?.toLowerCase().includes(query.trim().toLowerCase()));

  function action(label, Icon, onClick, { pressed, count, disabled, className } = {}) {
    return <button type="button" className={`engagement-action ${className || ""}`} aria-label={label}
      aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      <Icon fill={pressed && Icon !== FiRepeat ? "currentColor" : "none"} aria-hidden="true" />
      {Boolean(count) && <small>{count}</small>}
    </button>;
  }

  return <div className={`engagement-actions${reel ? " engagement-actions-reel" : ""}`}>
    <div className="engagement-action-row">
      {action(liked ? "Unlike" : "Like", FiHeart, () => setLike(!liked), { pressed: liked, count: likes.length, disabled: busy.like })}
      {action("Comment", FiMessageCircle, () => show("comments"), { count: replies.length })}
      {user && action(reposted ? "Undo repost" : "Repost", FiRepeat, toggleRepost,
        { pressed: reposted, count: reposts.length, disabled: busy.repost })}
      {action(`Share ${contentType}`, FiSend, () => show("share"), { count: post.shareCount })}
      {user && action(saved ? "Remove from saved" : "Save post", FiBookmark, toggleSave,
        { pressed: saved, disabled: busy.save || savedIds === null, className: "engagement-save" })}
      {reel && <Menu>
        <MenuButton as={IconButton} size="sm" variant="unstyled" className="engagement-action"
          aria-label="More reel options" icon={<FiMoreHorizontal />} />
        <Portal><MenuList>
          <MenuItem as={Link} to={path}>Open reel details</MenuItem>
          <MenuItem onClick={copyLink}>Copy link</MenuItem>
          <MenuItem as={Link} to="/saved">Saved posts</MenuItem>
        </MenuList></Portal>
      </Menu>}
    </div>
    {!reel && likes.length > 0 && <p className="engagement-liked-by">
      {(likes.at(-1)?.username) ? <>Liked by <strong>{likes.at(-1).username}</strong>{likes.length > 1 && ` and ${likes.length - 1} more`}</>
        : `${likes.length} ${likes.length === 1 ? "like" : "likes"}`}
    </p>}
    {sheet === "comments" && <PostCommentSheet open onClose={() => show(null)} viewer={user}
      post={post} sending={isReplying}
      onSend={sendReply} onLike={toggleCommentLike} reacting={busy} />}
    {sheet === "share" && <EngagementSheet open onClose={() => { if (!inFlight.current.has("share")) closeShare(); }}
      title={`Share ${contentType}`} kind="share" busy={isSending}>
      {user ? <>
        <div className="engagement-recipient-search">
          <FiSearch aria-hidden="true" />
          <Input type="search" aria-label="Filter conversations" placeholder="Find a conversation"
            value={query} variant="unstyled" onChange={(event) => setQuery(event.target.value)} />
          <Link to="/chat" onClick={closeShare}>Inbox</Link>
        </div>
        <div className="engagement-recipients" aria-label="Recipients">
          {conversationError ? <div role="alert">{conversationError} <Button size="xs" onClick={() => setRetryCount((n) => n + 1)}>Retry</Button></div>
            : conversations === null ? <Spinner aria-label="Loading conversations" />
              : !recipients.length ? <p>{query ? "No conversations match your search." : "Start a conversation to share here."}</p>
                : <div className="engagement-recipient-grid">{recipients.map(({ id, title, image }) => <button type="button"
                  disabled={isSending} key={id} aria-pressed={selected.includes(id)} onClick={() => setSelected((ids) =>
                    ids.includes(id) ? ids.filter((key) => key !== id) : [...ids, id])}>
                  <Avatar name={title} src={image} size="md" aria-hidden="true" /><span>{title}</span>
                </button>)}</div>}
        </div>
      </> : <p className="engagement-signin">Sign in to send to a conversation.</p>}
      {selected.length ? <div className="engagement-share-compose">
        <Textarea aria-label="Add a message" placeholder="Add a message (optional)" maxLength={4000}
          isDisabled={isSending} value={message} onChange={(event) => setMessage(event.target.value)} rows={2} resize="none" />
        <Button className="engagement-send" isLoading={isSending} onClick={sendShare}>Send · {selected.length}</Button>
      </div> : <div className="engagement-shortcuts">
        <div>
          <Button size="sm" onClick={copyLink} leftIcon={<FiLink />}>Copy link</Button>
          {typeof navigator.share === "function" && <Button size="sm" onClick={nativeShare} leftIcon={<FiShare2 />}>Share</Button>}
          <Button as="a" href={`https://wa.me/?text=${encodeURIComponent(contentUrl)}`} target="_blank" rel="noreferrer" size="sm">WhatsApp</Button>
        </div>
        <ReshareActions source={{ id: post._id, type: "post", kind: post.kind || "post",
          username: post.postedBy?.username, video: post.media?.[0]?.type === "video" }} onNavigate={closeShare} />
      </div>}
    </EngagementSheet>}
  </div>;
}
