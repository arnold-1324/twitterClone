import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform,
  Dimensions 
} from 'react-native';
import {
  Surface,
  Text,
  IconButton,
  Avatar,
  Badge,
  useTheme,
  ActivityIndicator,
  Portal,
  Modal,
  Card
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

import { 
  selectedConversationAtom, 
  messagesAtom, 
  conversationsAtom,
  selectedMsg 
} from '../../atoms/messagesAtom';
import userAtom from '../../atoms/userAtom';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../hooks/useToast';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';

const { height: screenHeight } = Dimensions.get('window');

export default function MessageContainer({ onBackPress, showBackButton = false }) {
  const theme = useTheme();
  const showToast = useToast();
  const flatListRef = useRef(null);
  
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  
  const selectedConversation = useRecoilValue(selectedConversationAtom);
  const [messages, setMessages] = useRecoilState(messagesAtom);
  const currentUser = useRecoilValue(userAtom);
  const { socket } = useSocket();
  const setConversations = useSetRecoilState(conversationsAtom);
  const [selectedReplyMsg, setSelectedReplyMsg] = useRecoilState(selectedMsg);

  // Group messages by date
  const groupMessagesByDate = (messages) => {
    const grouped = {};
    messages.forEach(message => {
      const date = new Date(message.createdAt).toDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(message);
    });
    return grouped;
  };

  // Format date for separator
  const formatDateSeparator = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setShowScrollToBottom(false);
  };

  // Handle scroll
  const handleScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isNearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;
    setShowScrollToBottom(!isNearBottom);
  };

  // Fetch messages
  useEffect(() => {
    const getMessages = async () => {
      setLoadingMessages(true);
      setMessages([]);
      
      try {
        if (selectedConversation?.mock) return;

        let url;
        if (selectedConversation?.isGroup && selectedConversation?.groupId) {
          url = `/api/messages/group/${selectedConversation.groupId}`;
        } else {
          url = `/api/messages/${selectedConversation.userId}`;
        }

        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
          showToast(data.error, 'error');
          return;
        }
        
        setMessages(data);
      } catch (error) {
        showToast(error.message, 'error');
      } finally {
        setLoadingMessages(false);
      }
    };

    getMessages();
  }, [
    selectedConversation?.userId,
    selectedConversation?.groupId,
    selectedConversation?.isGroup,
    selectedConversation?.mock,
    setMessages,
    showToast
  ]);

  // Socket event handlers
  useEffect(() => {
    const handleNewMessage = (message) => {
      if (selectedConversation?._id === message.conversationId) {
        setMessages((prev) => [...prev, message]);
        setTimeout(scrollToBottom, 100);
      }
      
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation._id === message.conversationId
            ? {
                ...conversation,
                lastMessage: { text: message.text, sender: message.sender },
              }
            : conversation
        )
      );
    };

    const handleNewGroupMessage = ({ message, conversationId }) => {
      if (selectedConversation?._id === conversationId) {
        setMessages((prev) => [...prev, message]);
        setTimeout(scrollToBottom, 100);
      }
      
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation._id === conversationId
            ? {
                ...conversation,
                lastMessage: { text: message.text, sender: message.sender },
              }
            : conversation
        )
      );
    };

    const handleMessageEdited = (editedMessage) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          const msgId = msg._id || msg.id;
          const editedId = editedMessage._id || editedMessage.id;
          return msgId === editedId ? { ...msg, ...editedMessage } : msg;
        })
      );
      setEditingMessageId(null);
      setEditingText('');
    };

    const handleMessageReactionUpdated = ({ messageId, reactions }) => {
      setMessages((prevMessages) =>
        prevMessages.map((message) => {
          const msgId = message._id || message.id;
          return msgId === messageId
            ? { ...message, reactions }
            : message;
        })
      );
    };

    const handleTypingStatus = ({ conversationId, typingUsers }) => {
      if (conversationId === selectedConversation._id) {
        const otherTypingUsers = (typingUsers || []).filter(
          (id) => String(id) !== String(currentUser._id)
        );
        setTypingUsers(otherTypingUsers);
      }
    };

    socket?.on('newMessage', handleNewMessage);
    socket?.on('newGroupMessage', handleNewGroupMessage);
    socket?.on('messageEdited', handleMessageEdited);
    socket?.on('messageReactionUpdated', handleMessageReactionUpdated);
    socket?.on('typingStatus', handleTypingStatus);

    return () => {
      socket?.off('newMessage', handleNewMessage);
      socket?.off('newGroupMessage', handleNewGroupMessage);
      socket?.off('messageEdited', handleMessageEdited);
      socket?.off('messageReactionUpdated', handleMessageReactionUpdated);
      socket?.off('typingStatus', handleTypingStatus);
    };
  }, [socket, selectedConversation?._id, currentUser._id, setMessages, setConversations]);

  // Auto scroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages.length]);

  // Handle message delete
  const handleDeleteMessage = async (messageId) => {
    try {
      const response = await fetch('/api/messages/deleteforme', {
        method: 'PUT',
        body: JSON.stringify({ messageId }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        showToast('Failed to delete message', 'error');
        return;
      }

      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
      showToast('Message deleted', 'success');
    } catch (error) {
      showToast('Failed to delete message', 'error');
    }
  };

  // Handle message edit
  const handleEditMessage = async (messageId, newText) => {
    try {
      const response = await fetch('/api/messages/edit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          newText,
          groupId: selectedConversation?.isGroup ? selectedConversation?.groupId : undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to edit message');

      const updatedMessage = await response.json();
      
      setMessages((prev) =>
        prev.map((m) =>
          String(m?._id) === String(updatedMessage?._id)
            ? { ...m, ...updatedMessage }
            : m
        )
      );
      
      setConversations((prev) =>
        prev.map((c) =>
          String(c?._id) === String(updatedMessage?.conversationId)
            ? {
                ...c,
                lastMessage: {
                  text: updatedMessage?.text,
                  sender: updatedMessage?.sender,
                },
              }
            : c
        )
      );
      
      setEditingMessageId(null);
      setEditingText('');
      return updatedMessage;
    } catch (error) {
      showToast(error?.message || 'Edit failed', 'error');
      throw error;
    }
  };

  // Handle highlight message
  const handleHighlightMessage = (messageId) => {
    setHighlightedMessageId(messageId);
    
    // Find message index and scroll to it
    const messageIndex = messages.findIndex(msg => msg._id === messageId);
    if (messageIndex !== -1) {
      flatListRef.current?.scrollToIndex({ 
        index: messageIndex, 
        animated: true, 
        viewPosition: 0.5 
      });
    }
    
    setTimeout(() => setHighlightedMessageId(null), 2000);
  };

  // Render date separator
  const renderDateSeparator = (date) => (
    <View key={`date-${date}`} style={styles.dateSeparator}>
      <Card style={[styles.dateBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Card.Content style={styles.dateBadgeContent}>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {formatDateSeparator(date)}
          </Text>
        </Card.Content>
      </Card>
    </View>
  );

  // Render messages with date separators
  const renderFlatListData = () => {
    const groupedMessages = groupMessagesByDate(messages);
    const flatData = [];

    Object.entries(groupedMessages).forEach(([date, dateMessages]) => {
      // Add date separator
      flatData.push({
        type: 'date',
        id: `date-${date}`,
        date: date,
      });
      
      // Add messages
      dateMessages.forEach(message => {
        flatData.push({
          type: 'message',
          id: message._id || message.id || Math.random(),
          ...message,
        });
      });
    });

    return flatData;
  };

  // Render item
  const renderItem = ({ item }) => {
    if (item.type === 'date') {
      return renderDateSeparator(item.date);
    }

    const sender = item.sender || {};
    const senderId = sender._id || sender.id || item.sender || item.senderId || '';
    const isOwnMessage = String(currentUser?._id || '') === String(senderId || '');
    const isHighlighted = String(highlightedMessageId || '') === String(item._id || '');

    return (
      <MessageBubble
        message={item}
        isOwnMessage={isOwnMessage}
        isGroupMessage={selectedConversation?.isGroup}
        isHighlighted={isHighlighted}
        onEdit={(msgId, text) => {
          setEditingMessageId(msgId);
          setEditingText(text);
        }}
        onDelete={handleDeleteMessage}
        onReply={(msg) => setSelectedReplyMsg(msg)}
        onHighlight={handleHighlightMessage}
        editingMessageId={editingMessageId}
        onEditSubmit={handleEditMessage}
        onCancelEdit={() => {
          setEditingMessageId(null);
          setEditingText('');
        }}
      />
    );
  };

  if (!selectedConversation._id) {
    return null;
  }

  const isGroupConversation = Boolean(selectedConversation?.isGroup);

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Surface style={styles.container}>
        {/* Header */}
        <Surface style={[styles.header, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.headerContent}>
            {showBackButton && (
              <IconButton
                icon="arrow-left"
                size={24}
                onPress={onBackPress}
                style={styles.backButton}
              />
            )}
            
            <Avatar.Image
              size={40}
              source={{ uri: selectedConversation?.userProfilePic }}
              style={styles.headerAvatar}
            />
            
            <View style={styles.headerInfo}>
              <Text variant="titleMedium" style={styles.headerTitle} numberOfLines={1}>
                {selectedConversation?.username}
              </Text>
              
              {isGroupConversation && Array.isArray(selectedConversation?.participants) && (
                <Text variant="bodySmall" style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {selectedConversation.participants.length} members
                </Text>
              )}
            </View>
            
            <View style={styles.headerActions}>
              <IconButton icon="phone" size={20} />
              <IconButton icon="video" size={20} />
              <IconButton icon="dots-vertical" size={20} />
            </View>
          </View>
        </Surface>

        {/* Messages */}
        <View style={styles.messagesContainer}>
          {loadingMessages ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={renderFlatListData()}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.messagesList}
              getItemLayout={(data, index) => ({
                length: 100, // estimated height
                offset: 100 * index,
                index,
              })}
              onScrollToIndexFailed={(info) => {
                console.warn('Scroll to index failed:', info);
              }}
            />
          )}
        </View>

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <View style={styles.typingContainer}>
            <TypingIndicator
              usernames={
                isGroupConversation
                  ? typingUsers.map((id) => {
                      const participant = (selectedConversation.participants || []).find(
                        (p) => String(p._id) === String(id)
                      );
                      return participant ? participant.username : 'Someone';
                    })
                  : [selectedConversation.username]
              }
            />
          </View>
        )}

        {/* Message Input */}
        <MessageInput
          setMessages={setMessages}
          editingMessageId={editingMessageId}
          setEditingMessageId={setEditingMessageId}
          editingText={editingText}
          setEditingText={setEditingText}
          isGroupConversation={isGroupConversation}
          groupId={isGroupConversation ? selectedConversation.groupId : undefined}
        />

        {/* Scroll to Bottom Button */}
        {showScrollToBottom && (
          <IconButton
            icon="chevron-down"
            size={24}
            mode="contained"
            onPress={scrollToBottom}
            style={styles.scrollToBottomButton}
          />
        )}
      </Surface>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 8,
  },
  headerAvatar: {
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
  },
  messagesContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
  },
  messagesList: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateBadge: {
    borderRadius: 16,
  },
  dateBadgeContent: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  scrollToBottomButton: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    elevation: 3,
  },
});