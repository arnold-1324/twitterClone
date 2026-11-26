import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import { FiPhone, FiVideo } from "react-icons/fi";
import { CallContext } from "../context/call.js";
import {
  Avatar,
  Flex,
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
import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { FaUsers, FaInfoCircle } from "react-icons/fa";
import Message from "./Message";
import TypingIndicator from "./TypingIndicator";
import AudioPlayer from "./AudioPlayer";
import GroupManagement from "./GroupManagement";
import groupMessagesByDate from "../Utils/GroupMsg";

const MotionFlex = motion(Flex);

const DateSeparator = ({ date }) => (
  <Flex justify="center" align="center" my={4}>
    <Box
      px={4}
      py={1}
      bg={useColorModeValue("gray.700", "gray.600")}
      borderRadius="full"
      shadow="sm"
    >
      <Text fontSize="xs" color="white">
        {date}
      </Text>
    </Box>
  </Flex>
);

const MessageContainer = ({ isMobileView, setSelectedConversation }) => {
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const showToast = useShowToast();

  const selectedConversation = useRecoilValue(selectedConversationAtom);
  const { _id: conversationId, mock, isGroup, groupId, userId } = selectedConversation;
  const [loadingMessages, setLoadingMessages] = useState(true);
  const setMessages = useSetRecoilState(messagesAtom);
  const messages = useRecoilValue(messagesAtom);
  const currentUser = useRecoilValue(userAtom);
  const { socket } = useSocket();
  const setConversations = useSetRecoilState(conversationsAtom);
  const messageEndRef = useRef(null);
  const historyRef = useRef(null);
  const heightBefore = useRef(null);
  const loadOlder = useRef(null);
  const [older, setOlder] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
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
    const response = await apiFetch("/api/messages/deleteforme", {
      method: "PUT",
      body: JSON.stringify({ messageId }),
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      showToast("Error", "Unexpected error", "error");
      return;
    }

    setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    showToast("Message deleted", undefined, "success");
  };

  const handleHighlightMessage = (messageId) => {
    setHighlightedMessageId(messageId);
    setTimeout(() => setHighlightedMessageId(null), 2000);
  };

  useEffect(() => {
    const handleNewMessage = (message) => {
      if (selectedConversation?._id === message.conversationId) {
        setMessages((prev) => prev.some((item) => item._id === message._id) ? prev : [...prev, message]);
      }
      if (!document.hasFocus()) {
        void new Audio(messageSound).play().catch(() => {});
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
        setMessages((prev) => prev.some((item) => item._id === message._id) ? prev : [...prev, message]);
      }
      if (!document.hasFocus()) {
        void new Audio(messageSound).play().catch(() => {});
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
    const handleMessageDeleted = ({ messageId }) => setMessages((items) => items.filter((item) => item._id !== messageId));
    socket.on("messageDeleted", handleMessageDeleted);

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("newGroupMessage", handleNewGroupMessage);
      socket.off("messageReactionUpdated", handleMessageReactionUpdated);
      socket.off("messageEdited", handleMessageEdited);
      socket.off("messageDeleted", handleMessageDeleted);
    };
  }, [socket, selectedConversation?._id]);

  useLayoutEffect(() => {
    const history = historyRef.current;
    if (heightBefore.current && history) {
      const { height, offset } = heightBefore.current;
      history.scrollTop = offset + history.scrollHeight - height;
      heightBefore.current = null;
    } else messageEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const controller = new AbortController();
    const url = isGroup ? `/api/messages/group/${groupId}` : `/api/messages/${userId}`;
    let currentRequest = 0;
    let olderPending = false;
    loadOlder.current = async (before) => {
      if (!before || olderPending) return;
      olderPending = true;
      setLoadingOlder(true);
      try {
        const response = await apiFetch(`${url}?before=${encodeURIComponent(before)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Could not load earlier messages.");
        const data = await readApiJson(response);
        if (controller.signal.aborted) return;
        setOlder(response.headers.get("X-Next-Cursor") || "");
        const history = historyRef.current;
        if (history) heightBefore.current = { height: history.scrollHeight, offset: history.scrollTop };
        setMessages((items) => [...data.filter((item) => !items.some(({ _id }) => _id === item._id)), ...items]);
      } catch (error) {
        if (!controller.signal.aborted) showToast("Error", error.message, "error");
      } finally {
        olderPending = false;
        if (!controller.signal.aborted) setLoadingOlder(false);
      }
    };
    async function load() {
      const version = ++currentRequest;
      try {
        if (mock) return;
        const response = await apiFetch(url, { signal: controller.signal });
        const data = await readApiJson(response);
        if (!response.ok) throw new Error(data.error || "Could not load messages.");
        if (!controller.signal.aborted && version === currentRequest) {
          if (version === 1) setOlder(response.headers.get("X-Next-Cursor") || "");
          setMessages((current) => {
            const history = new Map(data.map((message) => [message._id, message]));
            for (const message of current) if (!history.has(message._id)) history.set(message._id, message);
            return [...history.values()].sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt));
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) showToast("Error", error.message, "error");
      } finally {
        if (!controller.signal.aborted && version === currentRequest) setLoadingMessages(false);
      }
    }
    setMessages([]);
    setOlder("");
    setLoadingOlder(false);
    heightBefore.current = null;
    setLoadingMessages(true);
    load();
    socket?.on("connect", load);
    return () => {
      controller.abort();
      socket?.off("connect", load);
    };
  }, [conversationId, mock, isGroup, groupId, userId, setMessages, showToast, socket]);

  useEffect(() => {
    if (!socket || !selectedConversation?._id) return;
    const expiry = new Map();
    setTypingUsers([]);
    function handleTypingStatus({ conversationId, userId, isTyping }) {
      if (conversationId !== selectedConversation._id || userId === currentUser._id) return;
      clearTimeout(expiry.get(userId));
      expiry.delete(userId);
      if (!isTyping) {
        setTypingUsers((users) => users.filter((id) => id !== userId));
        return;
      }
      setTypingUsers((users) => users.includes(userId) ? users : [...users, userId]);
      expiry.set(userId, setTimeout(() => {
        expiry.delete(userId);
        setTypingUsers((users) => users.filter((id) => id !== userId));
      }, 2600));
    }
    socket.on("typingStatus", handleTypingStatus);
    return () => {
      expiry.forEach(clearTimeout);
      socket.off("typingStatus", handleTypingStatus);
    };
  }, [socket, selectedConversation?._id, currentUser?._id]);

  const isGroupConversation = Boolean(selectedConversation?.isGroup);
  const call = useContext(CallContext);

  return (
    <Flex className="thread-container" direction="column" minW={0} minH={0} w="full">
      <Flex className="thread-heading" alignItems="center" gap={3}>
        {isMobileView && (
          <IconButton
            icon={<BiArrowBack />}
            aria-label="Back to conversations"
            className="thread-back"
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
          </Text>
          {isGroupConversation &&
            Array.isArray(selectedConversation?.participants) && (
              <Text fontSize="xs" color="gray.400">
                {selectedConversation.participants.length} members
              </Text>
            )}
        </Flex>
        {!isGroupConversation && !selectedConversation.mock && call && <>
          <IconButton icon={<FiPhone />} aria-label="Start voice call" variant="ghost" size="sm"
            isDisabled={call.busy} onClick={() => call.start(selectedConversation, "audio")} />
          <IconButton icon={<FiVideo />} aria-label="Start video call" variant="ghost" size="sm"
            isDisabled={call.busy} onClick={() => call.start(selectedConversation, "video")} />
        </>}
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

      <Flex ref={historyRef} role="log" aria-label="Messages" className="thread-history" direction="column" gap={4} minH={0} overflowY="auto">
        {older && <Button size="sm" alignSelf="center" flexShrink={0} isLoading={loadingOlder}
          variant="outline" onClick={() => loadOlder.current?.(older)}>Load earlier messages</Button>}
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
          : Object.entries(groupMessagesByDate(messages)).map(
              ([date, dateMessages]) => (
                <Box key={date} width="100%">
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
                        id={`message-${message._id}`}
                        key={
                          message?._id ||
                          message?.messageId ||
                          Math.random()
                        }
                        justifyContent={
                          isOwnMessage ? "flex-end" : "flex-start"
                        }
                        mb={2}
                        width="100%"
                      >
                        <Box
                          bg={isHighlighted ? "green.900" : "transparent"}
                          minW={0}
                          maxW={
                            message?.audio ? "100%" : { base: "90%", md: "75%" }
                          }
                          width={message?.audio ? "100%" : undefined}
                          borderRadius="lg"
                          wordBreak="break-word"
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
                                const res = await apiFetch("/api/messages/edit", {
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

                                const updated = await readApiJson(res);
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
                </Box>
              )
            )}

        <div ref={messageEndRef} />
      </Flex>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <Box className="thread-typing" role="status">
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
      <MessageInput
        onConversationReady={(message) => {
          if (selectedConversation.mock) {
            const chat = { ...selectedConversation, _id: message.conversationId, mock: false, lastMessage: message };
            setSelectedConversation(chat);
            setConversations((current) => [chat, ...current.filter(({ _id }) => _id !== chat._id)]);
          } else {
            setConversations((current) => current.map((chat) => chat._id === message.conversationId ? { ...chat, lastMessage: message } : chat));
          }
        }}
        setMessages={setMessages}
        editingMessageId={editingMessageId}
        setEditingMessageId={setEditingMessageId}
        editingText={editingText}
        setEditingText={setEditingText}
        isGroupConversation={isGroupConversation}
        groupId={isGroupConversation ? selectedConversation.groupId : undefined}
      />

      {/* Group Management */}
      <GroupManagement
        isOpen={isGroupManagementOpen}
        onClose={() => setIsGroupManagementOpen(false)}
      />
    </Flex>
  );
};

export default MessageContainer;
