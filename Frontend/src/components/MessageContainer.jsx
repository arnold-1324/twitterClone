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
import {
  selectedConversationAtom,
  selectedMsg,
  messagesAtom,
  conversationsAtom,
} from "../atom/messagesAtom";
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
import groupMessagesByDate from "../Utils/GroupMsg";
import "../styles/ChatResponsive.css";

const MotionFlex = motion(Flex);

const DateSeparator = ({ date }) => (
  <div className="date-separator">
    <div className="date-separator-badge">
      {date}
    </div>
  </div>
);

const MessageContainer = ({ isMobileView, setSelectedConversation }) => {
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

  const handleSetPlayingAudioId = (id) => {
    setPlayingAudioId(id);
  };

  const handelselectedMsg = (message) => {
    setSelectedMsg({
      id: message.id,
      text: message.text,
      media: message.media,
      mediaType: message.mediaType,
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
    setTimeout(() => setHighlightedMessageId(null), 2000);
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
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          const msgId = msg._id || msg.id;
          const editedId = editedMessage._id || editedMessage.id;
          return msgId === editedId ? { ...msg, ...editedMessage } : msg;
        })
      );
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
  }, [socket, selectedConversation?._id]);

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
        const otherTypingUsers = (typingUsers || []).filter(
          (id) => String(id) !== String(currentUser._id)
        );
        setTypingUsers(otherTypingUsers);
      }
    };

    socket.on("typingStatus", handleTypingStatus);
    return () => socket.off("typingStatus", handleTypingStatus);
  }, [socket, selectedConversation?._id, currentUser?._id]);

  const isGroupConversation = Boolean(selectedConversation?.isGroup);

  return (
    <div className="message-container">
      {/* Header */}
      <div className="message-container-header">
        {isMobileView && (
          <button
            className="mobile-back-button"
            onClick={clearSelectedConversation}
            aria-label="Back to conversations"
          >
            <BiArrowBack size={20} />
          </button>
        )}
        
        <Avatar
          className="message-container-avatar"
          src={selectedConversation?.userProfilePic}
          size="sm"
          bg={isGroupConversation ? "teal.500" : undefined}
        >
          {isGroupConversation && <FaUsers />}
        </Avatar>
        
        <div className="message-container-info">
          <div className="message-container-name">
            <Text as="span" noOfLines={1}>
              {selectedConversation?.username}
            </Text>
            {isGroupConversation && (
              <Badge ml={2} colorScheme="teal" variant="subtle" fontSize="xs">
                Group
              </Badge>
            )}
            {!isGroupConversation && (
              <Image src="/verified.png" w={4} h={4} ml={1} />
            )}
          </div>
          {isGroupConversation &&
            Array.isArray(selectedConversation?.participants) && (
              <div className="message-container-status">
                {selectedConversation.participants.length} members
              </div>
            )}
        </div>
        
        {isGroupConversation && (
          <IconButton
            icon={<FaInfoCircle />}
            aria-label="Group Info"
            size="sm"
            variant="ghost"
            onClick={() => setIsGroupManagementOpen(true)}
            minW="44px"
            h="44px"
          />
        )}
      </div>

      {/* Messages List */}
      <div className="messages-list">
        {loadingMessages
          ? [...Array(5)].map((_, i) => (
              <MotionFlex
                key={i}
                gap={2}
                alignItems="center"
                p={3}
                borderRadius="md"
                alignSelf={i % 2 === 0 ? "flex-start" : "flex-end"}
                maxW="80%"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                {i % 2 === 0 && <SkeletonCircle size={7} />}
                <Flex flexDir={"column"} gap={2}>
                  <Skeleton h="8px" w="200px" />
                  <Skeleton h="8px" w="150px" />
                  <Skeleton h="8px" w="180px" />
                </Flex>
                {i % 2 !== 0 && <SkeletonCircle size={7} />}
              </MotionFlex>
            ))
          : Object.entries(groupMessagesByDate(messages)).map(
              ([date, dateMessages]) => (
                <div key={date} style={{ width: "100%" }}>
                  <DateSeparator date={date} />
                  {dateMessages.map((message = {}) => {
                    const sender = message?.sender || {};
                    const senderId =
                      sender?._id ||
                      sender?.id ||
                      message?.sender ||
                      message?.senderId ||
                      "";
                    const isOwnMessage =
                      String(currentUser?._id || "") ===
                      String(senderId || "");
                    const isHighlighted =
                      String(highlightedMessageId || "") ===
                      String(message?._id || "");

                    return (
                      <Flex
                        key={message?._id || message?.messageId || Math.random()}
                        justifyContent={isOwnMessage ? "flex-end" : "flex-start"}
                        mb={3}
                        width="100%"
                      >
                        <Box
                          className={`message-bubble ${
                            isOwnMessage ? "message-bubble--own" : "message-bubble--other"
                          }`}
                          bg={isHighlighted ? "green.900" : undefined}
                          boxShadow={isHighlighted ? "0 0 10px rgba(34, 197, 94, 0.5)" : undefined}
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
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    messageId: msgId,
                                    newText,
                                    groupId: isGroupConversation
                                      ? selectedConversation?.groupId
                                      : undefined,
                                  }),
                                });
                                if (!res.ok)
                                  throw new Error("Failed to edit message");

                                const updated = await res.json();
                                setMessages((prev) =>
                                  prev.map((m) =>
                                    String(m?._id) === String(updated?._id)
                                      ? { ...m, ...updated }
                                      : m
                                  )
                                );
                                setConversations((prev) =>
                                  prev.map((c) =>
                                    String(c?._id) ===
                                    String(updated?.conversationId)
                                      ? {
                                          ...c,
                                          lastMessage: {
                                            text: updated?.text,
                                            sender: updated?.sender,
                                          },
                                        }
                                      : c
                                  )
                                );
                                setEditingMessageId(null);
                                setEditingText("");
                                return updated;
                              } catch (err) {
                                showToast(
                                  "Error",
                                  err?.message || "Edit failed",
                                  "error"
                                );
                                throw err;
                              }
                            }}
                          />
                        </Box>
                      </Flex>
                    );
                  })}
                </div>
              )
            )}

        <div ref={messageEndRef} />
      </div>

      {/* Scroll to Bottom Button */}
      <button
        className="scroll-to-bottom"
        onClick={scrollToBottom}
        aria-label="Scroll to bottom"
      >
        <FaAnglesDown size={18} />
      </button>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <Box w="100%" px={4} pb={2} position="relative">
          <TypingIndicator
            usernames={
              isGroupConversation
                ? typingUsers.map((id) => {
                    const participant =
                      (selectedConversation.participants || []).find(
                        (p) => String(p._id) === String(id)
                      );
                    return participant ? participant.username : "Someone";
                  })
                : [selectedConversation.username]
            }
          />
        </Box>
      )}

      {/* Input */}
      <div className="message-input-container">
        <MessageInput
          setMessages={setMessages}
          editingMessageId={editingMessageId}
          setEditingMessageId={setEditingMessageId}
          editingText={editingText}
          setEditingText={setEditingText}
          isGroupConversation={isGroupConversation}
          groupId={isGroupConversation ? selectedConversation.groupId : undefined}
        />
      </div>

      {/* Group Management */}
      <GroupManagement
        isOpen={isGroupManagementOpen}
        onClose={() => setIsGroupManagementOpen(false)}
      />
    </div>
  );
};

export default MessageContainer;
