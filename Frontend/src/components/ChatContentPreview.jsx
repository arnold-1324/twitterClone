import { useEffect, useState } from "react";
import { Avatar } from "@chakra-ui/react";
import { FiClock, FiFileText, FiFilm, FiImage, FiMusic, FiPlay } from "react-icons/fi";
import { Link } from "react-router-dom";
import { contentLink } from "../lib/contentLinks";
import { noteTrackId, useMusicTrack } from "../lib/music";
import NoteMusicLabel from "./NoteMusicLabel";
import ReshareActions from "./ReshareActions";
import StoryLayers from "./StoryLayers";

function useUnexpired(expiresAt) {
  const timestamp = Date.parse(expiresAt);
  const [, update] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) return;
    const timer = setTimeout(() => update((tick) => tick + 1), timestamp - Date.now() + 5);
    const refresh = () => update((tick) => tick + 1);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [timestamp]);
  return !Number.isFinite(timestamp) || timestamp > Date.now();
}

function Unavailable({ label }) {
  return <div className="chat-preview-unavailable"><FiClock aria-hidden="true" /><span>{label} unavailable</span></div>;
}

function TrackCue({ id }) {
  const track = useMusicTrack(id);
  return track && <p><FiMusic aria-hidden="true" /> {track.title}</p>;
}

function MediaCard({ label, source, author, media, caption, unavailable, fromChat, composition, music }) {
  const video = media?.type === "video";
  const target = contentLink(source);
  const Icon = label === "Reel" ? FiFilm : label === "Story" ? FiImage : FiFileText;
  return <article className={`chat-reference-card chat-reference-${label.toLowerCase()}`} aria-label={`${label} preview`}>
    <Link to={target} state={fromChat ? { from: "/chat" } : undefined} className="chat-reference-open" aria-label={`View ${label.toLowerCase()} by ${source.username}`}>
      <div className="chat-reference-header">
        <Avatar size="xs" name={source.username} src={author?.profileImg} />
        <strong>@{source.username}</strong>
        <span><Icon aria-hidden="true" />{label}</span>
      </div>
      {(media?.url || composition?.layers?.length > 0) && <div className="chat-reference-media" data-video={video || undefined}
        style={composition ? { background: composition.background } : undefined}>
        {media?.url && (video ? <>
          <video src={media.url} muted playsInline preload="metadata" aria-label={`${label} video preview`} />
          <span className="chat-reference-play"><FiPlay aria-hidden="true" /></span>
        </> : <img src={media.url} loading="lazy" alt={`${label} from ${source.username}`} />)}
        <StoryLayers composition={composition} />
      </div>}
      {caption && <p>{caption}</p>}
      {music?.id && <TrackCue id={music.id} />}
      {unavailable && <p>Original story unavailable</p>}
    </Link>
    {!unavailable && <ReshareActions source={{ ...source, kind: label.toLowerCase(), video }} />}
  </article>;
}

export default function ChatContentPreview({ message }) {
  const { storyReference, storyPreview, noteReply, notePreview, postReference: post } = message;
  const stillActive = useUnexpired(storyPreview?.expiresAt ?? notePreview?.expiresAt ?? post?.sharedContent?.expiresAt);
  if (storyReference?.id) {
    if (!storyPreview || !stillActive) return <Unavailable label="Story" />;
    return <MediaCard label="Story" source={{ id: storyPreview.id, type: "story", username: storyPreview.username }}
      author={storyPreview} media={storyPreview.media} caption={storyPreview.caption} composition={storyPreview.composition}
      music={storyPreview.music} fromChat />;
  }
  if (noteReply) {
    if (!notePreview || !stillActive) return <Unavailable label="Note" />;
    const music = noteTrackId(notePreview);
    return <Link to={`/${encodeURIComponent(notePreview.username)}`} className="chat-note-preview"
      aria-label={`View note by ${notePreview.username}`}>
      <small>Replied to @{notePreview.username}’s note</small>
      <span className="note-bubble" data-note-theme={notePreview.theme}>
        {music && <FiMusic aria-hidden="true" />}<NoteMusicLabel note={notePreview} />
      </span>
    </Link>;
  }
  if (!post?.postedBy?.username) return <Unavailable label="Post" />;
  const unavailable = Boolean(post.sharedContent?.unavailable || !stillActive);
  const media = unavailable ? null : post.media?.[0] ?? (post.images ? { type: "image", url: post.images } : null);
  return <MediaCard label={post.kind === "reel" ? "Reel" : "Post"}
    source={{ id: post._id, type: "post", username: post.postedBy.username }}
    author={post.postedBy} media={media} caption={post.caption} music={post.music} unavailable={unavailable} />;
}
