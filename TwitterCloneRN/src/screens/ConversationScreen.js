import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text } from 'react-native-paper';

export default function ConversationScreen({ navigation, route }) {
  const { username, conversationId } = route.params || {};
  
  return (
    <Surface style={styles.container}>
      <View style={styles.content}>
        <Text variant="bodyLarge">Conversation with {username}</Text>
        <Text variant="bodyMedium">Conversation ID: {conversationId}</Text>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
});