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
    useDisclosure,
    IconButton,
    Box,
    Image,
    Text,
} from "@chakra-ui/react";
import { useState, useRef } from "react";
import { IoSendSharp, IoIosMic } from "react-icons/io5";
import { BsFillImageFill } from "react-icons/bs";
import useShowToast from "../hooks/useShowToast";
import { conversationsAtom, selectedConversationAtom } from "../atom/messagesAtom";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { motion } from "framer-motion";

const MotionFlex = motion(Flex);
const MotionBox = motion(Box);
const MotionImage = motion(Image);
const MotionModalContent = motion(ModalContent);

const MessageInput = ({ setMessages }) => {
    const [messageText, setMessageText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [mediaUrl, setMediaUrl] = useState(null);
    const [mediaError, setMediaError] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const mediaRecorderRef = useRef(null);
    const imageRef = useRef(null);
    const selectedConversation = useRecoilValue(selectedConversationAtom);
    const setConversations = useSetRecoilState(conversationsAtom);
    const showToast = useShowToast();

    const handleMediaChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const validTypes = ["image/*", "video/*", "audio/*", "application/*"];
            if (file.type.match(validTypes.join('|'))) {
                const reader = new FileReader();
                reader.onloadend = () => setMediaUrl(reader.result);
                reader.readAsDataURL(file);
                setMediaError("");
            } else {
                setMediaError("Invalid file type. Please upload a valid media file.");
                setMediaUrl(null);
            }
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!messageText && !mediaUrl && !audioBlob) return;
        if (isSending) return;

        setIsSending(true);

        try {
            const formData = new FormData();
            formData.append("message", messageText);
            formData.append("recipientId", selectedConversation.userId);

            if (mediaUrl) {
                const blob = dataURLtoBlob(mediaUrl);
                formData.append("media", blob);
            } else if (audioBlob) {
                formData.append("media", audioBlob, "voice-message.webm");
            }

            const res = await fetch("api/messages/send", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (data.error) {
                showToast("Error", data.error, "error");
                return;
            }

            setMessages((messages) => [...messages, data]);

            setConversations((prevConvs) => {
                return prevConvs.map((conversation) => {
                    if (conversation._id === selectedConversation._id) {
                        return {
                            ...conversation,
                            lastMessage: {
                                text: messageText,
                                sender: data.sender,
                            },
                        };
                    }
                    return conversation;
                });
            });

            setMessageText("");
            setMediaUrl(null);
            setAudioBlob(null);
        } catch (error) {
            showToast("Error", error.message, "error");
        } finally {
            setIsSending(false);
        }
    };

    const dataURLtoBlob = (dataURL) => {
        const [header, data] = dataURL.split(',');
        const mimeType = header.match(/:(.*?);/)[1];
        const byteString = atob(data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], { type: mimeType });
    };

    const handleAudioRecording = () => {
        if (isRecording) {
            mediaRecorderRef.current.stop();
        } else {
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
            });
        }
        setIsRecording(!isRecording);
    };

    return (
        <MotionFlex
            direction="column"
            w="full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
        >
            <Flex gap={3} alignItems="center" justifyContent="space-between">
                <form onSubmit={handleSendMessage} style={{ flex: 1 }}>
                    <InputGroup as={motion.div} initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
                        <Input
                            w="full"
                            placeholder="Type a message"
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                        />
                        <InputRightElement
                            cursor={messageText || mediaUrl || audioBlob ? "pointer" : "not-allowed"}
                        >
                            {isSending ? <Spinner size="sm" /> : <IoSendSharp onClick={handleSendMessage} />}
                        </InputRightElement>
                    </InputGroup>
                </form>

                <MotionBox display="flex" alignItems="center" flexDirection="column" whileHover={{ scale: 1.1 }}>
                    <IconButton
                        icon={<BsFillImageFill />}
                        onClick={() => imageRef.current.click()}
                        variant="outline"
                        aria-label="Send media"
                    />
                    <Input
                        ref={imageRef}
                        type="file"
                        hidden
                        accept="image/*,video/*,audio/*"
                        onChange={handleMediaChange}
                    />
                    {mediaError && <Text color="red.500" fontSize="sm">{mediaError}</Text>}
                </MotionBox>

                <IconButton
                    icon={<IoIosMic />}
                    onClick={handleAudioRecording}
                    variant="outline"
                    aria-label="Send voice message"
                    colorScheme={isRecording ? "red" : "gray"}
                    as={motion.div}
                    whileTap={{ scale: 0.9 }}
                />
            </Flex>

            <Modal isOpen={mediaUrl && !isRecording} onClose={() => setMediaUrl(null)}>
                <ModalOverlay />
                <MotionModalContent
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <ModalHeader>Preview</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <Flex direction="column" alignItems="center">
                            {mediaUrl && audioBlob ? (
                                <audio controls src={mediaUrl} />
                            ) : (
                                <MotionImage src={mediaUrl} alt="Preview" w="100%" initial={{ opacity: 0.8 }} animate={{ opacity: 1 }} />
                            )}
                            <Flex justifyContent="center" my={3}>
                                {isSending ? (
                                    <Spinner size="lg" />
                                ) : (
                                    <IoSendSharp
                                        size={28}
                                        cursor="pointer"
                                        onClick={handleSendMessage}
                                    />
                                )}
                            </Flex>
                        </Flex>
                    </ModalBody>
                </MotionModalContent>
            </Modal>
        </MotionFlex>
    );
};

export default MessageInput;
