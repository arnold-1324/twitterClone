import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text } from 'react-native-paper';

export default function SettingsScreen({ navigation }) {
  return (
    <Surface style={styles.container}>
      <View style={styles.content}>
        <Text variant="bodyLarge">Settings Screen</Text>
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