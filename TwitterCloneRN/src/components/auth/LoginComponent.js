import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  Title,
  Checkbox,
  useTheme
} from 'react-native-paper';
import { useSetRecoilState } from 'recoil';
import * as SecureStore from 'expo-secure-store';

import authScreenAtom from '../../atoms/authAtom';
import userAtom from '../../atoms/userAtom';
import { useToast } from '../../hooks/useToast';

export default function LoginComponent() {
  const theme = useTheme();
  const setAuthScreen = useSetRecoilState(authScreenAtom);
  const setUser = useSetRecoilState(userAtom);
  const showToast = useToast();
  
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [inputs, setInputs] = useState({
    username: '',
    password: ''
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!inputs.username || !inputs.password) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    setLoading(true);
    try {
      // Replace with your backend URL
      const apiUrl = __DEV__ 
        ? 'http://10.0.2.2:5000' // Android emulator localhost
        : 'https://twitterclone-backend-681i.onrender.com';
      
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inputs),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || 'Login failed', 'error');
        return;
      }

      if (data.error) {
        showToast(data.error, 'error');
        return;
      }

      // Store user data securely
      await SecureStore.setItemAsync('user-data', JSON.stringify(data.user));
      if (rememberMe) {
        await SecureStore.setItemAsync('remember-me', 'true');
      }

      setUser(data.user);
      showToast('Login successful!', 'success');
    } catch (error) {
      console.error('Login error:', error);
      showToast('An error occurred during login', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      showToast('Please enter your email', 'error');
      return;
    }

    setLoading(true);
    try {
      const apiUrl = __DEV__ 
        ? 'http://10.0.2.2:5000'
        : 'https://twitterclone-backend-681i.onrender.com';
      
      const response = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || 'Request failed', 'error');
        return;
      }

      if (data.error) {
        showToast(data.error, 'error');
        return;
      }

      showToast('A reset link has been sent to your email', 'success');
      setForgot(false);
    } catch (error) {
      console.error('Forgot password error:', error);
      showToast('An error occurred during password reset', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title style={[styles.title, { color: theme.colors.onSurface }]}>
            {forgot ? 'Forgot your password?' : 'Login'}
          </Title>
          
          {forgot && (
            <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
              You'll get an email with a reset link.
            </Text>
          )}

          <View style={styles.form}>
            {forgot ? (
              <>
                <TextInput
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  mode="outlined"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                />
                <Button
                  mode="contained"
                  onPress={handleForgotPassword}
                  loading={loading}
                  style={styles.button}
                >
                  Request Reset
                </Button>
                <Button
                  mode="text"
                  onPress={() => setForgot(false)}
                  style={styles.textButton}
                >
                  Back to Login
                </Button>
              </>
            ) : (
              <>
                <TextInput
                  label="Username"
                  value={inputs.username}
                  onChangeText={(text) => setInputs({ ...inputs, username: text })}
                  mode="outlined"
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
                
                <View style={styles.row}>
                  <Checkbox.Item
                    label="Remember me"
                    status={rememberMe ? 'checked' : 'unchecked'}
                    onPress={() => setRememberMe(!rememberMe)}
                    labelStyle={{ color: theme.colors.onSurface }}
                  />
                  <Button
                    mode="text"
                    onPress={() => setForgot(true)}
                    style={styles.forgotButton}
                  >
                    Forgot password?
                  </Button>
                </View>

                <Button
                  mode="contained"
                  onPress={handleSignIn}
                  loading={loading}
                  style={styles.button}
                >
                  Sign in
                </Button>

                <View style={styles.signupContainer}>
                  <Text style={{ color: theme.colors.onSurface }}>
                    Don't have an account?{' '}
                  </Text>
                  <Button
                    mode="text"
                    onPress={() => setAuthScreen('signup')}
                  >
                    Sign up
                  </Button>
                </View>
              </>
            )}
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
  subtitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
  form: {
    marginTop: 16,
  },
  input: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  forgotButton: {
    marginLeft: 'auto',
  },
  button: {
    marginBottom: 16,
  },
  textButton: {
    alignSelf: 'center',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
});