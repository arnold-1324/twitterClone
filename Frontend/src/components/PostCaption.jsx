import { useState } from "react";
import { Link } from "react-router-dom";

export default function PostCaption({ text, name, compact = false }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const limit = compact ? 78 : 145;
  const short = text.length > limit && !expanded;
  const visible = short ? text.slice(0, limit).replace(/\s+\S*$/, "") : text;
  return <p className="stream-caption">
    {name && <strong>{name} </strong>}
    {visible.split(/([@#][\p{L}\p{N}_]+)/u).map((segment, i) => segment[0] === "@" && /^@[\p{L}\p{N}_]+$/u.test(segment)
      ? <Link key={i} to={`/${encodeURIComponent(segment.slice(1))}`}>{segment}</Link>
      : segment[0] === "#" && /^#[\p{L}\p{N}_]+$/u.test(segment)
        ? <Link key={i} to={`/discover?topic=${encodeURIComponent(segment.slice(1))}`}>{segment}</Link> : segment)}
    {short && "…"}
    {text.length > limit && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
      {expanded ? "Less" : "More"}
    </button>}
  </p>;
}
