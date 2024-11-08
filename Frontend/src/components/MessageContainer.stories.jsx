import React, { useEffect } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { RecoilRoot } from 'recoil';
import MessageContainer from '../components/MessageContainer';
import { SocketContextProvider, useSocket } from '../context/SocketContext';

// Mock data for the conversation and messages
const mockConversation = {
  _id: '1',
  username: 'John Doe',
  userProfilePic: 'https://example.com/avatar.jpg',
  userId: '123',
};

const mockMessages = [
  {
    _id: 'msg1',
    text: 'Hello!',
    sender: { _id: '123', profileImg: 'https://example.com/avatar.jpg' },
    seen: true,
  },
  {
    _id: 'msg2',
    text: 'How are you?',
    sender: { _id: '456', profileImg: 'https://example.com/avatar.jpg' },
    seen: false,
  },
];

// Component to wrap MessageContainer with socket handling
const MessageContainerWithSocket = () => {
  const { socket } = useSocket();

  useEffect(() => {
    // Only attach the event listener if socket is defined
    if (socket) {
      socket.on("message", (data) => {
        console.log(data);
      });

      // Clean up the event listener when the component is unmounted or socket changes
      return () => socket.off("message");
    }
  }, [socket]);

  return (
    <MessageContainer
      selectedConversation={mockConversation}
      messages={mockMessages}
    />
  );
};

// Storybook meta configuration
const meta = {
  title: 'Components/MessageContainer',
  component: MessageContainer,
  decorators: [
    (Story) => (
      <RecoilRoot>
        <SocketContextProvider>
          <ChakraProvider>
            <Story />
          </ChakraProvider>
        </SocketContextProvider>
      </RecoilRoot>
    ),
  ],
};

export default meta;

// Default Story with mocked data and socket handling
export const Default = () => <MessageContainerWithSocket />;
