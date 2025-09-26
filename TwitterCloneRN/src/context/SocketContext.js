import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import NetInfo from '@react-native-community/netinfo';
import io from 'socket.io-client';
import userAtom from '../atoms/userAtom';
import NetworkUtils from '../utils/NetworkUtils';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    return {
      socket: null,
      onlineUsers: [],
      connectionStatus: 'disconnected',
      reconnectAttempts: 0,
      networkDiagnostics: null,
      sendMessageWithFallback: () => Promise.reject(new Error('Socket context not available'))
    };
  }
  return context;
};

export const SocketContextProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [networkDiagnostics, setNetworkDiagnostics] = useState(null);
  const user = useRecoilValue(userAtom);

  // Handle network status changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      console.log('Network status changed:', state.isConnected);
      if (state.isConnected && socket && connectionStatus === 'error') {
        socket.connect();
      }
    });

    return unsubscribe;
  }, [socket, connectionStatus]);

  useEffect(() => {
    if (!user?._id) return;

    // Determine the correct Socket.IO server URL for React Native
    const socketUrl = __DEV__ 
      ? 'http://10.0.2.2:5000' // Android emulator localhost
      : 'https://twitterclone-backend-681i.onrender.com';
    
    const socketConnection = io(socketUrl, {
      query: {
        userId: user._id,
      },
      transports: ['websocket', 'polling'],
      upgrade: true,
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      maxReconnectionAttempts: 10,
      forceNew: false,
      withCredentials: false,
      rememberUpgrade: false,
      pingTimeout: 60000,
      pingInterval: 25000
    });

    setSocket(socketConnection);

    // Connection event handlers
    socketConnection.on('connect', () => {
      console.log('Socket connected');
      setConnectionStatus('connected');
      setReconnectAttempts(0);
      setNetworkDiagnostics(null);
      
      // Send any pending messages when connection is restored
      NetworkUtils.sendPendingMessages(socketConnection).then((results) => {
        if (results.length > 0) {
          console.log('Sent pending messages:', results);
        }
      }).catch(console.error);
    });

    socketConnection.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnectionStatus('disconnected');
      setOnlineUsers([]);
    });

    socketConnection.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      setConnectionStatus('connected');
      setReconnectAttempts(attemptNumber);
    });

    socketConnection.on('reconnect_attempt', (attemptNumber) => {
      console.log('Reconnection attempt:', attemptNumber);
      setConnectionStatus('reconnecting');
      setReconnectAttempts(attemptNumber);
    });

    socketConnection.on('reconnect_error', (error) => {
      console.error('Reconnection error:', error);
      setConnectionStatus('error');
    });

    socketConnection.on('reconnect_failed', () => {
      console.error('Reconnection failed after all attempts');
      setConnectionStatus('failed');
    });

    socketConnection.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionStatus('error');
      
      if (error.type === 'TransportError') {
        console.log('Transport failed, will try fallback transport');
      }
      
      if (reconnectAttempts > 3) {
        NetworkUtils.runNetworkDiagnostics().then(setNetworkDiagnostics);
      }
    });

    socketConnection.on('getOnlineUsers', (users) => {
      setOnlineUsers(users);
    });

    return () => {
      socketConnection.disconnect();
    };
  }, [user?._id]);

  useEffect(() => {
    if (!socket || !user?._id) return;
    
    const handleReconnect = () => {
      socket.emit('setUserId', user._id);
      setTimeout(() => {
        NetworkUtils.sendPendingMessages(socket).then((results) => {
          if (results.length > 0) {
            console.log('Sent pending messages after reconnect:', results);
          }
        }).catch(console.error);
      }, 1000);
    };
    
    socket.on('reconnect', handleReconnect);
    return () => socket.off('reconnect', handleReconnect);
  }, [socket, user?._id]);

  // Helper function to send message with fallback
  const sendMessageWithFallback = (messageData) => {
    return new Promise((resolve, reject) => {
      if (!socket || connectionStatus !== 'connected') {
        const fallbackMessage = NetworkUtils.createFallbackMessage(
          messageData, 
          user._id, 
          messageData.conversationId
        );
        
        if (NetworkUtils.storePendingMessage(fallbackMessage)) {
          resolve({ success: true, message: fallbackMessage, isPending: true });
        } else {
          reject(new Error('Failed to store message locally'));
        }
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Message send timeout'));
      }, 10000);

      socket.emit('sendMessage', messageData, (response) => {
        clearTimeout(timeout);
        if (response.error) {
          const fallbackMessage = NetworkUtils.createFallbackMessage(
            messageData, 
            user._id, 
            messageData.conversationId
          );
          NetworkUtils.storePendingMessage(fallbackMessage);
          reject(new Error(response.error));
        } else {
          resolve({ success: true, message: response });
        }
      });
    });
  };

  return (
    <SocketContext.Provider 
      value={{ 
        socket, 
        onlineUsers, 
        connectionStatus, 
        reconnectAttempts, 
        networkDiagnostics, 
        sendMessageWithFallback 
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};