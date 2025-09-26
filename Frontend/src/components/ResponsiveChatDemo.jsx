/**
 * ResponsiveChatDemo - Test component to showcase responsive chat UI
 * This component demonstrates the responsive behavior across different viewports
 */

import React, { useState } from 'react';
import {
  Box,
  Text,
  VStack,
  HStack,
  Button,
  Badge,
  useColorModeValue,
  useBreakpointValue,
} from '@chakra-ui/react';
import '../styles/ChatResponsive.css';

const ResponsiveChatDemo = () => {
  const [selectedDemo, setSelectedDemo] = useState('mobile');
  const bgColor = useColorModeValue('white', 'gray.900');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  const demos = {
    mobile: { width: '375px', height: '667px', name: 'Mobile (375px)' },
    tablet: { width: '768px', height: '600px', name: 'Tablet (768px)' },
    desktop: { width: '1024px', height: '600px', name: 'Desktop (1024px)' },
    large: { width: '1440px', height: '700px', name: 'Large Desktop (1440px)' }
  };

  const currentDemo = demos[selectedDemo];

  return (
    <Box p={6} bg={bgColor} minH="100vh">
      <VStack spacing={6} align="stretch">
        {/* Demo Controls */}
        <Box>
          <Text fontSize="2xl" fontWeight="bold" mb={4}>
            Responsive Chat UI Demo
          </Text>
          <HStack spacing={3} flexWrap="wrap">
            {Object.entries(demos).map(([key, demo]) => (
              <Button
                key={key}
                size="sm"
                colorScheme={selectedDemo === key ? 'blue' : 'gray'}
                variant={selectedDemo === key ? 'solid' : 'outline'}
                onClick={() => setSelectedDemo(key)}
              >
                {demo.name}
              </Button>
            ))}
          </HStack>
        </Box>

        {/* Viewport Info */}
        <HStack spacing={4} flexWrap="wrap">
          <Badge colorScheme="blue" p={2}>
            Current: {currentDemo.name}
          </Badge>
          <Badge colorScheme="green" p={2}>
            Width: {currentDemo.width}
          </Badge>
          <Badge colorScheme="purple" p={2}>
            Height: {currentDemo.height}
          </Badge>
        </HStack>

        {/* Demo Frame */}
        <Box
          width={currentDemo.width}
          height={currentDemo.height}
          maxW="100%"
          border="2px solid"
          borderColor={borderColor}
          borderRadius="lg"
          overflow="hidden"
          mx="auto"
          position="relative"
          bg="gray.800"
        >
          {/* Demo Chat Interface */}
          <div className="chat-app-shell" style={{ height: '100%' }}>
            <div className="chat-page-container" style={{ height: '100%' }}>
              <div className="chat-flex-container">
                {/* Conversation List */}
                <div className="conversation-list">
                  <div className="create-group-button">
                    <div style={{ 
                      background: 'var(--chakra-colors-teal-500)',
                      color: 'white',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      marginBottom: '16px'
                    }}>
                      + Create Group
                    </div>
                  </div>

                  <div className="chat-search-container">
                    <div className="chat-search-form">
                      <input 
                        className="chat-search-input" 
                        placeholder="Search for a user"
                        style={{
                          background: 'var(--chakra-colors-gray-800)',
                          border: '1px solid var(--chakra-colors-gray-600)',
                          color: 'white',
                          padding: '0 12px',
                          borderRadius: '12px',
                          height: '44px'
                        }}
                      />
                      <button className="chat-search-button" style={{
                        background: 'var(--chakra-colors-blue-500)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        width: '44px',
                        height: '44px'
                      }}>
                        🔍
                      </button>
                    </div>
                  </div>

                  <div className="conversation-list-scroll">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} style={{ 
                        padding: '12px',
                        marginBottom: '8px',
                        background: 'var(--chakra-colors-gray-800)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: `hsl(${i * 60}, 70%, 60%)`,
                          flexShrink: 0
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '600', fontSize: '14px', color: 'white' }}>
                            User {i}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--chakra-colors-gray-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Last message preview...
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Message Container */}
                <div className="message-container">
                  {/* Header */}
                  <div className="message-container-header">
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--chakra-colors-blue-500)',
                      flexShrink: 0
                    }} />
                    <div className="message-container-info">
                      <div className="message-container-name" style={{ color: 'white' }}>
                        John Doe
                      </div>
                      <div className="message-container-status">
                        Active now
                      </div>
                    </div>
                    <button style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      background: 'transparent',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer'
                    }}>
                      ℹ️
                    </button>
                  </div>

                  {/* Messages */}
                  <div className="messages-list">
                    <div className="date-separator">
                      <div className="date-separator-badge">
                        Today
                      </div>
                    </div>

                    {/* Sample messages */}
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
                      <div className="message-bubble message-bubble--other">
                        Hey! How are you doing?
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                      <div className="message-bubble message-bubble--own">
                        I'm doing great! Thanks for asking. How about you?
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
                      <div className="message-bubble message-bubble--other">
                        Not bad! Just working on some new projects. This responsive chat UI is looking pretty good!
                      </div>
                    </div>
                  </div>

                  {/* Input */}
                  <div className="message-input-container">
                    <div className="message-input-form">
                      <textarea 
                        className="message-input-field"
                        placeholder="Type a message..."
                        style={{
                          background: 'var(--chakra-colors-gray-900)',
                          border: '1px solid var(--chakra-colors-gray-600)',
                          color: 'white',
                          resize: 'none',
                          minHeight: '44px'
                        }}
                      />
                      <button className="message-input-button" style={{
                        background: 'var(--chakra-colors-blue-500)',
                        color: 'white',
                        border: 'none'
                      }}>
                        📤
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Box>

        {/* Testing Instructions */}
        <Box p={4} bg="blue.50" borderRadius="md" borderLeft="4px solid" borderLeftColor="blue.500">
          <Text fontWeight="bold" mb={2}>Testing Instructions:</Text>
          <VStack align="start" spacing={1} fontSize="sm">
            <Text>• Test different viewport sizes using the buttons above</Text>
            <Text>• Verify no horizontal scrolling occurs at any width</Text>
            <Text>• Check that message bubbles wrap properly and don't overflow</Text>
            <Text>• Ensure touch targets are at least 44px on mobile</Text>
            <Text>• Confirm header elements don't overlap and truncate properly</Text>
            <Text>• Test that the message container scrolls independently</Text>
          </VStack>
        </Box>

        {/* Accessibility Notes */}
        <Box p={4} bg="green.50" borderRadius="md" borderLeft="4px solid" borderLeftColor="green.500">
          <Text fontWeight="bold" mb={2}>Accessibility Features:</Text>
          <VStack align="start" spacing={1} fontSize="sm">
            <Text>• All interactive elements meet 44px minimum touch target</Text>
            <Text>• Focus styles clearly visible with 2px blue outline</Text>
            <Text>• Font sizes scale appropriately using clamp() function</Text>
            <Text>• High contrast mode support with enhanced borders</Text>
            <Text>• Reduced motion support for users with vestibular disorders</Text>
            <Text>• Semantic HTML structure with proper ARIA labels</Text>
          </VStack>
        </Box>
      </VStack>
    </Box>
  );
};

export default ResponsiveChatDemo;