import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  TouchableWithoutFeedback,
  Modal,
  Pressable,
  Image,
  Animated,
  PanResponder
} from 'react-native';
import {
  Text,
  Card,
  Avatar,
  IconButton,
  TextInput,
  Button,
  useTheme,
  Menu,
  Surface
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useRecoilValue } from 'recoil';
import userAtom from '../../atoms/userAtom';
import ReactionPicker from './ReactionPicker';

export default function MessageBubble({
  message,
  isOwnMessage,
  isGroupMessage = false,
  isHighlighted = false,
  onEdit,
  onDelete,
  onReply,
  onHighlight,
  editingMessageId,
  onEditSubmit,
  onCancelEdit
}) {
  const theme = useTheme();
  const currentUser = useRecoilValue(userAtom);
  
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text || '');
  const [showImageModal, setShowImageModal] = useState(false);
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  
  const scaleAnim = new Animated.Value(1);
  const highlightAnim = new Animated.Value(isHighlighted ? 1 : 0);

  // Handle editing state
  useEffect(() => {
    setIsEditing(editingMessageId === message._id);
    if (editingMessageId === message._id) {
      setEditText(message.text || '');
    }
  }, [editingMessageId, message._id, message.text]);

  // Handle highlight animation
  useEffect(() => {
    if (isHighlighted) {
      Animated.sequence([
        Animated.timing(highlightAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(highlightAnim, {
          toValue: 0,
          duration: 200,
          delay: 1000,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [isHighlighted, highlightAnim]);

  // Pan responder for long press
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: () => false,
    onPanResponderGrant: () => {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    },
    onPanResponderRelease: () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
      setShowMenu(true);
    },
  });

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Check if message is emoji only
  const isEmojiOnly = (text) => {
    if (!text) return false;
    const emojiRegex = /^[\\u{1F600}-\\u{1F64F}\\u{1F300}-\\u{1F5FF}\\u{1F680}-\\u{1F6FF}\\u{1F1E0}-\\u{1F1FF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}]+$/u;
    return emojiRegex.test(text.trim()) && text.trim().length <= 6;
  };

  // Handle edit submission
  const handleEditSubmit = async () => {
    try {
      await onEditSubmit(message._id, editText);
      setIsEditing(false);
    } catch (error) {
      // Error handled in parent
    }
  };

  // Handle menu actions
  const handleMenuAction = (action) => {
    setShowMenu(false);
    
    switch (action) {
      case 'edit':
        onEdit(message._id, message.text);
        break;
      case 'reply':
        onReply({
          id: message._id,
          text: message.text,
          media: message.img || message.video || message.audio,
          mediaType: message.img ? 'img' : message.video ? 'video' : message.audio ? 'audio' : null,
          sender: isOwnMessage ? 'You' : message.sender?.username,
        });
        break;
      case 'delete':
        onDelete(message._id);
        break;
      case 'react':
        setReactionPickerVisible(true);
        break;
    }
  };

  // Render media content
  const renderMedia = () => {
    if (message.img) {
      return (
        <TouchableOpacity onPress={() => setShowImageModal(true)} activeOpacity={0.9}>
          <Image
            source={{ uri: message.img }}
            style={styles.messageImage}
            resizeMode=\"cover\"
          />
        </TouchableOpacity>
      );
    }

    if (message.video) {
      return (
        <TouchableOpacity style={styles.videoContainer} activeOpacity={0.9}>
          <Image
            source={{ uri: message.thumbnail }}
            style={styles.messageImage}
            resizeMode=\"cover\"
          />
          <View style={styles.playButton}>
            <Ionicons name=\"play\" size={32} color=\"white\" />
          </View>
        </TouchableOpacity>
      );
    }

    if (message.audio) {
      return (
        <View style={styles.audioContainer}>
          <IconButton icon=\"play\" size={20} />
          <View style={styles.audioWaveform}>
            <Text variant=\"bodySmall\">Voice message</Text>
          </View>
          <Text variant=\"bodySmall\" style={styles.audioDuration}>
            0:30
          </Text>
        </View>
      );
    }

    return null;
  };

  // Render reply preview
  const renderReplyPreview = () => {
    if (!message.replyTo) return null;

    return (
      <TouchableOpacity
        style={[
          styles.replyPreview,
          {
            backgroundColor: isOwnMessage 
              ? 'rgba(255,255,255,0.2)' 
              : 'rgba(0,0,0,0.1)',
            borderLeftColor: theme.colors.primary,
          }
        ]}
        onPress={() => onHighlight(message.replyTo._id || message.replyTo.id)}
      >
        <Text 
          variant=\"bodySmall\" 
          style={[
            styles.replyAuthor, 
            { color: isOwnMessage ? 'rgba(255,255,255,0.8)' : theme.colors.primary }
          ]}
        >
          {(() => {
            const replySenderId = message.replyTo?.sender?._id || message.replyTo?.sender;
            if (replySenderId && String(replySenderId) === String(currentUser._id)) return 'You';
            return message.replyTo?.sender?.username || 'Someone';
          })()} 
        </Text>
        <Text 
          variant=\"bodySmall\" 
          style={[
            styles.replyText,
            { color: isOwnMessage ? 'rgba(255,255,255,0.7)' : theme.colors.onSurfaceVariant }
          ]}
          numberOfLines={2}
        >
          {message.replyTo?.text || 'Media'}
        </Text>
      </TouchableOpacity>
    );
  };

  // Render reactions
  const renderReactions = () => {
    if (!message.reactions || message.reactions.length === 0) return null;

    return (
      <View style={styles.reactionsContainer}>
        {message.reactions.slice(0, 3).map((reaction, index) => (
          <Surface 
            key={index} 
            style={[
              styles.reactionBubble,
              { backgroundColor: theme.colors.surfaceVariant }
            ]}
          >
            <Text style={styles.reactionEmoji}>{reaction.type}</Text>
          </Surface>
        ))}
        {message.reactions.length > 3 && (
          <Surface style={[styles.reactionBubble, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={styles.reactionCount}>+{message.reactions.length - 3}</Text>
          </Surface>
        )}
      </View>
    );
  };

  const backgroundColor = isOwnMessage 
    ? theme.colors.primary 
    : theme.colors.surfaceVariant;
  
  const textColor = isOwnMessage 
    ? theme.colors.onPrimary 
    : theme.colors.onSurface;

  const bubbleStyle = isOwnMessage 
    ? { borderBottomRightRadius: 4 }
    : { borderBottomLeftRadius: 4 };

  return (
    <View style={[styles.container, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
      {/* Group message sender info */}
      {isGroupMessage && !isOwnMessage && (
        <View style={styles.senderInfo}>
          <Avatar.Image
            size={24}
            source={{ uri: message.sender?.profileImg }}
            style={styles.senderAvatar}
          />
          <Text variant=\"bodySmall\" style={[styles.senderName, { color: theme.colors.primary }]}>
            {message.sender?.username}
          </Text>
        </View>
      )}

      <Animated.View
        style={[
          {
            transform: [{ scale: scaleAnim }],
            backgroundColor: highlightAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['transparent', theme.colors.primaryContainer],
            }),
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableWithoutFeedback onLongPress={() => setShowMenu(true)}>
          <Card
            style={[
              styles.messageBubble,
              bubbleStyle,
              { backgroundColor },
              isHighlighted && { backgroundColor: theme.colors.primaryContainer }
            ]}
          >
            <Card.Content style={styles.messageContent}>
              {/* Reply preview */}
              {renderReplyPreview()}

              {/* Editing mode */}
              {isEditing ? (
                <View style={styles.editContainer}>
                  <TextInput
                    value={editText}
                    onChangeText={setEditText}
                    mode=\"outlined\"
                    style={styles.editInput}
                    dense
                    multiline
                  />
                  <View style={styles.editActions}>
                    <Button 
                      mode=\"text\" 
                      onPress={onCancelEdit}
                      textColor={isOwnMessage ? theme.colors.onPrimary : theme.colors.primary}
                    >
                      Cancel
                    </Button>
                    <Button 
                      mode=\"text\" 
                      onPress={handleEditSubmit}
                      disabled={!editText.trim()}
                      textColor={isOwnMessage ? theme.colors.onPrimary : theme.colors.primary}
                    >
                      Save
                    </Button>
                  </View>
                </View>
              ) : (
                <>
                  {/* Message text */}
                  {message.text && (
                    <Text
                      variant={isEmojiOnly(message.text) ? \"headlineMedium\" : \"bodyMedium\"}
                      style={[
                        styles.messageText,
                        { color: textColor },
                        isEmojiOnly(message.text) && styles.emojiText
                      ]}
                    >
                      {message.text}
                    </Text>
                  )}

                  {/* Media content */}
                  {renderMedia()}
                </>  
              )}

              {/* Message info */}
              <View style={styles.messageInfo}>
                {message.edited && !isEditing && (
                  <Text 
                    variant=\"bodySmall\" 
                    style={[styles.editedText, { color: textColor }]}
                  >
                    edited
                  </Text>
                )}
                <Text 
                  variant=\"bodySmall\" 
                  style={[styles.timeText, { color: textColor }]}
                >
                  {formatTime(message.createdAt)}
                </Text>
                {isOwnMessage && (
                  <Ionicons
                    name={message.seen ? \"checkmark-done\" : \"checkmark\"}
                    size={16}
                    color={textColor}
                    style={styles.seenIcon}
                  />
                )}
              </View>
            </Card.Content>
          </Card>
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* Reactions */}
      {renderReactions()}

      {/* Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType=\"fade\"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <Surface style={[styles.menuContainer, { backgroundColor: theme.colors.surface }]}>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => handleMenuAction('react')}
            >
              <Ionicons name=\"happy-outline\" size={20} color={theme.colors.onSurface} />
              <Text style={[styles.menuText, { color: theme.colors.onSurface }]}>React</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => handleMenuAction('reply')}
            >
              <Ionicons name=\"arrow-undo-outline\" size={20} color={theme.colors.onSurface} />
              <Text style={[styles.menuText, { color: theme.colors.onSurface }]}>Reply</Text>
            </TouchableOpacity>
            
            {isOwnMessage && (
              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={() => handleMenuAction('edit')}
              >
                <Ionicons name=\"create-outline\" size={20} color={theme.colors.onSurface} />
                <Text style={[styles.menuText, { color: theme.colors.onSurface }]}>Edit</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => handleMenuAction('delete')}
            >
              <Ionicons name=\"trash-outline\" size={20} color={theme.colors.error} />
              <Text style={[styles.menuText, { color: theme.colors.error }]}>Delete</Text>
            </TouchableOpacity>
          </Surface>
        </Pressable>
      </Modal>

      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        transparent
        animationType=\"fade\"
        onRequestClose={() => setShowImageModal(false)}
      >
        <Pressable style={styles.imageModalOverlay} onPress={() => setShowImageModal(false)}>
          <Image
            source={{ uri: message.img }}
            style={styles.fullScreenImage}
            resizeMode=\"contain\"
          />
        </Pressable>
      </Modal>

      {/* Reaction Picker */}
      <ReactionPicker
        visible={reactionPickerVisible}
        onClose={() => setReactionPickerVisible(false)}
        onSelectReaction={(emoji) => {
          // Handle reaction selection
          setReactionPickerVisible(false);
        }}
        messageId={message._id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 8,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginLeft: 8,
  },
  senderAvatar: {
    marginRight: 6,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: '80%',
    minWidth: '20%',
    borderRadius: 16,
    elevation: 1,
  },
  messageContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  replyPreview: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 4,
    marginBottom: 8,
    borderRadius: 4,
  },
  replyAuthor: {
    fontWeight: '600',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 12,
  },
  editContainer: {
    minWidth: 200,
  },
  editInput: {
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  messageText: {
    lineHeight: 20,
  },
  emojiText: {
    fontSize: 32,
    lineHeight: 40,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginTop: 4,
  },
  videoContainer: {
    position: 'relative',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -16 }, { translateY: -16 }],
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 200,
    paddingVertical: 8,
  },
  audioWaveform: {
    flex: 1,
    marginHorizontal: 8,
  },
  audioDuration: {
    fontSize: 12,
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    justifyContent: 'flex-end',
  },
  editedText: {
    fontSize: 11,
    fontStyle: 'italic',
    marginRight: 4,
  },
  timeText: {
    fontSize: 11,
    marginRight: 4,
  },
  seenIcon: {
    marginLeft: 2,
  },
  reactionsContainer: {
    flexDirection: 'row',
    marginTop: 4,
    marginLeft: 8,
  },
  reactionBubble: {
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    elevation: 1,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 10,
    fontWeight: '600',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    borderRadius: 12,
    minWidth: 150,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuText: {
    marginLeft: 12,
    fontSize: 16,
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '90%',
    height: '80%',
  },
});", "original_text": ""}]