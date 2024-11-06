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
import { IoSendSharp } from "react-icons/io5";
import { BsFillImageFill } from "react-icons/bs";
import useShowToast from "../hooks/useShowToast";
import { conversationsAtom, selectedConversationAtom } from "../atom/messagesAtom";
import { useRecoilValue, useSetRecoilState } from "recoil";

const MessageInput = ({ setMessages }) => {
    const [messageText, setMessageText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [mediaUrl, setMediaUrl] = useState(null);
    const [mediaError, setMediaError] = useState(""); 
    const imageRef = useRef(null);
    const { onClose } = useDisclosure();
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
        if (!messageText && !mediaUrl) return;
        if (isSending) return;

        setIsSending(true);

        try {
            const formData = new FormData();
            formData.append("message", messageText);
            formData.append("recipientId", selectedConversation.userId);

            
            if (mediaUrl) {
                const blob = dataURLtoBlob(mediaUrl); 
                formData.append("media", blob); 
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
        } catch (error) {
            showToast("Error", error.message, "error");
        } finally {
            setIsSending(false);
        }
    };

    
	const dataURLtoBlob = (dataURL) => {
		const byteString = atob(dataURL.split(',')[1]);
		const ab = new ArrayBuffer(byteString.length);
		const ia = new Uint8Array(ab);
		for (let i = 0; i < byteString.length; i++) {
			ia[i] = byteString.charCodeAt(i);
		}
		return new Blob([ab], { type: "application/octet-stream" }); 
	};

    return (
        <Flex gap={3} alignItems="center" justifyContent="space-between">
            <form onSubmit={handleSendMessage} style={{ flex: 1 }}>
                <InputGroup>
                    <Input
                        w="full"
                        placeholder="Type a message"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                    />
                    <InputRightElement
                        onClick={handleSendMessage}
                        cursor={messageText || mediaUrl ? "pointer" : "not-allowed"}
                    >
                        {isSending ? (
                            <Spinner size="sm" />
                        ) : (
                            <IoSendSharp />
                        )}
                    </InputRightElement>
                </InputGroup>
            </form>

            <Box display="flex" alignItems="center" flexDirection="column">
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
            </Box>

            <Modal isOpen={mediaUrl} onClose={() => setMediaUrl(null)}>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Preview</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <Flex direction="column" alignItems="center">
                            {mediaUrl && <Image src={mediaUrl} alt="Preview" w="100%" />}
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
                </ModalContent>
            </Modal>
        </Flex>
    );
};

export default MessageInput;
