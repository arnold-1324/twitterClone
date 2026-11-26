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
import { useState, useRef, useEffect } from "react";
import { IoSendSharp } from "react-icons/io5";
import { FiMic, FiPaperclip } from "react-icons/fi";
import { selectedConversationAtom, selectedMsg } from "../atom/messagesAtom";
import { useRecoilState, useRecoilValue } from "recoil";
import useUploadWithProgress from "../hooks/useUploadWithProgress";
import useVoiceRecorder from "../hooks/useVoiceRecorder";
import VoiceComposer from "./VoiceComposer";
import { useSocket } from "../context/SocketContext";
import { MdPoll } from "react-icons/md";
import {
  Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalBody, ModalFooter, ModalCloseButton, Button,
  VStack, Input as ChakraInput
} from "@chakra-ui/react";


const MessageInput = ({
  onConversationReady,
  setMessages,
  editingMessageId,
  setEditingMessageId,
  editingText,
  setEditingText,
  isGroupConversation,
  groupId
}) => {
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
   const [multiSelect, setMultiSelect] = useState(false);
   const [expiresAt, setExpiresAt] = useState("");
  const { upload, progress, isUploading } = useUploadWithProgress();
  const recipient = useRecoilValue(selectedConversationAtom);
  const toast = useToast();
  const voice = useVoiceRecorder((description) =>
    toast({ title: "Voice recording", description, status: "error" }));
  const [replyMsg, setReply] = useRecoilState(selectedMsg);
  const { socket } = useSocket();
  const lastTyping = useRef(0);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);

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

  useEffect(() => {
    const url = attachment?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [attachment?.url]);

  const isValidReply = (replyMsg.text || replyMsg.media) &&
    (!replyMsg.media || ['img', 'video', 'audio'].includes(replyMsg.mediaType));

  // Theme-aware styles
  const iconHoverColor = useColorModeValue("gray.200", "gray.600");
  const replySurface = useColorModeValue("gray.100", "gray.700");
  const replyAccent = useColorModeValue("green.600", "green.200");
  const replyText = useColorModeValue("gray.800", "gray.100");

  const sendMessage = async (file = attachment?.file) => {
    if (isSending || (!messageText.trim() && !file)) return;
    setIsSending(true);

    try {
      // Handle message editing
      if (editingMessageId) {
        const res = await apiFetch("/api/messages/edit", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: editingMessageId,
            newText: messageText,
            groupId: groupId
          })
        });
        const updated = await readApiJson(res);
        if (!res.ok) throw new Error(updated.error || "Failed to edit message");
        setMessages((items) => items.map((item) => item._id === updated._id ? { ...item, ...updated } : item));
        resetInputs();
        return;
      }

      // Handle new message sending
      const formData = new FormData();
      formData.append("message", messageText);

      if (isGroupConversation) {
        formData.append("groupId", groupId);
      } else {
        formData.append("recipientId", recipient.userId);
      }

      if (replyMsg.id) {
        formData.append("messageId", replyMsg.id);

      }

      if (file) formData.append("media", file);

      const url = replyMsg.id ? "/api/messages/reply" : "/api/messages/send";

      await new Promise((resolve, reject) => {
        upload(
          url,
          formData,
          (data) => {
            clearTimeout(typingTimeout.current);
            if (socket?.connected && !recipient.mock) socket.emit("typing", { conversationId: recipient._id, isTyping: false });
            setMessages(messages => messages.some((item) => item._id === data._id) ? messages : [...messages, data]);
            onConversationReady?.(data);
            resetInputs();
            resolve();
          },
          (err) => {
            reject(new Error(err));
          }
        );
      });
    } catch (error) {
      toast({ title: "Error", description: error.message, status: "error", duration: 5000 });
    } finally {
      setIsSending(false);
    }
  };

  const resetInputs = () => {
    setMessageText("");
    voice.discard();
    setAttachment(null);
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
    if (file) await sendMessage(file);
  }

  function handleMediaUpload(event) {
    const file = event.target.files[0];
    if (file) setAttachment({ file, url: URL.createObjectURL(file) });
    event.target.value = "";
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

      {attachment && (
        <Box className="thread-attachment">
          {attachment.file.type.startsWith("image/") ? (
            <Image src={attachment.url} alt="Attachment preview" maxH="136px" borderRadius="md" />
          ) : attachment.file.type.startsWith("video/") ? (
            <video src={attachment.url} controls style={{ maxHeight: "136px" }} />
          ) : attachment.file.type.startsWith("audio/") ? (
            <audio src={attachment.url} controls />
          ) : attachment.file.type === "application/pdf" ? (
            <iframe src={attachment.url} title="PDF attachment preview" width="100%" height="136" />
          ) : <Text noOfLines={1}>{attachment.file.name}</Text>}
          <CloseButton size="sm" onClick={() => setAttachment(null)} isDisabled={isSending}
            aria-label="Remove attachment" />
        </Box>
      )}

      {voice.phase !== "idle" ? <VoiceComposer voice={voice} sending={isSending} onSend={sendVoice} /> : (
        <Flex as="form" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }} className="message-editor"
          w="full" borderRadius="full" px={3} py={2} alignItems="center" gap={2}
          border="1px solid" borderColor="var(--chat-line)">
        <input ref={fileInputRef} type="file" hidden onChange={handleMediaUpload} />
        <IconButton type="button" icon={<FiPaperclip />} aria-label="Upload Media"
          onClick={() => fileInputRef.current?.click()} isDisabled={Boolean(editingMessageId) || isSending}
          variant="ghost" size="sm" _hover={{ bg: iconHoverColor }} />

        {isGroupConversation && <IconButton type="button"
          icon={<MdPoll />}
          aria-label="Create Poll"
          variant="ghost"
          size="sm"
          _hover={{ bg: iconHoverColor }}
          onClick={() => setIsPollModalOpen(true)}
        />}


        <Input
          placeholder={editingMessageId
            ? "Edit your message..."
            : (isGroupConversation ? "Type a message to group..." : "Type a message")}
          aria-label="Message"
          maxLength={4000}
          minW={0}
          value={messageText}
          onChange={handleTyping}
          flex={1}
          variant="unstyled"
        />

        <IconButton
          icon={<FiMic />}
          type="button"
          onClick={() => void voice.start()}
          aria-label="Record voice message"
          isDisabled={Boolean(attachment || editingMessageId) || isSending}
          variant="ghost"
          size="sm"
          _hover={{ bg: iconHoverColor }}
        />

        <IconButton
          icon={isSending ? <Spinner size="sm" /> : <IoSendSharp />}
          aria-label="Send"
          type="submit"
          isDisabled={isSending || (!messageText.trim() && !attachment)}
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
