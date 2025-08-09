import UserHeader from "../components/UserHeader";
import UserPost from "../components/UserPost";
import useGetUserProfile from "../hooks/useGetUserprofile";
import { useParams } from "react-router-dom";
import { useRecoilState } from "recoil";
import postsAtom from "../atom/postsAtom";
import { Flex, Spinner, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import useShowToast from "../hooks/useShowToast";
import Post from "../components/Post";
import { motion } from "framer-motion";

const MotionFlex = motion(Flex); // Wrapping Chakra's Flex with motion for animations

const UserPage = () => {
  const { user, loading } = useGetUserProfile();
  const { username } = useParams();
  const showToast = useShowToast();
  const [posts, setPosts] = useRecoilState(postsAtom);
  const [fetchingPosts, setFetchingPosts] = useState(false);

  useEffect(() => {
    const getPosts = async () => {
      if (!user) return;
      setFetchingPosts(true);
      try {
        const res = await fetch(`/api/posts/user/${username}`);
        const data = await res.json();
        //console.log(data);
        setPosts(data);
      } catch (error) {
        showToast("Error", error.message, "error");
        setPosts([]);
      } finally {
        setFetchingPosts(false);
      }
    };

    getPosts();
  }, [username, setPosts, user]);

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
      {!fetchingPosts && posts.length === 0 && <Text>User has no posts.</Text>}
      {fetchingPosts && (
        <MotionFlex justifyContent="center" my={12} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Spinner size="xl" />
        </MotionFlex>
      )}
      {posts.map((post) => (
        <Post key={post._id} post={post} postedBy={post.postedBy} />
      ))}
    </motion.div>
  );
};

export default UserPage;
