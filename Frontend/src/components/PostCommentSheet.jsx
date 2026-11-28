import { Avatar, Button } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { FiHeart, FiImage, FiSearch, FiSend, FiX } from "react-icons/fi";
import { Link } from "react-router-dom";
import { MessageSticker } from "./Stickers";
import StickerPicker from "./Stickers";
import { stickerLabel } from "../lib/stickers";
import EngagementSheet from "./EngagementSheet";

const emoji = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"];
const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function relativeTime(value) {
  if (!value) return "";
  const seconds = (Date.parse(value) - Date.now()) / 1000;
  if (!Number.isFinite(seconds)) return "";
  for (const [unit, size] of [["day", 86400], ["hour", 3600], ["minute", 60]]) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.trunc(seconds / size), unit);
  }
  return formatter.format(0, "second");
}

function CommentRow({ item, viewer, onReply, onLike, busy }) {
  const likes = item.likes ?? [];
  const liked = likes.includes(viewer?._id);
  return <article className="engagement-comment" aria-busy={item.pending || undefined}>
    <Avatar name={item.username} src={item.profileImg} size="sm" />
    <div className="engagement-comment-copy">
      <div className="engagement-comment-byline">
        <Link to={`/${encodeURIComponent(item.username)}`}><strong>{item.username}</strong></Link>
        {item.createdAt && <time dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time>}
      </div>
      <div>{stickerLabel(item.comment) ? <MessageSticker text={item.comment} /> : item.comment}</div>
      {item.mediaUrl && <img className="engagement-comment-image" src={item.mediaUrl} loading="lazy" alt="Photo attached to comment" />}
      {viewer && item._id && !item.pending && <button className="engagement-comment-reply" type="button" onClick={() => onReply(item)}>Reply</button>}
    </div>
    {viewer && item._id && !item.pending && <button className="engagement-comment-like" type="button"
      disabled={busy} aria-label={liked ? "Unlike comment" : "Like comment"} aria-pressed={liked} onClick={() => onLike(item)}>
      <FiHeart fill={liked ? "currentColor" : "none"} />{likes.length > 0 && <small>{likes.length}</small>}
    </button>}
  </article>;
}

export default function PostCommentSheet({ open, onClose, post, viewer, sending, onSend, onLike, reacting }) {
  const [draft, setDraft] = useState("");
  const [target, setTarget] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const input = useRef(null);
  const list = useRef(null);
  const fileInput = useRef(null);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const items = post.replies ?? [];
  const roots = [];
  const children = new Map();
  const known = new Set(items.map(({ _id }) => _id));
  for (const item of items) {
    if (item.parentId && known.has(item.parentId)) {
      const thread = children.get(item.parentId) ?? [];
      thread.push(item);
      children.set(item.parentId, thread);
    } else roots.push(item);
  }

  async function send(text) {
    if (sending || (!text.trim() && !file)) return;
    if (target) setExpanded((current) => ({ ...current, [target._id]: true }));
    if (await onSend(text, target?._id, file, preview)) {
      setDraft("");
      setTarget(null);
      setFile(null);
      if (!target && list.current) list.current.scrollTop = list.current.scrollHeight;
    }
  }

  function row(item, depth = 0) {
    const replies = children.get(item._id) ?? [];
    return <div key={item._id} className={depth ? "engagement-comment-thread" : undefined}>
      <CommentRow item={item} viewer={viewer} busy={reacting[item._id]} onLike={onLike}
        onReply={(reply) => { setTarget(reply); input.current?.focus(); }} />
      {!!replies.length && <button type="button" className="engagement-thread-toggle" aria-expanded={Boolean(expanded[item._id])}
        onClick={() => setExpanded((current) => ({ ...current, [item._id]: !current[item._id] }))}>
        {expanded[item._id] ? "Hide replies" : `View ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
      </button>}
      {expanded[item._id] && replies.map((reply) => row(reply, depth + 1))}
    </div>;
  }

  return <EngagementSheet open={open} onClose={onClose} title="Comments" kind="comments">
    {post.topics?.[0] && <Link className="engagement-context-topic"
      to={`/discover?topic=${encodeURIComponent(post.topics[0])}`} onClick={onClose}>
      <FiSearch aria-hidden="true" /> Explore #{post.topics[0]}
    </Link>}
    <div className="engagement-comments" ref={list} tabIndex={0} aria-label="Post comments">
      {roots.length ? roots.map((item, index) => item._id ? row(item) : <CommentRow key={index} item={item} viewer={viewer} />)
        : <div className="engagement-empty"><strong>No comments yet</strong><p>Start the conversation.</p></div>}
    </div>
    {viewer ? <form className="engagement-composer" onSubmit={(event) => { event.preventDefault(); void send(draft); }}>
      <div className="engagement-emoji" aria-label="Quick emoji">
        {emoji.map((symbol) => <button type="button" key={symbol} onClick={() => {
          setDraft((value) => (value + symbol).slice(0, 4000));
          input.current?.focus();
        }}>{symbol}</button>)}
      </div>
      {target && <div className="engagement-replying">
        Replying to @{target.username}
        <button type="button" aria-label="Cancel threaded reply" onClick={() => setTarget(null)}><FiX /></button>
      </div>}
      {preview && <div className="engagement-attachment-preview">
        <img src={preview} alt="Comment attachment preview" />
        <button type="button" aria-label="Remove attachment" disabled={sending} onClick={() => setFile(null)}><FiX /></button>
      </div>}
      <div className="engagement-composer-row">
        <Avatar name={viewer.username} src={viewer.profileImg} size="sm" />
        <input ref={input} aria-label="Reply text" placeholder={target ? "Write a reply…" : "Add a comment…"}
          maxLength={4000} value={draft} readOnly={sending} onChange={(event) => setDraft(event.target.value)} />
        <input hidden ref={fileInput} type="file" aria-label="Comment attachment" accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={(event) => { setFile(event.target.files[0] ?? null); event.target.value = ""; }} />
        <button className="engagement-attach" type="button" aria-label="Attach a photo or GIF" disabled={sending}
          onClick={() => fileInput.current?.click()}><FiImage /></button>
        <StickerPicker nested disabled={sending} onSelect={(text) => void send(text)} />
        <Button type="submit" size="sm" aria-label="Send comment" isLoading={sending} isDisabled={!(draft.trim() || file)}><FiSend /></Button>
      </div>
    </form> : <p className="engagement-signin"><Link to="/auth">Sign in to comment</Link></p>}
  </EngagementSheet>;
}
