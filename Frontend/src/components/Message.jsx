import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Flex,
  Text,
  Image,
  Avatar,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useColorModeValue,
  Textarea,
  Button,
  useToast,
} from "@chakra-ui/react";
import { BsThreeDotsVertical, BsCheck2All } from "react-icons/bs";
import { motion } from "framer-motion";
//import AudioPlayerNew from "./AudioPlayerNew";
import Reaction from "./Reaction";
import formatMessageTime from "../Utils/Timeformate";
import { useRecoilValue } from "recoil";
import userAtom from "../atom/userAtom";
import AudioPlayer from "./AudioPlayer"; // Assuming you have an AudioPlayer component

const MotionFlex = motion(Flex);

// Helper: detect emoji-only short messages (best-effort)
const isEmojiOnly = (text = "") => {
  if (!text) return false;
  try {
    const emojiRE = /\p{Extended_Pictographic}/u;
    const codepoints = [...text.trim()];
    const allEmoji = codepoints.every((c) => emojiRE.test(c));
    return allEmoji && codepoints.length <= 4;
  } catch (e) {
    return text.trim().length <= 2 && /[^\w\s]/.test(text);
  }
};

const Message = ({
  message,
  isOwnMessage,
  handelselectedMsg,
  handleDelete,
  updateMessageReactions,
  handleHighlightMessage,
  playingAudioId,
  setPlayingAudioId,
  isGroupMessage,
  editingMessageId,
  setEditingMessageId,
  setEditingText,
  onEditSubmit,
}) => {
  const toast = useToast();
  const currentUser = useRecoilValue(userAtom);
   const audioRef = React.useRef(null);
  const [localEditingText, setLocalEditingText] = useState(message.text);
  const [isEditing, setIsEditing] = useState(false);
  // const [playingAudioId, setPlayingAudioId] = useState(null);

  // move color tokens to component scope (hooks must be top-level)
  const bgCard = useColorModeValue("gray.50", "gray.700");
  const textCard = useColorModeValue("gray.900", "gray.100");
  const muted = useColorModeValue("gray.600", "gray.300");

  useEffect(() => {
    setIsEditing(editingMessageId === message._id);
  }, [editingMessageId, message._id]);

  useEffect(() => {
    setLocalEditingText(message.text);
  }, [message.text]);

  const handleEditSubmit = async () => {
    try {
      const updated = await onEditSubmit(message._id, localEditingText);
      if (updated) {
        setLocalEditingText(updated.text);
        setEditingMessageId(null);
        setEditingText("");
        setIsEditing(false);
      }
    } catch (err) {
      toast({
        title: "Edit failed",
        description: err?.message || "Something went wrong",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };


  const cancelEdit = () => {
    setEditingMessageId(null);
    setLocalEditingText(message.text);
  };

  // If message was deleted for this user -> show deleted notice
  const isDeletedForMe = Array.isArray(message.deletedFor) && message.deletedFor.includes(currentUser._id);
  const isDeletedForAll = Array.isArray(message.deletedFor) && message.deletedFor.length > 0 && !isDeletedForMe;

  // Improved renderMedia with compact fallback card
  const renderMedia = () => {

    // For pure audio messages with no text or post/media -> render audio player only
    if (message.type === "audio" && !message.text?.trim()) {
      return (
        <Box
          alignSelf={isOwnMessage ? "flex-end" : "flex-start"}
          mt={2}
          minW="250px"
          minH={"50px"}
        >
         
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
        </Box>
      );
    }


    // Case: post message with missing postReference -> compact horizontal card
    if (message.type === "post" && !message.postReference) {
      const username = message.sender?.username || "";

      return (
        <Box
          mt={2}
          p={3}
          borderRadius="12px"
          bg={bgCard}
          color={textCard}
          boxShadow="sm"
          border="1px solid"
          borderColor={useColorModeValue("gray.200", "gray.600")}
          width="100%"
          alignSelf={isOwnMessage ? "flex-end" : "flex-start"}
        >
          <Flex align="center" gap={3}>
            <Avatar size="md" src={message.sender?.profileImg} name={username} />

            <Box flex="1" minW={0}>
              <Text fontSize="sm" fontWeight="bold" noOfLines={1} color={textCard}>
                {message.sender?.username ?? "Unknown"}
              </Text>

              <Text fontSize="sm" noOfLines={2} color={muted} mt={1}>
                Post unavailable — it may have been removed or is no longer accessible.
              </Text>
            </Box>

            <Flex direction="column" align="flex-end" gap={2}>
              <Text fontSize="xs" color={useColorModeValue("gray.500", "gray.400")}>
                Shared
              </Text>
            </Flex>
          </Flex>
        </Box>
      );
    }

    // If postReference exists and is populated, render the post card
    if (message.postReference || message.type === "post") {
      const post = message.postReference;
      if (post) {
        return (
          <Box
            mt={2}
            p={2}
            borderRadius="10px"
            bg={bgCard}
            color={useColorModeValue("black", "white")}
            cursor="pointer"
            _hover={{ transform: "translateY(-2px)", transition: "150ms" }}
            alignSelf={isOwnMessage ? "flex-end" : "flex-start"}
          >
            <Flex align="center" mb={2}>
              <Avatar size="sm" src={post.postedBy?.profileImg} name={post.postedBy?.username} mr={3} />
              <Box>
                <Text fontSize="sm" fontWeight="bold">
                  {post.postedBy?.username || "Unknown"}
                </Text>
              </Box>
            </Flex>

            {post.images ? (
              <Box borderRadius="8px" overflow="hidden" mb={2}>
                <Image src={post.images} alt="Post image" objectFit="cover" w="100%" />
              </Box>
            ) : null}

            {post.caption && (
              <Text fontSize="sm" noOfLines={2}>
                {post.caption}
              </Text>
            )}
          </Box>
        );
      }
    }

    // regular img / video / audio
    if (message.img) {
      return <Image src={message.img} borderRadius="10px" maxW="100%" w="100%" alt="Shared content" />;
    }

    if (message.video) {
      return (
        <Box w="100%" maxW="100%">
          <video controls width="100%" style={{ borderRadius: 8, background: "#222" }} poster={message.thumbnail}>
            <source src={message.video} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </Box>
      );
    }



    return null;
  };

  // message content display: handle deleted, emoji-only (larger), edited
  const content = useMemo(() => {
    if (isDeletedForMe) {
      return (
        <Text fontStyle="italic" fontSize="sm" color={useColorModeValue("gray.600", "gray.400")}>
          You deleted this message
        </Text>
      );
    }
    if (isDeletedForAll) {
      return (
        <Text fontStyle="italic" fontSize="sm" color={useColorModeValue("gray.600", "gray.400")}>
          This message was deleted
        </Text>
      );
    }

    if (isEditing) return null; // editing UI handled separately

    // emoji-only large rendering
    if (message.text && isEmojiOnly(message.text)) {
      return (
        <Text fontSize="3xl" lineHeight="1" textAlign="left">
          {message.text}
        </Text>
      );
    }

    // If it's a post share and no text provided, show a short label
    if (message.type === "post" && (!message.text || message.text.trim() === "")) {
      return (
        <Text color={isOwnMessage ? "blue.100" : "gray.200"} fontSize="sm" fontWeight="semibold">
          Shared a post
        </Text>
      );
    }

    return message.text ? <Text color="white" fontSize="sm" wordBreak="break-word">{message.text}</Text> : null;
  }, [message.text, isEditing, isDeletedForMe, isDeletedForAll, isOwnMessage, message.type]);

  return (
    <MotionFlex
      direction="column"
      alignSelf={isOwnMessage ? "flex-end" : "flex-start"}
      minW="120px"
      width={message.video || message.postReference || message.img ? "100%" : "60%"}
      maxWidth={message.video || message.postReference || message.img ? "100%" : "80%"}
      p={2}
      mt={2}
      borderRadius="15px"
      color="white"
      boxShadow="md"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      position="relative"
      bg={isOwnMessage ? "blue.500" : "gray.600"}
      borderBottomRightRadius={isOwnMessage ? "5px" : "15px"}
      borderBottomLeftRadius={isOwnMessage ? "15px" : "5px"}
    >
      {/* Group Message Sender Info */}
      {isGroupMessage && !isOwnMessage && (
        <Flex alignItems="center" mb={1}>
          <Avatar size="xs" src={message.sender?.profileImg} name={message.sender?.username} mr={2} />
          <Text fontSize="xs" fontWeight="bold" color={useColorModeValue("gray.200", "gray.300")}>
            {message.sender?.username}
          </Text>
        </Flex>
      )}

      {/* Reply Block */}
      {message.replyTo && (
        <Box
          p={2}
          bg={useColorModeValue("gray.100", "gray.700")}
          borderLeft="4px solid"
          borderColor={useColorModeValue("teal.500", "teal.300")}
          borderRadius="md"
          mb={1}
          onClick={() => handleHighlightMessage(message.replyTo._id || message.replyTo.id)}
          cursor="pointer"
          _hover={{ bg: useColorModeValue("gray.200", "gray.600") }}
        >
          <Flex direction="row" alignItems="center">
            <Box flex="1">
              { /* safe replyTo sender check */}
              <Text fontSize="sm" fontWeight="bold" color={useColorModeValue("teal.600", "teal.200")} mb={1}>
                {(() => {
                  const replySenderId = message.replyTo?.sender?._id || message.replyTo?.sender;
                  if (replySenderId && String(replySenderId) === String(currentUser._id)) return "You";
                  return message.replyTo?.sender?.username || "Someone";
                })()}
              </Text>
              <Text fontSize="sm" color={useColorModeValue("gray.800", "gray.100")} noOfLines={2}>
                {message.replyTo?.text}
              </Text>
            </Box>
            {(message.replyTo?.img || message.replyTo?.video) && (
              <Box w="90px" h="50px" ml={2} borderRadius="md" overflow="hidden">
                {message.replyTo.img && <Image src={message.replyTo.img} alt="Reply thumbnail" objectFit="cover" w="full" h="full" />}
              </Box>
            )}
          </Flex>
        </Box>
      )}

      {/* Editing UI */}
      {isEditing ? (
        <Box width="100%" mt={2}>
          <Textarea value={localEditingText} onChange={(e) => setLocalEditingText(e.target.value)} autoFocus mb={2} color="black" bg="white" />
          <Flex justifyContent="flex-end">
            <Button size="sm" mr={2} onClick={cancelEdit}>
              Cancel
            </Button>
            <Button size="sm" colorScheme="blue" onClick={handleEditSubmit} isDisabled={!localEditingText.trim()}>
              Save
            </Button>
          </Flex>
        </Box>
      ) : (
        <>
          {/* Text / Emoji / Deleted content */}
          {content}

          {/* Media / Post Reference */}
          {renderMedia()}
        </>
      )}

      {/* Edited indicator */}
      {!isEditing && message.edited && !isDeletedForMe && !isDeletedForAll && (
        <Text fontSize="xx-small" align="right" mt={1} color={isOwnMessage ? "blue.100" : "gray.300"}>
          (edited)
        </Text>
      )}

      {/* Seen indicator */}
      {!isEditing && message.seen && (
        <Box color={isOwnMessage ? "blue.200" : "gray.300"} mr={1} alignSelf="flex-end">
          <BsCheck2All size={16} />
        </Box>
      )}

      {/* Menu Actions */}
      {!isEditing && !isDeletedForMe && (
        <Flex position="absolute" top={2} right={2}>
          <Menu>
            <MenuButton as={IconButton} icon={<BsThreeDotsVertical />} variant="ghost" size="xs" aria-label="Message options" />
            <MenuList borderRadius="md" boxShadow="lg" p={2} bg={useColorModeValue("white", "gray.800")} color={useColorModeValue("black", "white")}>
              {isOwnMessage && <MenuItem onClick={() => setEditingMessageId(message._id)}>Edit</MenuItem>}
              <MenuItem
                onClick={() =>
                  handelselectedMsg({
                    id: message._id,
                    text: message.text,
                    media: message.img || message.video || message.audio,
                    mediaType: message.img ? "img" : message.video ? "video" : message.audio ? "audio" : null,
                    sender: isOwnMessage ? "you" : message.sender?.username,
                  })
                }
              >
                Reply
              </MenuItem>
              <MenuItem onClick={() => handleDelete(message._id)}>Delete</MenuItem>
            </MenuList>
          </Menu>
        </Flex>
      )}

      {/* Reactions */}
      {!isEditing && !isDeletedForMe && (
        <Reaction messageId={message._id} initialReactions={message.reactions} onUpdateReactions={updateMessageReactions} />
      )}

      {/* Timestamp */}
      <Text fontSize="xs" align="right" mt={1} color={isOwnMessage ? "blue.100" : "gray.300"}>
        {formatMessageTime(message.createdAt)}
      </Text>
    </MotionFlex>
  );
};

export default React.memo(Message);
