import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Avatar,
  Text,
  Textarea,
  Spinner,
  Stack,
  Checkbox,
  useColorModeValue,
  IconButton,
} from "@chakra-ui/react";
import { useRecoilValue } from "recoil";
import userAtom from "../atom/userAtom";
import { LuSend } from "react-icons/lu";
import postsAtom from "../atom/postsAtom";
import { useRecoilState } from "recoil";


const SharePost = ({ postId }) => {
  const [showModal, setShowModal] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]); // Selected conversation ids
  const [text, setText] = useState("");
  const [posts, setPosts] = useRecoilState(postsAtom); 
  const user = useRecoilValue(userAtom); // Current user data
  const [loadingConversations, setLoadingConversations] = useState(false);

  useEffect(() => {
    const getConversations = async () => {
      setLoadingConversations(true);
      try {
        const res = await fetch("/api/messages/getConvo/user");
        const data = await res.json();
        console.log(data);
        if (data.error) {
          console.error("Error loading conversations:", data.error);
        } else {
          setConversations(data);
        }
      } catch (error) {
        console.error("Unable to load conversations:", error);
      } finally {
        setLoadingConversations(false);
      }
    };
    getConversations();
  }, []);





  const handleUserSelect = (convoId) => {
    setSelectedUsers((prev) =>
      prev.includes(convoId)
        ? prev.filter((id) => id !== convoId)
        : [...prev, convoId]
    );
  };

  const handleShare = async () => {
    if (selectedUsers.length === 0) {
      alert("Please select at least one user.");
      return;
    }
  
    try {
      const postData = selectedUsers.map((convoId) => ({
        postId,
        senderId: user._id,
        conversationId: convoId,
        text,
      }));
  
      const sharePostPromises = postData.map(async ({ postId, senderId, conversationId, text }) => {
        const res = await fetch("/api/posts/sharepost", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ postId, senderId, conversationId, text }),
        });
  
        if (!res.ok) {
          throw new Error(`Failed to share post with conversation ${conversationId}`);
        }
  
        const data = await res.json();
  
        // Check the response from the backend and update shareCount
        if (data && data.post && data.post._id) {
          setPosts((prevPosts) =>
            prevPosts.map((post) =>
              post._id === data.post._id
                ? { ...post, shareCount: data.post.shareCount } // Update shareCount with the value from response
                : post
            )
          );
        } else {
          console.error("Error updating share count:", data.error);
        }
      });
  
      // Wait for all promises to resolve
      await Promise.all(sharePostPromises)
        .then(() => {
          console.log("All posts shared successfully");
        })
        .catch((error) => {
          console.error("Error in sharing posts:", error);
        });
  
      // Reset states
      setSelectedUsers([]);
      setText("");
      setShowModal(false);
    } catch (error) {
      console.error("Error sharing post:", error);
      alert("Failed to share post. Please try again.");
    }
  };
  
  return (
    <>
      <IconButton
        onClick={() => setShowModal(true)}
        aria-label="Send"
        icon={<LuSend />}
        variant="ghost"
        fontSize="1.5rem"
        cursor="pointer"
      />

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Select Users to Share</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {loadingConversations ? (
              <Box textAlign="center" py={4}>
                <Spinner size="lg" />
                <Text mt={2}>Loading conversations...</Text>
              </Box>
            ) : (
              <Stack
                spacing={3}
                maxHeight="300px"
                overflowY="auto"
                direction="row"
                wrap="wrap"
              >
                {conversations.map((convo) => {
                  // Filter participants, exclude sender
                  const participants = convo.participants.filter(
                    (participant) =>
                      participant._id !== convo.lastMessage.sender
                  );

                  return participants.map((participant) => (
                    <Box
                      key={participant._id}
                      display="flex"
                      flexDirection="column"
                      alignItems="center"
                      p={3}
                      bg={useColorModeValue("white", "gray.700")}
                      borderRadius="md"
                      boxShadow="md"
                      cursor="pointer"
                      _hover={{ bg: useColorModeValue("gray.50", "gray.600") }}
                    >
                      <Box position="relative" display="inline-block">
                        <Avatar
                          src={participant.profileImg || "../../public/aot.png"} // Default image fallback
                          name={participant.username}
                          size="lg"
                          mb={2}
                        />
                        <Checkbox
                          isChecked={selectedUsers.includes(convo._id)}
                          onChange={() => handleUserSelect(convo._id)} // Select conversation by ID
                          size="lg"
                          position="absolute"
                          bottom="0"
                          right="0"
                          borderRadius="full"
                          zIndex={1}
                        />
                      </Box>
                      <Text fontWeight="medium">{participant.username}</Text>
                    </Box>
                  ));
                })}
              </Stack>
            )}
          </ModalBody>

          {selectedUsers.length > 0 && (
            <Box px={6} py={4}>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add a message (optional)"
                size="sm"
                resize="none"
                borderRadius="md"
                border="1px solid"
                borderColor="gray.300"
                mb={4}
              />
            </Box>
          )}

          <ModalFooter>
            <Button
              colorScheme="blue"
              onClick={handleShare}
              isDisabled={selectedUsers.length === 0}
            >
              Send
            </Button>
            <Button onClick={() => setShowModal(false)} ml={3}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default SharePost;



const ShareSVG = () => {
	return (
		<svg
			aria-label='Share'
			color=''
			fill='rgb(243, 245, 247)'
			height='20'
			role='img'
			viewBox='0 0 24 24'
			width='20'
		>
			<title>Share</title>
			<line
				fill='none'
				stroke='currentColor'
				strokeLinejoin='round'
				strokeWidth='2'
				x1='22'
				x2='9.218'
				y1='3'
				y2='10.083'
			></line>
			<polygon
				fill='none'
				points='11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334'
				stroke='currentColor'
				strokeLinejoin='round'
				strokeWidth='2'
			></polygon>
		</svg>
	);
};



