import React, { useState, useEffect } from 'react';
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
  useToast
} from '@chakra-ui/react';
import { BsThreeDotsVertical, BsCheck2All } from 'react-icons/bs';
import { motion } from 'framer-motion';
import AudioPlayerNew from './AudioPlayerNew';
import Reaction from './Reaction';
import formatMessageTime from '../Utils/Timeformate';
import { useRecoilState, useRecoilValue } from 'recoil';
import userAtom from '../atom/userAtom';
import { selectedConversationAtom } from '../atom/messagesAtom';

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
  isGroupMessage,
  editingMessageId,
  setEditingMessageId,
  setEditingText,
  onEditSubmit
}) => {
  const toast = useToast();
  const currentUser = useRecoilValue(userAtom);
  const [localEditingText, setLocalEditingText] = useState(message.text);
  const [isEditing, setIsEditing] = useState(false);
  
  // Sync editing state when prop changes
  useEffect(() => {
    setIsEditing(editingMessageId === message._id);
  }, [editingMessageId, message._id]);

  // Handle edit submission
  const handleEditSubmit = async () => {
    try {
      await onEditSubmit(message._id, localEditingText);
      setEditingMessageId(null);
    } catch (err) {
      toast({
        title: "Edit failed",
        description: err.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingMessageId(null);
    setLocalEditingText(message.text);
  };

  // Optimize video rendering
  const renderMedia = () => {
    if (message.img) {
      return <Image src={message.img} borderRadius="10px" maxW="100%" w="100%" alt="Shared content" />;
    }
    
    if (message.video) {
      return (
        <Box w="100%" maxW="100%">
          <video 
            controls 
            width="100%" 
            style={{ borderRadius: 8, background: '#222' }}
            poster={message.thumbnail} // Add thumbnail if available
          >
            <source src={message.video} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </Box>
      );
    }
    
    if (message.audio) {
      return (
        <Box w="57%" mt={2}>
          <AudioPlayerNew
            audioUrl={message.audio}
            isPlaying={playingAudioId === message._id}
            onPlay={() => setPlayingAudioId(message._id)}
          />
        </Box>
      );
    }
    
    return null;
  };

  return (
    <MotionFlex
      direction="column"
      alignSelf={isOwnMessage ? 'flex-end' : 'flex-start'}
      minW="120px"
      width={message.video || message.postReference || message.img ? '100%' : '60%'}
      maxWidth={message.video || message.postReference || message.img ? '100%' : '80%'}
      p={2}
      mt={2}
      borderRadius="15px"
      color="white"
      boxShadow="md"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      position="relative"
      bg={isOwnMessage ? 'blue.500' : 'gray.600'}
      borderBottomRightRadius={isOwnMessage ? '5px' : '15px'}
      borderBottomLeftRadius={isOwnMessage ? '15px' : '5px'}
    >
      {/* Group Message Sender Info */}
      {isGroupMessage && !isOwnMessage && (
        <Flex alignItems="center" mb={1}>
          <Avatar
            size="xs"
            src={message.sender?.profileImg}
            name={message.sender?.username}
            mr={2}
          />
          <Text fontSize="xs" fontWeight="bold" color={useColorModeValue('gray.200', 'gray.300')}>
            {message.sender?.username}
          </Text>
        </Flex>
      )}

      {/* Reply Block */}
      {message.replyTo && (
        <Box
          p={2}
          bg={useColorModeValue('gray.100', 'gray.700')}
          borderLeft="4px solid"
          borderColor={useColorModeValue('teal.500', 'teal.300')}
          borderRadius="md"
          mb={1}
          onClick={() => handleHighlightMessage(message.replyTo._id)}
          cursor="pointer"
          _hover={{ bg: useColorModeValue('gray.200', 'gray.600') }}
        >
          <Flex direction="row" alignItems="center">
            <Box flex="1">
              <Text fontSize="sm" fontWeight="bold" color={useColorModeValue('teal.600', 'teal.200')} mb={1}>
                {message.replyTo.sender._id === currentUser._id ? 'You' : message.replyTo.sender.username}
              </Text>
              <Text fontSize="sm" color={useColorModeValue('gray.800', 'gray.100')} noOfLines={2}>
                {message.replyTo.text}
              </Text>
            </Box>
            {(message.replyTo.img || message.replyTo.video) && (
              <Box w="90px" h="50px" ml={2} borderRadius="md" overflow="hidden">
                {message.replyTo.img && (
                  <Image 
                    src={message.replyTo.img} 
                    alt="Reply thumbnail" 
                    objectFit="cover" 
                    w="full" 
                    h="full" 
                  />
                )}
              </Box>
            )}
          </Flex>
        </Box>
      )}

      {/* Editing UI */}
      {isEditing ? (
        <Box width="100%" mt={2}>
          <Textarea
            value={localEditingText}
            onChange={(e) => setLocalEditingText(e.target.value)}
            autoFocus
            mb={2}
            color="black"
            bg="white"
          />
          <Flex justifyContent="flex-end">
            <Button size="sm" mr={2} onClick={cancelEdit}>
              Cancel
            </Button>
            <Button 
              size="sm" 
              colorScheme="blue"
              onClick={handleEditSubmit}
              isDisabled={!localEditingText.trim()}
            >
              Save
            </Button>
          </Flex>
        </Box>
      ) : (
        <>
          {/* Text content */}
          {message.text && (
            <Text color="white" fontSize="sm" wordBreak="break-word">
              {message.text}
            </Text>
          )}

          {/* Media content */}
          {renderMedia()}
        </>
      )}

      {/* Seen indicator */}
      {message.seen && (
        <Box color={isOwnMessage ? 'blue.200' : 'gray.300'} mr={1} alignSelf="flex-end">
          <BsCheck2All size={16} />
        </Box>
      )}

      {/* Menu Actions */}
      {!isEditing && (
        <Flex position="absolute" top={2} right={2}>
          <Menu>
            <MenuButton
              as={IconButton}
              icon={<BsThreeDotsVertical />}
              variant="ghost"
              size="xs"
              aria-label="Message options"
            />
            <MenuList
              borderRadius="md"
              boxShadow="lg"
              p={2}
              bg={useColorModeValue('white', 'gray.800')}
              color={useColorModeValue('black', 'white')}
            >
              {isOwnMessage && (
                <MenuItem onClick={() => setEditingMessageId(message._id)}>
                  Edit
                </MenuItem>
              )}
              <MenuItem
                onClick={() => handelselectedMsg({
                  id: message._id,
                  text: message.text,
                  media: message.img || message.video || message.audio,
                  mediaType: message.img ? 'img' : 
                            message.video ? 'video' : 
                            message.audio ? 'audio' : null,
                  sender: isOwnMessage ? 'you' : message.sender.username
                })}
              >
                Reply
              </MenuItem>
              <MenuItem onClick={() => handleDelete(message._id)}>
                Delete
              </MenuItem>
            </MenuList>
          </Menu>
        </Flex>
      )}

      {/* Reactions */}
      {!isEditing && (
        <Reaction
          messageId={message._id}
          initialReactions={message.reactions}
          onUpdateReactions={updateMessageReactions}
        />
      )}

      {/* Timestamp */}
      <Text fontSize="xs" align="right" mt={1} color={isOwnMessage ? 'blue.100' : 'gray.300'}>
        {formatMessageTime(message.createdAt)}
      </Text>
    </MotionFlex>
  );
};

export default React.memo(Message);