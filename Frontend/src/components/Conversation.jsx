import {
	Avatar,
	AvatarBadge,
	Box,
	Flex,
	Image,
	Stack,
	Text,
	WrapItem,
	useColorModeValue,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { useRecoilState, useRecoilValue } from "recoil";
import userAtom from "../atom/userAtom";
import { BsCheck2All, BsFillImageFill } from "react-icons/bs";
import { selectedConversationAtom } from "../atom/messagesAtom";

const MotionFlex = motion(Flex);

const Conversation = ({ conversation, isOnline, sx }) => {
	const user = conversation.participants.find(
		(participant) => participant._id !== conversation.lastMessage.sender
	);
	const currentUser = useRecoilValue(userAtom);
	const lastMessage = conversation.lastMessage;
	const [selectedConversation, setSelectedConversation] = useRecoilState(selectedConversationAtom);

	// Set hover and selected background colors
	const hoverBgColor = useColorModeValue("gray.100", "gray.700");
	const selectedBgColor = useColorModeValue("gray.200", "gray.600");

	// Handle conversation selection
	const handleSelectConversation = () => {
		setSelectedConversation({
			_id: conversation._id,
			userId: user._id,
			userProfilePic: user.profileImg,
			username: user.username,
		});
	};

	return (
		<MotionFlex
			gap={4}
			alignItems={"center"}
			p={3}
			borderRadius={"md"}
			boxShadow="md"
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4 }}
			_hover={{
				cursor: "pointer",
				bg: hoverBgColor,
			}}
			whileHover={{ scale: 1.03 }}
			onClick={handleSelectConversation}
			bg={selectedConversation?._id === conversation._id ? selectedBgColor : "transparent"}
			{...(selectedConversation?._id === conversation._id ? { opacity: 1, scale: 1.02, boxShadow: "0px 0px 12px rgba(66, 153, 225, 0.4)" } : {})}
			sx={sx} // Include sx prop for custom styles
		>
			{/* Avatar and Status */}
			<WrapItem>
				<Avatar
					size={"md"}
					src={user.profileImg}
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
		</MotionFlex>
	);
};

export default Conversation;
