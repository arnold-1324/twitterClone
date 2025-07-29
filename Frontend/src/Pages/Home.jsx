import { Box, Flex, Spinner } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import useShowToast from "../hooks/useShowToast";
import Post from "../components/Post";
import { useRecoilState } from "recoil";
import postsAtom from "../atom/postsAtom";
import SuggestedUsers from "../components/SuggestedUsers";
import SongPage from "../components/SongPage";
//import StoryEditPage from "../components/StoryEditPage";
import AudioPlayer from "../components/AudioPlayer";
import audioFile from "../assets/sounds/spectacu.mp3"; // Import the audio file


const HomePage = () => {
  const [posts, setPosts] = useRecoilState(postsAtom);
  const [loading, setLoading] = useState(true);
  const showToast = useShowToast();

  useEffect(() => {
    const getFeedPosts = async () => {
      setLoading(true);
      setPosts([]);
      try {
        const res = await fetch("api/posts/feed");
        const data = await res.json();
        if (data.error) {
          showToast("Error", data.error, "error");
          return;
        }
        console.log(data);
        setPosts(data);
      } catch (error) {
        showToast("Error", error.message, "error");
      } finally {
        setLoading(false);
      }
    };
    getFeedPosts();
  }, [setPosts]);

  return (
    <Flex gap="10" alignItems={"flex-start"}>
      <Box flex={70}>
        {!loading && posts.length === 0 && <h1>Follow some users to see the feed</h1>}

        {loading && (
          <Flex justify="center">
            <Spinner size="xl" />
          </Flex>
        )}
<<<<<<< HEAD
         {/* <AudioPlayer audioUrl={audioFile} /> {/* Use the imported audio file *
        <SongPage />  */}
=======
       {/* <SongPage /> */} 
>>>>>>> 6a425a5 (d-home test)
        {/* <StoryEditPage /> */}
        {posts.map((post) => (
          <Post key={post._id} post={post} postedBy={post.postedBy} />
        ))}
      </Box>

      <Box flex={30} display={{ base: "none", md: "block" }}>
        <SuggestedUsers />
      </Box>
    </Flex>
  );
};

export default HomePage;
