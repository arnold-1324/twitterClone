import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text } from 'react-native-paper';

export default function PostDetailScreen({ navigation, route }) {
  const { postId } = route.params || {};
  
  return (
    <Surface style={styles.container}>
      <View style={styles.content}>
        <Text variant="bodyLarge">Post Detail Screen</Text>
        <Text variant="bodyMedium">Post ID: {postId}</Text>
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