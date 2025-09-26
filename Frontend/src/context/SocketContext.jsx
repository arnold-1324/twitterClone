import { createContext, useContext, useEffect, useState } from "react";
import { useRecoilValue } from "recoil";
import io from "socket.io-client";
import userAtom from "../atom/userAtom";
import networkUtils from "../Utils/NetworkUtils";

const SocketContext = createContext();

export const useSocket = () => {
	const context = useContext(SocketContext);
	if (!context) {
		// Return default values if context is not available
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
		const cleanup = networkUtils.onConnectionChange((online) => {
			console.log('Network status changed:', online);
			if (online && socket && connectionStatus === 'error') {
				// Try to reconnect when network comes back online
				socket.connect();
			}
		});

		// Listen for socket connection failures from service worker
		const handleSocketFailure = (event) => {
			console.error('Socket connection failed:', event.detail.error);
			setConnectionStatus('blocked');
			// Run diagnostics to understand the issue
			networkUtils.runNetworkDiagnostics().then(setNetworkDiagnostics);
		};

		window.addEventListener('socketConnectionFailed', handleSocketFailure);

		return () => {
			cleanup();
			window.removeEventListener('socketConnectionFailed', handleSocketFailure);
		};
	}, [socket, connectionStatus]);

	useEffect(() => {
		// Determine the correct Socket.IO server URL
		const socketUrl = import.meta.env.PROD 
			? "https://twitterclone-backend-681i.onrender.com" 
			: "/"; // Use proxy in development
		
		const socket = io(socketUrl, {
			query: {
				userId: user?._id,
			},
			// Enable all transports for better compatibility
			transports: ["websocket", "polling"],
			// Upgrade to WebSocket when possible, but fallback to polling
			upgrade: true,
			// Connection timeout and retry settings
			timeout: 20000,
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 5000,
			maxReconnectionAttempts: 10,
			// Force new connection to avoid cached failed connections
			forceNew: false,
			// Enable CORS and allow credentials
			withCredentials: false,
			// Additional options for restricted networks
			rememberUpgrade: false,
			// Ping settings for connection health
			pingTimeout: 60000,
			pingInterval: 25000
		});

		setSocket(socket);

		// Connection event handlers
		socket.on('connect', () => {
			console.log('Socket connected');
			setConnectionStatus('connected');
			setReconnectAttempts(0);
			setNetworkDiagnostics(null);
			
			// Send any pending messages when connection is restored
			networkUtils.sendPendingMessages(socket).then((results) => {
				if (results.length > 0) {
					console.log('Sent pending messages:', results);
				}
			}).catch(console.error);
		});

		socket.on('disconnect', (reason) => {
			console.log('Socket disconnected:', reason);
			setConnectionStatus('disconnected');
			setOnlineUsers([]);
		});

		socket.on('reconnect', (attemptNumber) => {
			console.log('Socket reconnected after', attemptNumber, 'attempts');
			setConnectionStatus('connected');
			setReconnectAttempts(attemptNumber);
		});

		socket.on('reconnect_attempt', (attemptNumber) => {
			console.log('Reconnection attempt:', attemptNumber);
			setConnectionStatus('reconnecting');
			setReconnectAttempts(attemptNumber);
		});

		socket.on('reconnect_error', (error) => {
			console.error('Reconnection error:', error);
			setConnectionStatus('error');
		});

		socket.on('reconnect_failed', () => {
			console.error('Reconnection failed after all attempts');
			setConnectionStatus('failed');
		});

		socket.on('connect_error', (error) => {
			console.error('Connection error:', error);
			setConnectionStatus('error');
			
			// If WebSocket fails, log the error but let Socket.IO handle fallback
			if (error.type === 'TransportError') {
				console.log('Transport failed, will try fallback transport');
			}
			
			// Run network diagnostics on persistent connection errors
			if (reconnectAttempts > 3) {
				networkUtils.runNetworkDiagnostics().then(setNetworkDiagnostics);
			}
		});

		socket.on("getOnlineUsers", (users) => {
			setOnlineUsers(users);
		});

		return () => {
			socket.disconnect();
		};
	}, [user?._id]);

	useEffect(() => {
		if (!socket || !user?._id) return;
		const handleReconnect = () => {
			socket.emit("setUserId", user._id);
			// Send pending messages after reconnection
			setTimeout(() => {
				networkUtils.sendPendingMessages(socket).then((results) => {
					if (results.length > 0) {
						console.log('Sent pending messages after reconnect:', results);
					}
				}).catch(console.error);
			}, 1000);
		};
		socket.on("reconnect", handleReconnect);
		return () => socket.off("reconnect", handleReconnect);
	}, [socket, user?._id]);

	// Helper function to send message with fallback
	const sendMessageWithFallback = (messageData) => {
		return new Promise((resolve, reject) => {
			if (!socket || connectionStatus !== 'connected') {
				// Store message locally if socket is not available
				const fallbackMessage = networkUtils.createFallbackMessage(
					messageData, 
					user._id, 
					messageData.conversationId
				);
				
				if (networkUtils.storePendingMessage(fallbackMessage)) {
					resolve({ success: true, message: fallbackMessage, isPending: true });
				} else {
					reject(new Error('Failed to store message locally'));
				}
				return;
			}

			// Try to send normally
			const timeout = setTimeout(() => {
				reject(new Error('Message send timeout'));
			}, 10000);

			socket.emit('sendMessage', messageData, (response) => {
				clearTimeout(timeout);
				if (response.error) {
					// Store as fallback on server error
					const fallbackMessage = networkUtils.createFallbackMessage(
						messageData, 
						user._id, 
						messageData.conversationId
					);
					networkUtils.storePendingMessage(fallbackMessage);
					reject(new Error(response.error));
				} else {
					resolve({ success: true, message: response });
				}
			});
		});
	};

	return <SocketContext.Provider value={{ socket, onlineUsers, connectionStatus, reconnectAttempts, networkDiagnostics, sendMessageWithFallback }}>{children}</SocketContext.Provider>;
};