import AdaptiveVideo from "./AdaptiveVideo";
import { useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

export default function PostMedia({ post, playWhenVisible = false }) {
  const rail = useRef(null);
  const [index, setIndex] = useState(0);
  const items = post.media?.length ? post.media
    : post.imageUrl ? [{ type: "image", url: post.imageUrl }] : [];
  const multi = items.length > 1;

  function move(next) {
    if (!rail.current || next < 0 || next >= items.length) return;
    rail.current.scrollTo({ left: next * rail.current.clientWidth,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  if (!items.length) return null;
  if (items[0].type === "video") {
    return <AdaptiveVideo className="reel-video" src={items[0].url} streamUrl={items[0].streamUrl}
      aria-label={post.caption || "Reel video"} playWhenVisible={playWhenVisible} />;
  }
  if (!multi) return <img className="feed-photo" src={items[0].url} alt={post.caption || "Photo shared in this post"} loading="lazy" />;

  return <div className="post-carousel" role="group" aria-label="Post photos">
    <div ref={rail} className="carousel-rail" tabIndex={0}
      onScroll={({ currentTarget }) => setIndex(Math.round(currentTarget.scrollLeft / currentTarget.clientWidth))}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        move(index + (event.key === "ArrowRight" ? 1 : -1));
      }}>
      {items.map((item, position) => (
        <img className="feed-photo" key={item.url} src={item.url}
          alt={`Photo ${position + 1} of ${items.length}${post.caption ? ` · ${post.caption}` : ""}`} loading="lazy" />
      ))}
    </div>
    <button type="button" className="carousel-previous" onClick={() => move(index - 1)}
      disabled={index === 0} aria-label="Previous photo"><FiChevronLeft /></button>
    <button type="button" className="carousel-next" onClick={() => move(index + 1)}
      disabled={index >= items.length - 1} aria-label="Next photo"><FiChevronRight /></button>
    <span className="carousel-count" aria-live="polite">{index + 1} / {items.length}</span>
  </div>;
}
