import {
	Avatar,
	Divider,
	Flex,
	Image,
	Skeleton,
	SkeletonCircle,
	Text,
	useColorModeValue,
	Box,
  } from "@chakra-ui/react";
  import Message from "./Message";
  import MessageInput from "./MessageInput";
  import { useEffect, useRef, useState } from "react";
  import useShowToast from "../hooks/useShowToast";
  import { conversationsAtom, selectedConversationAtom } from "../atom/messagesAtom";
  import { useRecoilValue, useSetRecoilState } from "recoil";
  import userAtom from "../atom/userAtom";
  import { keyframes } from '@emotion/react';
  import { useSocket } from "../context/SocketContext";
  import messageSound from "../assets/sounds/message.mp3";
  
  const MessageContainer = () => {
	const showToast = useShowToast();
	const selectedConversation = useRecoilValue(selectedConversationAtom);
	const [loadingMessages, setLoadingMessages] = useState(true);
	const [messages, setMessages] = useState([]);
	const currentUser = useRecoilValue(userAtom);
	const { socket } = useSocket();
	const setConversations = useSetRecoilState(conversationsAtom);
	const messageEndRef = useRef(null);
  
	// Colors based on theme
	const containerBg = useColorModeValue("gray.200", "gray.900");
	const messageBg = useColorModeValue("white", "gray.700");
	const ownMessageBg = useColorModeValue("blue.200", "blue.600");
	const textColor = useColorModeValue("black", "white");

	const spinAnimation = keyframes`
	0% { transform: rotate(0deg); }
	100% { transform: rotate(360deg); }
	`;
	
	// Handle new messages in the conversation
	useEffect(() => {
	  const handleNewMessage = (message) => {
		if (selectedConversation._id === message.conversationId) {
		  setMessages((prev) => [...prev, message]);
		}
  
		if (!document.hasFocus()) {
		  new Audio(messageSound).play();
		}
  
		setConversations((prev) =>
		  prev.map((conversation) =>
			conversation._id === message.conversationId
			  ? { ...conversation, lastMessage: { text: message.text, sender: message.sender } }
			  : conversation
		  )
		);
	  };
  
	  socket.on("newMessage", handleNewMessage);
	  return () => socket.off("newMessage", handleNewMessage);
	}, [socket, selectedConversation._id, setConversations]);
  
	useEffect(() => {
	  const markMessagesAsSeen = () => {
		if (messages.length && messages[messages.length - 1].sender._id !== currentUser._id) {
		  socket.emit("markMessagesAsSeen", {
			conversationId: selectedConversation._id,
			userId: selectedConversation.userId,
		  });
		}
	  };
  
	  const handleMessagesSeen = ({ conversationId }) => {
		if (selectedConversation._id === conversationId) {
		  setMessages((prev) =>
			prev.map((message) => (message.seen ? message : { ...message, seen: true }))
		  );
		}
	  };
  
	  markMessagesAsSeen();
	  socket.on("messagesSeen", handleMessagesSeen);
	  return () => socket.off("messagesSeen", handleMessagesSeen);
	}, [messages, currentUser._id, selectedConversation, socket]);
  
	useEffect(() => {
	  messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);
  
	useEffect(() => {
	  const getMessages = async () => {
		setLoadingMessages(true);
		setMessages([]);
		try {
		  if (selectedConversation.mock) return;
		  const res = await fetch(`api/messages/${selectedConversation.userId}`);
		  const data = await res.json();
		  if (data.error) {
			showToast("Error", data.error, "error");
			return;
		  }
		  setMessages(data);
		} catch (error) {
		  showToast("Error", error.message, "error");
		} finally {
		  setLoadingMessages(false);
		}
	  };
	  getMessages();
	}, [selectedConversation.userId, selectedConversation.mock]);
  
	return (
	  <Flex
		flex="70"
		bg={containerBg}
		borderRadius="md"
		p={4}
		flexDirection="column"
		maxW="500px"
		maxH="600px"
		overflow="hidden"
	  >
		{/* Message Header */}
		<Flex w="full" h={12} alignItems="center" gap={2} mb={2}>
		  <Avatar src={selectedConversation.userProfilePic} size="sm" />
		  <Text color={textColor} display="flex" alignItems="center">
			{selectedConversation.username}
			<Image src="/verified.png" w={4} h={4} ml={1} />
		  </Text>
		</Flex>
		<Divider />
  
		{/* Messages List */}
		<Flex
		  flexDir="column"
		  gap={4}
		  my={4}
		  p={2}
		  height="400px"
		  overflowY="auto"
		  borderRadius="md"
		  bg={containerBg}
		  boxShadow="md"
		>
		  {loadingMessages
			? [...Array(5)].map((_, i) => (
				<Flex
				  key={i}
				  gap={2}
				  alignItems="center"
				  p={1}
				  borderRadius="md"
				  alignSelf={i % 2 === 0 ? "flex-start" : "flex-end"}
				>
				  {i % 2 === 0 && <SkeletonCircle size={7} />}
				  <Flex flexDir="column" gap={2}>
					<Skeleton h="8px" w="250px" />
					<Skeleton h="8px" w="250px" />
					<Skeleton h="8px" w="250px" />
				  </Flex>
				  {i % 2 !== 0 && <SkeletonCircle size={7} />}
				</Flex>
			  ))
			: messages.map((message) => {
				const isOwnMessage = currentUser._id === message.sender._id;
				return (
				  <Flex
					key={message._id}
					direction="column"
					alignSelf={isOwnMessage ? "flex-end" : "flex-start"}
					gap={2}
				  >
					<Flex alignItems="center" gap={2} mb={2}>
					  {!isOwnMessage && <Avatar src={message.sender.profileImg} size="sm" />}
					  <Flex
						direction="column"
						bg={isOwnMessage ? ownMessageBg : messageBg}
						borderRadius="16px"
						alignItems={isOwnMessage ? "flex-end" : "flex-start"}
						p={2}
						boxShadow="md"
						position="relative"
					  >
						{message.img && (
						  <Image
							src={message.img}
							alt="Message image"
							maxWidth="70%"
							borderRadius="md"
							mt={2}
							boxShadow="md"
						  />
						)}
						{message.video && (
						<Box as="video" src={message.video} controls width="100%" borderRadius="md" boxShadow="md" />
						)}
						{message.text && (
						  <Text color={textColor} mt={2}>
							{message.text}
						  </Text>
						)}
						<Box
						  position="absolute"
						  w="0"
						  h="0"
						  borderLeft={isOwnMessage ? `10px solid ${ownMessageBg}` : "none"}
						  borderRight={!isOwnMessage ? `10px solid ${messageBg}` : "none"}
						  borderBottom="10px solid transparent"
						  top={isOwnMessage ? "unset" : "0"}
						  bottom={isOwnMessage ? "0" : "unset"}
						  right={isOwnMessage ? "-10px" : "unset"}
						  left={!isOwnMessage ? "-10px" : "unset"}
						/>
					  </Flex>
					</Flex>
				  </Flex>
				);
			  })}
		</Flex>
  
		<MessageInput setMessages={setMessages} />
	  </Flex>
	);
  };
  
  export default MessageContainer;
  