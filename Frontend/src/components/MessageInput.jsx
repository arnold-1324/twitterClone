import {
  Flex,
  Input,
  IconButton,
  Box,
  useToast,
  useColorModeValue,
  Spinner,
  Image,
  Text,
  CloseButton,
} from "@chakra-ui/react";
import { useState, useRef, useEffect } from "react";
import { IoSendSharp, IoMic, IoPause } from "react-icons/io5";
import { BsFillImageFill } from "react-icons/bs";
import { motion } from "framer-motion";
import { selectedConversationAtom, selectedMsg } from "../atom/messagesAtom";
import { useRecoilState, useRecoilValue } from "recoil";
import useUploadWithProgress from "../hooks/useUploadWithProgress";
import { useSocket } from "../context/SocketContext";

const MotionFlex = motion(Flex);

const MessageInput = ({
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
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioPreview, setAudioPreview] = useState(null);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const { upload } = useUploadWithProgress();
  const mediaRecorderRef = useRef(null);
  const recipient = useRecoilValue(selectedConversationAtom);
  const toast = useToast();
  const replyMsg = useRecoilValue(selectedMsg);
  const [reply, setReply] = useRecoilState(selectedMsg);
  const { socket } = useSocket();
  const lastTyping = useRef(0);
  const typingTimeout = useRef(null);

  // Prefill input when editing
  useEffect(() => {
    if (editingMessageId) setMessageText(editingText || "");
  }, [editingMessageId, editingText]);

  // Join socket room
  useEffect(() => {
    if (!socket || !recipient._id) return;
    socket.emit("joinRoom", recipient._id);
    return () => socket.emit("leaveRoom", recipient._id);
  }, [socket, recipient._id]);

  // Handle upload progress
  useEffect(() => {
    if (!socket) return;
    const handleProgress = ({ percent }) => setUploadProgress(Number(percent));
    socket.on("uploadProgress", handleProgress);
    return () => socket.off("uploadProgress", handleProgress);
  }, [socket]);

  const isValidReply = (replyMsg.text || replyMsg.media) && 
    (!replyMsg.media || ['img', 'video', 'audio'].includes(replyMsg.mediaType));

  // Theme-aware styles
  const bgColor = useColorModeValue("white", "gray.800");
  const iconHoverColor = useColorModeValue("gray.200", "gray.600");
  const borderColor = useColorModeValue("gray.300", "gray.600");

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText && !audioBlob && !mediaFile) return;
    setIsSending(true);
    
    try {
      // Handle message editing
      if (editingMessageId) {
        const res = await fetch("/api/messages/edit", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: editingMessageId,
            newText: messageText,
            groupId: groupId
          })
        });
        if (!res.ok) throw new Error("Failed to edit message");
        resetInputs();
        return;
      }
      
      // Handle new message sending
      const formData = new FormData();
      formData.append("message", messageText);
      
      if (isGroupConversation) {
        formData.append("groupId", recipient.groupId);
      } else {
        formData.append("recipientId", recipient.userId);
      }
      
      if (replyMsg.id) {
        formData.append("messageId", replyMsg.id);
        if (isGroupConversation) formData.append("groupId", recipient.groupId);
      }
      
      if (audioBlob) formData.append("media", audioBlob, "voice-message.webm");
      if (mediaFile) formData.append("media", mediaFile);
      
      const url = replyMsg.id ? "/api/messages/reply" : "/api/messages/send";
      
      await new Promise((resolve, reject) => {
        upload(
          url,
          formData,
          (data) => {
            if (data.error) {
              toast({ title: "Error", description: data.error, status: "error", duration: 5000 });
              reject();
              return;
            }
            setMessages(messages => [...messages, data]);
            resetInputs();
            resolve();
          },
          (err) => {
            toast({ title: "Error", description: err, status: "error", duration: 5000 });
            reject();
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
    setAudioBlob(null);
    setAudioPreview(null);
    setMediaFile(null);
    setMediaPreview(null);
    setReply({
      id: "",
      text: '',
      media: null,
      mediaType: null,
    });
    setEditingMessageId(null);
    setEditingText("");
  };

  const handleTyping = (e) => {
    setMessageText(e.target.value);
    if (!socket || !recipient._id) return;
    
    const now = Date.now();
    if (now - lastTyping.current > 300) {
      socket.emit("typing", {
        conversationId: recipient._id,
        isTyping: true,
        isGroup: isGroupConversation,
      });
      lastTyping.current = now;
    }
    
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("typing", {
        conversationId: recipient._id,
        isTyping: false,
        isGroup: isGroupConversation,
      });
    }, 1500);
  };

  const handleAudioRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }
    
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        mediaRecorderRef.current = new MediaRecorder(stream);
        const audioChunks = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
          setAudioBlob(audioBlob);
          const audioUrl = URL.createObjectURL(audioBlob);
          setAudioPreview(audioUrl);
          setMediaPreview(<audio controls src={audioUrl} />);
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
      })
      .catch(() => {
        toast({
          title: "Permission denied",
          description: "Cannot access the microphone.",
          status: "error",
          duration: 2000,
        });
      });
  };

  const handleMediaUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setMediaFile(file);
    const url = URL.createObjectURL(file);

    if (file.type.startsWith("image/")) {
      setMediaPreview(<Image src={url} alt="Preview" maxH="150px" borderRadius="md" />);
    } else if (file.type.startsWith("video/")) {
      setMediaPreview(<video src={url} controls style={{ maxHeight: "150px" }} />);
    } else if (file.type.startsWith("audio/")) {
      setMediaPreview(<video src={url} controls style={{ maxHeight: "150px" }} />);
    }
  };

  const handleCancelMedia = () => {
    setMediaFile(null);
    setAudioBlob(null);
    setAudioPreview(null);
    setMediaPreview(null);
  };

  return (
    <Box w="full">
      {/* Upload Progress */}
      {uploadProgress > 0 && uploadProgress < 100 && (
        <UploadProgressBar progress={uploadProgress} fileName={mediaFile?.name || audioBlob ? "Audio" : ""} />
      )}

      {/* Reply Preview */}
      {isValidReply && (
        <Box
          p={2}
          bg={useColorModeValue("gray.100", "gray.700")}
          borderLeft="4px solid"
          borderColor={useColorModeValue("green.500", "green.300")}
          borderRadius="md"
          position="relative"
          boxShadow={useColorModeValue("sm", "md")}
        >
          <Flex direction="row" alignItems="center">
            <Box flex="1">
              <Text fontSize="sm" fontWeight="bold" color={useColorModeValue("green.600", "green.200")} mb={1}>
                {replyMsg.sender || "You"}
              </Text>
              <Text fontSize="sm" color={useColorModeValue("gray.800", "gray.100")} noOfLines={2}>
                {replyMsg.text}
              </Text>
            </Box>
            {replyMsg.media && (
              <Box w="50px" h="50px" ml={2} borderRadius="md" overflow="hidden" boxShadow={useColorModeValue("md", "lg")}>
                {replyMsg.mediaType === "img" ? (
                  <Image src={replyMsg.media} alt="Thumbnail" objectFit="cover" w="full" h="full" />
                ) : replyMsg.mediaType === "video" ? (
                  <video w="full" h="full" objectFit="cover" controls={false}>
                    <source src={replyMsg.media} />
                  </video>
                ) : replyMsg.mediaType === "audio" ? (
                  <Image src="../public/audio.png" alt="Audio Thumbnail" objectFit="cover" w="full" h="full" />
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

      {/* Media Preview */}
      {mediaPreview && (
        <Box mb={4} p={2} bg={bgColor} border="1px solid" borderColor={borderColor} borderRadius="md" position="relative">
          {mediaPreview}
          <CloseButton position="absolute" top={2} right={2} onClick={handleCancelMedia} aria-label="Cancel" />
        </Box>
      )}

      {/* Input Area */}
      <MotionFlex
        w="full"
        bg={bgColor}
        borderRadius="full"
        boxShadow="lg"
        px={4}
        py={2}
        alignItems="center"
        gap={2}
        border="1px solid"
        borderColor={borderColor}
      >
        <input
          type="file"
          accept="image/*,video/*"
          style={{ display: "none" }}
          id="media-upload"
          onChange={handleMediaUpload}
        />
        <IconButton
          as="label"
          htmlFor="media-upload"
          icon={<BsFillImageFill />}
          aria-label="Upload Media"
          variant="ghost"
          size="lg"
          _hover={{ bg: iconHoverColor }}
        />

        <Input
          placeholder={editingMessageId 
            ? "Edit your message..." 
            : (isGroupConversation ? "Type a message to group..." : "Type a message")}
          value={messageText}
          onChange={handleTyping}
          flex={1}
          variant="unstyled"
          bg={bgColor}
        />

        <IconButton
          icon={isRecording ? <IoPause /> : <IoMic />}
          onClick={handleAudioRecording}
          aria-label="Record"
          variant="ghost"
          size="lg"
          colorScheme={isRecording ? "red" : "gray"}
          _hover={{ bg: iconHoverColor }}
        />

        <IconButton
          icon={isSending ? <Spinner size="sm" /> : <IoSendSharp />}
          aria-label="Send"
          onClick={handleSendMessage}
          variant="ghost"
          size="lg"
          _hover={{ bg: iconHoverColor }}
        />
      </MotionFlex>
    </Box>
  );
};

export default MessageInput;