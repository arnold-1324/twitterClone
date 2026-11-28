import StickerPicker from "./Stickers";
import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import {
  Flex,
  Input,
  IconButton,
  Box,
  useToast,
  useColorModeValue,
  Spinner,
  Progress,
  Image,
  Text,
  Checkbox,
  CloseButton,
} from "@chakra-ui/react";
import { useState, useRef, useEffect, useContext, useId } from "react";
import { IoSendSharp } from "react-icons/io5";
import { FiMapPin, FiMic, FiPaperclip, FiRadio } from "react-icons/fi";
import { selectedConversationAtom, selectedMsg } from "../atom/messagesAtom";
import { LiveLocationContext } from "../context/liveLocation";
import userAtom from "../atom/userAtom";
import { useAppState, useAppValue } from "../state/store";
import useUploadWithProgress from "../hooks/useUploadWithProgress";
import useVoiceRecorder from "../hooks/useVoiceRecorder";
import VoiceComposer from "./VoiceComposer";
import { useSocket } from "../context/SocketContext";
import { MdPoll } from "react-icons/md";
import {
  Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalBody, ModalFooter, ModalCloseButton, Button, Menu, MenuButton, MenuItem, MenuList, Portal,
  VStack, Input as ChakraInput
} from "@chakra-ui/react";


function QueuedAttachment({ file, onRemove, disabled }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const preview = URL.createObjectURL(file);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file]);

  return <div className="queued-attachment">
    {url && <img src={url} alt="Selected attachment" />}
    <span title={file.name}>{file.name}</span>
    <CloseButton size="sm" onClick={onRemove} isDisabled={disabled} aria-label={`Remove ${file.name}`} />
  </div>;
}

const MessageInput = ({
  onConversationReady,
  setMessages,
  editingMessageId,
  setEditingMessageId,
  editingText,
  setEditingText,
  isGroupConversation,
  groupId,
  participants = [],
}) => {
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
   const [multiSelect, setMultiSelect] = useState(false);
   const [expiresAt, setExpiresAt] = useState("");
  const { upload, progress, isUploading } = useUploadWithProgress();
  const recipient = useAppValue(selectedConversationAtom);
  const userId = useAppValue(userAtom)?._id;
  const location = useContext(LiveLocationContext);
  const locationRequest = useRef(null);
  const [sharingLocation, setSharingLocation] = useState(false);
  const toast = useToast();
  const voice = useVoiceRecorder((description) =>
    toast({ title: "Voice recording", description, status: "error" }));
  const [replyMsg, setReply] = useAppState(selectedMsg);
  const { socket } = useSocket();
  const lastTyping = useRef(0);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const mentionListId = useId();
  const [caret, setCaret] = useState(0);
  const [mentionFocus, setMentionFocus] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mention = isGroupConversation && mentionFocus
    ? /(?<![\w.@])@([\w.@-]*)$/.exec(messageText.slice(0, caret)) : null;
  const matches = mention ? participants.filter(({ _id, username }) =>
    _id !== userId && username?.toLowerCase().startsWith(mention[1].toLowerCase())).slice(0, 6) : [];
  const activeIndex = Math.min(mentionIndex, matches.length - 1);

  function chooseMention(person) {
    const end = caret + (/^[\w.@-]*/.exec(messageText.slice(caret))?.[0].length ?? 0);
    const prefix = `${messageText.slice(0, mention.index)}@${person.username} `;
    if (prefix.length + (messageText.length - end) > 4000) return;
    setMessageText(prefix + messageText.slice(end));
    setCaret(prefix.length);
    setMentionFocus(false);
    requestAnimationFrame(() => {
      const input = messageInputRef.current;
      input?.focus();
      input?.setSelectionRange(prefix.length, prefix.length);
    });
  }

  function mentionKeys(event) {
    if (!matches.length) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setMentionFocus(false);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setMentionIndex((activeIndex + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length);
    } else if (event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)) {
      event.preventDefault();
      chooseMention(matches[activeIndex]);
    }
  }

  useEffect(() => () => locationRequest.current?.abort(), []);

  async function shareLocation(mode) {
    if (locationRequest.current || !location) return;
    const controller = new AbortController();
    locationRequest.current = controller;
    setSharingLocation(true);
    try {
      const message = await location.share(recipient, mode, controller.signal);
      if (controller.signal.aborted) return;
      setMessages((items) => items.some(({ _id }) => _id === message._id) ? items : [...items, message]);
      onConversationReady?.(message);
    } catch (error) {
      if (!controller.signal.aborted) toast({ title: "Share location", description: error.message, status: "error" });
    } finally {
      locationRequest.current = null;
      if (!controller.signal.aborted) setSharingLocation(false);
    }
  }

