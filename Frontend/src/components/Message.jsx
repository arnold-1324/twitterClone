import { MessageSticker } from "./Stickers";
import { stickerLabel } from "../lib/stickers";
import AdaptiveVideo from "./AdaptiveVideo";
import { memo, useState, useEffect } from "react";
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
  Portal,
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
import { useAppValue } from "../state/store";
import userAtom from "../atom/userAtom";
import AudioPlayer from "./AudioPlayer"; // Assuming you have an AudioPlayer component
import PollMessage from "./PollMessage";
import LocationMessage from "./LocationMessage";
import { Link } from "react-router-dom";
import ChatContentPreview from "./ChatContentPreview";
import ChatAttachment from "./ChatAttachment";
import ChatAlbum from "./ChatAlbum";

const MotionFlex = motion(Flex);

function renderMentions(text, mentions, currentUserId) {
  if (!mentions?.length) return text;
  const byName = new Map(mentions.map((mention) => [mention.username, mention]));
  const result = [];
  let cursor = 0;
  for (const match of text.matchAll(/(?<![\w.@])@([\w-][\w.@-]{0,63})/g)) {
    const mention = byName.get(match[1]) ?? byName.get(match[1].replace(/\.+$/, ""));
    if (!mention) continue;
    const { username, user } = mention;
    result.push(text.slice(cursor, match.index));
    result.push(<Link className="message-mention" data-mention-you={user === currentUserId || undefined}
      key={match.index} to={`/${encodeURIComponent(username)}`}>@{username}</Link>);
    cursor = match.index + username.length + 1;
  }
  return [...result, text.slice(cursor)];
}

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
  onLocationUpdate,
}) => {
  const toast = useToast();
  const currentUser = useAppValue(userAtom);
  const [localEditingText, setLocalEditingText] = useState(message.text);
  const [isEditing, setIsEditing] = useState(false);
  // const [playingAudioId, setPlayingAudioId] = useState(null);

  // move color tokens to component scope (hooks must be top-level)
  const subtleBorder = useColorModeValue("gray.200", "gray.600");
  const menuText = useColorModeValue("black", "white");
  const secondaryText = useColorModeValue("gray.600", "gray.400");
  const senderText = useColorModeValue("gray.200", "gray.300");
  const replySurface = useColorModeValue("gray.100", "gray.700");
  const replyBorder = useColorModeValue("teal.500", "teal.300");
  const replyAuthor = useColorModeValue("teal.600", "teal.200");
  const replyColor = useColorModeValue("gray.800", "gray.100");
  const menuSurface = useColorModeValue("white", "gray.800");

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

  // Improved renderMedia with compact fallback card
  const renderMedia = () => {
    if (message.location) return <LocationMessage message={message} outgoing={isOwnMessage} onUpdate={onLocationUpdate} />;

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

    // Poll message
    if (message.type === "poll" && message.poll) {
      return (
        <Box alignSelf={isOwnMessage ? "flex-end" : "flex-start"} mt={2} width="100%">
          <PollMessage message={message} currentUserId={currentUser._id} />
        </Box>
      );
    }


    if (message.postReference || message.type === "post") return <ChatContentPreview message={message} />;

    if (message.attachments?.length) return <ChatAlbum items={message.attachments} />;

    if (message.file) return <ChatAttachment url={message.file} attachment={message.attachment} />;

    if (message.img) {
      return <Image src={message.img} borderRadius="10px" maxW="100%" w="100%" alt="Shared content" />;
    }

    if (message.video) {
      return (
        <Box w="100%" maxW="100%">
          <AdaptiveVideo src={message.video} streamUrl={message.videoStreamUrl} width="100%"
            style={{ borderRadius: 8, background: "#222" }} poster={message.thumbnail} aria-label="Shared video" />
        </Box>
      );
    }



    return null;
  };

  // message content display: handle deleted, emoji-only (larger), edited
  function messageContent() {
    if (isDeletedForMe) {
      return (
        <Text fontStyle="italic" fontSize="sm" color={secondaryText}>
          You deleted this message
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

    if (stickerLabel(message.text)) return <MessageSticker text={message.text} />;
    if (message.type === "post" && message.text === "Shared a post") return null;

    return message.text && message.type !== "location" ? <Text color="inherit" fontSize="sm" wordBreak="break-word">
      {renderMentions(message.text, message.mentions, currentUser._id)}
    </Text> : null;
  }

  return (
    <MotionFlex
      direction="column"
      alignSelf={isOwnMessage ? "flex-end" : "flex-start"}
      minW="110px"
      width={message.video || message.postReference || message.file || message.img || message.attachments?.length || message.type === "poll" ? "min(100%, 440px)" : "fit-content"}
      maxW="100%"
      py={2}
      pl={3}
      pr={8}
      borderRadius="15px"
      boxShadow="none"
      position="relative"
      className={`thread-bubble ${isOwnMessage ? "thread-bubble-own" : ""}`}
      borderBottomRightRadius={isOwnMessage ? "5px" : "15px"}
      borderBottomLeftRadius={isOwnMessage ? "15px" : "5px"}
    >
      {/* Group Message Sender Info */}
      {isGroupMessage && !isOwnMessage && (
        <Flex alignItems="center" mb={1}>
          <Avatar size="xs" src={message.sender?.profileImg} name={message.sender?.username} mr={2} />
          <Text fontSize="xs" fontWeight="bold" color={senderText}>
            {message.sender?.username}
          </Text>
        </Flex>
      )}

      {/* Reply Block */}
      {message.replyTo && (
        <Box
          p={2}
          bg={replySurface}
          borderLeft="4px solid"
          borderColor={replyBorder}
          borderRadius="md"
          mb={1}
          onClick={() => handleHighlightMessage(message.replyTo._id || message.replyTo.id)}
          cursor="pointer"
          _hover={{ bg: subtleBorder }}
        >
          <Flex direction="row" alignItems="center">
            <Box flex="1">
              { /* safe replyTo sender check */}
              <Text fontSize="sm" fontWeight="bold" color={replyAuthor} mb={1}>
                {(() => {
                  const replySenderId = message.replyTo?.sender?._id || message.replyTo?.sender;
                  if (replySenderId && String(replySenderId) === String(currentUser._id)) return "You";
                  return message.replyTo?.sender?.username || "Someone";
                })()}
              </Text>
              <Text fontSize="sm" color={replyColor} noOfLines={2}>
                {stickerLabel(message.replyTo?.text) || message.replyTo?.text}
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
      {!isDeletedForMe && (message.storyReference?.id || message.noteReply) && <ChatContentPreview message={message} />}
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
          {messageContent()}

          {/* Media / Post Reference */}
          {!isDeletedForMe && renderMedia()}
        </>
      )}

      {/* Edited indicator */}
      {!isEditing && message.edited && !isDeletedForMe && (
        <Text fontSize="xx-small" align="right" mt={1} color="inherit" opacity={0.72}>
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
          <Menu placement="top-end">
            <MenuButton as={IconButton} icon={<BsThreeDotsVertical />} variant="ghost" size="xs" aria-label="Message options" />
            <Portal><MenuList borderRadius="md" boxShadow="lg" p={2} bg={menuSurface} color={menuText}>
              {isOwnMessage && !message.location && <MenuItem onClick={() => setEditingMessageId(message._id)}>Edit</MenuItem>}
              <MenuItem
                onClick={() =>
                  handelselectedMsg({
                    id: message._id,
                    text: stickerLabel(message.text) || message.text || (message.attachments?.length ? `${message.attachments.length} attachments` : ""),
                    media: message.img || message.video || message.audio,
                    mediaType: message.img ? "img" : message.video ? "video" : message.audio ? "audio" : null,
                    sender: isOwnMessage ? "you" : message.sender?.username,
                  })
                }
              >
                Reply
              </MenuItem>
              <MenuItem onClick={() => handleDelete(message._id)}>Delete</MenuItem>
            </MenuList></Portal>
          </Menu>
        </Flex>
      )}

      {/* Reactions */}
      {!isEditing && !isDeletedForMe && (
        <Reaction messageId={message._id} initialReactions={message.reactions} onUpdateReactions={updateMessageReactions} />
      )}

      {/* Timestamp */}
      <Text fontSize="xs" align="right" mt={1} color="inherit" opacity={0.72}>
        {formatMessageTime(message.createdAt)}
      </Text>
    </MotionFlex>
  );
};

export default memo(Message);
