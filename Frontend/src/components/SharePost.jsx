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
  Input,
  useColorModeValue,
  IconButton,
} from "@chakra-ui/react";
import { useRecoilValue, useRecoilState } from "recoil";
import userAtom from "../atom/userAtom";
import postsAtom from "../atom/postsAtom";
import { LuSend } from "react-icons/lu";

const SharePost = ({ postId }) => {
  const [showModal, setShowModal] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]); // selected conversation IDs
  const [text, setText] = useState("");
  const [posts, setPosts] = useRecoilState(postsAtom);
  const user = useRecoilValue(userAtom);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    // wait until we have user._id to reliably filter participants
    if (!user || !user._id) return;

    let mounted = true;
    const getConversations = async () => {
      setLoadingConversations(true);
      try {
        const res = await fetch("/api/messages/getConvo/user");
        if (!res.ok) throw new Error(`Network error: ${res.status}`);
        const data = await res.json();
        console.log("fetched conversations:", data);
        if (!mounted) return;
        setConversations(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Unable to load conversations:", error);
        if (mounted) setConversations([]);
      } finally {
        if (mounted) setLoadingConversations(false);
      }
    };

    getConversations();
    return () => {
      mounted = false;
    };
  }, [user && user._id]);

  const handleUserSelect = (convoId) => {
    setSelectedUsers((prev) =>
      prev.includes(convoId) ? prev.filter((id) => id !== convoId) : [...prev, convoId]
    );
  };

  const handleShare = async () => {
    if (selectedUsers.length === 0) {
      alert("Please select at least one conversation/group.");
      return;
    }

    setSharing(true);
    try {
      // Post to backend for every selected conversation
      const responses = await Promise.all(
        selectedUsers.map((conversationId) =>
          fetch("/api/posts/sharepost", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              postId,
              senderId: user._id,
              conversationId,
              text,
            }),
          })
        )
      );

      for (const res of responses) {
        if (!res.ok) {
          console.error("Share request failed:", res.status, await res.text());
          throw new Error("One of the share requests failed.");
        }
        const data = await res.json();
        // Update shareCount from backend response if provided
        if (data?.post?._id) {
          setPosts((prev) =>
            prev.map((p) => (p._id === data.post._id ? { ...p, shareCount: data.post.shareCount } : p))
          );
        } else {
          console.warn("Share response didn't contain updated post:", data);
        }
      }

      // reset
      setSelectedUsers([]);
      setText("");
      setShowModal(false);
    } catch (err) {
      console.error("Error sharing post:", err);
      alert("Failed to share post. Check console & try again.");
    } finally {
      setSharing(false);
    }
  };

  // Filter & prepare display list:
  const visibleConversations = conversations
    .filter(Boolean)
    .filter((convo) => {
      // hide empty convo objects
      if (!convo) return false;
      // If group, must have groupInfo
      if (convo.isGroup) return !!convo.groupInfo;
      // For DMs ensure there's someone other than the current user
      return Array.isArray(convo.participants) && convo.participants.some((p) => p._id && p._id !== user._id);
    })
    .filter((convo) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      if (convo.isGroup && convo.groupInfo?.name) return convo.groupInfo.name.toLowerCase().includes(term);
      // else match other participant username
      const other = convo.participants?.find((p) => p._id !== user._id) || convo.participants?.[0];
      return other?.username?.toLowerCase().includes(term);
    });

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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Select Users to Share</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Input
              placeholder="Search users or groups..."
              mb={3}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {loadingConversations ? (
              <Box textAlign="center" py={4}>
                <Spinner size="lg" />
                <Text mt={2}>Loading conversations...</Text>
              </Box>
            ) : visibleConversations.length === 0 ? (
              <Box textAlign="center" py={6}>
                <Text>No conversations found.</Text>
                <Text fontSize="sm" color="gray.500">
                  (Make sure your conversations endpoint returns data and that `user._id` is available.)
                </Text>
              </Box>
            ) : (
              <Stack spacing={3} maxH="300px" overflowY="auto" direction="row" wrap="wrap">
                {visibleConversations.map((convo) => {
                  // Render group as single card
                  if (convo.isGroup && convo.groupInfo) {
                    const isChecked = selectedUsers.includes(convo._id);
                    return (
                      <Box
                        key={convo._id}
                        display="flex"
                        flexDirection="column"
                        alignItems="center"
                        p={3}
                        bg={useColorModeValue("white", "gray.700")}
                        borderRadius="md"
                        boxShadow="md"
                        cursor="pointer"
                        _hover={{ bg: useColorModeValue("gray.50", "gray.600") }}
                        onClick={() => handleUserSelect(convo._id)}
                        minW="110px"
                        textAlign="center"
                      >
                        <Box position="relative" display="inline-block">
                          <Avatar
                            src={convo.groupInfo.profileImage || "/aot.png"} // public folder fallback
                            name={convo.groupInfo.name}
                            size="lg"
                            mb={2}
                          />
                          <Checkbox
                            isChecked={isChecked}
                            onChange={() => handleUserSelect(convo._id)}
                            size="lg"
                            position="absolute"
                            bottom="0"
                            right="0"
                            borderRadius="full"
                            zIndex={1}
                          />
                        </Box>
                        <Text fontWeight="medium" noOfLines={1} maxW="110px">
                          {convo.groupInfo.name}
                        </Text>
                      </Box>
                    );
                  }

                  // Render DM as a single card keyed by convo._id (not participant._id)
                  const other = convo.participants?.find((p) => p._id !== user._id) || convo.participants?.[0];
                  if (!other) return null;
                  const isChecked = selectedUsers.includes(convo._id);
                  return (
                    <Box
                      key={convo._id}
                      display="flex"
                      flexDirection="column"
                      alignItems="center"
                      p={3}
                      bg={useColorModeValue("white", "gray.700")}
                      borderRadius="md"
                      boxShadow="md"
                      cursor="pointer"
                      _hover={{ bg: useColorModeValue("gray.50", "gray.600") }}
                      onClick={() => handleUserSelect(convo._id)}
                      minW="110px"
                      textAlign="center"
                    >
                      <Box position="relative" display="inline-block">
                        <Avatar
                          src={other.profileImg || "/aot.png"}
                          name={other.username}
                          size="lg"
                          mb={2}
                        />
                        <Checkbox
                          isChecked={isChecked}
                          onChange={() => handleUserSelect(convo._id)}
                          size="lg"
                          position="absolute"
                          bottom="0"
                          right="0"
                          borderRadius="full"
                          zIndex={1}
                        />
                      </Box>
                      <Text fontWeight="medium" noOfLines={1} maxW="110px">
                        {other.username}
                      </Text>
                    </Box>
                  );
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
            <Button colorScheme="blue" onClick={handleShare} isDisabled={selectedUsers.length === 0 || sharing}>
              {sharing ? "Sending..." : "Send"}
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
