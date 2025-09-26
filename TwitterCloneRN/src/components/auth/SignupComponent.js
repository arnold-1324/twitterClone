import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  Title,
  useTheme
} from 'react-native-paper';
import { useSetRecoilState } from 'recoil';
import * as SecureStore from 'expo-secure-store';

import authScreenAtom from '../../atoms/authAtom';
import userAtom from '../../atoms/userAtom';
import { useToast } from '../../hooks/useToast';

export default function SignupComponent() {
  const theme = useTheme();
  const setAuthScreen = useSetRecoilState(authScreenAtom);
  const setUser = useSetRecoilState(userAtom);
  const showToast = useToast();
  
  const [inputs, setInputs] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!inputs.name || !inputs.username || !inputs.email || !inputs.password) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    if (inputs.password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    setLoading(true);
    try {
      const apiUrl = __DEV__ 
        ? 'http://10.0.2.2:5000'
        : 'https://twitterclone-backend-681i.onrender.com';
      
      const response = await fetch(`${apiUrl}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inputs),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || 'Signup failed', 'error');
        return;
      }

      if (data.error) {
        showToast(data.error, 'error');
        return;
      }

      // Store user data securely
      await SecureStore.setItemAsync('user-data', JSON.stringify(data.user));
      
      setUser(data.user);
      showToast('Account created successfully!', 'success');
    } catch (error) {
      console.error('Signup error:', error);
      showToast('An error occurred during signup', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title style={[styles.title, { color: theme.colors.onSurface }]}>
            Sign Up
          </Title>

          <View style={styles.form}>
            <TextInput
              label="Full Name"
              value={inputs.name}
              onChangeText={(text) => setInputs({ ...inputs, name: text })}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Username"
              value={inputs.username}
              onChangeText={(text) => setInputs({ ...inputs, username: text })}
              mode="outlined"
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              label="Email"
              value={inputs.email}
              onChangeText={(text) => setInputs({ ...inputs, email: text })}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              label="Password"
              value={inputs.password}
              onChangeText={(text) => setInputs({ ...inputs, password: text })}
              mode="outlined"
              secureTextEntry
              style={styles.input}
            />

            <Button
              mode="contained"
              onPress={handleSignUp}
              loading={loading}
              style={styles.button}
            >
              Sign Up
            </Button>

            <View style={styles.loginContainer}>
              <Text style={{ color: theme.colors.onSurface }}>
                Already have an account?{' '}
              </Text>
              <Button
                mode="text"
                onPress={() => setAuthScreen('login')}
              >
                Login
              </Button>
            </View>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  form: {
    marginTop: 16,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginBottom: 16,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
});