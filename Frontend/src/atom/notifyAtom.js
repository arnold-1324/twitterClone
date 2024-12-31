import { atom } from "recoil";

const  NotifyAtom= atom({
	key: "NotifyAtom",
	default: { notifications: [], unreadCount: 0 }, 
});

export default NotifyAtom;