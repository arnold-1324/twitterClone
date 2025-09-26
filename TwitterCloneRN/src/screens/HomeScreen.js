import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Surface, Text, FAB } from 'react-native-paper';

export default function HomeScreen({ navigation }) {
  const posts = []; // This will be populated from your posts atom

  return (
    <Surface style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Home Feed
      </Text>
      
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.postContainer}>
            <Text>{item.content}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text variant="bodyLarge">No posts yet</Text>
            <Text variant="bodyMedium">Create your first post!</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
      
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('CreatePost')}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    padding: 16,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  postContainer: {
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});