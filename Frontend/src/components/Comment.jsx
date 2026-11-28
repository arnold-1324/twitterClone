import { MessageSticker } from "./Stickers";
import { stickerLabel } from "../lib/stickers";
import { Avatar, Divider, Flex, Text } from "@chakra-ui/react";

const Comment = ({ reply, lastReply }) => {
	return (
		<>
			<Flex gap={4} py={2} my={2} w={"full"}>
				<Avatar src={reply.profileImg} size={"sm"} />
				<Flex gap={1} w={"full"} flexDirection={"column"}>
					<Flex w={"full"} justifyContent={"space-between"} alignItems={"center"}>
						<Text fontSize='sm' fontWeight='bold'>
							{reply.username}
						</Text>
					</Flex>
					<Text as="div">{stickerLabel(reply.comment) ? <MessageSticker text={reply.comment} /> : reply.comment}</Text>
					{reply.mediaUrl && <img className="engagement-comment-image" src={reply.mediaUrl} loading="lazy" alt="Photo attached to reply" />}
				</Flex>
			</Flex>
			{!lastReply ? <Divider /> : null}
		</>
	);
};

export default Comment;
