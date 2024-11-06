import { Avatar, Box, Flex, Image, Skeleton, Text } from "@chakra-ui/react";
import { selectedConversationAtom } from "../atom/messagesAtom";
import { useRecoilValue } from "recoil";
import userAtom from "../atom/userAtom";
import { BsCheck2All } from "react-icons/bs";
import { useState } from "react";

const Message = ({ ownMessage, message }) => {
	const selectedConversation = useRecoilValue(selectedConversationAtom);
	const user = useRecoilValue(userAtom);
	const [imgLoaded, setImgLoaded] = useState(false);

	return (
		<Flex gap={2} direction={ownMessage ? "row-reverse" : "row"}>
			{ownMessage ? (
				<>
					{/* Sent Message */}
					{message.text && (
						<Flex bg="green.800" maxW="350px" p={1} borderRadius="md">
							<Text color="white">{message.text}</Text>
							<Box alignSelf="flex-end" ml={1} color={message.seen ? "blue.400" : ""} fontWeight="bold">
								<BsCheck2All size={16} />
							</Box>
						</Flex>
					)}

					{/* Sent Message Image */}
					{message.img && (
						<Flex mt={5} w="200px">
							<Image src={message.img} alt="Message image" borderRadius={4} hidden={!imgLoaded} onLoad={() => setImgLoaded(true)} />
							{!imgLoaded && <Skeleton w="200px" h="200px" />}
						</Flex>
					)}

					<Avatar src={user.profilePic} w="7" h="7" />
				</>
			) : (
				<>
					{/* Received Message */}
					<Avatar src={selectedConversation.userProfilePic} w="7" h="7" />
					{message.text && (
						<Text maxW="350px" bg="gray.400" p={1} borderRadius="md" color="black">
							{message.text}
						</Text>
					)}

					{/* Received Message Image */}
					{message.img && (
						<Flex mt={5} w="200px">
							<Image src={message.img} alt="Message image" borderRadius={4} hidden={!imgLoaded} onLoad={() => setImgLoaded(true)} />
							{!imgLoaded && <Skeleton w="200px" h="200px" />}
						</Flex>
					)}
				</>
			)}
		</Flex>
	);
};

export default Message;
