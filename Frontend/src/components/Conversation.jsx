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

  const Conversation = ({ conversation, onlineUsers }) => {
	const currentUser = useRecoilValue(userAtom);
	const [selectedConversation, setSelectedConversation] = useRecoilState(
	  selectedConversationAtom
	);
  

	const hoverBgColor = useColorModeValue("gray.100", "gray.700");
	const selectedBgColor = useColorModeValue("gray.200", "gray.600");
	
	
	const otherParticipant = conversation.participants.find(
		(p) => p._id !== currentUser._id
	);
	const isOnline = otherParticipant && onlineUsers.includes(otherParticipant._id);
	
	const lastMessage = conversation.lastMessage || {};
	

	
	
	const handleSelectConversation = () => {
		if (otherParticipant) {
			setSelectedConversation({
				_id: conversation._id,
		  userId: otherParticipant._id,
		  userProfilePic: otherParticipant.profileImg,
		  username: otherParticipant.username,
		});
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
			src={otherParticipant?.profileImg || ""}
			name={otherParticipant?.username || "Unknown"}
			borderRadius="full"
			isOnline={isOnline}
		  >
			{isOnline && <AvatarBadge boxSize="1em" bg="green.400" />}
		  </Avatar>
		</WrapItem>
  
		
		<Stack direction={"column"} fontSize={"sm"} flex="1">
		 
		  <Text fontWeight="bold" display={"flex"} alignItems={"center"}>
				{otherParticipant?.username || "Unknown"}
			{otherParticipant?.isVerified && (
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
