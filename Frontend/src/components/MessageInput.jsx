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
import { useState, useRef } from "react";
import { IoSendSharp, IoMic, IoPause } from "react-icons/io5";
import { BsFillImageFill } from "react-icons/bs";
import { motion } from "framer-motion";
import { selectedConversationAtom } from "../atom/messagesAtom";
import { useRecoilValue } from "recoil";

const MotionFlex = motion(Flex);

const MessageInput = ({ setMessages }) => {
    const [messageText, setMessageText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioPreview, setAudioPreview] = useState(null);
    const [mediaFile, setMediaFile] = useState(null);
    const [mediaPreview, setMediaPreview] = useState(null);
    const mediaRecorderRef = useRef(null);
    const recipient = useRecoilValue(selectedConversationAtom);
    const toast = useToast();

    // Theme-aware styles
    const bgColor = useColorModeValue("white", "gray.800");
    const iconHoverColor = useColorModeValue("gray.200", "gray.600");
    const borderColor = useColorModeValue("gray.300", "gray.600");

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!messageText && !audioBlob && !mediaFile) return;

        setIsSending(true);

        try {
            const formData = new FormData();
            formData.append("message", messageText);
            formData.append("recipientId",recipient.userId);

            if (audioBlob) {
                formData.append("media", audioBlob, "voice-message.webm");
            }

            if (mediaFile) {
                formData.append("media", mediaFile);
            }

            
            const res = await fetch("/api/messages/send", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (data.error) {
                toast({
                    title: "Error",
                    description: data.error,
                    status: "error",
                    duration: 5000,
                    isClosable: true,
                });
                return;
            }

            setMessages((messages) => [...messages, data]);
            setMessageText("");
            setAudioBlob(null);
            setAudioPreview(null);
            setMediaFile(null);
            setMediaPreview(null);
        } catch (error) {
            toast({
                title: "Error",
                description: error.message,
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setIsSending(false);
        }
    };

    const handleAudioRecording = () => {
        if (!isRecording) {
            navigator.mediaDevices
                .getUserMedia({ audio: true })
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
                        duration: 5000,
                        isClosable: true,
                    });
                });
        } else {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleMediaUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setMediaFile(file);
            const url = URL.createObjectURL(file);

            if (file.type.startsWith("image/")) {
                setMediaPreview(<Image src={url} alt="Preview" maxH="150px" borderRadius="md" />);
            } else if (file.type.startsWith("video/")) {
                setMediaPreview(<video src={url} controls style={{ maxHeight: "150px" }} />);
            }else if (file.type.startsWith("audio/")) {
                setMediaPreview(<video src={url} controls style={{ maxHeight: "150px" }} />);
            }
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
            {/* Media Preview */}
            {mediaPreview && (
                <Box
                    mb={4}
                    p={2}
                    bg={bgColor}
                    border="1px solid"
                    borderColor={borderColor}
                    borderRadius="md"
                    position="relative"
                >
                    {mediaPreview}
                    <CloseButton
                        position="absolute"
                        top={2}
                        right={2}
                        onClick={handleCancelMedia}
                        aria-label="Cancel"
                    />
                </Box>
            )}

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
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                {/* Media Upload */}
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

                {/* Message Input */}
                <Input
                    placeholder="Type a message"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    flex={1}
                    variant="unstyled"
                    bg={bgColor}
                />

                {/* Audio Record */}
                <IconButton
                    icon={isRecording ? <IoPause /> : <IoMic />}
                    onClick={handleAudioRecording}
                    aria-label="Record"
                    variant="ghost"
                    size="lg"
                    colorScheme={isRecording ? "red" : "gray"}
                    _hover={{ bg: iconHoverColor }}
                />

                {/* Send Button */}
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
