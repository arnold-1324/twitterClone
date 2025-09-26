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
import GroupUIComponents from "../components/GroupUIComponents";
import CreateGroupButton from "../components/CreateGroupButton";
import "../styles/ChatResponsive.css";
//import { CreateGroupModal, InviteModal, PermissionsDropdown } from "../components/GroupUIComponents";

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
  //const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
 // const [inviteModalOpen, setInviteModalOpen] = useState(false);
//  const [groupPermissions, setGroupPermissions] = useState(null);
  const [groupInfoModalOpen, setGroupInfoModalOpen] = useState(false);
   
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
        const res = await fetch("/api/messages/getConvo/user");
        const data = await res.json();

        if (data.error) {
          showToast("Error", data.error, "error");
        } else {
         // console.log("Conversations data:",data);
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

        setConversations((prev) => {
          const filtered = prev.filter(c => c._id !== newConversation._id);
          return [...filtered, newConversation];
        });
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

  // Helper: is current conversation a group?
  const isGroupConversation = selectedConversation && selectedConversation.isGroup;
  const groupId = isGroupConversation ? selectedConversation.groupId : null;

  return (
    <div className="chat-app-shell">
      <div className="chat-page-container">
        <div className="chat-flex-container">
          {/* Conversation List - Hide on mobile when conversation is selected */}
          {(!isMobileView || !selectedConversation._id) && (
            <div className="conversation-list">
              {/* Create Group Button */}
              <div className="create-group-button">
                <CreateGroupButton onClick={() => setGroupInfoModalOpen(true)} />
              </div>

              {/* Search Form */}
              <div className="chat-search-container">
                <form onSubmit={handleConversationSearch} className="chat-search-form">
                  <Input
                    className="chat-search-input"
                    placeholder="Search for a user"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    size="md"
                    fontSize="16px"
                    _focus={{
                      borderColor: "blue.500",
                      boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)"
                    }}
                  />
                  <Button
                    className="chat-search-button"
                    type="submit"
                    isLoading={searchingUser}
                    colorScheme="blue"
                    size="md"
                    aria-label="Search for user"
                    minW="44px"
                    h="44px"
                  >
                    <SearchIcon />
                  </Button>
                </form>
              </div>

              {/* Conversations Scroll Area */}
              <div className="conversation-list-scroll">
                {loadingConversations ? (
                  [0, 1, 2, 3].map((_, i) => (
                    <Flex key={i} gap={4} alignItems="center" p={3}>
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
                        borderRadius: "12px",
                        p: 3,
                        mb: 2,
                        cursor: "pointer",
                        _hover: { 
                          boxShadow: "0px 0px 8px 0px rgba(66, 153, 225, 0.6)",
                          transform: "translateY(-1px)"
                        },
                        ...(selectedConversation._id === conversation._id && {
                          boxShadow: "0px 0px 8px 0px rgba(66, 153, 225, 0.8)",
                          bg: "gray.800"
                        }),
                      }}
                    />
                  ))
                ) : (
                  <Text textAlign="center" color="gray.400" py={8}>
                    No conversations found.
                  </Text>
                )}
              </div>
            </div>
          )}

          {/* Message Container */}
          {selectedConversation._id ? (
            <div className="message-container">
              {isGroupConversation && (
                <Box mb={2} p={3}>
                  {/* Group permissions component can go here */}
                </Box>
              )}
              <MessageContainer 
                isMobileView={isMobileView} 
                setSelectedConversation={setSelectedConversation} 
              />
            </div>
          ) : (
            !isMobileView && (
              <Flex
                className="message-container"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                borderRadius="md"
                bg="gray.800"
                border="2px dashed"
                borderColor="gray.600"
              >
                <GiConversation size={80} color="var(--chakra-colors-gray-500)" />
                <Text mt={4} color="gray.400" textAlign="center" fontSize="lg">
                  Select a conversation to start messaging
                </Text>
                <Text mt={2} color="gray.500" textAlign="center" fontSize="sm">
                  Choose from your conversations or search for users
                </Text>
              </Flex>
            )
          )}
        </div>

        {/* Group Management Modal */}
        <GroupUIComponents
          isOpen={groupInfoModalOpen}
          onClose={() => setGroupInfoModalOpen(false)}
          mode="create"
        />
      </div>
    </div>
  );
};

export default ChatPage;
