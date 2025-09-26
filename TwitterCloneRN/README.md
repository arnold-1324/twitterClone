# Twitter Clone React Native

This is a React Native conversion of the original React web application. The app includes real-time messaging, posts, notifications, and user profiles with mobile-optimized UI and native features.

## Setup Instructions

### Prerequisites

1. **Node.js and npm**: Make sure you have Node.js installed (version 16 or higher)
2. **Expo CLI**: Install globally with `npm install -g @expo/cli`
3. **Android Studio** (for Android development) or **Xcode** (for iOS development)
4. **Expo Go app** on your mobile device for testing

### Installation

1. **Navigate to the React Native project directory**:
   ```bash
   cd TwitterCloneRN
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Install additional required packages** (if not automatically installed):
   ```bash
   npx expo install @react-native-async-storage/async-storage
   npx expo install @react-native-community/netinfo
   npx expo install react-native-paper
   npx expo install react-native-vector-icons
   ```

4. **Configure environment variables**:
   Create a `.env` file in the root directory:
   ```env
   API_BASE_URL=https://twitterclone-backend-681i.onrender.com
   SOCKET_URL=https://twitterclone-backend-681i.onrender.com
   ```

### Running the App

1. **Start the Expo development server**:
   ```bash
   npm start
   ```

2. **Run on different platforms**:
   - **Android**: `npm run android` or scan QR code with Expo Go
   - **iOS**: `npm run ios` or scan QR code with Expo Go
   - **Web**: `npm run web`

## Project Structure

```
TwitterCloneRN/
├── App.js                 # Main app component
├── app.json              # Expo configuration
├── babel.config.js       # Babel configuration
├── package.json          # Dependencies and scripts
├── src/
│   ├── atoms/           # Recoil state atoms
│   │   ├── authAtom.js
│   │   ├── messagesAtom.js
│   │   ├── notifyAtom.js
│   │   ├── postsAtom.js
│   │   └── userAtom.js
│   ├── components/      # Reusable components
│   │   └── auth/        # Authentication components
│   │       ├── LoginComponent.js
│   │       └── SignupComponent.js
│   ├── context/         # React context providers
│   │   └── SocketContext.js
│   ├── hooks/           # Custom hooks
│   │   └── useToast.js
│   ├── navigation/      # Navigation configuration
│   │   ├── AppNavigator.js
│   │   └── NavigationService.js
│   ├── screens/         # Screen components
│   │   ├── AuthScreen.js
│   │   ├── ChatScreen.js
│   │   ├── ConversationScreen.js
│   │   ├── CreatePostScreen.js
│   │   ├── EditProfileScreen.js
│   │   ├── HomeScreen.js
│   │   ├── NotificationScreen.js
│   │   ├── PostDetailScreen.js
│   │   ├── ProfileScreen.js
│   │   └── SettingsScreen.js
│   ├── services/        # API services
│   └── utils/           # Utility functions
│       └── NetworkUtils.js
└── assets/              # Images, fonts, etc.
```

## Key Features Converted

### ✅ Completed
- **Project Setup**: Expo configuration with all necessary dependencies
- **Authentication**: Login and signup with secure storage
- **Navigation**: Stack and tab navigation with proper routing
- **State Management**: Recoil atoms for global state
- **Socket.IO Integration**: Real-time messaging with offline fallback
- **Network Utilities**: Connection monitoring and message queuing
- **UI Framework**: React Native Paper for consistent Material Design

### 🚧 In Progress / To Do
- **Chat Interface**: Message containers and conversation UI
- **Post Components**: Create, display, and interact with posts
- **User Profiles**: Profile viewing and editing
- **Notifications**: Push notifications and in-app alerts
- **Media Handling**: Image/video upload and display
- **Camera Integration**: Photo capture and sharing
- **Offline Support**: Data persistence and sync

## API Configuration

The app is configured to work with your existing backend:

- **Development**: Uses `http://10.0.2.2:5000` for Android emulator
- **Production**: Uses `https://twitterclone-backend-681i.onrender.com`

Make sure your backend supports CORS for mobile requests and has the proper endpoints configured.

## Native Features

- **Secure Storage**: User credentials stored securely
- **Network Monitoring**: Real-time network status detection
- **Push Notifications**: Ready for implementation with Expo Notifications
- **Camera Access**: Configured for photo/video capture
- **File System**: Ready for media storage and sharing

## Development Notes

1. **Hot Reload**: Changes are automatically reflected in the app
2. **Debugging**: Use React Native Debugger or Expo Dev Tools
3. **Testing**: Run on physical devices for best experience
4. **Building**: Use `expo build` for production builds

## Next Steps

1. Complete the remaining UI components (Chat, Posts, Profile)
2. Implement media handling and camera features
3. Add push notification functionality
4. Test on both iOS and Android devices
5. Optimize performance and add error boundaries
6. Deploy to app stores

## Troubleshooting

- **Metro bundler issues**: Run `npx expo start --clear`
- **Dependencies conflicts**: Delete `node_modules` and run `npm install`
- **Simulator issues**: Restart the simulator/emulator
- **Network issues**: Check if backend is accessible from mobile device

For more help, check the [Expo documentation](https://docs.expo.dev/) or [React Navigation docs](https://reactnavigation.org/).