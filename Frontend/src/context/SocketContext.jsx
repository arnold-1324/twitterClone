import { createContext, useContext, useEffect, useState } from "react";
import { useRecoilValue } from "recoil";
import io from "socket.io-client";
import userAtom from "../atom/userAtom";

const SocketContext = createContext();

export const useSocket = () => {
	return useContext(SocketContext);
};

export const SocketContextProvider = ({ children }) => {
	
	const [socket, setSocket] = useState(null);
	const [onlineUsers, setOnlineUsers] = useState([]);
	const user = useRecoilValue(userAtom);

	useEffect(() => {
		if (!user?._id) return;
		// Connect to backend socket.io server on port 5000
		const socket = io("http://localhost:5000", {
			query: { userId: user._id },
			transports: ["websocket"], 
		});

		setSocket(socket);

		socket.on("getOnlineUsers", (users) => {
			setOnlineUsers(users);
		});

		return () => {
			socket.disconnect();
		};
	}, [user?._id]);

	return <SocketContext.Provider value={{ socket, onlineUsers }}>{children}</SocketContext.Provider>;
};