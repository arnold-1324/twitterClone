import { Button, Spinner } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FiCalendar, FiFilm, FiGrid, FiHeart, FiImage, FiSettings } from "react-icons/fi";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch, readApiJson } from "../lib/apiFetch";

const sections = [
  { value: "history", label: "Account history", icon: FiCalendar },
  { value: "media", label: "Photos and videos", icon: FiImage },
  { value: "liked", label: "Interactions", icon: FiHeart },
];
const categories = {
  created: "Account created", name: "Name", username: "Username", bio: "Bio",
  photo: "Profile photo", privacy: "Privacy", password: "Password",
};
const descriptions = {
  created: "You created your account.",
  name: "You updated your display name.",
  username: "You changed your username.",
  bio: "You updated your bio.",
  photo: "You changed your profile photo.",
  password: "You changed your password.",
};

function describe(event) {
  if (event.kind === "bio" && event.action === "removed") return "You removed your bio.";
  if (event.kind === "privacy") return event.action === "hidden"
    ? "You hid your bio from other accounts." : "You made your bio visible.";
  return descriptions[event.kind];
}

function dateGroup(value) {
  const now = new Date();
  const date = new Date(value);
  if (now.getFullYear() !== date.getFullYear()) return "Earlier";
  return now.getMonth() === date.getMonth() ? "This month" : "This year";
}

export default function AccountActivityPage() {
  const [params, setParams] = useSearchParams();
  const section = sections.some(({ value }) => params.get("section") === value) ? params.get("section") : "history";
  const [kind, setKind] = useState("");
  const [sort, setSort] = useState("newest");
  const [mediaType, setMediaType] = useState("posts");
  const [interactionType, setInteractionType] = useState("liked");
  const [rows, setRows] = useState([]);
  const [joinedAt, setJoinedAt] = useState(null);
  const [next, setNext] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);
  const [retry, setRetry] = useState(0);
  const history = section === "history";
  const view = section === "liked" ? interactionType : mediaType;

  useEffect(() => {
    const controller = new AbortController();
    setRows([]);
    setNext("");
    setJoinedAt(null);
    setLoading(true);
    setError("");
    const query = new URLSearchParams(history ? { sort, ...(kind && { kind }) } : { view });
    async function load() {
      try {
        const response = await apiFetch(`${history ? "/api/users/account-history" : "/api/posts/account-media"}?${query}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Could not load this activity.");
        const data = await readApiJson(response);
        if (controller.signal.aborted) return;
        setRows(history ? data.entries : data);
        setJoinedAt(history ? data.joinedAt : null);
        setNext(response.headers.get("X-Next-Cursor") || "");
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [history, kind, sort, view, retry]);

  async function loadMore() {
    if (!next || more) return;
    const query = new URLSearchParams(history ? { sort, before: next, ...(kind && { kind }) } : { view, before: next });
    setMore(true);
    setError("");
    try {
      const response = await apiFetch(`${history ? "/api/users/account-history" : "/api/posts/account-media"}?${query}`);
      if (!response.ok) throw new Error("Could not load the next page.");
      const data = await readApiJson(response);
      setRows((current) => [...current, ...(history ? data.entries : data)]);
      setNext(response.headers.get("X-Next-Cursor") || "");
    } catch (error) {
      setError(error.message);
    } finally {
      setMore(false);
    }
  }
  const joined = { _id: "joined", kind: "created", createdAt: joinedAt };
  const entries = history && !kind && joinedAt && !loading
    ? sort === "oldest" ? [joined, ...rows] : !next ? [...rows, joined] : rows
    : rows;

  return <main className="dayline-tool-page account-activity">
    <div className="discovery-header"><h1>Your activity</h1>
      <Button as={Link} to="/settings" size="sm" variant="outline" leftIcon={<FiSettings />}>Settings</Button>
    </div>
    <div className="social-panel account-activity-grid">
      <nav aria-label="Account activity">
        {sections.map(({ value, label, icon: Icon }) => (
          <button type="button" key={value} disabled={more} aria-pressed={section === value}
            onClick={() => setParams({ section: value })}><Icon />{label}</button>
        ))}
      </nav>
      <section className="account-activity-detail">
        <h2>{sections.find(({ value }) => value === section).label}</h2>
        {history && <p>Review changes you’ve made since creating your account.</p>}
        <div className="activity-tools">
          {!history && <span>Newest published first</span>}
          {history && <><label>Sort by <select value={sort} onChange={(event) => setSort(event.target.value)} disabled={more}>
            <option value="newest">Newest to oldest</option>
            <option value="oldest">Oldest to newest</option>
          </select></label><label>Filter by <select value={kind} onChange={(event) => setKind(event.target.value)} disabled={more}>
            <option value="">All changes</option>
            {Object.entries(categories).filter(([key]) => key !== "created").map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></label></>}
          {section === "media" && <div className="segmented" aria-label="Media type">
            <button type="button" aria-pressed={mediaType === "posts"} disabled={more} onClick={() => setMediaType("posts")}>Posts</button>
            <button type="button" aria-pressed={mediaType === "reels"} disabled={more} onClick={() => setMediaType("reels")}>Reels</button>
          </div>}
          {section === "liked" && <div className="segmented" aria-label="Interaction type">
            <button type="button" aria-pressed={interactionType === "liked"} disabled={more} onClick={() => setInteractionType("liked")}>Likes</button>
            <button type="button" aria-pressed={interactionType === "replied"} disabled={more} onClick={() => setInteractionType("replied")}>Replies</button>
          </div>}
        </div>
        {loading && <Spinner size="sm" aria-label="Loading account activity" />}
        {error && <p role="alert">{error} <Button size="xs" onClick={() => setRetry((number) => number + 1)}>Retry</Button></p>}
        {!loading && !error && !entries.length && <p>{history ? "No matching account changes yet." : section === "liked" ? (view === "liked" ? "Posts you like will appear here." : "Posts you reply to will appear here.") : "Your published media will appear here."}</p>}
        {history ? entries.map((item, index) => {
          const group = dateGroup(item.createdAt);
          const showGroup = index === 0 || group !== dateGroup(entries[index - 1].createdAt);
          return <div key={item._id}>
            {showGroup && <h3 className="history-group">{group}</h3>}
            <div className="history-event"><FiCalendar aria-hidden="true" /><div><strong>{categories[item.kind]}</strong>
              <p>{describe(item)}</p>{item.profileValue && <p className="history-value">{item.profileValue}</p>}
            </div><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString()}</time></div>
          </div>;
        }) : <div className="account-media-grid">
          {entries.map((post) => {
            const media = post.media?.[0];
            return <Link key={post._id} to={`/${post.postedBy?.username || "post"}/post/${post._id}`} aria-label={post.caption || (post.kind === "reel" ? "Open reel" : "Open post")}>
              {media?.type === "image" ? <img src={media.url} alt="" loading="lazy" />
                : media?.type === "video" ? <video src={media.url} preload="metadata" muted playsInline /> : <p>{post.caption}</p>}
              <span aria-hidden="true">{post.kind === "reel" ? <FiFilm /> : <FiGrid />}</span>
            </Link>;
          })}
        </div>}
        {next && <Button mt={4} size="sm" variant="outline" isLoading={more} onClick={loadMore}>Load more</Button>}
      </section>
    </div>
  </main>;
}
