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
} from "@chakra-ui/react";
import { useRecoilValue } from "recoil";
import userAtom from "../atom/userAtom";

const SharePost = ({ postId }) => {
  const [showModal, setShowModal] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]); // Selected conversation ids
  const [text, setText] = useState("");
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
        const res = await fetch("api/posts/sharepost", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ postId, senderId, conversationId, text }),
        });

        if (!res.ok) {
          throw new Error(`Failed to share post with conversation ${conversationId}`);
        }

        return res.json();
      });

      await Promise.all(sharePostPromises);
      alert("Post shared successfully!");
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
      {/* Share Icon */}
      <Button
        onClick={() => setShowModal(true)}
        variant="ghost"
        fontSize="1.5rem"
        cursor="pointer"
      >
        🔗 Share
      </Button>

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
                    (participant) => participant._id !== convo.lastMessage.sender
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
