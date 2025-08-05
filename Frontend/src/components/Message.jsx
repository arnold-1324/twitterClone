import React from 'react'
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
  useColorModeValue
} from '@chakra-ui/react'
import { BsThreeDotsVertical, BsCheck2All } from 'react-icons/bs'
import { motion } from 'framer-motion'
// Inline MotionFlex definition to avoid missing file error
const MotionFlex = motion(Flex)
import { useRecoilValue } from 'recoil'
import userAtom from '../atom/userAtom'
import Reaction from './Reaction'
import AudioPlayerNew from './AudioPlayerNew'
import formatMessageTime from '../Utils/Timeformate'

const Message = ({
  message,
  isOwnMessage,
  handelselectedMsg,
  handleDelete,
  updateMessageReactions,
  handleHighlightMessage,
  playingAudioId,
  setPlayingAudioId,
  isGroupMessage
}) => {
  const currentUser = useRecoilValue(userAtom)

  // ✅ Early return for audio messages
  if (message.audio) {
    return (
      <Box w="57%" mt={2}>
        <AudioPlayerNew
          audioUrl={message.audio}
          isPlaying={playingAudioId === message._id}
          onPlay={() => setPlayingAudioId(message._id)}
        />
      </Box>
    )
  }

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
          position="relative"
          boxShadow={useColorModeValue('sm', 'md')}
          mb={1}
          onClick={() => handleHighlightMessage(message.replyTo._id)}
          cursor="pointer"
        >
          <Flex direction="row" alignItems="center">
            <Box flex="1">
              <Text
                fontSize="sm"
                fontWeight="bold"
                color={useColorModeValue('teal.600', 'teal.200')}
                mb={1}
              >
                {message.replyTo.sender._id === currentUser._id ? 'You' : message.replyTo.sender.username}
              </Text>
              <Text fontSize="sm" color={useColorModeValue('gray.800', 'gray.100')} noOfLines={2}>
                {message.replyTo.text}
              </Text>
            </Box>
            {(message.replyTo.img || message.replyTo.video) && (
              <Box w="90px" h="50px" ml={2} borderRadius="md" overflow="hidden">
                {message.replyTo.img && (
                  <Image src={message.replyTo.img} alt="Thumbnail" objectFit="cover" w="full" h="full" />
                )}
                {message.replyTo.video && (
                  <video w="full" h="full" muted>
                    <source src={message.replyTo.video} />
                  </video>
                )}
              </Box>
            )}
          </Flex>
        </Box>
      )}

      {/* Post Reference */}
      {message.postReference && (
        <Box position="relative" bg="gray.500" borderRadius="md" width="100%" mb={4} overflow="hidden">
          <Flex
            position="absolute"
            top={2}
            left={2}
            bg="rgba(0, 0, 0, 0.0)"
            p={2}
            borderRadius="md"
            align="center"
            zIndex={2}
            width="calc(100% - 16px)"
            maxWidth="100%"
          >
            <Avatar size="sm" src={message.postReference?.postedBy?.profileImg} mr={2} />
            <Text fontWeight="bold" color="white" isTruncated>
              {message.postReference?.postedBy?.username}
            </Text>
          </Flex>
          <Box width="100%" maxWidth="100%">
            <Image
              src={message.postReference?.images}
              alt="Post Image"
              width="800%"
              maxWidth="100%"
              h="300px"
              objectFit="cover"
              display="block"
            />
          </Box>
        </Box>
      )}

      {/* Text */}
      {message.text && (
        <Text color="white" fontSize="sm">
          {message.text}
        </Text>
      )}

      {/* Image */}
      {message.img && <Image src={message.img} borderRadius="10px" maxW="100%" w="100%" />}

      {/* Video */}
      {message.video && (
        <Box w="100%" maxW="100%">
          <video controls width="100%" style={{ borderRadius: 8, background: '#222' }}>
            <source src={message.video} type="video/mp4" />
          </video>
        </Box>
      )}

      {/* Seen checkmark */}
      {message.seen && (
        <Box color={isOwnMessage ? 'blue.200' : 'gray.300'} mr={1} alignSelf="flex-end">
          <BsCheck2All size={16} />
        </Box>
      )}

      {/* Menu Actions */}
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
            bg={useColorModeValue('white', 'gray.800')}
            color="black"
            mt="4px"
          >
            {isOwnMessage && (
              <MenuItem onClick={() => {
                setEditingMessageId(message._id);
                setEditingText(message.text);
              }}>
                Edit
              </MenuItem>
            )}
            <MenuItem
              onClick={() => {
                const data = {
                  id: message._id,
                  text: message.text,
                  media: message.img || message.video || message.audio,
                  mediaType: message.img
                    ? 'img'
                    : message.video
                      ? 'video'
                      : message.audio
                        ? 'audio'
                        : null,
                  sender: isOwnMessage ? 'you' : message.sender.username
                }
                handelselectedMsg(data)
              }}
            >
              Reply
            </MenuItem>
            <MenuItem onClick={() => handleDelete(message._id)}>Delete</MenuItem>
          </MenuList>
        </Menu>
      </Flex>

      {/* Reactions */}
      <Reaction
        messageId={message._id}
        initialReactions={message.reactions}
        onUpdateReactions={updateMessageReactions}
      />

      {/* Timestamp */}
      <Text fontSize="xs" align="right" mt={1} color={isOwnMessage ? 'blue.100' : 'gray.300'}>
        {formatMessageTime(message.createdAt)}
      </Text>
    </MotionFlex>
  )
}

export default Message
