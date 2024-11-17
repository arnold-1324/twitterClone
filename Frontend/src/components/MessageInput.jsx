import {
    Flex,
    Input,
    InputGroup,
    InputRightElement,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalHeader,
    ModalOverlay,
    Spinner,
    IconButton,
    Box,
    Text,
    useToast,
} from "@chakra-ui/react";
import { useState, useRef } from "react";
import { IoSendSharp, IoMic } from "react-icons/io5";
import { BsFillImageFill } from "react-icons/bs";
import { motion } from "framer-motion";

const MotionFlex = motion(Flex);
const MotionBox = motion(Box);

const MessageInput = ({ setMessages }) => {
    const [messageText, setMessageText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [mediaUrl, setMediaUrl] = useState(null);
    const [mediaError, setMediaError] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const mediaRecorderRef = useRef(null);
    const toast = useToast();

    const handleSendMessage = async (e) => {
        e.preventDefault();

        if (!messageText && !mediaUrl && !audioBlob) return;
        if (isSending) return;

        setIsSending(true);

        try {
            const formData = new FormData();
            formData.append("message", messageText);

            if (mediaUrl && !audioBlob) {
                const blob = await fetch(mediaUrl).then((res) => res.blob());
                formData.append("media", blob);
            } else if (audioBlob) {
                formData.append("media", audioBlob, "voice-message.webm");
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
            setMediaUrl(null);
            setAudioBlob(null);
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
            navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
                mediaRecorderRef.current = new MediaRecorder(stream);
                const audioChunks = [];

                mediaRecorderRef.current.ondataavailable = (event) => {
                    audioChunks.push(event.data);
                };

                mediaRecorderRef.current.onstop = () => {
                    const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
                    setAudioBlob(audioBlob);
                    const audioUrl = URL.createObjectURL(audioBlob);
                    setMediaUrl(audioUrl);
                };

                mediaRecorderRef.current.start();
                setIsRecording(true);
            }).catch(() => {
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

    const handleMediaChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const previewUrl = URL.createObjectURL(file);
            setMediaUrl(previewUrl);
            setAudioBlob(null);  // To avoid conflicts between audio recording and file preview
        }
    };

    return (
        <MotionFlex direction="column" w="full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <Flex gap={3} alignItems="center" justifyContent="space-between">
                <form onSubmit={handleSendMessage} style={{ flex: 1 }}>
                    <InputGroup>
                        <Input
                            w="full"
                            placeholder="Type a message"
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                        />
                        <InputRightElement cursor={messageText || mediaUrl || audioBlob ? "pointer" : "not-allowed"}>
                            {isSending ? <Spinner size="sm" /> : <IoSendSharp onClick={handleSendMessage} />}
                        </InputRightElement>
                    </InputGroup>
                </form>

                <IconButton
                    icon={<BsFillImageFill />}
                    onClick={() => document.getElementById("fileInput").click()}
                    variant="outline"
                    aria-label="Send media"
                />
                <input id="fileInput" type="file" hidden accept="image/*,video/*,audio/*" onChange={handleMediaChange} />

                <IconButton
                    icon={<IoMic />}
                    onMouseDown={handleAudioRecording}
                    onMouseUp={handleAudioRecording}
                    variant="outline"
                    aria-label="Send voice message"
                    colorScheme={isRecording ? "red" : "gray"}
                    as={motion.div}
                    whileTap={{ scale: 0.9 }}
                />
            </Flex>

            {mediaUrl && (
                <Modal isOpen onClose={() => setMediaUrl(null)}>
                    <ModalOverlay />
                    <ModalContent>
                        <ModalHeader>Preview</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                            <Flex direction="column" alignItems="center">
                                {audioBlob ? (
                                    <audio controls src={mediaUrl} />
                                ) : (
                                    <MotionBox initial={{ opacity: 0.8 }} animate={{ opacity: 1 }}>
                                        <video src={mediaUrl} controls style={{ width: "100%" }} />
                                    </MotionBox>
                                )}
                                <Flex justifyContent="center" my={3}>
                                    {isSending ? (
                                        <Spinner size="lg" />
                                    ) : (
                                        <IoSendSharp size={28} cursor="pointer" onClick={handleSendMessage} />
                                    )}
                                </Flex>
                            </Flex>
                        </ModalBody>
                    </ModalContent>
                </Modal>
            )}
        </MotionFlex>
    );
};

export default MessageInput;
