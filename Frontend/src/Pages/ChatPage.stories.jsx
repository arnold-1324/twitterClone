// ChatPage.stories.js
import ChatPage from './ChatPage';
import { RecoilRoot, useSetRecoilState } from 'recoil';
import { conversationsAtom, selectedConversationAtom } from '../atom/messagesAtom';
import userAtom from '../atom/userAtom';
import { SocketContextProvider } from '../context/SocketContext';
import { useEffect } from 'react';

// Mock data for the story
const mockConversations = [
  {
    _id: '1',
    participants: [
      {
        _id: 'user123',
        username: 'johndoe',
        profileImg: '/path/to/profilePic.jpg',
        fullName: 'John Doe',
      },
    ],
    lastMessage: {
      text: 'Hello!',
      sender: 'johndoe',
      seen: true,
    },
  },
  {
    _id: '2',
    participants: [
      {
        _id: 'user456',
        username: 'janedoe',
        profileImg: '/path/to/profilePic2.jpg',
        fullName: 'Jane Doe',
      },
    ],
    lastMessage: {
      text: 'Hi there!',
      sender: 'janedoe',
      seen: false,
    },
  },
];

// Wrapper component to initialize Recoil state
const WithProviders = ({ children }) => {
  const setConversations = useSetRecoilState(conversationsAtom);
  const setSelectedConversation = useSetRecoilState(selectedConversationAtom);
  const setCurrentUser = useSetRecoilState(userAtom);

  // Set mock data in Recoil atoms after component mounts
  useEffect(() => {
    setConversations(mockConversations);
    setSelectedConversation(mockConversations[0]);
    setCurrentUser({ _id: 'currentUserId', username: 'currentuser' });
  }, [setConversations, setSelectedConversation, setCurrentUser]);

  return (
    <SocketContextProvider>
      {children}
    </SocketContextProvider>
  );
};

export default {
  title: 'Pages/ChatPage',
  component: ChatPage,
  decorators: [
    (Story) => (
      <RecoilRoot>
        <WithProviders>
          <Story />
        </WithProviders>
      </RecoilRoot>
    ),
  ],
};

const Template = (args) => <ChatPage {...args} />;

export const Default = Template.bind({});
Default.args = {};
