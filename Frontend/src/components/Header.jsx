import {
	Button,
	Flex,
	Image,
	Link,
	IconButton,
	useColorMode,
	Tooltip,
	Badge,
	useBreakpointValue,
} from "@chakra-ui/react";
import { useRecoilValue, useSetRecoilState } from "recoil";
import userAtom from "../atom/userAtom";
import { AiFillHome } from "react-icons/ai";
import { RxAvatar } from "react-icons/rx";
import { FiLogOut } from "react-icons/fi";
import { BsFillChatQuoteFill, BsBellFill } from "react-icons/bs";
import { MdOutlineSettings } from "react-icons/md";
import { Link as RouterLink } from "react-router-dom";
import useLogout from "../hooks/useLogout";
import authScreenAtom from "../atom/authAtom";
import NotificationIcon from "./NotificationIcon";
import NotifyAtom from "../atom/notifyAtom";

const Header = () => {
	const { colorMode, toggleColorMode } = useColorMode();
	const user = useRecoilValue(userAtom);
	const logout = useLogout();
	const setAuthScreen = useSetRecoilState(authScreenAtom);
	const { unreadCount } = useRecoilValue(NotifyAtom);
	const isMobile = useBreakpointValue({ base: true, md: false });
	// Mockup for unread notifications count
	const unreadNotifications = 3;

	return (
		<Flex justifyContent="space-between" alignItems="center" my={6}>
			{user && (
				<Link as={RouterLink} to="/">
					<AiFillHome size={24} />
				</Link>
			)}
			{!user && (
				<Link
					as={RouterLink}
					to={authScreen === "login" ? "/auth" : "/auth"}
					onClick={() => setAuthScreen("login")}
				>
					Login
				</Link>
			)}

			<Image
				cursor={"pointer"}
				alt="logo"
				w={6}
				src={colorMode === "dark" ? "/light-logo.svg" : "/dark-logo.svg"}
				onClick={toggleColorMode}
			/>

			{user && (
				<Flex alignItems={"center"} gap={4}>
					<Link as={RouterLink} to={`/${user.username}`}>
						<RxAvatar size={24} />
					</Link>
					<Link as={RouterLink} to={`/chat`}>
						<BsFillChatQuoteFill size={20} />
					</Link>
					<NotificationIcon unreadCount={unreadCount > 0 ? unreadCount : ""} />
					<Link as={RouterLink} to={`/settings`}>
						<MdOutlineSettings size={20} />
					</Link>
					<Button size={"xs"} onClick={logout}>
						<FiLogOut size={20} />
					</Button>
				</Flex>
			)}
			{!user && (
				<Link
					as={RouterLink}
					to={authScreen === "signup" ? "/auth" : "/auth"}
					onClick={() => setAuthScreen("signup")}
				>
					Sign up
				</Link>
			)}
		</Flex>
	);
};

export default Header;