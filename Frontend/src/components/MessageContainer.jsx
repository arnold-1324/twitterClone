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
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import MessageInput from "./MessageInput";
import { useEffect, useRef, useState } from "react";
import useShowToast from "../hooks/useShowToast";
import { conversationsAtom, selectedConversationAtom, selectedMsg,messagesAtom } from "../atom/messagesAtom";
import { useRecoilValue, useSetRecoilState, useRecoilState } from "recoil";
import userAtom from "../atom/userAtom";
import { useSocket } from "../context/SocketContext";
import messageSound from "../assets/sounds/message.mp3";
import { BiArrowBack } from "react-icons/bi";
import { FaAnglesDown } from "react-icons/fa6";
import Message from "./Message";
import TypingIndicator from "./TypingIndicator";

const MotionFlex = motion(Flex);

const MessageContainer = ({ isMobileView, setSelectedConversation }) => {
  const showToast = useShowToast();
  const selectedConversation = useRecoilValue(selectedConversationAtom);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const  setMessages = useSetRecoilState(messagesAtom);
  const messages = useRecoilValue(messagesAtom);
  const currentUser = useRecoilValue(userAtom);
  const { socket } = useSocket();
  const setConversations = useSetRecoilState(conversationsAtom);
  const messageEndRef = useRef(null);
  const [Msg, setSelectedMsg] = useRecoilState(selectedMsg);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);

  const clearSelectedConversation = () => {
    setSelectedConversation({});
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
      prevMessages.map((message) =>
        message._id === messageId
          ? { ...message, reactions: updatedReactions }
          : message
      )
    );
  };

  const handleDelete = async (messageId) => {
    const response = await fetch("api/messages/deleteforme", {
      method: "DELETE",
      body: JSON.stringify({ messageId }),
    });

    if (!response.ok) {
      showToast({
        type: "error",
        title: "Error deleting message",
      });
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
      if (selectedConversation._id === message.conversationId) {
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

    socket.on("newMessage", handleNewMessage);

    return () => socket.off("newMessage", handleNewMessage);
  }, [socket, selectedConversation._id, setConversations]);

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
        if (selectedConversation.mock) return;
        const res = await fetch(
          `api/messages/${selectedConversation.userId}`
        );
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
  }, [selectedConversation.userId, selectedConversation.mock]);

  useEffect(() => {
    if (!socket || !selectedConversation._id) return;
    const handleTypingStatus = ({ conversationId, typingUsers }) => {
      if (conversationId === selectedConversation._id) {
        setTypingUsers(typingUsers.filter((id) => id !== currentUser._id));
      }
    };
    socket.on("typingStatus", handleTypingStatus);
    return () => socket.off("typingStatus", handleTypingStatus);
  }, [socket, selectedConversation._id, currentUser._id]);

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
        <Avatar src={selectedConversation.userProfilePic} size="sm" />
        <Text display="flex" alignItems="center">
          {selectedConversation.username}{" "}
          <Image src="/verified.png" w={4} h={4} ml={1} />
        </Text>
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
            const isOwnMessage =
              currentUser._id === message.sender._id ||
              currentUser._id === message.sender.id ||
              currentUser._id === message.sender;
            const isHighlighted = highlightedMessageId === message._id;
            return (
              <Box
                key={message._id}
                bg={isHighlighted ? "green.900" : "transparent"}
              >
                <Message
                  message={message}
                  isOwnMessage={isOwnMessage}
                  handelselectedMsg={handelselectedMsg}
                  handleDelete={handleDelete}
                  updateMessageReactions={updateMessageReactions}
                  handleHighlightMessage={handleHighlightMessage}
                />
              </Box>
            );
          })}
          
        {typingUsers.length > 0 && (
          <TypingIndicator
            usernames={typingUsers.length === 1
              ? [selectedConversation.username]
              : typingUsers.map((id) => {
                  const participant = (selectedConversation.participants || []).find(
                    (p) => p._id === id
                  );
                  return participant ? participant.username : "Someone";
                })
            }
          />
        )}
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

      <MessageInput setMessages={setMessages} />
    </Flex>
  );
};

export default MessageContainer;
