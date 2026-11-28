import AdaptiveVideo from "./AdaptiveVideo";
import { useEffect, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import MusicPlayer from "./MusicPlayer";
import { Link } from "react-router-dom";

function MediaCredit({ credit }) {
  if (!credit) return null;

  return <details className="media-credit">
    <summary>Media credit</summary>
    <small>
      <a href={credit.source} target="_blank" rel="noreferrer">{credit.title}</a> by {credit.creator}
      {" · "}{credit.licenseUrl
        ? <a href={credit.licenseUrl} target="_blank" rel="noreferrer">{credit.license}</a>
        : credit.license}
      {credit.changes && ` · ${credit.changes}`}
      {credit.original && <> · <a href={credit.original} target="_blank" rel="noreferrer">Original video</a></>}
    </small>
  </details>;
}

export default function PostMedia({ post, playWhenVisible = false, detailView = false, priorityMedia = false }) {
  if (!post.music?.id) return <PostVisuals post={post} playWhenVisible={playWhenVisible} priorityMedia={priorityMedia} />;
  return <PostWithMusic post={post} playWhenVisible={playWhenVisible} detailView={detailView} priorityMedia={priorityMedia} />;
}

function PostWithMusic({ post, playWhenVisible, detailView, priorityMedia }) {
  const stage = useRef(null);
  const [musicOpen, setMusicOpen] = useState(false);
  const [visible, setVisible] = useState(detailView);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const target = stage.current;
    let observer;
    function observe() {
      observer?.disconnect();
      const margin = detailView ? 0 : Math.floor(window.innerHeight * 0.42);
      observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
        rootMargin: `-${margin}px 0px`,
      });
      observer.observe(target);
    }
    observe();
    window.addEventListener("resize", observe);
    return () => {
      window.removeEventListener("resize", observe);
      observer.disconnect();
    };
  }, [detailView]);
  const hasMedia = post.media?.length || post.imageUrl;
  return <div ref={stage} className={`post-audio-stage${hasMedia ? "" : " post-audio-stage-empty"}`}>
    <PostVisuals post={post} playWhenVisible={playWhenVisible && !musicOpen} priorityMedia={priorityMedia} />
    <MusicPlayer key={post._id} music={post.music} autoPlay volumeAxis="horizontal" inView={visible && !musicOpen} overlay={Boolean(hasMedia)} onOpenChange={(open) => {
      if (open) stage.current?.querySelector("video")?.pause();
      setMusicOpen(open);
    }} />
  </div>;
}

function PostVisuals({ post, playWhenVisible, priorityMedia }) {
  const rail = useRef(null);
  const video = useRef(null);
  const [index, setIndex] = useState(0);
  const [ended, setEnded] = useState(false);
  const items = post.media?.length ? post.media
    : post.imageUrl ? [{ type: "image", url: post.imageUrl }] : [];
  const multi = items.length > 1;
  const primaryImage = priorityMedia ? { loading: "eager", fetchpriority: "high" } : { loading: "lazy" };

  function move(next) {
    if (!rail.current || next < 0 || next >= items.length) return;
    rail.current.scrollTo({ left: next * rail.current.clientWidth,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  if (!items.length) return null;
  if (items[0].type === "video") {
    return <>
      <div className="post-video-stage">
        <AdaptiveVideo videoRef={video} className="reel-video" src={items[0].url} streamUrl={items[0].streamUrl}
          aria-label={post.caption || "Reel video"} playWhenVisible={playWhenVisible} eager={priorityMedia}
          loop={false} onEnded={() => setEnded(true)} onPlay={() => setEnded(false)} />
        {ended && <div className="post-video-replay">
          <Link to="/reels">Watch more reels</Link>
          <button type="button" onClick={() => {
            video.current.currentTime = 0;
            void video.current.play().catch(() => {});
          }}>Watch again</button>
        </div>}
      </div>
      <MediaCredit credit={items[0].credit} />
    </>;
  }
  if (!multi) return <>
    <img className="feed-photo" src={items[0].url} alt={post.caption || "Photo shared in this post"} decoding="async" {...primaryImage} />
    <MediaCredit credit={items[0].credit} />
  </>;

  return <>
    <div className="post-carousel" role="group" aria-label="Post photos">
      <div ref={rail} className="carousel-rail" tabIndex={0}
        onScroll={({ currentTarget }) => setIndex(Math.round(currentTarget.scrollLeft / currentTarget.clientWidth))}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          move(index + (event.key === "ArrowRight" ? 1 : -1));
        }}>
        {items.map((item, position) => (
          <img className="feed-photo" key={item.url} src={item.url}
            alt={item.credit?.title || `Photo ${position + 1} of ${items.length}${post.caption ? ` · ${post.caption}` : ""}`}
            decoding="async" {...(position === 0 ? primaryImage : { loading: "lazy" })} />
        ))}
      </div>
      <button type="button" className="carousel-previous" onClick={() => move(index - 1)}
        disabled={index === 0} aria-label="Previous photo"><FiChevronLeft /></button>
      <button type="button" className="carousel-next" onClick={() => move(index + 1)}
        disabled={index >= items.length - 1} aria-label="Next photo"><FiChevronRight /></button>
      <span className="carousel-count" aria-live="polite">{index + 1} / {items.length}</span>
    </div>
    <MediaCredit credit={items[index]?.credit} />
  </>;
}
