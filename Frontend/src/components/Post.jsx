import { Avatar } from "@chakra-ui/avatar";
import { Image } from "@chakra-ui/image";
import { Box, Flex, Text } from "@chakra-ui/layout";
import { Link, useNavigate } from "react-router-dom";
import Actions from "./Actions";
import { useEffect, useState } from "react";
import useShowToast from "../hooks/useShowToast";
import { formatDistanceToNow } from "date-fns";
import { DeleteIcon } from "@chakra-ui/icons";
import { useRecoilState, useRecoilValue } from "recoil";
import userAtom from "../atom/userAtom";
import postsAtom from "../atom/postsAtom";

const Post = ({ post, postedBy }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const showToast = useShowToast();
  const currentUser = useRecoilValue(userAtom);
  const [posts, setPosts] = useRecoilState(postsAtom);
  const navigate = useNavigate();

  useEffect(() => {
    const getUser = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`api/users/profile/${postedBy}`);
        if (!res.ok) throw new Error("Failed to fetch user data");

        const data = await res.json();
        setUser(data);
      } catch (error) {
        showToast("Error", error.message || "Failed to fetch data", "error");
      } finally {
        setIsLoading(false);
      }
    };

    if (postedBy) getUser();
  }, [postedBy]);

  const handleDeletePost = async (e) => {
    e.preventDefault();
    if (!window.confirm("Are you sure you want to delete this post?")) return;

    try {
      const res = await fetch(`api/posts/${post._id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete post");

      showToast("Success", "Post deleted", "success");
      setPosts(posts.filter((p) => p._id !== post._id));
    } catch (error) {
      showToast("Error", error.message, "error");
    }
  };

  if (isLoading) return <Text>Loading...</Text>;
  if (!user) return null;

  return (
    <Link to={`/${user.username}/post/${post._id}`}>
      <Flex gap={3} mb={4} py={5} borderWidth="1px" borderRadius="md" p={4} shadow="md">
        <Avatar 
          size="md" 
          name={user.fullName} 
          src={user.profileImg} 
          onClick={(e) => {
            e.preventDefault();
            navigate(`/${user.username}`);
          }} 
        />
        <Flex flex={1} flexDirection="column" gap={2}>
          <Flex justifyContent="space-between">
            <Text fontWeight="bold" fontSize="sm">{user.username}</Text>
            <Text fontSize="xs" color="gray.500">
              {formatDistanceToNow(new Date(post.createdAt))} ago
            </Text>
          </Flex>
          <Box>
            <Text mb={2}>{post.caption}</Text> {/* Updated to display caption */}
            {post.images && <Image src={post.images} alt={post.caption} borderRadius="md" /> } {/* Updated to display images */}
          </Box>
          <Actions post={post} />
          {user._id === currentUser?._id && (
            <DeleteIcon cursor="pointer" onClick={handleDeletePost} />
          )}
        </Flex>
      </Flex>
    </Link>
  );
};

export default Post;