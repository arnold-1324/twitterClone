import usePresence from "../hooks/usePresence";
import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import { FiArrowDown, FiPhone, FiVideo } from "react-icons/fi";
import { LuPalette, LuSnowflake } from "react-icons/lu";
import Snowfall from "react-snowfall";
import { CallContext, formatCallDuration } from "../context/call.js";
import {
  Avatar,
  Flex,
  Text,
  useColorModeValue,
  usePrefersReducedMotion,
  Skeleton,
  SkeletonCircle,
  IconButton,
  Box,
  Badge,
  Button,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import MessageInput from "./MessageInput";
import ChatThemePicker from "./ChatThemePicker";
import { chatWallpaperStyle, getChatFont, getChatTheme } from "../lib/chatThemes";
import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import useShowToast from "../hooks/useShowToast";
import {
  selectedConversationAtom,
  selectedMsg,
  messagesAtom,
  conversationsAtom,
  mergeConversationTheme,
} from "../atom/messagesAtom";
import { useAppValue, useSetAppValue, useAppState } from "../state/store";
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
import formatMessageTime from "../Utils/Timeformate";

const MotionFlex = motion(Flex);

function mergeLiveLocation(message, location) {
  return message.location && (location.revision ?? 0) > (message.location.revision ?? 0)
    ? { ...message, location } : message;
}

function CallHistory({ message, outgoing }) {
  const { mode, outcome, durationSeconds } = message.call;
  const completed = outcome === "completed";
  const Icon = mode === "video" ? FiVideo : FiPhone;
  const title = mode === "video" ? "Video call" : "Voice call";
  const status = completed ? null : message.text?.split(" · ")[1];
  const details = [outgoing ? "Outgoing" : "Incoming", status,
    Number.isInteger(durationSeconds) ? formatCallDuration(durationSeconds) : null].filter(Boolean);
  return <div className="call-history-row">
    <article className={`call-history-card${outgoing ? " call-history-outgoing" : ""}`}
      aria-label={`${title}, ${details.join(", ")}`}>
      <span className={`call-history-icon${completed ? "" : " call-history-pending"}`}><Icon aria-hidden="true" /></span>
      <div><strong>{title}</strong><span>{details.join(" · ")}</span></div>
      <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
    </article>
  </div>;
}

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

  const selectedConversation = useAppValue(selectedConversationAtom);
  const { _id: conversationId, mock, isGroup, groupId, userId } = selectedConversation;
  const [loadingMessages, setLoadingMessages] = useState(true);
  const setMessages = useSetAppValue(messagesAtom);
  const messages = useAppValue(messagesAtom);
  const currentUser = useAppValue(userAtom);
  const { socket } = useSocket();
  const presence = usePresence();
  const [conversations, setConversations] = useAppState(conversationsAtom);
  const [changingSnowfall, setChangingSnowfall] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const conversation = conversations.find(({ _id }) => _id === conversationId) ?? selectedConversation;
  const snowfall = Boolean(conversation.snowfall);
  const background = getChatTheme(conversation.backgroundTheme, conversation.customBackgroundUrl);
  const font = getChatFont(conversation.chatFont);
  const wallpaper = background.id !== "default";
  const historyRef = useRef(null);
  const followLatest = useRef(true);
  const [awayFromLatest, setAwayFromLatest] = useState(false);
  const heightBefore = useRef(null);
  const loadOlder = useRef(null);
  const [older, setOlder] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [Msg, setSelectedMsg] = useAppState(selectedMsg);
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

  function trackScroll() {
    const history = historyRef.current;
    if (!history) return;
    const atLatest = history.scrollHeight - history.clientHeight - history.scrollTop < 64;
    followLatest.current = atLatest;
    setAwayFromLatest(!atLatest);
  }

  function jumpToLatest() {
    const history = historyRef.current;
    if (!history) return;
    history.scrollTo({ top: history.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
  }

  function handleLocationUpdate({ messageId, location }) {
    setMessages((items) => items.map((message) =>
      message._id === messageId ? mergeLiveLocation(message, location) : message));
  }

  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = (message) => {
      if (selectedConversation?._id === message.conversationId) {
        setMessages((prev) => prev.some((item) => item._id === message._id) ? prev : [...prev, message]);
      }
      if (!message.call && !document.hasFocus()) {
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
                lastMessage: { text: message.text, sender: message.sender, mentionedUsers: message.mentions?.map(({ user }) => user) },
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
    socket.on("liveLocationUpdated", handleLocationUpdate);
    const handleMessageDeleted = ({ messageId }) => setMessages((items) => items.filter((item) => item._id !== messageId));
    socket.on("messageDeleted", handleMessageDeleted);

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("newGroupMessage", handleNewGroupMessage);
      socket.off("messageReactionUpdated", handleMessageReactionUpdated);
      socket.off("messageEdited", handleMessageEdited);
      socket.off("liveLocationUpdated", handleLocationUpdate);
      socket.off("messageDeleted", handleMessageDeleted);
    };
  }, [socket, selectedConversation?._id]);

  useLayoutEffect(() => {
    const history = historyRef.current;
    if (!history) return;
    if (heightBefore.current) {
      const { height, offset } = heightBefore.current;
      history.scrollTop = offset + history.scrollHeight - height;
      heightBefore.current = null;
    } else if (followLatest.current) history.scrollTop = history.scrollHeight;
    trackScroll();
  }, [messages.length, loadingMessages]);

  const latestMessage = messages.at(-1);
  const latestId = latestMessage?.conversationId === conversationId ? latestMessage?._id : undefined;
  useEffect(() => {
    if (!latestId || !conversationId || loadingMessages || awayFromLatest || mock) return;
    const controller = new AbortController();
    let timer;
    function schedule() {
      clearTimeout(timer);
      if (document.visibilityState !== "visible") return;
      timer = setTimeout(() => {
        void apiFetch(`/api/messages/${conversationId}/read`, {
          method: "PATCH", signal: controller.signal, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: latestId }),
        }).then((response) => {
          if (response.ok) window.dispatchEvent(new Event("inbox-read"));
        }).catch(() => {});
      }, 180);
    }
    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      clearTimeout(timer);
      controller.abort();
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [latestId, conversationId, loadingMessages, awayFromLatest, mock]);

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
        const response = await apiFetch(`${url}?markRead=false`, { signal: controller.signal });
        const data = await readApiJson(response);
        if (!response.ok) throw new Error(data.error || "Could not load messages.");
        if (!controller.signal.aborted && version === currentRequest) {
          if (version === 1) setOlder(response.headers.get("X-Next-Cursor") || "");
          setMessages((current) => {
            const history = new Map(data.map((message) => [message._id, message]));
            for (const message of current) {
              const fresh = history.get(message._id);
              if (!fresh) history.set(message._id, message);
              else if (message.location) history.set(message._id, mergeLiveLocation(fresh, message.location));
            }
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
    followLatest.current = true;
    setLoadingMessages(true);
    load();
    socket?.on("connect", load);
    window.addEventListener("focus", load);
    return () => {
      controller.abort();
      socket?.off("connect", load);
      window.removeEventListener("focus", load);
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

  async function saveAppearance(change, file) {
    let body = JSON.stringify(change);
    if (file) {
      body = new FormData();
      for (const [name, value] of Object.entries(change)) body.append(name, value);
      body.append("background", file);
    }
    const response = await apiFetch(`/api/messages/${conversationId}/theme`, {
      method: "PATCH", body,
      headers: file ? undefined : { "Content-Type": "application/json" },
    });
    const theme = await readApiJson(response);
    if (!response.ok) throw new Error(theme.error || "Could not save the chat appearance.");
    setConversations((items) => items.map((chat) => chat._id === conversationId ? mergeConversationTheme(chat, theme) : chat));
    setSelectedConversation((chat) => chat._id === conversationId ? mergeConversationTheme(chat, theme) : chat);
  }

  async function toggleSnowfall() {
    setChangingSnowfall(true);
    try {
      await saveAppearance({ snowfall: !snowfall });
    } catch (error) {
      showToast("Snowfall unavailable", error.message, "error");
    } finally {
      setChangingSnowfall(false);
    }
  }

  const status = isGroupConversation ? {} : presence(selectedConversation.participants?.[0]);

  return (
    <Flex className={`thread-container${snowfall ? " thread-winter" : ""}`} direction="column" minW={0} minH={0} w="full"
      data-chat-font={font.id} style={font.family ? { "--chat-font": font.family } : undefined}>
      {snowfall && <div className={`thread-snow${reducedMotion ? " thread-snow-static" : ""}`} aria-hidden="true">
        {!reducedMotion && <Snowfall snowflakeCount={52} color="#d7ecff" radius={[0.8, 2.2]} speed={[0.9, 1.9]} wind={[-0.32, 0.55]} />}
      </div>}
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
        <div className="presence-avatar"><Avatar
          src={selectedConversation?.userProfilePic}
          size="sm"
          bg={isGroupConversation ? "teal.500" : undefined}
        >
          {isGroupConversation && <FaUsers />}
        </Avatar>{status.online && <span className="presence-dot" aria-hidden="true" />}</div>
        <Flex direction="column" flex="1">
          <Text display="flex" alignItems="center">
            {selectedConversation?.username}
            {isGroupConversation && (
              <Badge ml={2} colorScheme="teal" variant="subtle">
                Group
              </Badge>
            )}
          </Text>
          {status.label && <Text fontSize="xs" color="var(--dayline-dim)">{status.label}</Text>}
          {isGroupConversation &&
            Array.isArray(selectedConversation?.participants) && (
              <Text fontSize="xs" color="gray.400">
                {selectedConversation.participants.length} members
              </Text>
            )}
        </Flex>
        {!mock && <IconButton icon={<LuPalette />} aria-label="Customize chat" title="Customize chat"
          variant="ghost" size="sm" onClick={() => setThemePickerOpen(true)} />}
        {!mock && <IconButton icon={<LuSnowflake />} aria-label="Snowfall" title={snowfall ? "Turn off shared snowfall" : "Turn on shared snowfall"}
          variant="ghost" size="sm" className="thread-snow-button" aria-pressed={snowfall}
          isLoading={changingSnowfall} onClick={toggleSnowfall} />}
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

      <div className="thread-history-area">
      <Flex ref={historyRef} onScroll={trackScroll} role="log" aria-label="Messages"
        className={`thread-history${wallpaper ? " wallpaper-surface" : ""}`} data-chat-theme={background.id}
        style={wallpaper ? chatWallpaperStyle(background) : undefined} direction="column" gap={4} minH={0} overflowY="auto">
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
                    if (message.call) return <CallHistory key={message._id} message={message} outgoing={isOwnMessage} />;
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
                            onLocationUpdate={handleLocationUpdate}
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

      </Flex>
      {awayFromLatest && !loadingMessages && <IconButton className="thread-latest-button" icon={<FiArrowDown />}
        aria-label="Jump to latest messages" title="Jump to latest messages" onClick={jumpToLatest} />}
      </div>

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
          followLatest.current = true;
          if (selectedConversation.mock) {
            const chat = { ...selectedConversation, _id: message.conversationId, mock: false, lastMessage: message };
            setSelectedConversation(chat);
            setConversations((current) => [chat, ...current.filter(({ _id }) => _id !== chat._id)]);
          } else {
            setConversations((current) => current.map((chat) => chat._id === message.conversationId ? {
              ...chat, lastMessage: { ...message, mentionedUsers: message.mentions?.map(({ user }) => user) },
              updatedAt: message.createdAt,
            } : chat));
          }
        }}
        setMessages={setMessages}
        editingMessageId={editingMessageId}
        setEditingMessageId={setEditingMessageId}
        editingText={editingText}
        setEditingText={setEditingText}
        isGroupConversation={isGroupConversation}
        groupId={isGroupConversation ? selectedConversation.groupId : undefined}
        participants={isGroupConversation ? (conversations.find(({ _id }) => _id === conversationId)?.participants
          ?? selectedConversation.participants) : undefined}
      />

      {/* Group Management */}
      <GroupManagement
        isOpen={isGroupManagementOpen}
        onClose={() => setIsGroupManagementOpen(false)}
      />
      {themePickerOpen && <ChatThemePicker currentTheme={background.id}
        currentFont={font.id} savedImage={conversation.customBackgroundUrl}
        onApply={saveAppearance}
        onClose={() => setThemePickerOpen(false)} />}
    </Flex>
  );
};

export default MessageContainer;
