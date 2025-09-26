/**
 * Network utilities for handling connection issues and fallbacks
 */

class NetworkUtils {
  constructor() {
    this.connectionChecks = [];
    this.isOnline = navigator.onLine;
    this.setupNetworkListeners();
  }

  setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('Network: Back online');
      this.isOnline = true;
      this.notifyConnectionChange(true);
    });

    window.addEventListener('offline', () => {
      console.log('Network: Gone offline');
      this.isOnline = false;
      this.notifyConnectionChange(false);
    });

    // Listen for service worker messages about socket connection failures
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SOCKET_CONNECTION_FAILED') {
          console.warn('Service Worker: Socket connection failed', event.data.error);
          this.handleSocketConnectionFailure(event.data.error);
        }
      });
    }
  }

  notifyConnectionChange(online) {
    this.connectionChecks.forEach(callback => {
      try {
        callback(online);
      } catch (error) {
        console.error('Error in connection change callback:', error);
      }
    });
  }

  onConnectionChange(callback) {
    this.connectionChecks.push(callback);
    return () => {
      this.connectionChecks = this.connectionChecks.filter(cb => cb !== callback);
    };
  }

  handleSocketConnectionFailure(error) {
    // Dispatch custom event for socket connection failures
    window.dispatchEvent(new CustomEvent('socketConnectionFailed', {
      detail: { error }
    }));
  }

  /**
   * Test if the backend is reachable
   */
  async testBackendConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Use the correct backend URL based on environment
      const backendUrl = import.meta.env.PROD 
        ? 'https://twitterclone-backend-681i.onrender.com/api/health'
        : '/api/health';

      const response = await fetch(backendUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('Backend connection test failed:', error);
      return false;
    }
  }

  /**
   * Test Socket.IO connection using polling transport
   */
  async testSocketConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Use the correct backend URL based on environment
      const socketUrl = import.meta.env.PROD 
        ? 'https://twitterclone-backend-681i.onrender.com/socket.io/?transport=polling'
        : '/socket.io/?transport=polling';

      const response = await fetch(socketUrl, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('Socket.IO connection test failed:', error);
      return false;
    }
  }

  /**
   * Comprehensive network diagnostics
   */
  async runNetworkDiagnostics() {
    const results = {
      navigator_online: navigator.onLine,
      backend_reachable: false,
      socket_reachable: false,
      timestamp: new Date().toISOString()
    };

    console.log('Running network diagnostics...');

    try {
      results.backend_reachable = await this.testBackendConnection();
      results.socket_reachable = await this.testSocketConnection();
    } catch (error) {
      console.error('Network diagnostics failed:', error);
    }

    console.log('Network diagnostics results:', results);
    return results;
  }

  /**
   * Create a fallback message for when real-time features are unavailable
   */
  createFallbackMessage(originalMessage, userId, conversationId) {
    return {
      id: `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: originalMessage.text,
      sender: userId,
      conversationId: conversationId,
      createdAt: new Date(),
      isFallback: true,
      media: originalMessage.media || null,
      mediaType: originalMessage.mediaType || null,
      status: 'pending' // Will be updated when connection is restored
    };
  }

  /**
   * Store messages locally when socket is unavailable
   */
  storePendingMessage(message) {
    try {
      const pendingMessages = JSON.parse(localStorage.getItem('pendingMessages') || '[]');
      pendingMessages.push(message);
      localStorage.setItem('pendingMessages', JSON.stringify(pendingMessages));
      return true;
    } catch (error) {
      console.error('Failed to store pending message:', error);
      return false;
    }
  }

  /**
   * Get and clear pending messages
   */
  getPendingMessages() {
    try {
      const pendingMessages = JSON.parse(localStorage.getItem('pendingMessages') || '[]');
      localStorage.removeItem('pendingMessages');
      return pendingMessages;
    } catch (error) {
      console.error('Failed to retrieve pending messages:', error);
      return [];
    }
  }

  /**
   * Send pending messages when connection is restored
   */
  async sendPendingMessages(socket) {
    const pendingMessages = this.getPendingMessages();
    
    if (pendingMessages.length === 0) {
      return [];
    }

    console.log(`Sending ${pendingMessages.length} pending messages...`);
    const results = [];

    for (const message of pendingMessages) {
      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Message send timeout'));
          }, 10000);

          socket.emit('sendMessage', {
            text: message.text,
            media: message.media,
            mediaType: message.mediaType,
            conversationId: message.conversationId
          }, (response) => {
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
        // Store failed message back for retry
        this.storePendingMessage(message);
      }
    }

    return results;
  }
}

// Export singleton instance
const networkUtils = new NetworkUtils();
export default networkUtils;