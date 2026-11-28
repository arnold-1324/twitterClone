import { defineState } from "../state/store";

const  NotifyAtom= defineState({
	key: "NotifyAtom",
	default: { notifications: [], unreadCount: 0 }, 
});

export default NotifyAtom;