import { Avatar } from "@chakra-ui/avatar";
import { Image } from "@chakra-ui/image";
import { Box, Flex, Text, Skeleton, SkeletonCircle, SkeletonText } from "@chakra-ui/react";
import { Link, useNavigate } from "react-router-dom";
import Actions from "./Actions";
import { useEffect, useState } from "react";
import useShowToast from "../hooks/useShowToast";
import { formatDistanceToNow } from "date-fns";
import { DeleteIcon } from "@chakra-ui/icons";
import { useRecoilState, useRecoilValue } from "recoil";
import userAtom from "../atom/userAtom";
import postsAtom from "../atom/postsAtom";
import { motion } from "framer-motion";

const MotionFlex = motion(Flex); // Wrapping Chakra's Flex with motion for animations

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

  if (isLoading) {
    return (
      <MotionFlex
        gap={3}
        mb={4}
        py={5}
        borderWidth="1px"
        borderRadius="md"
        p={4}
        shadow="md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <SkeletonCircle size="10" />
        <Flex flex={1} flexDirection="column" gap={2}>
          <SkeletonText noOfLines={1} width="40%" />
          <SkeletonText noOfLines={2} spacing="4" mb={2} />
          <Skeleton height="200px" borderRadius="md" />
          <SkeletonText noOfLines={1} width="30%" />
        </Flex>
      </MotionFlex>
    );
  }

  if (!user) return null;

  return (
    <Link to={`/${user.username}/post/${post._id}`}>
      <MotionFlex
        gap={3}
        mb={4}
        py={5}
        borderWidth="1px"
        borderRadius="md"
        p={4}
        shadow="md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
        _hover={{
          scale: 1.02, // Slight scale effect to simulate hover inside the card
          boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.15)", // Elevation effect on hover
        }}
      >
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
            <Text mb={2}>{post.caption}</Text>
            {post.images && <Image src={post.images} alt={post.caption} borderRadius="md" />}
          </Box>
          <Actions post={post} />
          {user._id === currentUser?._id && (
            <DeleteIcon
              cursor="pointer"
              onClick={handleDeletePost}
              _hover={{ color: "red.500" }}
            />
          )}
        </Flex>
      </MotionFlex>
    </Link>
  );
};

export default Post;
