import {
  Avatar,
  Divider,
  Flex,
  Image,
  Text,
  useColorModeValue,
  Skeleton,
  SkeletonCircle,
  IconButton,
  Box,
  Badge,
  Button,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import MessageInput from "./MessageInput";
import { useEffect, useRef, useState } from "react";
import useShowToast from "../hooks/useShowToast";
import { conversationsAtom, selectedConversationAtom, selectedMsg, messagesAtom } from "../atom/messagesAtom";
import { useRecoilValue, useSetRecoilState, useRecoilState } from "recoil";
import userAtom from "../atom/userAtom";
import { useSocket } from "../context/SocketContext";
import messageSound from "../assets/sounds/message.mp3";
import { BiArrowBack } from "react-icons/bi";
import { FaAnglesDown } from "react-icons/fa6";
import { FaUsers, FaInfoCircle } from "react-icons/fa";
import Message from "./Message";
import TypingIndicator from "./TypingIndicator";
import AudioPlayer from "./AudioPlayer";
import GroupManagement from "./GroupManagement";

const MotionFlex = motion(Flex);

const MessageContainer = ({ isMobileView, setSelectedConversation }) => {
  // State for editing messages
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const showToast = useShowToast();
  const selectedConversation = useRecoilValue(selectedConversationAtom);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const setMessages = useSetRecoilState(messagesAtom);
  const messages = useRecoilValue(messagesAtom);
  const currentUser = useRecoilValue(userAtom);
  const { socket } = useSocket();
  const setConversations = useSetRecoilState(conversationsAtom);
  const messageEndRef = useRef(null);
  const [Msg, setSelectedMsg] = useRecoilState(selectedMsg);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isGroupManagementOpen, setIsGroupManagementOpen] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState(null);

  const clearSelectedConversation = () => {
    setSelectedConversation({});
  };

  // Always set the id, do not toggle
  const handleSetPlayingAudioId = (id) => {
    setPlayingAudioId(id);
  };

  const handelselectedMsg = (message) => {
    setSelectedMsg({
      id: message.id,
      text: message.text,
      media: message.media,
      mediaType: message.mediaType
    });
  };

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const updateMessageReactions = (messageId, updatedReactions) => {
    setMessages((prevMessages) =>
      prevMessages.map((message) => {
        const msgId = message._id || message.id;
        return msgId === messageId
          ? { ...message, reactions: updatedReactions }
          : message;
      })
    );
  };

  const handleDelete = async (messageId) => {
    const response = await fetch("/api/messages/deleteforme", {
      method: "PUT",
      body: JSON.stringify({ messageId }),
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      showToast("Error", "Unexpected error", "error");
      return;
    }

    setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    showToast({
      type: "success",
      title: "Message deleted successfully",
    });
  };

  const handleHighlightMessage = (messageId) => {
    setHighlightedMessageId(messageId);
    setTimeout(() => setHighlightedMessageId(null), 2000); // Remove highlight after 2 seconds
  };

  useEffect(() => {
    const handleNewMessage = (message) => {
      if (selectedConversation?._id === message.conversationId) {
        setMessages((prev) => [...prev, message]);
      }
      if (!document.hasFocus()) {
        new Audio(messageSound).play();
      }
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation._id === message.conversationId
            ? {
                ...conversation,
                lastMessage: { text: message.text, sender: message.sender },
              }
            : conversation
        )
      );
    };

    const handleNewGroupMessage = ({ message, groupId, conversationId }) => {
      if (selectedConversation?._id === conversationId) {
        setMessages((prev) => [...prev, message]);
      }
      if (!document.hasFocus()) {
        new Audio(messageSound).play();
      }
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation._id === conversationId
            ? {
                ...conversation,
                lastMessage: { text: message.text, sender: message.sender },
              }
            : conversation
        )
      );
    };

    const handleMessageReactionUpdated = ({ messageId, reactions }) => {
      updateMessageReactions(messageId, reactions);
    };

    const handleMessageEdited = (editedMessage) => {
      debugger;
      // Use editedMessage (not `message`) and safely update local messages
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          const msgId = msg._id || msg.id;
          const editedId = editedMessage._id || editedMessage.id;
          return msgId === editedId ? { ...msg, ...editedMessage } : msg;
        })
      );

      // Clear editing UI state
      setEditingMessageId(null);
      setEditingText("");
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("newGroupMessage", handleNewGroupMessage);
    socket.on("messageReactionUpdated", handleMessageReactionUpdated);
    socket.on("messageEdited", handleMessageEdited);

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("newGroupMessage", handleNewGroupMessage);
      socket.off("messageReactionUpdated", handleMessageReactionUpdated);
      socket.off("messageEdited", handleMessageEdited);
    };
  }, [socket, selectedConversation?._id, setConversations, setMessages, setEditingMessageId, setEditingText]);

  useEffect(() => {
    const timer = setTimeout(() => {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return () => clearTimeout(timer);
  }, [setMessages]);

  useEffect(() => {
    const getMessages = async () => {
      setLoadingMessages(true);
      setMessages([]);
      try {
        if (selectedConversation?.mock) return;

        let url;
        if (selectedConversation?.isGroup && selectedConversation?.groupId) {
          url = `/api/messages/group/${selectedConversation.groupId}`;
        } else {
          url = `/api/messages/${selectedConversation.userId}`;
        }

        const res = await fetch(url);
        const data = await res.json();
        if (data.error) {
          showToast("Error", data.error, "error");
          return;
        }
        setMessages(data);
      } catch (error) {
        showToast("Error", error.message, "error");
      } finally {
        setLoadingMessages(false);
      }
    };
    getMessages();
  }, [
    selectedConversation?.userId,
    selectedConversation?.groupId,
    selectedConversation?.isGroup,
    selectedConversation?.mock,
    setMessages,
  ]);

  useEffect(() => {
    if (!socket || !selectedConversation?._id) return;

    const handleTypingStatus = ({ conversationId, typingUsers }) => {
      if (conversationId === selectedConversation._id) {
        // Filter out current user and keep ids as strings
        const otherTypingUsers = (typingUsers || []).filter((id) => String(id) !== String(currentUser._id));
        setTypingUsers(otherTypingUsers);
      }
    };

    socket.on("typingStatus", handleTypingStatus);
    return () => socket.off("typingStatus", handleTypingStatus);
  }, [socket, selectedConversation?._id, currentUser?._id]);

  // Check if current conversation is a group
  const isGroupConversation = Boolean(selectedConversation?.isGroup);

  return (
    <Flex
      flex="70"
      bg={useColorModeValue("gray.900", "black")}
      borderRadius="md"
      p={4}
      flexDirection="column"
      maxW="496.22px"
      maxH="537.05px"
      overflow="hidden"
      minWidth="340px"
      width="100%"
    >
      <Flex w="full" h={12} alignItems="center" gap={2} mb={2}>
        {isMobileView && (
          <IconButton
            icon={<BiArrowBack />}
            aria-label="Back to conversations"
            onClick={clearSelectedConversation}
            alignSelf="flex-start"
          />
        )}
        <Avatar
          src={selectedConversation?.userProfilePic}
          size="sm"
          bg={isGroupConversation ? "teal.500" : undefined}
        >
          {isGroupConversation && <FaUsers />}
        </Avatar>
        <Flex direction="column" flex="1">
          <Text display="flex" alignItems="center">
            {selectedConversation?.username}
            {isGroupConversation && (
              <Badge ml={2} colorScheme="teal" variant="subtle">
                Group
              </Badge>
            )}
            {!isGroupConversation && <Image src="/verified.png" w={4} h={4} ml={1} />}
          </Text>
          {isGroupConversation && Array.isArray(selectedConversation?.participants) && (
            <Text fontSize="xs" color="gray.400">
              {selectedConversation.participants.length} members
            </Text>
          )}
        </Flex>
        {isGroupConversation && (
          <IconButton
            icon={<FaInfoCircle />}
            aria-label="Group Info"
            size="sm"
            variant="ghost"
            onClick={() => setIsGroupManagementOpen(true)}
          />
        )}
      </Flex>

      <Divider />

      <Flex
        flexDir="column"
        gap={14}
        my={4}
        p={2}
        height="calc(400px - 2rem)"
        overflowY="auto"
        overflowX="hidden"
        borderRadius="md"
        bg={useColorModeValue("gray.800", "black")}
        boxShadow="md"
        width="100%"
        minWidth="0"
        sx={{
          "::-webkit-scrollbar": {
            width: "8px",
          },
          "::-webkit-scrollbar-track": {
            background: "#f1f1f1",
          },
          "::-webkit-scrollbar-thumb": {
            background: "#888",
            borderRadius: "50%",
          },
          "::-webkit-scrollbar-thumb:hover": {
            background: "#555",
          },
        }}
      >
        {loadingMessages
          ? [...Array(5)].map((_, i) => (
              <MotionFlex
                key={i}
                gap={2}
                alignItems="center"
                p={1}
                borderRadius="md"
                alignSelf={i % 2 === 0 ? "flex-start" : "flex-end"}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                {i % 2 === 0 && <SkeletonCircle size={7} />}
                <Flex flexDir={"column"} gap={2}>
                  <Skeleton h="8px" w="250px" />
                  <Skeleton h="8px" w="250px" />
                  <Skeleton h="8px" w="250px" />
                  <Skeleton h="8px" w="250px" />
                </Flex>
                {i % 2 === 0 && <SkeletonCircle size={7} />}
              </MotionFlex>
            ))
          : messages.map((message) => {
              const sender = message.sender || {};
              const senderId = sender._id || sender.id || message.sender;
              const isOwnMessage = String(currentUser._id) === String(senderId);
              const isHighlighted = highlightedMessageId === message._id;
              return (
                <Flex
                  id="message-box"
                  key={message._id}
                  justifyContent={isOwnMessage ? "flex-end" : "flex-start"}
                  mb={2}
                  width="100%"
                >
                  <Box
                    bg={isHighlighted ? "green.900" : "transparent"}
                    minW="120px"
                    maxW={message.audio ? "100%" : { base: "90%", md: "75%" }}
                    width={message.audio ? "100%" : undefined}
                    borderRadius="lg"
                    wordBreak="break-word"
                    boxShadow="sm"
                    px={1}
                    py={1}
                    display="inline-block"
                  >
                    <Message
                      message={message}
                      isOwnMessage={isOwnMessage}
                      handelselectedMsg={handelselectedMsg}
                      handleDelete={handleDelete}
                      updateMessageReactions={updateMessageReactions}
                      handleHighlightMessage={handleHighlightMessage}
                      isGroupMessage={isGroupConversation}
                      playingAudioId={playingAudioId}
                      setPlayingAudioId={handleSetPlayingAudioId}
                      editingMessageId={editingMessageId}
                      setEditingMessageId={setEditingMessageId}
                      setEditingText={setEditingText}
                      onEditSubmit={async (msgId, newText) => {
                        try {
                          const res = await fetch("/api/messages/edit", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              messageId: msgId,
                              newText,
                              groupId: isGroupConversation ? selectedConversation.groupId : undefined,
                            }),
                          });
                          if (!res.ok) throw new Error("Failed to edit message");

                          const updated = await res.json(); 
                          setMessages(prev =>
                            prev.map(m => (String(m._id) === String(updated._id) ? { ...m, ...updated } : m))
                          );
                          setConversations(prev =>
                            prev.map(c =>
                              String(c._id) === String(updated.conversationId)
                                ? { ...c, lastMessage: { text: updated.text, sender: updated.sender } }
                                : c
                            )
                          );
                          setEditingMessageId(null);
                          setEditingText("");
                          return updated;
                        } catch (err) {
                          showToast("Error", err.message || "Edit failed", "error");
                          throw err; 
                        }
                      }}

                    />
                  </Box>
                </Flex>
              );
            })}
        <div ref={messageEndRef} />
        <IconButton
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
          position="absolute"
          alignSelf={"flex-end"}
          top={"430px"}
          rounded={"full"}
          bg={useColorModeValue("gray.800", "gray.700")}
        >
          <FaAnglesDown size={24} />
        </IconButton>
      </Flex>

      {typingUsers.length > 0 && (
        <Box w="100%" px={2} pb={1} position="relative">
          <TypingIndicator
            usernames={
              isGroupConversation
                ? typingUsers.map((id) => {
                    const participant = (selectedConversation.participants || []).find(
                      (p) => String(p._id) === String(id)
                    );
                    return participant ? participant.username : "Someone";
                  })
                : [selectedConversation.username]
            }
          />
        </Box>
      )}

      <MessageInput
        setMessages={setMessages}
        editingMessageId={editingMessageId}
        setEditingMessageId={setEditingMessageId}
        editingText={editingText}
        setEditingText={setEditingText}
        isGroupConversation={isGroupConversation}
        groupId={isGroupConversation ? selectedConversation.groupId : undefined}
      />

      {/* Group Management Modal */}
      <GroupManagement isOpen={isGroupManagementOpen} onClose={() => setIsGroupManagementOpen(false)} />
    </Flex>
  );
};

export default MessageContainer;
