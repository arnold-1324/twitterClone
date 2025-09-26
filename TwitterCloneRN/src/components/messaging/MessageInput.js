import React, { useState, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity,
  Alert
} from 'react-native';
import {
  TextInput,
  IconButton,
  Surface,
  useTheme,
  Text,
  Card
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useRecoilState, useRecoilValue } from 'recoil';

import { selectedConversationAtom, selectedMsg } from '../../atoms/messagesAtom';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../hooks/useToast';

export default function MessageInput({
  setMessages,
  editingMessageId,
  setEditingMessageId,
  editingText,
  setEditingText,
  isGroupConversation,
  groupId
}) {
  const theme = useTheme();
  const showToast = useToast();
  
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  
  const recipient = useRecoilValue(selectedConversationAtom);
  const [replyMsg, setReplyMsg] = useRecoilState(selectedMsg);
  const { socket } = useSocket();
  const typingTimeoutRef = useRef(null);

  // Handle typing indicator
  const handleTyping = (text) => {
    setMessageText(text);
    
    if (!socket || !recipient._id) return;
    
    // Send typing indicator
    socket.emit('typing', {
      conversationId: recipient._id,
      isTyping: true,
      isGroup: isGroupConversation,
    });
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 1 second of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', {
        conversationId: recipient._id,
        isTyping: false,
        isGroup: isGroupConversation,
      });
    }, 1000);
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!messageText.trim() && !selectedMedia) return;
    
    setIsSending(true);
    
    try {
      const messageData = {
        message: messageText,
        conversationId: recipient._id,
      };
      
      if (isGroupConversation) {
        messageData.groupId = recipient.groupId;
      } else {
        messageData.recipientId = recipient.userId;
      }
      
      if (replyMsg.id) {
        messageData.replyToId = replyMsg.id;
      }
      
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });
      
      const data = await response.json();
      
      if (data.error) {
        showToast(data.error, 'error');
        return;
      }
      
      setMessages(messages => [...messages, data]);
      resetInputs();
      
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Reset all inputs
  const resetInputs = () => {
    setMessageText('');
    setSelectedMedia(null);
    setReplyMsg({
      id: '',
      text: '',
      media: null,
      mediaType: null,
    });
    setEditingMessageId(null);
    setEditingText('');
  };

  const isValidReply = replyMsg.text || replyMsg.media;

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Reply Preview */}
      {isValidReply && (
        <Card style={[styles.replyPreview, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Card.Content style={styles.replyContent}>
            <View style={styles.replyHeader}>
              <Text variant="bodySmall" style={[styles.replyLabel, { color: theme.colors.primary }]}>
                Replying to {replyMsg.sender || 'Unknown'}
              </Text>
              <IconButton
                icon="close"
                size={16}
                onPress={() => setReplyMsg({ id: '', text: '', media: null, mediaType: null })}
              />
            </View>
            <Text 
              variant="bodySmall" 
              style={{ color: theme.colors.onSurfaceVariant }}
              numberOfLines={2}
            >
              {replyMsg.text || 'Media'}
            </Text>
          </Card.Content>
        </Card>
      )}

      {/* Input Container */}
      <View style={styles.inputContainer}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.colors.primaryContainer }]}
          onPress={() => showToast('Media picker coming soon', 'info')}
        >
          <Ionicons 
            name="add" 
            size={24} 
            color={theme.colors.onPrimaryContainer} 
          />
        </TouchableOpacity>

        <TextInput
          value={messageText}
          onChangeText={handleTyping}
          placeholder={editingMessageId ? 'Edit your message...' : 'Type a message...'}
          mode="outlined"
          multiline
          style={styles.textInput}
          dense
          contentStyle={styles.textInputContent}
        />

        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.colors.primaryContainer }]}
          onPress={() => showToast('Voice recording coming soon', 'info')}
        >
          <Ionicons 
            name="mic" 
            size={24} 
            color={theme.colors.onPrimaryContainer}
          />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.sendButton, 
            { 
              backgroundColor: messageText.trim()
                ? theme.colors.primary 
                : theme.colors.surfaceVariant
            }
          ]}
          onPress={handleSendMessage}
          disabled={isSending || !messageText.trim()}
        >
          <Ionicons 
            name="send" 
            size={20} 
            color={messageText.trim()
              ? theme.colors.onPrimary 
              : theme.colors.onSurfaceVariant
            }
          />
        </TouchableOpacity>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  replyPreview: {
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  replyContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  replyLabel: {
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: 'transparent',
  },
  textInputContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});