import {
	Avatar,
	AvatarBadge,
	Box,
	Flex,
	Image,
	Stack,
	Text,
	WrapItem,
	useColorMode,
	useColorModeValue,
} from "@chakra-ui/react";
import { useRecoilState, useRecoilValue } from "recoil";
import userAtom from "../atom/userAtom";
import { BsCheck2All, BsFillImageFill } from "react-icons/bs";
import { selectedConversationAtom } from "../atom/messagesAtom";

const Conversation = ({ conversation, isOnline }) => {
	// Get the first participant as the user (based on your data structure)
	const user = conversation.participants.find(
		(participant) => participant._id !== conversation.lastMessage.sender // Find the non-sender
	); 
	const currentUser = useRecoilValue(userAtom);
	const lastMessage = conversation.lastMessage;
	const [selectedConversation, setSelectedConversation] = useRecoilState(selectedConversationAtom);
	const colorMode = useColorMode();

	// Set hover and selected background colors
	const hoverBgColor = useColorModeValue("gray.100", "gray.700");
	const selectedBgColor = useColorModeValue("gray.200", "gray.600");

	// Handle when a conversation is clicked to select it
	const handleSelectConversation = () => {
		setSelectedConversation({
			_id: conversation._id,
			userId: user._id,
			userProfilePic: user.profileImg,
			username: user.username,
		});
	};

	return (
		<Flex
			gap={4}
			alignItems={"center"}
			p={3}
			_hover={{
				cursor: "pointer",
				bg: hoverBgColor,
			}}
			onClick={handleSelectConversation}
			bg={
				selectedConversation?._id === conversation._id
					? selectedBgColor
					: "transparent"
			}
			borderRadius={"md"}
			boxShadow="md"
		>
			{/* Avatar and Status */}
			<WrapItem>
				<Avatar
					size={"md"}
					src={user.profileImg} // Using user.profileImg instead of profilePic
					name={user.username}
					borderRadius="full"
				>
					{isOnline && <AvatarBadge boxSize="1em" bg="green.400" />}
				</Avatar>
			</WrapItem>

			{/* Conversation Details */}
			<Stack direction={"column"} fontSize={"sm"} flex="1">
				{/* Username with verified badge */}
				<Text fontWeight="bold" display={"flex"} alignItems={"center"}>
					{user.username}
					{user.isVerified && (
						<Image src="/verified.png" w={4} h={4} ml={2} alt="verified" />
					)}
				</Text>

				{/* Last message */}
				<Text fontSize={"xs"} color={useColorModeValue("gray.600", "gray.400")}>
					{/* If the current user is the sender, show the message read status */}
					{currentUser._id === lastMessage.sender && (
						<Box color={lastMessage.seen ? "blue.400" : "gray.500"}>
							<BsCheck2All size={16} />
						</Box>
					)}
					{/* Truncate message if it's too long, and show an image icon if it's an image */}
					{lastMessage.text.length > 18
						? lastMessage.text.substring(0, 18) + "..."
						: lastMessage.text || <BsFillImageFill size={16} />}
				</Text>

				{/* Timestamp */}
				<Text fontSize="xs" color={useColorModeValue("gray.500", "gray.400")}>
					{new Date(lastMessage.createdAt).toLocaleTimeString([], {
						hour: "2-digit",
						minute: "2-digit",
					})}
				</Text>
			</Stack>
		</Flex>
	);
};

export default Conversation;
