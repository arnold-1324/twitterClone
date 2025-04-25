import React, { useState } from "react";
import {
  Box,
  Flex,
  Text,
  Image,
  Avatar,
  IconButton,
  useColorModeValue,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { FaPause, FaPlay } from "react-icons/fa";
import { BsThreeDotsVertical, BsCheck2All } from "react-icons/bs";
import Reaction from "./Reaction";
import formatMessageTime from "../Utils/Timeformate";
import userAtom from "../atom/userAtom";
import { useRecoilValue } from "recoil";
import AudioPlayer from "./AudioPlayer";

const MotionFlex = motion(Flex);
const Message = ({
  message,
  isOwnMessage,
  handelselectedMsg,
  handleDelete,
  updateMessageReactions,
  handleHighlightMessage,
  playingAudioId,
  setPlayingAudioId,
}) => {
 // const [isPlaying, setIsPlaying] = React.useState(false);
  const audioRef = React.useRef(null);
  const currentUser = useRecoilValue(userAtom);
  const [playingAudioId, setPlayingAudioId] = useState(null)
  return (

      <MotionFlex
        direction="column"
        justifySelf={isOwnMessage ? "flex-end" : "flex-start"}
        width={message.audio ? "73%" :"70%"}
        height={message.audio && "90px"}
        rounded={message.audio && "full"}
        maxWidth={"50%"}
        p={1}
        mt={2}
        borderRadius="15px"
        color="white"
        boxShadow="md"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        position="relative"
        bg={isOwnMessage ? "gray.900" : "gray.400"}
      >
      {message.replyTo && (
        <Box
          p={2}
          bg={useColorModeValue("gray.100", "gray.700")}
          borderLeft="4px solid"
          borderColor={useColorModeValue("teal.500", "teal.300")}
          borderRadius="md"
          position="relative"
          boxShadow={useColorModeValue("sm", "md")}
          mb={1}
          onClick={() => handleHighlightMessage(message.replyTo._id)}
          cursor="pointer"
        >
          <Flex direction="row" alignItems="center">
            <Box flex="1">
              <Text
                fontSize="sm"
                fontWeight="bold"
                color={useColorModeValue("teal.600", "teal.200")}
                mb={1}
              >
                {message.replyTo.sender._id === currentUser._id ||
                message.sender.id === currentUser._id
                  ? "You"
                  : message.replyTo.sender.username}
              </Text>
              <Text
                fontSize="sm"
                color={useColorModeValue("gray.800", "gray.100")}
                noOfLines={2}
              >
                {message.replyTo.text}
              </Text>
            </Box>

            {(message.replyTo.img || message.replyTo.video) && (
              <Box
                w="90px"
                h="50px"
                ml={2}
                borderRadius="md"
                overflow="hidden"
                boxShadow={useColorModeValue("md", "lg")}
              >
                {message.replyTo.img && (
                  <Image
                    src={message.replyTo.img}
                    alt="Thumbnail"
                    objectFit="cover" 
                    w="full"
                    h="full"
                  />
                )}
                {message.replyTo.video && (
                  <video w="full" h="full" controls={false}>
                    <source src={message.replyTo.video} />
                  </video>
                )}
              </Box>
            )}
          </Flex>
        </Box>
      )}

      {message.postReference && (
        <Box
          position="relative"
          bg="gray.500"
          borderRadius="md"
          maxW="lg"
          w="full"
          mb={4}
          overflow="hidden" 
        >
         
          <Flex
            position="absolute"
            top={2}
            left={2}
            bg="rgba(0, 0, 0, 0.0)" 
            p={2}
            borderRadius="md"
            align="center"
            zIndex={2}
          >
            <Avatar
              size="sm"
              src={message.postReference?.postedBy?.profileImg}
              mr={2}
            />
            <Text fontWeight="bold" color="white">
              {message.postReference?.postedBy?.username}
            </Text>
          </Flex>

          
          <Image
            src={message.postReference?.images}
            alt="Post Image"
            w="full"
            h="300px" 
            objectFit="cover" 
          />
        </Box>
      )}

      {message.text && (
        <Text color={isOwnMessage ? "gray.200" : "gray.900"}>
          {message.text}
        </Text>
      )}
      {message.img && (
        <Image src={message.img} borderRadius="10px" />
      )}
      {message.video && (
        <video controls width="100%">
          <source src={message.video} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      )}
      {message.audio && (
        <AudioPlayer
          audioUrl={message.audio}
          isPlaying={playingAudioId === message._id}
          onPlay={(id) => {
            if (id === null) {
              setPlayingAudioId(null)
            } else {
              setPlayingAudioId(message._id)
            }
          }}
        />
      )}
      {message.seen && (
        <Box
          color={isOwnMessage ? "blue.400" : "gray.900"}
          mr={1}
          alignSelf={"flex-end"}
        >
          <BsCheck2All size={16} />
        </Box>
      )}

      <Flex position="absolute" top="-25px" right="0">
        <Menu>
          <MenuButton
            as={IconButton}
            icon={<BsThreeDotsVertical />}
            variant="ghost"
            size="sm"
            aria-label="Options"
          />
          <MenuList
            borderRadius="md"
            boxShadow="lg"
            p={2}
            bg={useColorModeValue("white", "gray.800")}
            color="black"
            mt="4px"
          >
            {isOwnMessage && (
              <MenuItem onClick={() => handleEdit(message._id)}>
                Edit
              </MenuItem>
            )}
            <MenuItem
              onClick={() => {
                const data = {
                  id: message._id,
                  text: message.text,
                  media:
                    message.img || message.video || message.audio,
                  mediaType: message.img
                    ? "img"
                    : message.video
                      ? "video"
                      : message.audio
                        ? "audio"
                        : null,
                  sender: isOwnMessage
                    ? "you"
                    : message.sender.username,
                };

                handelselectedMsg(data);
              }}
            >
              Reply
            </MenuItem>

            <MenuItem onClick={() => handleDelete(message._id)}>
              Delete
            </MenuItem>
          </MenuList>
        </Menu>
      </Flex>

      <Reaction
        messageId={message._id}
        initialReactions={message.reactions}
        onUpdateReactions={updateMessageReactions}
      />

      <Text
        fontSize="xs"
        align="right"
        mt={1}
        color={isOwnMessage ? "gray.200" : "gray.900"}
      >
        {formatMessageTime(message.createdAt)}
      </Text>
    </MotionFlex>
  );
};

export default Message;