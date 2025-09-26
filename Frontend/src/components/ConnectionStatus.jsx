import React, { useState, useEffect } from 'react';
import {
  Box,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Button,
  Text,
  Badge,
  useColorModeValue,
  VStack,
  HStack
} from '@chakra-ui/react';
import { useSocket } from '../context/SocketContext';
import networkUtils from '../Utils/NetworkUtils';

// Error boundary wrapper component
class ConnectionStatusErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ConnectionStatus error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null; // Don't render anything if there's an error
    }

    return this.props.children;
  }
}

const ConnectionStatusComponent = () => {
  const socketContext = useSocket();
  const [lastDiagnostics, setLastDiagnostics] = useState(null);
  
  const bgColor = useColorModeValue('white', 'gray.800');

  // Add safety checks
  if (!socketContext || !socketContext.connectionStatus) {
    return null;
  }

  const { connectionStatus, reconnectAttempts } = socketContext;

  const runDiagnostics = async () => {
    try {
      const diagnostics = await networkUtils.runNetworkDiagnostics();
      setLastDiagnostics(diagnostics);
    } catch (error) {
      console.error('Failed to run diagnostics:', error);
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'success';
      case 'reconnecting': return 'warning';
      case 'disconnected': return 'warning';
      case 'error': 
      case 'failed': 
      case 'blocked': return 'error';
      default: return 'info';
    }
  };

  const getStatusMessage = () => {
    switch (connectionStatus) {
      case 'connected': 
        return 'Real-time features are working normally';
      case 'reconnecting': 
        return `Reconnecting... (attempt ${reconnectAttempts})`;
      case 'disconnected': 
        return 'Disconnected from real-time features';
      case 'error': 
        return 'Connection error - some features may be limited';
      case 'failed': 
        return 'Connection failed - real-time features unavailable';
      case 'blocked': 
        return 'Connection blocked by network - using offline mode';
      default: 
        return 'Checking connection...';
    }
  };

  const shouldShowAlert = () => {
    return ['reconnecting', 'disconnected', 'error', 'failed', 'blocked'].includes(connectionStatus);
  };

  if (!shouldShowAlert()) {
    return null;
  }

  return (
    <Box position="fixed" top={4} right={4} zIndex={1000} maxW="400px">
      <Alert 
        status={getStatusColor()} 
        variant="left-accent" 
        bg={bgColor}
        borderRadius="md"
        boxShadow="lg"
      >
        <AlertIcon />
        <Box flex="1">
          <AlertTitle fontSize="sm">
            Connection Status
          </AlertTitle>
          <AlertDescription fontSize="xs">
            {getStatusMessage()}
          </AlertDescription>
          
          {connectionStatus === 'blocked' && (
            <Text fontSize="xs" mt={2} color="gray.600">
              Messages will be sent when connection is restored.
            </Text>
          )}
          
          <Button
            size="xs"
            variant="outline"
            onClick={runDiagnostics}
            mt={2}
            isDisabled={connectionStatus === 'connected'}
          >
            Run Diagnostics
          </Button>
        </Box>
      </Alert>
    </Box>
  );
};

// Main component with error boundary
const ConnectionStatus = () => {
  return (
    <ConnectionStatusErrorBoundary>
      <ConnectionStatusComponent />
    </ConnectionStatusErrorBoundary>
  );
};

export default ConnectionStatus;