import UserHeader from "../components/UserHeader";
import useGetUserProfile from "../hooks/useGetUserprofile";
import { useParams } from "react-router-dom";
import { useAppState } from "../state/store";
import postsAtom from "../atom/postsAtom";
import { Button, Flex, Spinner, Text } from "@chakra-ui/react";
import usePostPages from "../hooks/usePostPages";
import Post from "../components/Post";
import { motion } from "framer-motion";
import { useState } from "react";

const MotionFlex = motion(Flex); // Wrapping Chakra's Flex with motion for animations

const UserPage = () => {
  const { user, loading } = useGetUserProfile();
  const { username } = useParams();
  const [posts, setPosts] = useAppState(postsAtom);
  const [showReposts, setShowReposts] = useState(false);
  const url = user?.username === username
    ? `/api/posts/user/${encodeURIComponent(username)}${showReposts ? "?filter=reposts" : ""}` : null;
  const { loading: fetchingPosts, error, cursor, retry, loadMore } = usePostPages(url, setPosts);

  if (loading) {
    return (
      <MotionFlex
        justifyContent="center"
        alignItems="center"
        minHeight="80vh"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Spinner size="xl" />
      </MotionFlex>
    );
  }

  if (!user && !loading) return <Text>User not found</Text>;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <UserHeader user={user} />
      <div className="profile-post-tabs" aria-label="Profile publications">
        <Button size="sm" variant="ghost" aria-pressed={!showReposts} onClick={() => setShowReposts(false)}>Posts</Button>
        <Button size="sm" variant="ghost" aria-pressed={showReposts} onClick={() => setShowReposts(true)}>Reposts</Button>
      </div>
      {error && <Text role="alert">{error} <Button size="xs" onClick={retry}>Retry</Button></Text>}
      {!error && !fetchingPosts && posts.length === 0 && <Text>{showReposts ? "No reposts yet." : "User has no posts."}</Text>}
      {fetchingPosts && (
        <MotionFlex justifyContent="center" my={12} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Spinner size="xl" />
        </MotionFlex>
      )}
      {posts.map((post) => (
        <Post key={post._id} post={post} postedBy={post.postedBy} />
      ))}
      {cursor && <Button onClick={loadMore} isLoading={fetchingPosts} variant="outline">Load older posts</Button>}
    </motion.div>
  );
};

export default UserPage;
