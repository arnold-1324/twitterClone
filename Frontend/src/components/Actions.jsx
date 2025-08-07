import {
	Box,
	Button,
	Flex,
	FormControl,
	Input,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Text,
	useDisclosure,
	IconButton,
	Spinner,
	Stack,
	Checkbox,
	useColorModeValue,
	Avatar,
	Textarea,
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import userAtom from "../atom/userAtom";
import useShowToast from "../hooks/useShowToast";
import postsAtom from "../atom/postsAtom";
import { LuSend } from "react-icons/lu";

const Actions = ({ post }) => {
	const user = useRecoilValue(userAtom);
	const [liked, setLiked] = useState(post.likes.includes(user?._id));
	const [posts, setPosts] = useRecoilState(postsAtom);
	const [isLiking, setIsLiking] = useState(false);
	const [isReplying, setIsReplying] = useState(false);
	const [reply, setReply] = useState("");
	const [showModal, setShowModal] = useState(false);
	const [conversations, setConversations] = useState([]);
	const [selectedUsers, setSelectedUsers] = useState([]);
	const [text, setText] = useState("");
	const [loadingConversations, setLoadingConversations] = useState(false);

	const showToast = useShowToast();
	const { isOpen, onOpen, onClose } = useDisclosure();

	useEffect(() => {
		const getConversations = async () => {
			setLoadingConversations(true);
			try {
				const res = await fetch("/api/messages/getConvo/user");
				const data = await res.json();
				if (data.error) {
					console.error("Error loading conversations:", data.error);
				} else {
					setConversations(data);
				}
			} catch (error) {
				console.error("Unable to load conversations:", error);
			} finally {
				setLoadingConversations(false);
			}
		};
		getConversations();
	}, []);

	useEffect(() => {
		
		if (user && post.likes) {
		  setLiked(post.likes.some((like) => like._id === user._id));
		}
	  }, [user, post.likes]);
	  
	  const handleLikeAndUnlike = async () => {
		if (!user) return showToast("Error", "You must be logged in to like a post", "error");
		if (isLiking) return;
	  
		setIsLiking(true);
	  
		const updatedPost = {
		  ...post,
		  likes: liked
			? post.likes.filter((like) => like._id !== user._id) 
			: [
				...post.likes,
				{
				  _id: user._id,        
				  username: user.username, 
				  profileImg: user.profileImg, 
				},
			  ],
		};
	  
		
		setPosts((prevPosts) =>
		  prevPosts.map((p) => (p._id === post._id ? updatedPost : p))
		);
	  
		
		setLiked((prevLiked) => !prevLiked);
	  
		try {
		  const res = await fetch("/api/posts/like/" + post._id, {
			method: "PUT",
			headers: {
			  "Content-Type": "application/json",
			},
		  });
	  
		  const data = await res.json();
		  if (data.error) {
			showToast("Error", data.error, "error");
			
			setPosts((prevPosts) =>
			  prevPosts.map((p) => (p._id === post._id ? post : p))
			);
		  }
		} catch (error) {
		  showToast("Error", error.message, "error");
		 
		  setPosts((prevPosts) =>
			prevPosts.map((p) => (p._id === post._id ? post : p))
		  );
		} finally {
		  setIsLiking(false);
		}
	  };
	  
	  
	const handleReply = async () => {
		if (!user) return showToast("Error", "You must be logged in to reply to a post", "error");
		if (isReplying) return;
		setIsReplying(true);
		try {
			const res = await fetch("/api/posts/reply/" + post._id, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ comment: reply }),
			});
			const data = await res.json();
			if (data.error) return showToast("Error", data.error, "error");

			const updatedPosts = posts.map((p) => {
				if (p._id === post._id) {
					return { ...p, replies: [...p.replies, data] };
				}
				return p;
			});
			setPosts(updatedPosts);
			showToast("Success", "Reply posted successfully", "success");
			onClose();
			setReply("");
		} catch (error) {
			showToast("Error", error.message, "error");
		} finally {
			setIsReplying(false);
		}
	};

	const handleUserSelect = (convoId) => {
		setSelectedUsers((prev) =>
			prev.includes(convoId)
				? prev.filter((id) => id !== convoId)
				: [...prev, convoId]
		);
	};

	const handleShare = async () => {
		if (selectedUsers.length === 0) {
			alert("Please select at least one user.");
			return;
		}

		try {
			const postData = selectedUsers.map((convoId) => ({
				postId: post._id,
				senderId: user._id,
				conversationId: convoId,
				text,
			}));

			const sharePostPromises = postData.map(async ({ postId, senderId, conversationId, text }) => {
				const res = await fetch("/api/posts/sharepost", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ postId, senderId, conversationId, text }),
				});

				if (!res.ok) {
					throw new Error(`Failed to share post with conversation ${conversationId}`);
				}

				return res.json();
			});

			await Promise.all(sharePostPromises);

			setPosts((prevPosts) =>
				prevPosts.map((p) =>
					p._id === post._id ? { ...p, shareCount: p.shareCount + selectedUsers.length } : p
				)
			);

			alert("Post shared successfully!");
			setSelectedUsers([]);
			setText("");
			setShowModal(false);
		} catch (error) {
			console.error("Error sharing post:", error);
			alert("Failed to share post. Please try again.");
		}
	};

	return (
		<Flex flexDirection='column' marginLeft={"-24px"} mt={2}>
			<Flex gap={3} my={1}  onClick={(e) => e.preventDefault()}>
				<svg
					aria-label="Like"
					color={liked ? "rgb(237, 73, 86)" : ""}
					fill={liked ? "rgb(237, 73, 86)" : "transparent"}
					height="19"
					role="img"
					viewBox="0 0 24 22"
					width="20"
					onClick={handleLikeAndUnlike}
				>
					<path
						d="M1 7.66c0 4.575 3.899 9.086 9.987 12.934.338.203.74.406 1.013.406.283 0 .686-.203 1.013-.406C19.1 16.746 23 12.234 23 7.66 23 3.736 20.245 1 16.672 1 14.603 1 12.98 1.94 12 3.352 11.042 1.952 9.408 1 7.328 1 3.766 1 1 3.736 1 7.66Z"
						stroke="currentColor"
						strokeWidth="2"
					></path>
				</svg>

				<svg
					aria-label='Comment'
					color=''
					fill=''
					height='20'
					role='img'
					viewBox='0 0 24 24'
					width='20'
					onClick={onOpen}
				>
					<title>Comment</title>
					<path
						d='M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z'
						fill='none'
						stroke='currentColor'
						strokeLinejoin='round'
						strokeWidth='2'
					></path>
				</svg>

				<RepostSVG />
				<IconButton
					onClick={() => setShowModal(true)}
					aria-label="Send"
					icon={<LuSend />}
					variant="ghost"
					fontSize="1.5rem"
					cursor="pointer"
					mt={"-8px"}
				/>
				
			</Flex>

			<Flex gap={2} alignItems={"center"}>
				<Text color={"gray.light"} fontSize='sm'>
					{post.likes.length} likes
				</Text>
				<Box w={0.5} h={0.5} borderRadius={"full"} bg={"gray.light"}></Box>
				<Text color={"gray.light"} fontSize='sm'>
					{post.replies.length} replies
				</Text>
				<Text color={"gray.light"} fontSize='sm'>
					{post.shareCount} shares
				</Text>
			</Flex>

			<Modal isOpen={isOpen} onClose={onClose}>
				<ModalOverlay />
				<ModalContent>
					<ModalHeader></ModalHeader>
					<ModalCloseButton />
					<ModalBody pb={6}>
						<FormControl>
							<Input
								placeholder='Reply goes here..'
								value={reply}
								onChange={(e) => setReply(e.target.value)}
							/>
						</FormControl>
					</ModalBody>

					<ModalFooter>
						<Button colorScheme='blue' size={"sm"} mr={3} isLoading={isReplying} onClick={handleReply}>
							Reply
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>

			<Modal isOpen={showModal} onClose={() => setShowModal(false)}>
				<ModalOverlay />
				<ModalContent>
					<ModalHeader>Select Users to Share</ModalHeader>
					<ModalCloseButton />
					<ModalBody>
						{loadingConversations ? (
							<Box textAlign="center" py={4}>
								<Spinner size="lg" />
								<Text mt={2}>Loading conversations...</Text>
							</Box>
						) : (
							<Stack
								spacing={3}
								maxHeight="300px"
								overflowY="auto"
								direction="row"
								wrap="wrap"
							>
								{conversations.map((convo) => {
									const participants = convo.participants.filter(
										(participant) =>
											participant._id !== convo.lastMessage.sender
									);

									return participants.map((participant) => (
										<Box
											key={participant._id}
											display="flex"
											flexDirection="column"
											alignItems="center"
											p={3}
											bg={useColorModeValue("white", "gray.700")}
											borderRadius="md"
											boxShadow="md"
											cursor="pointer"
											_hover={{ bg: useColorModeValue("gray.50", "gray.600") }}
										>
											<Box position="relative" display="inline-block">
												<Avatar
													src={participant.profileImg || "../../public/aot.png"}
													name={participant.username}
													size="lg"
													mb={2}
												/>
												<Checkbox
													isChecked={selectedUsers.includes(convo._id)}
													onChange={() => handleUserSelect(convo._id)}
													size="lg"
													position="absolute"
													bottom="0"
													right="0"
													borderRadius="full"
													zIndex={1}
												/>
											</Box>
											<Text fontWeight="medium">{participant.username}</Text>
										</Box>
									));
								})}
							</Stack>
						)}
					</ModalBody>

					{selectedUsers.length > 0 && (
						<Box px={6} py={4}>
							<Textarea
								value={text}
								onChange={(e) => setText(e.target.value)}
								placeholder="Add a message (optional)"
								size="sm"
								resize="none"
								borderRadius="md"
								border="1px solid"
								borderColor="gray.300"
								mb={4}
							/>
						</Box>
					)}

					<ModalFooter>
						<Button
							colorScheme="blue"
							onClick={handleShare}
							isDisabled={selectedUsers.length === 0}
						>
							Send
						</Button>
						<Button onClick={() => setShowModal(false)} ml={3}>
							Cancel
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</Flex>
	);
};

