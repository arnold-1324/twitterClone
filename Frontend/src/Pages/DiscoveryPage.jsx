import { Button, Spinner } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { useSetRecoilState, useRecoilValue } from "recoil";
import savedPostsAtom from "../atom/savedPostsAtom";
import postsAtom from "../atom/postsAtom";
import Post from "../components/Post";
import usePostPages from "../hooks/usePostPages";

export default function DiscoveryPage({ reels = false, saved = false }) {
  const posts = useRecoilValue(postsAtom);
  const setPosts = useSetRecoilState(postsAtom);
  const savedIds = useRecoilValue(savedPostsAtom);
  const { loading, error, retry, cursor, loadMore } = usePostPages(saved ? "/api/posts/saved" : reels ? "/api/posts/reels" : "/api/posts/discover", setPosts);
  const visible = saved ? posts.filter((post) => savedIds?.includes(post._id)) : posts;
  return <main className={reels ? "dayline-tool-page reels-page" : "dayline-tool-page"}>
    <div className="discovery-header">
      <h1>{saved ? "Saved" : reels ? "Reels" : "Discover"}</h1>
      {!reels && !saved && <Button as={Link} to="/saved" size="sm" variant="outline">Saved posts</Button>}
      {reels && <Button as={Link} to="/create?type=reel" variant="outline" size="sm">Create reel</Button>}
    </div>
    {loading && <Spinner aria-label="Loading content" />}
    {error && <p role="alert">{error} <Button variant="outline" size="sm" onClick={retry}>Retry</Button></p>}
    {!loading && !error && (!saved || savedIds !== null) && !visible.length && <p>{saved ? "Save a post or reel to find it here." : reels ? "No reels yet. Share the first one." : "There are no posts to recommend yet."}</p>}
    <div className={reels ? "reels-track" : undefined}>
      {visible.map((post) => <Post key={post._id} post={post} postedBy={post.postedBy} playWhenVisible={reels} />)}
    </div>
    {cursor && <Button variant="outline" size="sm" isLoading={loading} onClick={loadMore}>Load more</Button>}
  </main>;
}
