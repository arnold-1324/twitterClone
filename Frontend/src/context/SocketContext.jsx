import { refreshSession } from "../lib/apiFetch.js";
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

		const connection = io(import.meta.env.VITE_SOCKET_URL || "/", { withCredentials: true });
		connection.on("getOnlineUsers", setOnlineUsers);
		connection.on("presenceChanged", ({ online, offline }) => {
			setOnlineUsers((current) => {
				const members = new Set([...current, ...online]);
				offline.forEach((id) => members.delete(id));
				return [...members];
			});
		});
		let disposed = false;
		let authRetry = false;
		connection.on("connect", () => { authRetry = false; });
		async function reconnect() {
			if (authRetry || disposed) return;
			authRetry = true;
			if (!disposed && await refreshSession().catch(() => false) && !disposed) connection.connect();
		}
		connection.on("disconnect", (reason) => {
			setOnlineUsers([]);
			if (reason === "io server disconnect") void reconnect();
		});
		connection.on("connect_error", (error) => {
			if (error.message === "Authentication required") void reconnect();
		});
		setSocket(connection);
		return () => {
			disposed = true;
			connection.disconnect();
			setSocket(null);
			setOnlineUsers([]);
		};
	}, [user?._id]);

	return <SocketContext.Provider value={{ socket, onlineUsers }}>{children}</SocketContext.Provider>;
};