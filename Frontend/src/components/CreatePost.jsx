import { AddIcon } from "@chakra-ui/icons";
import {
    Button,
    CloseButton,
    Flex,
    FormControl,
    Image,
    Input,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    Spinner,
    Text,
    Textarea,
    useColorModeValue,
    useDisclosure,
} from "@chakra-ui/react";
import { useRef, useState } from "react";
import { BsFillImageFill } from "react-icons/bs";
import { useRecoilState, useRecoilValue } from "recoil";
import userAtom from "../atom/userAtom";
import useShowToast from "../hooks/useShowToast";
import postsAtom from "../atom/postsAtom";
import { useParams } from "react-router-dom";

const MAX_CHAR = 500;

const CreatePost = () => {
    const [mediaUrl, setMediaUrl] = useState("");
    const { isOpen, onOpen, onClose } = useDisclosure();
    const fileRef = useRef(null);
    const [postText, setPostText] = useState("");
    const [remainingChar, setRemainingChar] = useState(MAX_CHAR);
    const user = useRecoilValue(userAtom);
    const showToast = useShowToast();
    const [loading, setLoading] = useState(false);
    const [posts, setPosts] = useRecoilState(postsAtom);
    const { username } = useParams();

    const handleMediaChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setMediaUrl(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleTextChange = (e) => {
        const inputText = e.target.value;
        if (inputText.length > MAX_CHAR) {
            setPostText(inputText.slice(0, MAX_CHAR));
            setRemainingChar(0);
        } else {
            setPostText(inputText);
            setRemainingChar(MAX_CHAR - inputText.length);
        }
    };

    const handleCreatePost = async (e) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append("caption", postText);
            const fileInput = fileRef.current.files[0];
            if (fileInput) formData.append("image", fileInput);

            const res = await fetch("/api/posts/create", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (data.error) {
                showToast("Error", data.error, "error");
                return;
            }
            showToast("Success", "Post created successfully", "success");
            if (username === user.username) setPosts([data, ...posts]);
            setPostText("");
            setMediaUrl("");
            onClose();
        } catch (error) {
            showToast("Error creating post", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button
                position="fixed"
                bottom={10}
                right={5}
                bg={useColorModeValue("gray.300", "gray.dark")}
                onClick={onOpen}
                size={{ base: "sm", sm: "md" }}
                transition="transform 0.3s ease, box-shadow 0.3s ease"
                _hover={{
                    transform: "scale(1.15)",
                    boxShadow: "0px 5px 15px rgba(0, 0, 0, 0.2)",
                }}
            >
                <AddIcon />
            </Button>

            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalOverlay />
                <ModalContent
                    animation="fadeIn 0.4s ease-out"
                    bg={useColorModeValue("white", "gray.800")}
                    transform="scale(1)"
                    transition="transform 0.3s ease"
                    _hover={{
                        transform: "scale(1.02)",
                    }}
                >
                    <ModalHeader>Create Post</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody pb={6}>
                        <FormControl>
                            <Textarea
                                placeholder="Post content goes here.."
                                onChange={handleTextChange}
                                value={postText}
                                bg={useColorModeValue("gray.50", "gray.700")}
                                borderRadius="md"
                                _hover={{ borderColor: "blue.400" }}
                                _focus={{ boxShadow: "0 0 8px blue" }}
                                transition="box-shadow 0.2s ease"
                            />
                            <Text
                                fontSize="xs"
                                fontWeight="bold"
                                textAlign="right"
                                mt="1"
                                color="gray.800"
                            >
                                {remainingChar}/{MAX_CHAR}
                            </Text>

                            <Input
                                type="file"
                                hidden
                                ref={fileRef}
                                onChange={handleMediaChange}
                            />

                            <BsFillImageFill
                                style={{ marginLeft: "5px", cursor: "pointer" }}
                                size={16}
                                onClick={() => fileRef.current.click()}
                            />
                        </FormControl>

                        {mediaUrl && (
                            <Flex mt={5} w="full" position="relative">
                                <Image
                                    src={mediaUrl}
                                    alt="Selected"
                                    borderRadius="md"
                                    boxShadow="md"
                                    animation="fadeIn 0.4s ease-out"
                                />
                                <CloseButton
                                    onClick={() => setMediaUrl("")}
                                    bg="gray.800"
                                    position="absolute"
                                    top={2}
                                    right={2}
                                />
                            </Flex>
                        )}
                    </ModalBody>

                    <ModalFooter>
                        <Button
                            colorScheme="blue"
                            mr={3}
                            onClick={handleCreatePost}
                            isLoading={loading}
                            spinner={<Spinner color="white" />}
                            _hover={{
                                bg: "blue.600",
                                transform: "scale(1.05)",
                            }}
                            _loading={{
                                animation: "pulse 1s infinite",
                                bg: "blue.400",
                            }}
                        >
                            Post
                        </Button>
                        <Button onClick={onClose} variant="ghost">
                            Cancel
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
};

export default CreatePost;
