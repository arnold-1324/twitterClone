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

  // guard if conversation is not provided
  if (!conversation) return null;

  // Normalise participants (use participants, fall back to members)
  const participants = Array.isArray(conversation.participants)
    ? conversation.participants
    : Array.isArray(conversation.members)
    ? conversation.members
    : [];

  // Ensure ids are compared as strings
  const onlineIds = Array.isArray(onlineUsers)
    ? onlineUsers.map((id) => String(id))
    : [];

  const currentUserId = currentUser?._id ? String(currentUser._id) : null;

  // Check if this is a group conversation
  const isGroup = Boolean(conversation.isGroup || conversation.groupInfo);

  // lastMessage fallback (could be in messages array)
  const lastMessage =
    conversation.lastMessage ||
    (Array.isArray(conversation.messages) && conversation.messages.length
      ? conversation.messages[conversation.messages.length - 1]
      : {}) || {};

  // compute display values safely
  let displayName = "Unknown";
  let displayImage = "";
  let isOnline = false;

  if (isGroup) {
    displayName = conversation.groupInfo?.name || "Group";
    displayImage = conversation.groupInfo?.profileImage || "";
    isOnline = participants.some((p) => onlineIds.includes(String(p?._id)));
  } else {
    const otherParticipant = participants.find(
      (p) => String(p?._id) !== currentUserId
    );
    displayName = otherParticipant?.username || "Unknown";
    displayImage = otherParticipant?.profileImg || "";
    isOnline = Boolean(
      otherParticipant && onlineIds.includes(String(otherParticipant._id))
    );
  }

  const handleSelectConversation = () => {
    if (isGroup) {
      setSelectedConversation({
        _id: conversation._id,
        groupId: conversation.groupId || conversation.groupInfo?._id,
        username: displayName,
        userProfilePic: displayImage,
        isGroup: true,
        groupInfo: conversation.groupInfo || conversation, // keep groupInfo if available
        participants,
      });
    } else {
      const otherParticipant = participants.find(
        (p) => String(p?._id) !== currentUserId
      );
      if (otherParticipant) {
        setSelectedConversation({
          _id: conversation._id,
          userId: otherParticipant._id,
          userProfilePic: otherParticipant.profileImg,
          username: otherParticipant.username,
          isGroup: false,
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
      bg={selectedConversation?._id === conversation._id ? selectedBgColor : "transparent"}
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
              {participants.length || 0} members
            </Text>
          )}
          {!isGroup &&
            participants.find((p) => String(p?._id) !== currentUserId)?.isVerified && (
              <Image src="/verified.png" w={4} h={4} ml={2} alt="verified" />
            )}
        </Text>

        <Text fontSize={"xs"} color={useColorModeValue("gray.600", "gray.400")}>
          {lastMessage.sender && (
            <Box color={lastMessage.seen ? "blue.400" : "gray.500"} mr={1} display="inline-block">
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
          {formatMessageTime(conversation.updatedAt)}
        </Text>
      </Stack>
    </Flex>
  );
};

Conversation.defaultProps = {
  onlineUsers: [],
};

export default Conversation;
