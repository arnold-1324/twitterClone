import { 
	Avatar, 
	Divider, 
	Flex, 
	Image, 
	Skeleton, 
	SkeletonCircle, 
	Text, 
	useColorModeValue 
  } from "@chakra-ui/react";
  import { motion } from "framer-motion"; // Import framer-motion for animation
  import MessageInput from "./MessageInput";
  import { useEffect, useRef, useState } from "react";
  import useShowToast from "../hooks/useShowToast";
  import { conversationsAtom, selectedConversationAtom } from "../atom/messagesAtom";
  import { useRecoilValue, useSetRecoilState } from "recoil";
  import userAtom from "../atom/userAtom";
  import { useSocket } from "../context/SocketContext";
  import messageSound from "../assets/sounds/message.mp3";
  import { FaCompactDisc ,FaPause,FaPlay} from "react-icons/fa";
  
  const MotionFlex = motion(Flex); // Animated Flex component for message animations
  
  const MessageContainer = () => {
	const showToast = useShowToast();
	const [isPlaying, setIsPlaying] = useState(false);
	const selectedConversation = useRecoilValue(selectedConversationAtom);
	const [loadingMessages, setLoadingMessages] = useState(true);
	const [messages, setMessages] = useState([]);
	const currentUser = useRecoilValue(userAtom);
	const { socket } = useSocket();
	const setConversations = useSetRecoilState(conversationsAtom);
	const messageEndRef = useRef(null);
  
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
		bg={useColorModeValue("gray.900", "black")}
		borderRadius="md"
		p={4}
		flexDirection="column"
		maxW="496.22px"
		maxH="537.05px"
		overflow="hidden"
	  >
		<Flex w="full" h={12} alignItems="center" gap={2} mb={2}>
		  <Avatar src={selectedConversation.userProfilePic} size="sm" />
		  <Text display="flex" alignItems="center">
			{selectedConversation.username} <Image src="/verified.png" w={4} h={4} ml={1} />
		  </Text>
		</Flex>
  
		<Divider />
  
		<Flex
		  flexDir="column"
		  gap={4}
		  my={4}
		  p={2}
		  height="400px"
		  overflowY="auto"
		  borderRadius="md"
		  bg={useColorModeValue("gray.800", "black")}
		  boxShadow="md"
		>
		  {loadingMessages
			? [...Array(5)].map((_, i) => (
				<MotionFlex
				  key={i}
				  gap={2}
				  alignItems="center"
				  p={1}
				  borderRadius="md"
				  alignSelf={i % 2 === 0 ? "flex-start" : "flex-end"}
				  initial={{ opacity: 0, y: 20 }}
				  animate={{ opacity: 1, y: 0 }}
				  transition={{ delay: i * 0.1, duration: 0.4 }}
				>
				  {i % 2 === 0 && <SkeletonCircle size={7} />}
				  <Flex flexDir="column" gap={2}>
					<Skeleton h="8px" w="250px" />
					<Skeleton h="8px" w="250px" />
					<Skeleton h="8px" w="250px" />
				  </Flex>
				  {i % 2 !== 0 && <SkeletonCircle size={7} />}
				</MotionFlex>
			  ))
			: messages.map((message) => {
				const isOwnMessage = currentUser._id === message.sender._id;
				return (
				  <MotionFlex
					key={message._id}
					direction="column"
					alignSelf={isOwnMessage ? "flex-end" : "flex-start"}
					gap={2}
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.3 }}
				  >
					<Flex alignItems="center" gap={2} mb={2}>
					  {!isOwnMessage && <Avatar src={message.sender.profileImg} size="sm" />}
					  <Flex
						direction="column"
						bg={isOwnMessage ? "gray.600" : "gray.700"}
						borderRadius="md"
						alignItems={isOwnMessage ? "flex-end" : "flex-start"}
					  >
						{(message.img || message.video || message.audio) && (
						  <Flex direction="column" alignItems="center" gap={2}>
							{message.img && (
							  <Image
								src={message.img}
								alt="Message image"
								maxWidth="50%"
								borderRadius="md"
								mt={2}
								boxShadow="md"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ duration: 0.3 }}
							  />
							)}
							{message.video && (
							  <motion.video
								width="100%"
								controls
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ duration: 0.3 }}
							  >
								<source src={message.video} type="video/mp4" />
								Your browser does not support the video tag.
							  </motion.video>
							)}
{message.audio && (
  <Flex direction="row" alignItems="center" gap={4} w="100%" justify="flex-start" p={2}>
    {/* Gramophone Icon */}
    <Flex
      width="60px"
      height="60px"
      borderRadius="50%"
      bg="gray.700"
      display="flex"
      justifyContent="center"
      alignItems="center"
      boxShadow="lg"
    >
      <FaCompactDisc size={35} color="gold" />
    </Flex>

    {/* Audio Player Container */}
    <Flex
      direction="column"
      w="100%"
      bg="gray.900"
      borderRadius="md"
      p={4}
      boxShadow="lg"
      alignItems="center"
      justify="center"
    >
      {/* Song Title */}
      <Text fontSize="sm" color="white" isTruncated mb={2} fontWeight="bold">
        {message.audioName || "Audio Name"}
      </Text>

      {/* Audio Controls */}
      <Flex direction="row" alignItems="center" justify="center" w="100%" gap={4}>
        {/* Play/Pause Button */}
        <motion.div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px",
            borderRadius: "50%",
            backgroundColor: "green",
            cursor: "pointer",
            boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.2)",
          }}
          onClick={() => {
            if (isPlaying) {
              document.getElementById("audioPlayer").pause();
            } else {
              document.getElementById("audioPlayer").play();
            }
            setIsPlaying(!isPlaying);
          }}
        >
          {isPlaying ? <FaPause size={20} color="white" /> : <FaPlay size={20} color="white" />}
        </motion.div>

        {/* Audio Progress */}
        <motion.audio
          id="audioPlayer"
          controls
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          style={{
            width: "80%",
            backgroundColor: "transparent",
            border: "none",
            outline: "none",
            margin: "0 auto",
          }}
        >
          <source src={message.audio} type="audio/mp3" />
        </motion.audio>
      </Flex>
    </Flex>
  </Flex>
)}

						  </Flex>
						)}
						{message.text && (
						  <Text
							color={isOwnMessage ? "white" : "black"}
							p={2}
							borderRadius="md"
							mt={2}
							boxShadow="sm"
						  >
							{message.text}
						  </Text>
						)}
					  </Flex>
					</Flex>
				  </MotionFlex>
				);
			  })}
		</Flex>
  
		<MessageInput setMessages={setMessages} />
	  </Flex>
	);
  };
  
  export default MessageContainer;
  