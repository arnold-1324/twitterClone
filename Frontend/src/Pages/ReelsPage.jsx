import { Button, Spinner } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiChevronUp, FiPlus } from "react-icons/fi";
import { Link } from "react-router-dom";
import { useAppState, useAppValue } from "../state/store";
import postsAtom from "../atom/postsAtom";
import userAtom from "../atom/userAtom";
import usePostPages from "../hooks/usePostPages";
import ReelSlide from "../components/ReelSlide";

export default function ReelsPage() {
  const [posts, setPosts] = useAppState(postsAtom);
  const viewer = useAppValue(userAtom);
  const [mode, setMode] = useState("all");
  const { loading, error, retry, cursor, loadMore } = usePostPages(
    mode === "following" ? "/api/posts/reels?scope=following" : "/api/posts/reels", setPosts);
  const [index, setIndex] = useState(0);
  const [sheet, setSheet] = useState(null);
  const [muted, setMuted] = useState(true);
  const track = useRef(null);
  const positions = useRef(new Map());
  const restored = useRef(false);
  const selectionKey = `reels-active:${viewer?._id || ""}`;
  const reels = posts.filter((post) => post.kind === "reel" && post.media?.some(({ type }) => type === "video")
    && (mode === "all" || viewer?.following?.includes(post.postedBy?._id)));
  const active = Math.min(index, Math.max(0, reels.length - 1));

  useEffect(() => {
    if (loading || restored.current || !reels.length || !track.current) return;
    restored.current = true;
    try {
      const previous = sessionStorage.getItem(selectionKey);
      const target = reels.findIndex(({ _id }) => _id === previous);
      if (target >= 0) {
        track.current.scrollTop = target * track.current.clientHeight;
        setIndex(target);
      }
    } catch { /* Browsing storage can be disabled. */ }
  }, [loading, reels, selectionKey]);

  function go(next) {
    if (sheet || !track.current || next < 0) return;
    if (next >= reels.length) {
      if (cursor && !loading) void loadMore();
      return;
    }
    track.current.scrollTo({ top: next * track.current.clientHeight,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  function handleScroll() {
    if (!track.current || sheet) return;
    const next = Math.min(reels.length - 1, Math.max(0, Math.round(track.current.scrollTop / track.current.clientHeight)));
    if (next < 0 || next === active) return;
    setIndex(next);
    if (mode === "all") {
      try { sessionStorage.setItem(selectionKey, reels[next]._id); } catch { /* Browsing storage can be disabled. */ }
    }
  }

  function switchMode(next) {
    if (mode === next) return;
    setMode(next);
    setIndex(0);
    if (track.current) track.current.scrollTop = 0;
  }

  return <main className="reel-browser" aria-label="Reels">
    <div className="reel-browser-header">
      <h1>Reels</h1>
      <div className="reel-tabs" aria-label="Reel feed">
        <button type="button" aria-pressed={mode === "all"} onClick={() => switchMode("all")}>Discover</button>
        <button type="button" aria-pressed={mode === "following"} onClick={() => switchMode("following")}>Following</button>
      </div>
      <Link to="/create?type=reel" className="reel-create" aria-label="Create reel"><FiPlus /></Link>
    </div>
    {!reels.length && <div className="reel-browser-status">
      {loading ? <Spinner aria-label="Loading reels" /> : error
        ? <><p role="alert">{error}</p><Button onClick={retry} size="sm">Retry</Button></>
        : <p>{mode === "following" ? "Reels from people you follow will appear here." : "No reels yet. Share the first one."}</p>}
    </div>}
    {reels.length > 0 && <div className="reel-browser-body">
      <div ref={track} className="reel-viewport" data-locked={sheet ? "" : undefined} tabIndex={0} aria-label="Swipe through reels"
        onScroll={handleScroll} onKeyDown={(event) => {
          if (event.target !== event.currentTarget || !["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(event.key)) return;
          event.preventDefault();
          go(active + (["ArrowUp", "PageUp"].includes(event.key) ? -1 : 1));
        }}>
        {reels.map((post, i) => <article className="reel-frame" key={post._id} aria-label={`Reel ${i + 1} of ${reels.length}`}>
          {i === active && <ReelSlide post={post} viewer={viewer} muted={muted} setMuted={setMuted} sheet={sheet}
            setSheet={setSheet} position={positions.current} goNext={() => go(active + 1)} />}
        </article>)}
      </div>
      <div className="reel-steppers" aria-label="Reel navigation">
        <button type="button" aria-label="Previous reel" disabled={!active || Boolean(sheet)} onClick={() => go(active - 1)}><FiChevronUp /></button>
        <span aria-live="polite">{active + 1} / {reels.length}</span>
        <button type="button" aria-label="Next reel" disabled={(active >= reels.length - 1 && !cursor) || Boolean(sheet)}
          onClick={() => go(active + 1)}><FiChevronDown /></button>
      </div>
    </div>}
  </main>;
}
