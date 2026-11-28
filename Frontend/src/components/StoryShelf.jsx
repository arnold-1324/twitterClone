import { useEffect, useRef, useState } from "react";
import { Avatar } from "@chakra-ui/react";
import { FiChevronLeft, FiChevronRight, FiPlus } from "react-icons/fi";
import { Link } from "react-router-dom";
import useEphemeralShelf from "../hooks/useEphemeralShelf";
import useShelfNavigation from "../hooks/useShelfNavigation";
import { invalidateStories, storyFeedPath } from "../lib/ephemeralCache";
import { canPreloadMedia, preloadStoryMedia, preloadStoryProfile } from "../lib/storyPreload";
import StoryComposer from "./StoryComposer";

const isActive = ({ expiresAt }) => new Date(expiresAt).getTime() > Date.now();

export function StoryLink({ person, viewer, from, own = false, profile = false, seen = false, peers }) {
  const timer = useRef();
  const cancelPreload = () => clearTimeout(timer.current);
  useEffect(() => () => clearTimeout(timer.current), [viewer, person.username]);
  const preload = () => {
    if (canPreloadMedia()) void preloadStoryProfile(viewer, person.username);
  };
  return <Link className={profile ? "profile-story-link" : "story-shelf-entry"}
    to={`/stories/${encodeURIComponent(person.username)}`} state={{ from, peers }}
    onPointerEnter={() => { timer.current = setTimeout(preload, 120); }}
    onPointerLeave={cancelPreload} onFocus={preload}
    aria-label={own ? "View your story" : `View story by ${person.username}`}
    aria-description={!own ? (seen ? "Seen" : "Unseen") : undefined}>
    <span className={`story-ring${seen || own ? " story-ring-seen" : ""}`}><Avatar name={person.fullName || person.username} src={person.profileImg} /></span>
    {!profile && <small>{own ? "Your story" : person.username}</small>}
  </Link>;
}

export default function StoryShelf({ user }) {
  const { data, reload, error } = useEphemeralShelf(storyFeedPath, user._id);
  const [composing, setComposing] = useState(false);
  const rows = (data ?? []).filter(isActive);
  const mine = rows.some(({ author }) => author._id === user._id);
  const others = rows.filter(({ author }) => author._id !== user._id);
  const { track, position, measure, move } = useShelfNavigation(others.length + 1);
  const peers = rows.map(({ author, expiresAt }) => ({ author, expiresAt }));

  useEffect(() => {
    if (!data || !canPreloadMedia()) return;
    const previews = data.filter(isActive).slice(0, 4);
    for (const { preview } of previews) preloadStoryMedia(user._id, preview);
    const first = previews.find(({ author }) => author._id !== user._id);
    if (first) void preloadStoryProfile(user._id, first.author.username);
  }, [data, user._id]);

  return <section className="story-section" aria-label="Stories">
    <div className="note-carousel story-carousel">
      <button className="note-carousel-arrow" type="button" aria-label="Previous story author"
        disabled={!position.previous} onClick={() => move(-1)}><FiChevronLeft aria-hidden="true" /></button>
      <div className="story-shelf" ref={track} onScroll={measure}>
      <div className="story-shelf-own">
        {mine && <StoryLink person={user} viewer={user._id} from="/" peers={peers} own />}
        <button type="button" className={mine ? "story-add-badge" : "story-shelf-entry story-shelf-add"}
          aria-label="Add story" onClick={() => setComposing(true)}>
          {mine ? <FiPlus /> : <>
            <span className="story-ring"><Avatar name={user.fullName} src={user.profileImg} /><i><FiPlus /></i></span>
            <small>Add story</small>
          </>}
        </button>
      </div>
      {others.map(({ author, unseen }) =>
        <StoryLink key={author._id} person={author} viewer={user._id} from="/" peers={peers} seen={!unseen} />)}
      </div>
      <button className="note-carousel-arrow" type="button" aria-label="Next story author"
        disabled={!position.next} onClick={() => move(1)}><FiChevronRight aria-hidden="true" /></button>
    </div>
    {error && <button className="ephemeral-retry" onClick={reload}>Retry stories</button>}
    {composing && <StoryComposer user={user} onPublished={() => {
      invalidateStories(user._id, user.username);
      void reload();
    }} onClose={() => setComposing(false)} />}
  </section>;
}
