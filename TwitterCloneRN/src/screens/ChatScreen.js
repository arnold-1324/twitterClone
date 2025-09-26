import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Dimensions } from 'react-native';
import {
  Surface,
  Text,
  TextInput,
  Button,
  FAB,
  Card,
  useTheme,
  Portal,
  Modal,
  ActivityIndicator
} from 'react-native-paper';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { Ionicons } from '@expo/vector-icons';

import { conversationsAtom, selectedConversationAtom } from '../atoms/messagesAtom';
import userAtom from '../atoms/userAtom';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../hooks/useToast';
import ConversationItem from '../components/messaging/ConversationItem';
import MessageContainer from '../components/messaging/MessageContainer';
import CreateGroupModal from '../components/messaging/CreateGroupModal';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

export default function ChatScreen({ navigation }) {
  const theme = useTheme();
  const showToast = useToast();
  const [searchText, setSearchText] = useState('');
  const [searchingUser, setSearchingUser] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  
  const [conversations, setConversations] = useRecoilState(conversationsAtom);
  const [selectedConversation, setSelectedConversation] = useRecoilState(selectedConversationAtom);
  const currentUser = useRecoilValue(userAtom);
  const { socket, onlineUsers } = useSocket();

  // Fetch conversations on mount
  useEffect(() => {
    const getConversations = async () => {
      try {
        const response = await fetch('/api/messages/getConvo/user');
        const data = await response.json();

        if (data.error) {
          showToast(data.error, 'error');
        } else {
          setConversations(data);
        }
      } catch (error) {
        showToast('Unable to load conversations. Please try again.', 'error');
      } finally {
        setLoadingConversations(false);
      }
    };

    getConversations();
  }, [setConversations, showToast]);

  // Handle messages seen updates
  useEffect(() => {
    const handleMessagesSeen = ({ conversationId }) => {
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation._id === conversationId
            ? {
                ...conversation,
                lastMessage: { ...conversation.lastMessage, seen: true },
              }
            : conversation
        )
      );
    };

    socket?.on('messagesSeen', handleMessagesSeen);
    return () => {
      socket?.off('messagesSeen', handleMessagesSeen);
    };
  }, [socket, setConversations]);

  const handleConversationSearch = async () => {
    if (!searchText.trim()) return;

    setSearchingUser(true);
    try {
      const response = await fetch(`/api/users/profile/${searchText}`);
      const searchedUser = await response.json();

      if (searchedUser.error) {
        showToast(searchedUser.error, 'error');
        return;
      }

      if (!searchedUser) {
        showToast('User not found.', 'error');
        return;
      }

      const isSelf = searchedUser._id === currentUser._id;
      if (isSelf) {
        showToast('You cannot message yourself.', 'error');
        return;
      }

      const existingConversation = conversations.find(
        (c) => c.participants[0]?._id === searchedUser._id
      );

      if (existingConversation) {
        setSelectedConversation({
          _id: existingConversation._id,
          userId: searchedUser._id,
          username: searchedUser.username,
          userProfilePic: searchedUser.profileImg,
        });
      } else {
        const newConversation = {
          mock: true,
          lastMessage: { text: '', sender: '' },
          _id: `mock-${Date.now()}`,
          participants: [searchedUser],
        };

        setConversations((prev) => {
          const filtered = prev.filter((c) => c._id !== newConversation._id);
          return [...filtered, newConversation];
        });
        setSelectedConversation({
          _id: newConversation._id,
          userId: searchedUser._id,
          username: searchedUser.username,
          userProfilePic: searchedUser.profileImg,
        });
      }
    } catch (error) {
      showToast('Failed to search user.', 'error');
    } finally {
      setSearchingUser(false);
      setSearchText('');
    }
  };

  const renderConversationsList = () => (
    <View style={[styles.conversationsList, { backgroundColor: theme.colors.surface }]}>
      {/* Header */}
      <View style={styles.conversationsHeader}>
        <Text variant="headlineSmall" style={styles.title}>
          Messages
        </Text>
        <Button
          mode="contained-tonal"
          icon="account-group"
          onPress={() => setShowCreateGroup(true)}
          style={styles.createGroupButton}
        >
          New Group
        </Button>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          label="Search for a user"
          value={searchText}
          onChangeText={setSearchText}
          mode="outlined"
          style={styles.searchInput}
          right={
            <TextInput.Icon
              icon="magnify"
              onPress={handleConversationSearch}
              disabled={searchingUser || !searchText.trim()}
            />
          }
        />
      </View>

      {/* Conversations List */}
      <View style={styles.conversationsContainer}>
        {loadingConversations ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Loading conversations...</Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <ConversationItem
                conversation={item}
                onlineUsers={onlineUsers}
                onPress={() => {
                  const isGroup = Boolean(item.isGroup || item.groupInfo);
                  
                  if (isGroup) {
                    setSelectedConversation({
                      _id: item._id,
                      groupId: item.groupId || item.groupInfo?._id,
                      username: item.groupInfo?.name || 'Group',
                      userProfilePic: item.groupInfo?.profileImage || '',
                      isGroup: true,
                      groupInfo: item.groupInfo || item,
                      participants: item.participants || item.members || [],
                    });
                  } else {
                    const otherParticipant = item.participants?.find(
                      (p) => p._id !== currentUser._id
                    );
                    if (otherParticipant) {
                      setSelectedConversation({
                        _id: item._id,
                        userId: otherParticipant._id,
                        userProfilePic: otherParticipant.profileImg,
                        username: otherParticipant.username,
                        isGroup: false,
                      });
                    }
                  }
                  
                  // Navigate to conversation screen on mobile
                  if (!isTablet) {
                    navigation.navigate('Conversation', {
                      conversationId: item._id,
                      username: isGroup ? (item.groupInfo?.name || 'Group') : 
                        item.participants?.find(p => p._id !== currentUser._id)?.username
                    });
                  }
                }}
                isSelected={selectedConversation._id === item._id}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons 
                  name="chatbubbles-outline" 
                  size={64} 
                  color={theme.colors.onSurfaceVariant}
                />
                <Text variant="bodyLarge" style={styles.emptyText}>
                  No conversations yet
                </Text>
                <Text variant="bodyMedium" style={styles.emptySubtext}>
                  Search for users to start chatting
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={conversations.length === 0 ? styles.emptyList : undefined}
          />
        )}
      </View>
    </View>
  );

  const renderMessageContainer = () => {
    if (!selectedConversation._id) {
      return (
        <View style={[styles.emptyMessageContainer, { backgroundColor: theme.colors.surface }]}>
          <Ionicons 
            name="chatbubbles" 
            size={80} 
            color={theme.colors.onSurfaceVariant}
          />
          <Text variant="headlineSmall" style={styles.emptyMessageTitle}>
            Select a conversation
          </Text>
          <Text variant="bodyMedium" style={styles.emptyMessageSubtitle}>
            Choose from your conversations or search for users
          </Text>
        </View>
      );
    }

    return (
      <MessageContainer
        onBackPress={() => setSelectedConversation({})}
        showBackButton={!isTablet}
      />
    );
  };

  if (isTablet) {
    // Tablet layout - side by side
    return (
      <Surface style={styles.container}>
        <View style={styles.tabletContainer}>
          <View style={styles.tabletConversations}>
            {renderConversationsList()}
          </View>
          <View style={styles.tabletMessages}>
            {renderMessageContainer()}
          </View>
        </View>
        
        <Portal>
          <Modal
            visible={showCreateGroup}
            onDismiss={() => setShowCreateGroup(false)}
            contentContainerStyle={styles.modalContainer}
          >
            <CreateGroupModal onClose={() => setShowCreateGroup(false)} />
          </Modal>
        </Portal>
      </Surface>
    );
  }

  // Mobile layout - full screen conversations list
  return (
    <Surface style={styles.container}>
      {renderConversationsList()}
      
      <Portal>
        <Modal
          visible={showCreateGroup}
          onDismiss={() => setShowCreateGroup(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <CreateGroupModal onClose={() => setShowCreateGroup(false)} />
        </Modal>
      </Portal>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabletContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  tabletConversations: {
    flex: 0.35,
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.1)',
  },
  tabletMessages: {
    flex: 0.65,
  },
  conversationsList: {
    flex: 1,
  },
  conversationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontWeight: 'bold',
  },
  createGroupButton: {
    borderRadius: 20,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchInput: {
    backgroundColor: 'transparent',
  },
  conversationsContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 16,
    opacity: 0.7,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.7,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyMessageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyMessageTitle: {
    marginTop: 16,
    textAlign: 'center',
  },
  emptyMessageSubtitle: {
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.7,
  },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 12,
  },
});