import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import { Avatar, AvatarGroup, IconButton, Skeleton } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { FiTrash2 } from "react-icons/fi";
import { useAppValue, useSetAppValue } from "../state/store";
import PostMedia from "./PostMedia";
import Actions from "./Actions";
import CreatorFollow from "./CreatorFollow";
import PostCaption from "./PostCaption";
import userAtom from "../atom/userAtom";
import postsAtom from "../atom/postsAtom";
import useShowToast from "../hooks/useShowToast";
import { contentLink } from "../lib/contentLinks";

export default function Post({ post, postedBy, playWhenVisible = false, showPermalink = true, detailView = false, priorityMedia = false }) {
  const [legacyAuthor, setLegacyAuthor] = useState(null);
  const currentUser = useAppValue(userAtom);
  const setPosts = useSetAppValue(postsAtom);
  const showToast = useShowToast();
  const author = typeof postedBy === "object" ? postedBy : legacyAuthor;
  const createdAt = new Date(post.createdAt);
  const card = useRef(null);
  const viewerId = currentUser?._id;
  const authorId = author?._id;

  useEffect(() => {
    if (!card.current || !viewerId || !authorId || viewerId === authorId || !("IntersectionObserver" in window)) return;
    let timer;
    const observer = new IntersectionObserver(([entry]) => {
      clearTimeout(timer);
      if (entry.intersectionRatio < 0.45) return;
      timer = setTimeout(() => {
        if (document.visibilityState !== "visible") return;
        observer.disconnect();
        void apiFetch(`/api/posts/${post._id}/view`, { method: "PUT" }).catch(() => {});
      }, 1000);
    }, { threshold: [0, 0.45] });
    observer.observe(card.current);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [post._id, viewerId, authorId]);

  useEffect(() => {
    if (typeof postedBy !== "string") return;
    const request = new AbortController();
    setLegacyAuthor(null);
    apiFetch(`/api/users/profile/${encodeURIComponent(postedBy)}`, { signal: request.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load the post author.");
        return readApiJson(response);
      })
      .then(setLegacyAuthor)
      .catch(() => {
        if (!request.signal.aborted) setLegacyAuthor({ username: "Unavailable" });
      });
    return () => request.abort();
  }, [postedBy]);

  async function deletePost() {
    if (!window.confirm("Delete this post?")) return;
    try {
      const result = await apiFetch(`/api/posts/${post._id}`, { method: "DELETE" });
      if (!result.ok) throw new Error("Could not delete the post.");
      setPosts((items) => items.filter((item) => item._id !== post._id));
    } catch (error) {
      showToast("Error", error.message, "error");
    }
  }

  if (!author && postedBy) return <Skeleton height="140px" mb={4} borderRadius="xl" />;

  const profile = author?._id && `/${author.username}`;
  const postLink = profile && `${profile}/post/${post._id}`;
  return (
    <article ref={card} className="social-panel feed-post">
      <header>
        <Avatar as={profile ? Link : undefined} to={profile || undefined} size="sm"
          src={author?.profileImg} name={author?.fullName} aria-label={author?.username} />
        <div className="feed-byline">
          {profile ? <Link to={profile}>{author.fullName || author.username}</Link> : <strong>Unavailable account</strong>}
          {profile && <span>@{author.username}</span>}
        </div>
        {author?._id && <CreatorFollow creator={author} />}
        {currentUser && author?._id === currentUser._id && (
          <IconButton size="sm" variant="ghost" aria-label="Delete post" onClick={deletePost} icon={<FiTrash2 />} />
        )}
      </header>
      {post.sharedContent && <div className="reshare-credit">
        {post.sharedContent.unavailable ? "Original content is unavailable." : <>
          <Link to={contentLink(post.sharedContent)}>Shared from @{post.sharedContent.username}</Link>
          {post.sharedContent.caption && <p>{post.sharedContent.caption}</p>}
        </>}
      </div>}
      <PostMedia post={post} playWhenVisible={playWhenVisible} detailView={detailView} priorityMedia={priorityMedia || detailView} />
      <footer>
        <Actions post={author ? { ...post, postedBy: author } : post} />
        <PostCaption text={post.caption} name={author?.username} />
        {Number.isFinite(createdAt.getTime()) && <time className="stream-post-time" dateTime={createdAt.toISOString()}>
          {postLink ? <Link to={postLink}>{formatDistanceToNow(createdAt, { addSuffix: true })}</Link>
            : formatDistanceToNow(createdAt, { addSuffix: true })}
        </time>}
        {showPermalink && postLink && <Link className="feed-permalink" to={postLink}>View post</Link>}
        <AvatarGroup size="xs" max={4}>
          {(post.likes ?? []).filter((item) => typeof item === "object" && item).slice(-4).map((item) => (
            <Avatar key={item._id} src={item.profileImg} name={item.username} />
          ))}
        </AvatarGroup>
      </footer>
    </article>
  );
}
