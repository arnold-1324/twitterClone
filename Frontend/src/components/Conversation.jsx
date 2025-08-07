import {
	Avatar,
	AvatarBadge,
	Box,
	Flex,
	Image,
	Stack,
	Text,
	WrapItem,
	border,
	useColorModeValue,
  } from "@chakra-ui/react";
  import { useRecoilState, useRecoilValue } from "recoil";
  import userAtom from "../atom/userAtom";
  import { BsCheck2All, BsFillImageFill } from "react-icons/bs";
  import { selectedConversationAtom } from "../atom/messagesAtom";
  import formatMessageTime from "../Utils/Timeformate";
  import { FaUsers } from "react-icons/fa";

  const Conversation = ({ conversation, onlineUsers }) => {
	const currentUser = useRecoilValue(userAtom);
	const [selectedConversation, setSelectedConversation] = useRecoilState(
	  selectedConversationAtom
	);
  
	const hoverBgColor = useColorModeValue("gray.100", "gray.700");
	const selectedBgColor = useColorModeValue("gray.200", "gray.600");
	
	// Check if this is a group conversation
	const isGroup = conversation.isGroup || conversation.groupInfo;
	
	let displayName, displayImage, isOnline;
	//console.log("Conversation data:",conversation);
	
	if (isGroup) {
		// Group conversation

		displayName = conversation.groupInfo?.name || "Group";
		displayImage = conversation.groupInfo?.profileImage;
		 // Groups don't have profile images yet
		// For groups, we could show if any member is online
		isOnline = conversation.participants?.some(p => onlineUsers.includes(p._id));
	} else {
		// One-on-one conversation
		const otherParticipant = conversation.participants.find(
			(p) => p._id !== currentUser._id
		);
		displayName = otherParticipant?.username || "Unknown";
		displayImage = otherParticipant?.profileImg;
		isOnline = otherParticipant && onlineUsers.includes(otherParticipant._id);
	}
	
	const lastMessage = conversation.lastMessage || {};
	
	const handleSelectConversation = () => {
		
	if (isGroup) {
		//console.log("[Conversation] Group Profile Image:", displayImage);
	}
		if (isGroup) {
			setSelectedConversation({
				_id: conversation._id,
				groupId: conversation.groupId,
				username: displayName,
				userProfilePic: displayImage,
				isGroup: true,
				groupInfo: conversation.groupInfo,
				participants: conversation.participants
			});
		} else {
			const otherParticipant = conversation.participants.find(
				(p) => p._id !== currentUser._id
			);
			if (otherParticipant) {
				setSelectedConversation({
					_id: conversation._id,
					userId: otherParticipant._id,
					userProfilePic: otherParticipant.profileImg,
					username: otherParticipant.username,
					isGroup: false
				});
			}
		}
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
		
		<WrapItem>
		  <Avatar
			size={"md"}
			src={displayImage || ""}
			name={displayName || "Unknown"}
			borderRadius="full"
			bg={isGroup ? "teal.500" : undefined}
		  >
			{isGroup && <FaUsers />}
			{!isGroup && isOnline && <AvatarBadge boxSize="1em" bg="green.400" />}
		  </Avatar>
		</WrapItem>
  
		
		<Stack direction={"column"} fontSize={"sm"} flex="1">
		 
		  <Text fontWeight="bold" display={"flex"} alignItems={"center"}>
				{displayName}
				{isGroup && (
					<Text fontSize="xs" color="gray.500" ml={2}>
						{conversation.participants?.length || 0} members
					</Text>
				)}
			{!isGroup && conversation.participants?.find(p => p._id !== currentUser._id)?.isVerified && (
			  <Image src="/verified.png" w={4} h={4} ml={2} alt="verified" />
			)}
		  </Text>
  
		 
		  <Text fontSize={"xs"} color={useColorModeValue("gray.600", "gray.400")}>
			{lastMessage.sender && (
			  <Box color={lastMessage.seen ? "blue.400" : "gray.500"} mr={1}>
				<BsCheck2All size={16} />
			  </Box>
			)}
			{lastMessage.text?.trim()
			  ? lastMessage.text.length > 18
				? lastMessage.text.substring(0, 18) + "..."
				: lastMessage.text
			  : <BsFillImageFill size={16} />}
		  </Text>
  
		 
		  <Text fontSize="xs" color={useColorModeValue("gray.500", "gray.400")}>
			{ formatMessageTime(conversation.updatedAt)}
		  </Text>
		</Stack>
	  </Flex>
	);
  };
  
  Conversation.defaultProps = {
	onlineUsers: [], 
  };

  export default Conversation;
