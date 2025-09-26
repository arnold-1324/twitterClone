import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRecoilValue } from 'recoil';
import { Surface } from 'react-native-paper';
import authScreenAtom from '../atoms/authAtom';
import LoginComponent from '../components/auth/LoginComponent';
import SignupComponent from '../components/auth/SignupComponent';

export default function AuthScreen() {
  const authScreen = useRecoilValue(authScreenAtom);

  return (
    <Surface style={styles.container}>
      <View style={styles.content}>
        {authScreen === 'login' ? <LoginComponent /> : <SignupComponent />}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
});