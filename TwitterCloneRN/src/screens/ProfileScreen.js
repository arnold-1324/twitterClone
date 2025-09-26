import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text } from 'react-native-paper';

export default function ProfileScreen({ navigation }) {
  return (
    <Surface style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Profile
      </Text>
      <View style={styles.content}>
        <Text variant="bodyLarge">Profile functionality will be implemented here</Text>
      </View>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
});