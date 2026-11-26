import { useEffect, useState } from "react";
import { Button, Spinner } from "@chakra-ui/react";
import { FiArrowLeft, FiMessageCircle } from "react-icons/fi";
import { Link, useParams } from "react-router-dom";
import { useRecoilState } from "recoil";
import { apiFetch, readApiJson } from "../lib/apiFetch";
import postsAtom from "../atom/postsAtom";
import Post from "../components/Post";
import Comment from "../components/Comment";

export default function PostPage() {
  const { pid } = useParams();
  const [posts, setPosts] = useRecoilState(postsAtom);
  const [status, setStatus] = useState("loading");
  const post = posts.find((item) => item._id === pid);
  useEffect(() => {
    const request = new AbortController();
    setStatus("loading");
    apiFetch(`/api/posts/${encodeURIComponent(pid)}`, { signal: request.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const item = await readApiJson(response);
        if (!request.signal.aborted) {
          setPosts([item]);
          setStatus("ready");
        }
      })
      .catch(() => { if (!request.signal.aborted) setStatus("error"); });
    return () => request.abort();
  }, [pid, setPosts]);
  return <main className="dayline-tool-page stream-page">
    <div className="stream-heading">
      <Button as={Link} to="/" size="sm" variant="ghost" leftIcon={<FiArrowLeft />}>Feed</Button>
      <h1>{post?.kind === "reel" ? "Reel" : "Post"}</h1>
    </div>
    {status === "loading" ? <Spinner aria-label="Loading post" /> : status === "error" || !post
      ? <p role="status">This post is unavailable.</p>
      : <>
        <Post post={post} postedBy={post.postedBy} showPermalink={false} />
        <section className="social-panel dayline-tool-panel post-replies" aria-labelledby="replies-heading">
          <h2 id="replies-heading"><FiMessageCircle /> Replies</h2>
          {!post.replies.length && <p>No replies yet.</p>}
          {post.replies.map((reply, index) => (
            <Comment key={reply._id} reply={reply} lastReply={index === post.replies.length - 1} />
          ))}
        </section>
      </>}
  </main>;
}
