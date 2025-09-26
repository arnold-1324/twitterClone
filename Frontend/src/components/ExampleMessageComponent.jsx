/**
 * Example implementation of using the enhanced Socket.IO functionality
 * 
 * This shows how to integrate the resilient socket connection and fallback
 * messaging system into your existing message components.
 */

import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import useShowToast from '../hooks/useShowToast';

const ExampleMessageComponent = () => {
  const { socket, connectionStatus, sendMessageWithFallback } = useSocket();
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const showToast = useShowToast();

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    setIsSending(true);
    
    try {
      const messageData = {
        text: messageText,
        conversationId: 'example-conversation-id',
        // Add other message properties as needed
      };

      // Use the enhanced send function with fallback support
      const result = await sendMessageWithFallback(messageData);
      
      if (result.isPending) {
        // Message was stored locally and will be sent when connection is restored
        showToast('Info', 'Message will be sent when connection is restored', 'info');
      } else {
        // Message was sent successfully
        showToast('Success', 'Message sent', 'success');
      }
      
      setMessageText('');
    } catch (error) {
      console.error('Failed to send message:', error);
      showToast('Error', 'Failed to send message', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const getConnectionStatusMessage = () => {
    switch (connectionStatus) {
      case 'connected':
        return '🟢 Connected';
      case 'reconnecting':
        return '🟡 Reconnecting...';
      case 'disconnected':
        return '🟠 Disconnected';
      case 'error':
        return '🔴 Connection Error';
      case 'blocked':
        return '🔴 Connection Blocked - Offline Mode';
      default:
        return '⚪ Unknown';
    }
  };

  return (
    <div>
      {/* Connection status display */}
      <div style={{ marginBottom: '10px', fontSize: '12px', color: '#666' }}>
        Status: {getConnectionStatusMessage()}
      </div>
      
      {/* Message input */}
      <input
        type="text"
        value={messageText}
        onChange={(e) => setMessageText(e.target.value)}
        placeholder="Type your message..."
        disabled={isSending}
        onKeyPress={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
          }
        }}
      />
      
      {/* Send button */}
      <button
        onClick={handleSendMessage}
        disabled={isSending || !messageText.trim()}
      >
        {isSending ? 'Sending...' : 'Send'}
      </button>
      
      {/* Connection warning */}
      {connectionStatus === 'blocked' && (
        <div style={{ 
          marginTop: '10px', 
          padding: '8px', 
          backgroundColor: '#fff3cd', 
          border: '1px solid #ffeaa7',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          ⚠️ Real-time messaging is unavailable. Messages will be sent when connection is restored.
        </div>
      )}
    </div>
  );
};

/**
 * For existing message components, you can enhance them by:
 * 
 * 1. Replace direct socket.emit calls with sendMessageWithFallback
 * 2. Monitor connectionStatus to provide user feedback
 * 3. Handle pending message states appropriately
 * 
 * Example migration:
 */

// OLD CODE:
// socket.emit('sendMessage', messageData, (response) => {
//   if (response.error) {
//     showToast('Error', response.error, 'error');
//   } else {
//     // Handle success
//   }
// });

// NEW CODE:
// try {
//   const result = await sendMessageWithFallback(messageData);
//   if (result.isPending) {
//     showToast('Info', 'Message will be sent when connected', 'info');
//   } else {
//     // Handle success
//   }
// } catch (error) {
//   showToast('Error', error.message, 'error');
// }

export default ExampleMessageComponent;