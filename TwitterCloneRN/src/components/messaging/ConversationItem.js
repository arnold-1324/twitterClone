import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Text,
  Avatar,
  Card,
  Badge,
  useTheme
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useRecoilValue } from 'recoil';
import userAtom from '../../atoms/userAtom';

export default function ConversationItem({ 
  conversation, 
  onlineUsers = [], 
  onPress, 
  isSelected = false 
}) {
  const theme = useTheme();
  const currentUser = useRecoilValue(userAtom);

  if (!conversation) return null;

  // Normalize participants
  const participants = Array.isArray(conversation.participants)
    ? conversation.participants
    : Array.isArray(conversation.members)
    ? conversation.members
    : [];

  // Check if online
  const onlineIds = Array.isArray(onlineUsers)
    ? onlineUsers.map((id) => String(id))
    : [];

  const currentUserId = currentUser?._id ? String(currentUser._id) : null;

  // Check if this is a group conversation
  const isGroup = Boolean(conversation.isGroup || conversation.groupInfo);

  // Last message fallback
  const lastMessage = conversation.lastMessage ||
    (Array.isArray(conversation.messages) && conversation.messages.length
      ? conversation.messages[conversation.messages.length - 1]
      : {}) || {};

  // Compute display values
  let displayName = 'Unknown';
  let displayImage = '';
  let isOnline = false;

  if (isGroup) {
    displayName = conversation.groupInfo?.name || 'Group';
    displayImage = conversation.groupInfo?.profileImage || '';
    isOnline = participants.some((p) => onlineIds.includes(String(p?._id)));
  } else {
    const otherParticipant = participants.find(
      (p) => String(p?._id) !== currentUserId
    );
    displayName = otherParticipant?.username || 'Unknown';
    displayImage = otherParticipant?.profileImg || '';
    isOnline = Boolean(
      otherParticipant && onlineIds.includes(String(otherParticipant._id))
    );
  }

  // Format last message text
  const getLastMessageText = () => {
    if (!lastMessage.text?.trim()) {
      return (
        <View style={styles.mediaMessage}>
          <Ionicons 
            name="image" 
            size={14} 
            color={theme.colors.onSurfaceVariant} 
          />
          <Text 
            variant="bodySmall" 
            style={[styles.lastMessageText, { color: theme.colors.onSurfaceVariant }]}
          >
            Media
          </Text>
        </View>
      );
    }
    
    const text = lastMessage.text.length > 35 
      ? lastMessage.text.substring(0, 35) + '...'
      : lastMessage.text;
      
    return (
      <Text 
        variant="bodySmall" 
        style={[styles.lastMessageText, { color: theme.colors.onSurfaceVariant }]}
        numberOfLines={1}
      >
        {text}
      </Text>
    );
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card 
        style={[
          styles.container,
          {
            backgroundColor: isSelected 
              ? theme.colors.primaryContainer 
              : theme.colors.surface
          }
        ]}
        mode="contained"
      >
        <Card.Content style={styles.content}>
          <View style={styles.avatarContainer}>
            <Avatar.Image
              size={56}
              source={{ uri: displayImage }}
              style={styles.avatar}
            />
            {isGroup ? (
              <View style={[styles.groupBadge, { backgroundColor: theme.colors.primary }]}>
                <Ionicons name="people" size={12} color="white" />
              </View>
            ) : (
              isOnline && (
                <View style={[styles.onlineBadge, { backgroundColor: theme.colors.primary }]} />
              )
            )}
          </View>

          <View style={styles.messageInfo}>
            <View style={styles.headerRow}>
              <Text 
                variant="titleMedium" 
                style={[styles.displayName, { color: theme.colors.onSurface }]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
              
              {isGroup && (
                <Badge 
                  size={16} 
                  style={[styles.groupBadgeText, { backgroundColor: theme.colors.secondaryContainer }]}
                >
                  {participants.length || 0}
                </Badge>
              )}
              
              <Text 
                variant="bodySmall" 
                style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}
              >
                {formatTime(conversation.updatedAt)}
              </Text>
            </View>

            <View style={styles.lastMessageRow}>
              {lastMessage.sender && (
                <Ionicons 
                  name={lastMessage.seen ? "checkmark-done" : "checkmark"} 
                  size={14} 
                  color={lastMessage.seen ? theme.colors.primary : theme.colors.onSurfaceVariant}
                  style={styles.seenIcon}
                />
              )}
              {getLastMessageText()}
            </View>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 8,
    marginVertical: 4,
    elevation: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    backgroundColor: '#E1E1E1',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'white',
  },
  groupBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  messageInfo: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  displayName: {
    flex: 1,
    fontWeight: '600',
  },
  groupBadgeText: {
    marginHorizontal: 8,
  },
  timeText: {
    fontSize: 12,
  },
  lastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seenIcon: {
    marginRight: 4,
  },
  lastMessageText: {
    flex: 1,
  },
  mediaMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
});