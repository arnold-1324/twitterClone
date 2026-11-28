import { Avatar, Button, Spinner } from "@chakra-ui/react";
import { FiArrowUpRight, FiHeart, FiPlus } from "react-icons/fi";
import { useEffect, useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAppState, useAppValue } from "../state/store";
import Post from "../components/Post";
import StoryShelf from "../components/StoryShelf";
import SuggestedUsers from "../components/SuggestedUsers";
import postsAtom from "../atom/postsAtom";
import usePostPages from "../hooks/usePostPages";
import userAtom from "../atom/userAtom";
import notifyAtom from "../atom/notifyAtom";

export default function HomePage() {
  const [posts, setPosts] = useAppState(postsAtom);
  const user = useAppValue(userAtom);
  const { unreadCount } = useAppValue(notifyAtom);
  const { loading, error, cursor, retry, loadMore } = usePostPages("/api/posts/feed", setPosts);
  const restored = useRef(false);
  const scrollKey = `home-scroll:${user._id}`;
  useLayoutEffect(() => {
    if (restored.current || loading || !posts.length) return;
    restored.current = true;
    try { window.scrollTo(0, Number(sessionStorage.getItem(scrollKey)) || 0); }
    catch { /* Browsing storage can be disabled. */ }
  }, [loading, posts.length, scrollKey]);

  useEffect(() => () => {
    if (!restored.current) return;
    try { sessionStorage.setItem(scrollKey, String(window.scrollY)); }
    catch { /* Browsing storage can be disabled. */ }
  }, [scrollKey]);

  return (
    <main className="feed-layout">
      <section aria-label="Home feed">
        <header className="home-stream-header">
          <Link to="/create" aria-label="Create post"><FiPlus /><span>Create</span></Link>
          <img src="/dark-logo-192.png" alt="" width="30" height="30" />
          <Link to="/notifications" aria-label={unreadCount ? `Activity, ${unreadCount} unread` : "Activity"}>
            <FiHeart />{unreadCount > 0 && <i aria-hidden="true" />}
          </Link>
        </header>
        <StoryShelf user={user} />
        {loading && !posts.length && <div className="feed-state" role="status"><Spinner /> Loading…</div>}
        {error && <div className="social-panel feed-state" role="alert">{error}
          <Button size="sm" variant="outline" onClick={retry}>Try again</Button>
        </div>}
        {!loading && !error && !posts.length && <div className="social-panel feed-state">
          <p>Your feed is empty. Follow someone to see their posts here.</p>
          <div className="feed-empty-actions"><Link to="/search">Find people</Link><Link to="/create">Create a post</Link></div>
        </div>}
        {posts.map((post, index) => <Post key={post._id} post={post} postedBy={post.postedBy}
          playWhenVisible={post.kind === "reel"} showPermalink={false} priorityMedia={index === 0} />)}
        {cursor && <Button onClick={loadMore} isLoading={loading} variant="outline">Load more</Button>}
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
