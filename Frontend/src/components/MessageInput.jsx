import { Flex, Image, Input, InputGroup, InputRightElement, Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay, Spinner } from "@chakra-ui/react";
import { useRef, useState } from "react";
import { IoSendSharp } from "react-icons/io5";
import useShowToast from "../hooks/useShowToast";
import { conversationsAtom, selectedConversationAtom } from "../atom/messagesAtom";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { useSocket } from "../context/SocketContext";

const MessageInput = ({ setMessages }) => {
	const showToast = useShowToast();
	const [message, setMessage] = useState("");
	const [img, setImg] = useState(null);
	const { socket } = useSocket();
	const fileInputRef = useRef();
	const [isLoading, setIsLoading] = useState(false);
	const selectedConversation = useRecoilValue(selectedConversationAtom);
	const setConversations = useSetRecoilState(conversationsAtom);

	// Handle file input
	const handleFileChange = (e) => {
		const file = e.target.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onloadend = () => {
				setImg(reader.result);
			};
			reader.readAsDataURL(file);
		}
	};

	// Send the message
	const sendMessage = async () => {
		if (message.trim() === "" && !img) return;

		setIsLoading(true);
		try {
			const newMessage = { text: message, img, sender: selectedConversation.userId, receiver: selectedConversation._id };
			socket.emit("sendMessage", newMessage);
			setMessages((prev) => [...prev, newMessage]);
			setMessage("");
			setImg(null);
		} catch (error) {
			showToast("Error", error.message, "error");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Flex gap={2} alignItems="center">
			{/* Image Preview Modal */}
			{img && (
				<Modal isOpen={true} onClose={() => setImg(null)}>
					<ModalOverlay />
					<ModalContent>
						<ModalHeader>Preview Image</ModalHeader>
						<ModalCloseButton />
						<ModalBody>
							<Image src={img} alt="preview" />
						</ModalBody>
					</ModalContent>
				</Modal>
			)}

			{/* Input Box */}
			<InputGroup>
				<Input
					placeholder="Type a message..."
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && sendMessage()}
				/>
				<InputRightElement>
					<Image
						src="/image-icon.png"
						alt="Attach Image"
						boxSize="20px"
						cursor="pointer"
						onClick={() => fileInputRef.current.click()}
					/>
				</InputRightElement>
			</InputGroup>

			{/* Send Button */}
			<Flex
				onClick={sendMessage}
				alignItems="center"
				justifyContent="center"
				borderRadius="full"
				bg="green.400"
				color="white"
				p={2}
				cursor="pointer"
			>
				{isLoading ? <Spinner /> : <IoSendSharp />}
			</Flex>

			{/* Hidden file input */}
			<input
				type="file"
				ref={fileInputRef}
				style={{ display: "none" }}
				onChange={handleFileChange}
			/>
		</Flex>
	);
};

export default MessageInput;