export default Actions;

const RepostSVG = () => {
	return (
		<svg
			aria-label='Repost'
			color='currentColor'
			fill='currentColor'
			height='20'
			role='img'
			viewBox='0 0 24 24'
			width='20'
		>
			<title>Repost</title>
			<path
				fill=''
				d='M19.998 9.497a1 1 0 0 0-1 1v4.228a3.274 3.274 0 0 1-3.27 3.27h-5.313l1.791-1.787a1 1 0 0 0-1.412-1.416L7.29 18.287a1.004 1.004 0 0 0-.294.707v.001c0 .023.012.042.013.065a.923.923 0 0 0 .281.643l3.502 3.504a1 1 0 0 0 1.414-1.414l-1.797-1.798h5.318a5.276 5.276 0 0 0 5.27-5.27v-4.228a1 1 0 0 0-1-1Zm-6.41-3.496-1.795 1.795a1 1 0 1 0 1.414 1.414l3.5-3.5a1.003 1.003 0 0 0 0-1.417l-3.5-3.5a1 1 0 0 0-1.414 1.414l1.794 1.794H8.27A5.277 5.277 0 0 0 3 9.271V13.5a1 1 0 0 0 2 0V9.271a3.275 3.275 0 0 1 3.271-3.27Z'
			></path>
		</svg>
	);
};

const ShareSVG = () => {
	return (
		<svg
			aria-label='Share'
			color=''
			fill='rgb(243, 245, 247)'
			height='20'
			role='img'
			viewBox='0 0 24 24'
			width='20'
		>
			<title>Share</title>
			<line
				fill='none'
				stroke='currentColor'
				strokeLinejoin='round'
				strokeWidth='2'
				x1='22'
				x2='9.218'
				y1='3'
				y2='10.083'
			></line>
			<polygon
				fill='none'
				points='11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334'
				stroke='currentColor'
				strokeLinejoin='round'
				strokeWidth='2'
			></polygon>
		</svg>
	);
};
