import StickerPicker from "../components/Stickers";
import { useEffect, useRef, useState } from "react";
import { Avatar, IconButton, Menu, MenuButton, MenuItem, MenuList, Modal, ModalContent, Spinner } from "@chakra-ui/react";
import { FiChevronLeft, FiChevronRight, FiEye, FiHeart, FiPause, FiPlay, FiSend, FiShare2, FiSmile, FiTrash2, FiVolume2, FiVolumeX, FiX } from "react-icons/fi";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiFetch, readApiJson } from "../lib/apiFetch";
import useEphemeralShelf from "../hooks/useEphemeralShelf";
import { ephemeralEntry, invalidateStories, loadEphemeral, markStorySeen, storyFeedPath, storyProfileData, storyProfilePath, updateEphemeral } from "../lib/ephemeralCache";
import { canPreloadMedia, preloadStoryMedia, preloadStoryProfile } from "../lib/storyPreload";
import useShowToast from "../hooks/useShowToast";
import AdaptiveVideo from "../components/AdaptiveVideo";
import StoryActivity from "../components/StoryActivity";
import StoryShareDialog from "../components/StoryShareDialog";
import { contentLink } from "../lib/contentLinks";
import StoryLayers from "../components/StoryLayers";
import MusicPlayer from "../components/MusicPlayer";

const duration = 6500;
const reactions = [["🔥", "Fire"], ["😍", "Love"], ["😂", "Laugh"], ["😮", "Surprised"], ["👏", "Applause"]];
const firstUnseen = (data, start) => start || !data ? 0 : Math.max(0, data.stories.findIndex(({ seen }) => !seen));

export default function StoryPage({ user }) {
  const { username } = useParams();
  const [query] = useSearchParams();
  const start = query.get("story");
  return <StoryPlayer key={`${username}:${start ?? ""}`} username={username} start={start} user={user} />;
}

