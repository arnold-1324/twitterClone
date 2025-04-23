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
		const socket = io("http://localhost:5000", {
			query: { userId: user._id },
			transports: ["websocket"],
			reconnection: true,
		});

		setSocket(socket);

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
		};
		socket.on("reconnect", handleReconnect);
		return () => socket.off("reconnect", handleReconnect);
	}, [socket, user?._id]);

	return <SocketContext.Provider value={{ socket, onlineUsers }}>{children}</SocketContext.Provider>;
};