const handleOptionChange = (index, value) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const handleAddOption = () => {
    setPollOptions([...pollOptions, ""]);
  };

  const handleCreatePoll = async () => {
    if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) {
      toast({ title: "Please enter a question and at least 2 options", status: "warning" });
      return;
    }

    const pollPayload = {
      conversationId: recipient._id,
      question: pollQuestion,
      options: pollOptions.filter(o => o.trim()),
      multiSelect: false, // or true if you want
      expiresAt: null, // optional
    };

    try {
      const res = await apiFetch("/api/polls/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pollPayload),
      });

      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.message || "Failed to create poll");

      setMessages(prev => [...prev, data.poll]);

      setIsPollModalOpen(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      toast({ title: "Poll created successfully", status: "success" });
    } catch (err) {
      toast({ title: "Error", description: err.message, status: "error" });
    }
  };



  // Prefill input when editing
  useEffect(() => {
    if (editingMessageId) setMessageText(editingText || "");
  }, [editingMessageId, editingText]);

  // Join socket room
  useEffect(() => {
    if (!socket || !recipient._id || recipient.mock) return;
    const join = () => socket.emit("joinRoom", recipient._id);
    if (socket.connected) join();
    socket.on("connect", join);
    return () => {
      socket.off("connect", join);
      if (socket.connected) socket.emit("leaveRoom", recipient._id);
    };
  }, [socket, recipient._id, recipient.mock]);

  const isValidReply = (replyMsg.text || replyMsg.media) &&
    (!replyMsg.media || ['img', 'video', 'audio'].includes(replyMsg.mediaType));

  // Theme-aware styles
  const iconHoverColor = useColorModeValue("gray.200", "gray.600");
  const replySurface = useColorModeValue("gray.100", "gray.700");
  const replyAccent = useColorModeValue("green.600", "green.200");
  const replyText = useColorModeValue("gray.800", "gray.100");

  const sendMessage = async (files = attachments, text = messageText) => {
    if (isSending || (!text.trim() && !files.length)) return;
    setIsSending(true);

    try {
      // Handle message editing
      if (editingMessageId) {
        const res = await apiFetch("/api/messages/edit", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: editingMessageId,
            newText: text,
            groupId: groupId
          })
        });
        const updated = await readApiJson(res);
        if (!res.ok) throw new Error(updated.error || "Failed to edit message");
        setMessages((items) => items.map((item) => item._id === updated._id ? { ...item, ...updated } : item));
        resetInputs();
        return;
      }

      const destination = isGroupConversation ? { groupId } : { recipientId: recipient.userId };
      const body = { ...destination, message: text, ...(replyMsg.id && { messageId: replyMsg.id }) };
      const url = replyMsg.id ? "/api/messages/reply" : "/api/messages/send";
      let data;
      if (files.length) {
        const formData = new FormData();
        for (const [name, value] of Object.entries(body)) formData.append(name, value);
        files.forEach((file) => formData.append("media", file));
        data = await new Promise((resolve, reject) => upload(url, formData, resolve, (error) => reject(new Error(error))));
      } else {
        const response = await apiFetch(url, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        data = await readApiJson(response);
        if (!response.ok) throw new Error(data.error || "Could not send message.");
      }
      clearTimeout(typingTimeout.current);
      if (socket?.connected && !recipient.mock) socket.emit("typing", { conversationId: recipient._id, isTyping: false });
      setMessages((items) => items.some((item) => item._id === data._id) ? items : [...items, data]);
      onConversationReady?.(data);
      resetInputs();
      if (text !== messageText) setMessageText(messageText);
    } catch (error) {
      toast({ title: "Error", description: error.message, status: "error", duration: 5000 });
    } finally {
      setIsSending(false);
    }
  };

  const resetInputs = () => {
    setMessageText("");
    setMentionFocus(false);
    voice.discard();
    setAttachments([]);
    setReply({
      id: "",
      text: '',
      media: null,
      mediaType: null,
    });
    setEditingMessageId(null);
    setEditingText("");
  };

  useEffect(() => () => {
    clearTimeout(typingTimeout.current);
  }, [socket, recipient._id]);

  const handleTyping = (e) => {
    setMessageText(e.target.value);
    setCaret(e.target.selectionStart);
    setMentionFocus(true);
    setMentionIndex(0);
    if (!socket?.connected || !recipient._id || recipient.mock) return;

    const now = Date.now();
    if (now - lastTyping.current > 900) {
      socket.emit("typing", {
        conversationId: recipient._id,
        isTyping: true,
      });
      lastTyping.current = now;
    }

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      if (!socket.connected) return;
      socket.emit("typing", {
        conversationId: recipient._id,
        isTyping: false,
      });
    }, 1500);
  };

  async function sendVoice() {
    if (isSending) return;
    const file = voice.file || await voice.stop();
    if (file) await sendMessage([file]);
  }

  function handleMediaUpload(event) {
    const files = [...attachments, ...event.target.files];
    event.target.value = "";
    if (files.length > 6 || files.reduce((sum, file) => sum + file.size, 0) > 25 * 1024 * 1024) {
      toast({ title: "Attachment limit", description: "Choose up to 6 files, 25 MB total.", status: "error" });
      return;
    }
    setAttachments(files);
  }

  return (
    <Box w="full" className="thread-compose">
      {isUploading && progress > 0 && progress < 100 && (
        <Progress aria-label="Uploading attachment" size="xs" value={progress} colorScheme="blue" />
      )}

      {/* Reply Preview */}
      {isValidReply && (
        <Box
          p={2}
          bg={replySurface}
          borderLeft="4px solid"
          borderColor={replyAccent}
          borderRadius="md"
          position="relative"
          boxShadow="sm"
        >
          <Flex direction="row" alignItems="center">
            <Box flex="1">
              <Text fontSize="sm" fontWeight="bold" color={replyAccent} mb={1}>
                {replyMsg.sender || "You"}
              </Text>
              <Text fontSize="sm" color={replyText} noOfLines={2}>
                {replyMsg.text}
              </Text>
            </Box>
            {replyMsg.media && (
              <Box w="50px" h="50px" ml={2} borderRadius="md" overflow="hidden" boxShadow="md">
                {replyMsg.mediaType === "img" ? (
                  <Image src={replyMsg.media} alt="Thumbnail" objectFit="cover" w="full" h="full" />
                ) : replyMsg.mediaType === "video" ? (
                  <video style={{ width: "100%", height: "100%", objectFit: "cover" }}>
                    <source src={replyMsg.media} />
                  </video>
                ) : replyMsg.mediaType === "audio" ? (
                  <Image src="/audio.png" alt="Audio Thumbnail" objectFit="cover" w="full" h="full" />
                ) : null}
              </Box>
            )}
          </Flex>
          <CloseButton position="absolute" top={2} right={2} onClick={() => setReply({
            id: "",
            text: '',
            media: null,
            mediaType: null,
          })} aria-label="Cancel" />
        </Box>
      )}

      {attachments.length > 0 && <div className="queued-attachments" aria-label="Selected attachments">
        {attachments.map((file, index) => <QueuedAttachment file={file} key={`${file.name}:${file.lastModified}:${index}`}
          disabled={isSending} onRemove={() => setAttachments((items) => items.filter((_, position) => position !== index))} />)}
      </div>}

      {voice.phase !== "idle" ? <VoiceComposer voice={voice} sending={isSending} onSend={sendVoice} /> : (
        <Flex as="form" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }} className="message-editor"
          w="full" borderRadius="full" px={3} py={2} alignItems="center" gap={2}
          border="1px solid" borderColor="var(--chat-line)">
        {matches.length > 0 && <div id={mentionListId} className="mention-options" role="listbox" aria-label="Group members">
          {matches.map((person, index) => <button key={person._id} type="button" id={`${mentionListId}-${index}`}
            tabIndex={-1} role="option" aria-selected={index === activeIndex}
            onMouseDown={(event) => event.preventDefault()} onClick={() => chooseMention(person)}>
            @{person.username}
          </button>)}
        </div>}
        <input ref={fileInputRef} type="file" multiple hidden onChange={handleMediaUpload} />
        <IconButton type="button" icon={<FiPaperclip />} aria-label="Upload Media"
          onClick={() => fileInputRef.current?.click()} isDisabled={Boolean(editingMessageId) || isSending}
          variant="ghost" size="sm" _hover={{ bg: iconHoverColor }} />

        <StickerPicker disabled={isSending || Boolean(editingMessageId || attachments.length)} onSelect={(text) => void sendMessage([], text)} />

        {isGroupConversation && <IconButton type="button"
          icon={<MdPoll />}
          aria-label="Create Poll"
          variant="ghost"
          size="sm"
          _hover={{ bg: iconHoverColor }}
          onClick={() => setIsPollModalOpen(true)}
        />}

        {location && <Menu placement="top-start" isLazy>
          <MenuButton as={IconButton} icon={sharingLocation ? <Spinner size="xs" /> : <FiMapPin />}
            aria-label="Share location" isDisabled={sharingLocation || isSending || Boolean(editingMessageId)}
            variant="ghost" size="sm" />
          <Portal><MenuList>
            <MenuItem icon={<FiMapPin />} onClick={() => shareLocation("current")}>Share current location</MenuItem>
            <MenuItem icon={<FiRadio />} onClick={() => shareLocation("live")}>Share live location for 15 minutes</MenuItem>
          </MenuList></Portal>
        </Menu>}

        <Input
          ref={messageInputRef}
          placeholder={editingMessageId
            ? "Edit your message..."
            : (isGroupConversation ? "Type a message to group..." : "Type a message")}
          aria-label="Message"
          maxLength={4000}
          minW={0}
          value={messageText}
          onChange={handleTyping}
          onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
          onBlur={() => setMentionFocus(false)}
          onKeyDown={mentionKeys}
          role={isGroupConversation ? "combobox" : undefined}
          aria-autocomplete={isGroupConversation ? "list" : undefined}
          aria-expanded={isGroupConversation ? Boolean(matches.length) : undefined}
          aria-controls={matches.length ? mentionListId : undefined}
          aria-activedescendant={matches.length ? `${mentionListId}-${activeIndex}` : undefined}
          flex={1}
          variant="unstyled"
        />

        <IconButton
          icon={<FiMic />}
          type="button"
          onClick={() => void voice.start()}
          aria-label="Record voice message"
          isDisabled={Boolean(attachments.length || editingMessageId) || isSending}
          variant="ghost"
          size="sm"
          _hover={{ bg: iconHoverColor }}
        />

        <IconButton
          icon={isSending ? <Spinner size="sm" /> : <IoSendSharp />}
          aria-label="Send"
          type="submit"
          isDisabled={isSending || (!messageText.trim() && !attachments.length)}
          variant="ghost"
          size="sm"
          _hover={{ bg: iconHoverColor }}
        />
        </Flex>
      )}


      <Modal isOpen={isPollModalOpen} onClose={() => setIsPollModalOpen(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create a Poll</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={3}>
              <ChakraInput
                placeholder="Poll question"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
              />

              {pollOptions.map((opt, i) => (
                <ChakraInput
                  key={i}
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChange={(e) => handleOptionChange(i, e.target.value)}
                />
              ))}

              <Button onClick={handleAddOption} variant="ghost" colorScheme="blue">
                + Add Option
              </Button>

              <Checkbox
                isChecked={multiSelect}
                onChange={(e) => setMultiSelect(e.target.checked)}
              >
                Allow multiple choices
              </Checkbox>

              <ChakraInput
                type="datetime-local"
                placeholder="Expiry date & time"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" onClick={handleCreatePoll}>
              Create Poll
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </Box>
  );
};

export default MessageInput;