function StoryPlayer({ username, start, user }) {
  const navigate = useNavigate();
  const { state } = useLocation();
  const toast = useShowToast();
  const { data: shelf, reload: reloadShelf } = useEphemeralShelf(storyFeedPath, user._id);
  const endpoint = storyProfilePath(username);
  const path = start ? `${endpoint}?start=${encodeURIComponent(start)}` : endpoint;
  const entry = ephemeralEntry(user._id, path);
  const [data, setData] = useState(() => storyProfileData(entry.freshUntil > Date.now() ? entry.snapshot.data : null));
  const [index, setIndex] = useState(() => firstUnseen(data, start));
  const started = useRef(Boolean(data));
  const viewedHere = useRef(new Set());
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [readyMedia, setReadyMedia] = useState(null);
  const [brokenImage, setBrokenImage] = useState(null);
  const [reply, setReply] = useState("");
  const [replyFocus, setReplyFocus] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [pending, setPending] = useState("");
  const [activityOpen, setActivityOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reacting, setReacting] = useState(false);
  const [sessionPeers, setSessionPeers] = useState(() => state?.peers ?? shelf);
  const photoElapsed = useRef(0);
  const media = useRef(null);
  const stepRef = useRef(null);
  const request = useRef(null);
  const story = data?.stories[index];
  const author = data?.author;
  const own = author?._id === user._id;
  const peers = (sessionPeers ?? []).filter(({ expiresAt }) => new Date(expiresAt).getTime() > Date.now());
  const peerIndex = peers.findIndex((entry) => entry.author.username === username);
  const previousAuthor = peerIndex > 0 ? peers[peerIndex - 1].author : null;
  const nextAuthor = peerIndex >= 0 ? peers[peerIndex + 1]?.author : null;
  const stopped = paused || replyFocus || stickerOpen || Boolean(pending) || activityOpen || shareOpen || reacting || musicOpen;
  const original = story?.sharedContent;
  const composition = story?.composition ?? original?.composition;
  const music = story?.music ?? original?.music;
  const slideDuration = music?.duration ? music.duration * 1000 : duration;
  const canvasOnly = story?.kind === "canvas";
  const video = story?.kind === "video" || original?.media?.[0]?.type === "video";
  const asset = original?.media?.[0] ?? story;

  useEffect(() => {
    if (shelf) setSessionPeers((current) => current ?? shelf);
  }, [shelf]);

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    loadEphemeral(entry, { force: Boolean(entry.snapshot.error) })
      .then((result) => {
        if (controller.signal.aborted || !result || started.current) return;
        const active = storyProfileData(result);
        started.current = true;
        setIndex(firstUnseen(active, start));
        setData(active);
      }).catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [entry, start]);

  const viewedId = story?._id;
  const wasUnseen = !story?.seen;
  useEffect(() => {
    if (!viewedId || readyMedia !== viewedId || own) return;
    let timer;
    function schedule() {
      clearTimeout(timer);
      if (document.visibilityState !== "visible") return;
      timer = setTimeout(() => {
        document.removeEventListener("visibilitychange", schedule);
        void apiFetch(`/api/stories/${viewedId}/view`, { method: "PUT" }).then((response) => {
          if (!response.ok) return;
          const firstLook = wasUnseen && !viewedHere.current.has(viewedId);
          viewedHere.current.add(viewedId);
          markStorySeen(user._id, username, viewedId, firstLook);
        }).catch(() => {});
      }, 300);
    }
    document.addEventListener("visibilitychange", schedule);
    schedule();
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [viewedId, readyMedia, own, wasUnseen, user._id, username]);

  useEffect(() => {
    if (data) preloadStoryMedia(user._id, data.stories[index + 1]);
  }, [data, index, user._id]);

  const nextUsername = nextAuthor?.username;
  useEffect(() => {
    if (nextUsername && canPreloadMedia()) void preloadStoryProfile(user._id, nextUsername);
  }, [nextUsername, user._id]);

  useEffect(() => {
    photoElapsed.current = 0;
    setProgress(0);
    setPaused(false);
    setReply("");
  }, [story?._id]);

  useEffect(() => {
    if (!story) return;
    const expires = setTimeout(() => {
      setData((value) => value && ({ ...value, stories: value.stories.filter(({ _id }) => _id !== story._id) }));
      setIndex((value) => Math.min(value, Math.max(0, data.stories.length - 2)));
    }, Math.max(0, new Date(story.expiresAt).getTime() - Date.now()));
    return () => clearTimeout(expires);
  }, [story, data?.stories.length]);

  useEffect(() => {
    if (!viewedId || video || readyMedia !== viewedId || stopped) return;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      photoElapsed.current += now - last;
      last = now;
      if (photoElapsed.current >= slideDuration) {
        clearInterval(timer);
        void stepRef.current(1);
      } else setProgress(photoElapsed.current / slideDuration);
    }, 45);
    return () => clearInterval(timer);
  }, [viewedId, video, stopped, readyMedia, slideDuration]);

  useEffect(() => {
    if (viewedId && (canvasOnly || original && !original.media?.length)) setReadyMedia(viewedId);
  }, [original, viewedId, canvasOnly]);

  useEffect(() => {
    const video = media.current?.querySelector("video");
    if (!video) return;
    if (stopped) video.pause();
    else if (video.readyState >= 2) void video.play().catch(() => setPaused(true));
  }, [story?._id, stopped]);

  useEffect(() => {
    function keys(event) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        void stepRef.current(event.key === "ArrowLeft" ? -1 : 1);
      }
    }
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, []);

  function close() {
    navigate(state?.from || (start ? `/${encodeURIComponent(username)}` : "/"), { replace: true });
  }

  function goTo(person) {
    navigate(`/stories/${encodeURIComponent(person.username)}`, { state: { ...state, peers }, replace: true });
  }

  async function step(direction) {
    if (!data || pending === "page") return;
    const destination = index + direction;
    if (destination >= 0 && destination < data.stories.length) {
      setIndex(destination);
      return;
    }
    if (direction < 0) {
      if (previousAuthor) goTo(previousAuthor);
      return;
    }
    if (!data.cursor) {
      if (nextAuthor) goTo(nextAuthor);
      else close();
      return;
    }
    setPending("page");
    try {
      const response = await apiFetch(`${endpoint}?after=${data.cursor}`, { signal: request.current.signal });
      const page = await readApiJson(response);
      if (!response.ok) throw new Error(page.error || "Could not load the next story.");
      if (!page.stories.length) {
        if (nextAuthor) goTo(nextAuthor);
        else close();
        return;
      }
      setData((current) => ({ ...current, stories: [...current.stories, ...page.stories], cursor: page.cursor }));
      setIndex(destination);
    } catch (failure) {
      if (!request.current.signal.aborted) {
        setPaused(true);
        toast("Stories", failure.message, "error");
      }
    } finally {
      if (!request.current.signal.aborted) setPending("");
    }
  }
  stepRef.current = step;

  async function action(name, work) {
    if (pending) return;
    setPending(name);
    try { await work(); }
    catch (failure) { toast("Story", failure.message, "error"); }
    finally { setPending(""); }
  }

  function like() {
    return action("like", async () => {
      const liked = !story.liked;
      const response = await apiFetch(`/api/stories/${story._id}/like`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ liked }),
      });
      if (!response.ok) throw new Error((await readApiJson(response)).error || "Could not update the like.");
      const withLike = (current) => current && ({
        ...current, stories: current.stories.map((item) => item._id === story._id ? { ...item, liked } : item),
      });
      updateEphemeral(entry, withLike);
      if (start) updateEphemeral(ephemeralEntry(user._id, endpoint), withLike);
      setData(withLike);
    });
  }

  function react(reaction) {
    return action("reaction", async () => {
      const response = await apiFetch(`/api/stories/${story._id}/reaction`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reaction }),
      });
      const result = await readApiJson(response);
      if (!response.ok) throw new Error(result.error || "Could not react to the story.");
      const reacted = (current) => current && ({
        ...current, stories: current.stories.map((item) => item._id === story._id ? { ...item, reaction } : item),
      });
      updateEphemeral(entry, reacted, { keepFresh: true });
      if (start) updateEphemeral(ephemeralEntry(user._id, endpoint), reacted, { keepFresh: true });
      setData(reacted);
    });
  }

  function sendReply(text) {
    if (!text.trim()) return;
    void action("reply", async () => {
      const response = await apiFetch("/api/messages/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: author._id, storyId: story._id, message: text }),
      });
      if (!response.ok) throw new Error((await readApiJson(response)).error || "Could not send the reply.");
      setReply("");
      toast("Reply sent", undefined, "success");
    });
  }

  function remove() {
    if (!window.confirm("Delete this story?")) return;
    void action("delete", async () => {
      const response = await apiFetch(`/api/stories/${story._id}`, { method: "DELETE" });
      if (!response.ok) throw new Error((await readApiJson(response)).error || "Could not delete the story.");
      invalidateStories(user._id, username);
      void reloadShelf();
      setData((value) => ({ ...value, stories: value.stories.filter((item) => item._id !== story._id) }));
      setIndex(Math.min(index, Math.max(0, data.stories.length - 2)));
    });
  }

  return <Modal isOpen onClose={close} size="full" motionPreset="none">
    <ModalContent className="story-viewer" bg="#101722" color="#f4f7fb" aria-label="Story viewer">
      <div className="story-view-top">
        <Link to="/" aria-label="Home"><img src="/dark-logo-192.png" alt="" width="32" height="32" /></Link>
        <IconButton variant="ghost" aria-label="Close stories" icon={<FiX />} onClick={close} />
      </div>
      {!story ? <div className="story-view-empty">
        {error || data ? <><p>{error || "This account has no active stories."}</p><button onClick={close}>Go back</button></>
          : <Spinner label="Loading story" />}
      </div> : <div className="story-view-shell">
        <div className="story-neighbor">{previousAuthor && <button onClick={() => goTo(previousAuthor)}>
          <Avatar name={previousAuthor.username} src={previousAuthor.profileImg} /><span>{previousAuthor.username}</span>
        </button>}</div>
        <div className="story-view-center">
          <article className="story-stage" ref={media} style={composition ? { background: composition.background } : undefined}>
            <div className="story-stage-media" key={story._id}>
              {video
                ? <AdaptiveVideo eager src={asset.url} streamUrl={asset.streamUrl} controls={false} muted={muted} autoPlay={!stopped}
                  onCanPlay={() => setReadyMedia(story._id)}
                  onEnded={() => step(1)} onTimeUpdate={(event) => {
                    const video = event.currentTarget;
                    if (video.duration > 0) setProgress(video.currentTime / video.duration);
                  }} aria-label="Story video" />
                : canvasOnly ? null
                : original && !original.media?.length ? <p className="story-shared-text">
                  {original.unavailable ? "Original content is unavailable." : original.caption || `Shared from @${original.username}`}
                </p> : brokenImage === story._id ? <p role="status">This photo could not load.</p>
                  : <img src={asset.url} loading="eager" fetchpriority="high" alt={story.caption || `Story by ${username}`}
                    onLoad={() => setReadyMedia(story._id)} onError={() => setBrokenImage(story._id)} />}
            </div>
            {original?.composition && original.composition !== composition && <StoryLayers composition={original.composition} />}
            <StoryLayers composition={composition} />
            {music && <MusicPlayer key={story._id} music={music} overlay autoPlay volumeAxis="vertical" active={!stopped && readyMedia === story._id} onOpenChange={setMusicOpen} />}
            {readyMedia !== story._id && brokenImage !== story._id && <div className="story-media-loading">
              <Spinner size="sm" label={video ? "Loading video" : "Loading photo"} />
            </div>}
            <div className="story-stage-header">
              <div className="story-progress" aria-label={`Story ${index + 1} of ${data.stories.length}`}>
                {data.stories.map((item, position) => <span key={item._id}>
                  <i style={{ width: `${(position < index ? 1 : position === index ? Math.min(1, progress) : 0) * 100}%` }} />
                </span>)}
              </div>
              <div className="story-view-author">
                <Link to={`/${encodeURIComponent(username)}`}><Avatar name={username} src={author.profileImg} size="sm" /><strong>{username}</strong></Link>
                <IconButton size="sm" variant="ghost" onClick={() => setPaused(!paused)} aria-label={paused ? "Play story" : "Pause story"}
                  icon={paused ? <FiPlay /> : <FiPause />} />
                {video && <IconButton size="sm" variant="ghost" onClick={() => setMuted(!muted)}
                  aria-label={muted ? "Unmute story" : "Mute story"} icon={muted ? <FiVolumeX /> : <FiVolume2 />} />}
                {own && <IconButton size="sm" variant="ghost" isDisabled={Boolean(pending)} onClick={remove}
                  aria-label="Delete story" icon={<FiTrash2 />} />}
              </div>
            </div>
            {(story.caption || original?.id) && <div className="story-caption">{story.caption}
              {original?.id && <Link to={contentLink(original)}>View @{original.username}’s {original.kind}</Link>}
            </div>}
            <button type="button" className="story-step story-step-back" disabled={!index && !previousAuthor} onClick={() => step(-1)} aria-label="Previous story"><FiChevronLeft /></button>
            <button type="button" className="story-step story-step-next" onClick={() => step(1)} aria-label="Next story"><FiChevronRight /></button>
          </article>
          <div className="story-view-actions">
            {!own && <form onSubmit={(event) => { event.preventDefault(); sendReply(reply); }}>
              <input aria-label="Reply to story" placeholder="Send a reply…" value={reply} maxLength={4000}
                onFocus={() => setReplyFocus(true)} onBlur={() => setReplyFocus(false)} onChange={(event) => setReply(event.target.value)} />
              <StickerPicker nested disabled={Boolean(pending)} onSelect={sendReply} onOpenChange={setStickerOpen} />
              <button aria-label="Send story reply" disabled={!reply.trim() || Boolean(pending)}><FiSend /></button>
            </form>}
            {!own && <IconButton aria-label={story.liked ? "Unlike story" : "Like story"} icon={<FiHeart />} variant="ghost"
              aria-pressed={story.liked} isDisabled={Boolean(pending)} onClick={like} />}
            {!own && <Menu onOpen={() => setReacting(true)} onClose={() => setReacting(false)} isLazy>
              <MenuButton as={IconButton} variant="ghost" aria-label="React to story" icon={story.reaction ? <span>{story.reaction}</span> : <FiSmile />} />
              <MenuList color="var(--chakra-colors-chakra-body-text)" minWidth="0">
                {reactions.map(([emoji, label]) => <MenuItem key={emoji} onClick={() => react(story.reaction === emoji ? null : emoji)}>
                  {emoji} {label}{story.reaction === emoji && " ✓"}
                </MenuItem>)}
              </MenuList>
            </Menu>}
            {own && <IconButton aria-label="View story activity" icon={<FiEye />} variant="ghost" onClick={() => setActivityOpen(true)} />}
            <IconButton aria-label="Share story" icon={<FiShare2 />} variant="ghost" onClick={() => setShareOpen(true)} />
          </div>
        </div>
        <div className="story-neighbor">{nextAuthor && <button onClick={() => goTo(nextAuthor)}>
          <Avatar name={nextAuthor.username} src={nextAuthor.profileImg} /><span>{nextAuthor.username}</span>
        </button>}</div>
      </div>}
      {story && activityOpen && <StoryActivity key={story._id} id={story._id} onClose={() => setActivityOpen(false)} />}
      {story && shareOpen && <StoryShareDialog viewer={user._id} source={{ id: story._id, type: "story", kind: "story", username, video }}
        onClose={() => setShareOpen(false)} />}
    </ModalContent>
  </Modal>;
}
