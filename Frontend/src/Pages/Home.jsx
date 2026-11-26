import { Avatar, Button, Spinner } from "@chakra-ui/react";
import { useState } from "react";
import { FiArrowUpRight, FiCamera, FiEdit3 } from "react-icons/fi";
import { Link } from "react-router-dom";
import { useRecoilState, useRecoilValue } from "recoil";
import Post from "../components/Post";
import CreatePost from "../components/CreatePost";
import SuggestedUsers from "../components/SuggestedUsers";
import postsAtom from "../atom/postsAtom";
import usePostPages from "../hooks/usePostPages";
import userAtom from "../atom/userAtom";

export default function HomePage() {
  const [posts, setPosts] = useRecoilState(postsAtom);
  const user = useRecoilValue(userAtom);
  const [filter, setFilter] = useState("all");
  const { loading, error, cursor, retry, loadMore } = usePostPages("/api/posts/feed", setPosts);

  const people = [...new Map([user, ...posts.map((post) => post.postedBy).filter((author) => author?._id)]
    .map((person) => [person._id, person])).values()].slice(0, 8);
  const items = filter === "photos" ? posts.filter((post) => post.imageUrl) : posts;

  return (
    <main className="feed-layout">
      <section aria-labelledby="feed-title">
        <div className="feed-title">
          <div className="discovery-header"><h1 id="feed-title">Your feed</h1><Link className="feed-permalink" to="/discover">Discover posts</Link></div>
          <div className="feed-tabs" aria-label="Filter posts">
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All posts</button>
            <button type="button" aria-pressed={filter === "photos"} onClick={() => setFilter("photos")}><FiCamera /> Photos</button>
          </div>
        </div>
        {people.length > 1 && <nav className="feed-people" aria-label="People in your feed">
          {people.map((person) => (
            <Link key={person._id} to={`/${person.username}`}>
              <Avatar name={person.fullName} src={person.profileImg} size="md" />
              <span>{person.username}</span>
            </Link>
          ))}
        </nav>}
        <div className="social-panel feed-composer">
          <Avatar name={user.fullName} src={user.profileImg} size="sm" />
          <CreatePost inline onCreated={() => setFilter("all")} />
        </div>
        {loading && <div className="feed-state" role="status"><Spinner /> Loading posts…</div>}
        {error && <div className="social-panel feed-state" role="alert">{error}
          <Button size="sm" variant="outline" onClick={retry}>Try again</Button>
        </div>}
        {!loading && !error && items.length === 0 && (
          <div className="social-panel feed-state">
            <span className="feed-state-icon">{filter === "photos" ? <FiCamera /> : <FiEdit3 />}</span>
            <h2>{filter === "photos" ? "No photos yet" : "Your feed starts here"}</h2>
            <p>{filter === "photos" ? "Photo posts from you and the people you follow will appear here." : "Write your first post or follow someone to see their updates."}</p>
          </div>
        )}
        {items.map((post) => <Post key={post._id} post={post} postedBy={post.postedBy} />)}
        {cursor && <Button onClick={loadMore} isLoading={loading} variant="outline">Load older posts</Button>}
      </section>
      <aside className="feed-sidebar" aria-label="People">
        <Link to={`/${user.username}`} className="social-panel feed-account">
          <Avatar name={user.fullName} src={user.profileImg} />
          <span><strong>{user.fullName}</strong><small>@{user.username}</small></span>
          <FiArrowUpRight />
        </Link>
        <div className="social-panel feed-suggestions"><SuggestedUsers /></div>
      </aside>
    </main>
  );
}
