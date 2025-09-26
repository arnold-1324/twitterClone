import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import { RecoilRoot } from 'recoil';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';

import { SocketContextProvider } from './src/context/SocketContext';
import AppNavigator from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/NavigationService';

const customDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#1DA1F2',
    primaryContainer: '#1A91DA',
    surface: '#101010',
    background: '#101010',
    onSurface: '#FFFFFF',
    onBackground: '#FFFFFF',
  },
};

const customLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1DA1F2',
    primaryContainer: '#1A91DA',
    surface: '#FFFFFF',
    background: '#F5F5F5',
  },
};

export default function App() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? customDarkTheme : customLightTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RecoilRoot>
        <PaperProvider theme={theme}>
          <NavigationContainer ref={navigationRef} theme={theme}>
            <SocketContextProvider>
              <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
              <AppNavigator />
              <Toast />
            </SocketContextProvider>
          </NavigationContainer>
        </PaperProvider>
      </RecoilRoot>
    </GestureHandlerRootView>
  );
}