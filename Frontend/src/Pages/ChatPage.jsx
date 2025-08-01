import { SearchIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Flex,
  IconButton,
  Input,
  Skeleton,
  SkeletonCircle,
  Text,
  useBreakpointValue,
} from "@chakra-ui/react";
import Conversation from "../components/Conversation";
import { GiConversation } from "react-icons/gi";
import MessageContainer from "../components/MessageContainer";
import { useEffect, useState } from "react";
import useShowToast from "../hooks/useShowToast";
import { useRecoilState, useRecoilValue } from "recoil";
import { conversationsAtom, selectedConversationAtom } from "../atom/messagesAtom";
import userAtom from "../atom/userAtom";
import { useSocket } from "../context/SocketContext";
import { motion } from "framer-motion";
import { InviteModal, PermissionsDropdown, ConversationInput } from "../components/GroupUIComponents";

const MotionFlex = motion(Flex);
const MotionBox = motion(Box);

const ChatPage = () => {
  const [searchingUser, setSearchingUser] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [selectedConversation, setSelectedConversation] = useRecoilState(selectedConversationAtom);
  const [conversations, setConversations] = useRecoilState(conversationsAtom);
  const currentUser = useRecoilValue(userAtom);
  const showToast = useShowToast();
  const { socket, onlineUsers } = useSocket();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [groupPermissions, setGroupPermissions] = useState(null);
     
  const isMobileView = useBreakpointValue({ base: true, md: false }); // Mobile view condition

  useEffect(() => {
    const handleMessagesSeen = ({ conversationId }) => {
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation._id === conversationId
            ? {
                ...conversation,
                lastMessage: { ...conversation.lastMessage, seen: true },
              }
            : conversation
        )
      );
    };

    socket?.on("messagesSeen", handleMessagesSeen);

    return () => {
      socket?.off("messagesSeen", handleMessagesSeen);
    };
  }, [socket, setConversations]);

  useEffect(() => {
    const getConversations = async () => {
      try {
        const res = await fetch("api/messages/getConvo/user");
        const data = await res.json();

        if (data.error) {
          showToast("Error", data.error, "error");
        } else {
          setConversations(data);
        }
      } catch {
        showToast("Error", "Unable to load conversations. Please try again.", "error");
      } finally {
        setLoadingConversations(false);
      }
    };

    getConversations();
  }, [setConversations]);

  const handleConversationSearch = async (e) => {
    e.preventDefault();
    if (!searchText.trim()) return;

    setSearchingUser(true);

    try {
      const res = await fetch(`/api/users/profile/${searchText}`);
      const searchedUser = await res.json();

      if (searchedUser.error) {
        showToast("Error", searchedUser.error, "error");
        return;
      }

      if (!searchedUser) {
        showToast("Error", "User not found.", "error");
        return;
      }

      const isSelf = searchedUser._id === currentUser._id;
      if (isSelf) {
        showToast("Error", "You cannot message yourself.", "error");
        return;
      }

      const existingConversation = conversations.find(
        (c) => c.participants[0]?._id === searchedUser._id
      );

      if (existingConversation) {
        setSelectedConversation({
          _id: existingConversation._id,
          userId: searchedUser._id,
          username: searchedUser.username,
          userProfilePic: searchedUser.profileImg,
        });
      } else {
        const newConversation = {
          mock: true,
          lastMessage: { text: "", sender: "" },
          _id: `mock-${Date.now()}`,
          participants: [searchedUser],
        };

        setConversations((prev) => [...prev, newConversation]);
        setSelectedConversation({
          _id: newConversation._id,
          userId: searchedUser._id,
          username: searchedUser.username,
          userProfilePic: searchedUser.profileImg,
        });
      }
    } catch (error) {
      showToast("Error", "Failed to search user.", "error");
    } finally {
      setSearchingUser(false);
    }
  };

  // Check if the user is online and send the status to the Conversation component
  const log = conversations.map((con) => {
  
    console.log(con._id);
    const isOnline = onlineUsers.includes(con.participants[0]?._id);
   
    return (
      <Conversation
      isOnline={isOnline}
        key={con._id}
        conversation={con}
        sx={{
          transition: "box-shadow 0.2s ease-in-out",
          _hover: { boxShadow: "0px 0px 8px 0px rgba(66, 153, 225, 0.6)" },
          ...(selectedConversation._id === con._id && {
            boxShadow: "0px 0px 8px 0px rgba(66, 153, 225, 0.8)",
          }),
        }}
      />
    );
  });

  // Helper: is current conversation a group?
  const isGroupConversation = selectedConversation && selectedConversation.isGroup;
  const groupId = isGroupConversation ? selectedConversation._id : null;

  return (
    <Box
      position="absolute"
      left="50%"
      w={{ base: "100%", md: "80%", lg: "950px" }}
      p={4}
      mt="49px"
      transform="translateX(-50%)"
    >
      <Flex
        gap={4}
        flexDirection={isMobileView && selectedConversation._id ? "column" : "row"}
        mx="auto"
        my="10px"
        maxW={{ sm: "400px", md: "full" }}
      >
        {(!isMobileView || !selectedConversation._id) && (
          <Flex flex={30} flexDirection="column" gap={4} maxH={"600px"}>
            {/* Add group creation/invite button */}
            <Button colorScheme="teal" mb={2} onClick={() => setInviteModalOpen(true)}>
              Manage Groups
            </Button>
            <form onSubmit={handleConversationSearch}>
              <Flex gap={2}>
                <Input
                  placeholder="Search for a user"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <Button
                  type="submit"
                  isLoading={searchingUser}
                  size="sm"
                  aria-label="Search for user"
                >
                  <SearchIcon />
                </Button>
              </Flex>
            </form>

            <Box
              flex="1"
              maxH={{ base: "400px", md: "500px" }}
              overflowY="auto"
              sx={{
                "&::-webkit-scrollbar": { display: "none" },
                "-ms-overflow-style": "none",
                "scrollbar-width": "none",
              }}
            >
              {loadingConversations ? (
                [0, 1, 2, 3].map((_, i) => (
                  <Flex key={i} gap={4} alignItems="center">
                    <SkeletonCircle size="10" />
                    <Flex flexDirection="column" gap={2} w="full">
                      <Skeleton h="10px" w="80px" />
                      <Skeleton h="8px" w="90%" />
                    </Flex>
                  </Flex>
                ))
              ) : conversations.length ? (
                conversations.map((conversation) => (
                  <Conversation
                    key={conversation._id}
                    conversation={conversation}
                    onlineUsers={onlineUsers}
                    sx={{
                      transition: "box-shadow 0.2s ease-in-out",
                      _hover: { boxShadow: "0px 0px 8px 0px rgba(66, 153, 225, 0.6)" },
                      ...(selectedConversation._id === conversation._id && {
                        boxShadow: "0px 0px 8px 0px rgba(66, 153, 225, 0.8)",
                      }),
                    }}
                  />
                ))
              ) : (
                <Text>No conversations found.</Text>
              )}
            </Box>
          </Flex>
        )}

        {selectedConversation._id ? (
          <Flex flex={70} flexDirection="column" gap={2}>
            {/* If group, show permissions dropdown and invite modal */}
            {isGroupConversation && (
              <Box mb={2}>
                <PermissionsDropdown
                  groupId={groupId}
                  currentUserId={currentUser._id}
                  value={groupPermissions || (selectedConversation.permissions?.canMessage || "all")}
                  onChange={setGroupPermissions}
                />
                <Button size="sm" ml={2} onClick={() => setInviteModalOpen(true)}>
                  Invite Members
                </Button>
              </Box>
            )}
            <MessageContainer isMobileView={isMobileView} setSelectedConversation={setSelectedConversation} />
            {/* Use group-aware input for group conversations */}
            {isGroupConversation && (
              <ConversationInput
                group={selectedConversation}
                currentUserId={currentUser._id}
                onSend={msg => {/* send message logic here */}}
              />
            )}
          </Flex>
        ) : (
          !isMobileView && (
            <Flex
              flex={70}
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              h="400px"
              borderRadius="md"
            >
              <GiConversation size={100} />
              <Text>Select a conversation to start messaging</Text>
            </Flex>
          )
        )}
      </Flex>
      {/* Invite modal for group management */}
      {isGroupConversation && (
        <InviteModal
          isOpen={inviteModalOpen}
          onClose={() => setInviteModalOpen(false)}
          groupId={groupId}
          currentUserId={currentUser._id}
        />
      )}
    </Box>
  );
};

export default ChatPage;
