import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

class NetworkUtils {
  static pendingMessagesKey = 'pending_messages';
  static maxPendingMessages = 100;

  // Check if device is online
  static async isOnline() {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected && state.isInternetReachable;
    } catch (error) {
      console.error('Error checking network status:', error);
      return false;
    }
  }

  // Listen for connection changes
  static onConnectionChange(callback) {
    const unsubscribe = NetInfo.addEventListener(state => {
      callback(state.isConnected && state.isInternetReachable);
    });
    return unsubscribe;
  }

  // Store pending message
  static async storePendingMessage(message) {
    try {
      const existingMessages = await this.getPendingMessages();
      const updatedMessages = [...existingMessages, message].slice(-this.maxPendingMessages);
      
      await AsyncStorage.setItem(this.pendingMessagesKey, JSON.stringify(updatedMessages));
      return true;
    } catch (error) {
      console.error('Error storing pending message:', error);
      return false;
    }
  }

  // Get pending messages
  static async getPendingMessages() {
    try {
      const messages = await AsyncStorage.getItem(this.pendingMessagesKey);
      return messages ? JSON.parse(messages) : [];
    } catch (error) {
      console.error('Error getting pending messages:', error);
      return [];
    }
  }

  // Clear pending messages
  static async clearPendingMessages() {
    try {
      await AsyncStorage.removeItem(this.pendingMessagesKey);
    } catch (error) {
      console.error('Error clearing pending messages:', error);
    }
  }

  // Send pending messages
  static async sendPendingMessages(socket) {
    try {
      const pendingMessages = await this.getPendingMessages();
      const results = [];

      for (const message of pendingMessages) {
        try {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
            
            socket.emit('sendMessage', message, (response) => {
              clearTimeout(timeout);
              if (response.error) {
                reject(new Error(response.error));
              } else {
                resolve(response);
              }
            });
          });
          
          results.push({ success: true, message });
        } catch (error) {
          console.error('Failed to send pending message:', error);
          results.push({ success: false, message, error: error.message });
        }
      }

      // Clear successfully sent messages
      const failedMessages = results
        .filter(result => !result.success)
        .map(result => result.message);
      
      await AsyncStorage.setItem(this.pendingMessagesKey, JSON.stringify(failedMessages));
      
      return results;
    } catch (error) {
      console.error('Error sending pending messages:', error);
      return [];
    }
  }

  // Create fallback message
  static createFallbackMessage(messageData, userId, conversationId) {
    return {
      ...messageData,
      _id: `fallback_${Date.now()}_${Math.random()}`,
      createdAt: new Date().toISOString(),
      sender: userId,
      conversationId,
      isPending: true,
      fallback: true,
    };
  }

  // Run network diagnostics
  static async runNetworkDiagnostics() {
    try {
      const state = await NetInfo.fetch();
      const diagnostics = {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        isWifiEnabled: state.isWifiEnabled,
        details: state.details,
        timestamp: new Date().toISOString(),
      };

      console.log('Network diagnostics:', diagnostics);
      return diagnostics;
    } catch (error) {
      console.error('Error running network diagnostics:', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Test backend connectivity
  static async testBackendConnectivity(baseUrl) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        method: 'GET',
        timeout: 5000,
      });
      
      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default NetworkUtils;