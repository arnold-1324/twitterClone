import {
	Button,
	Flex,
	Image,
	Link,
	IconButton,
	useColorMode,
	Tooltip,
	Badge,
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

const Header = () => {
	const { colorMode, toggleColorMode } = useColorMode();
	const user = useRecoilValue(userAtom);
	const logout = useLogout();
	const setAuthScreen = useSetRecoilState(authScreenAtom);

	// Mockup for unread notifications count
	const unreadNotifications = 3;

	return (
		<Flex justifyContent="space-between" align="center" mt={6} mb={12} px={4}>
			{/* Home Icon */}
			{user && (
				<Tooltip label="Home" placement="bottom">
					<Link as={RouterLink} to="/">
						<AiFillHome size={24} />
					</Link>
				</Tooltip>
			)}

			{/* Authentication Links */}
			

			{/* Logo with Color Mode Toggle */}
			<IconButton
				icon={<Image alt="logo" src={colorMode === "dark" ? "/light-logo.svg" : "/dark-logo.svg"} />}
				onClick={toggleColorMode}
				aria-label="Toggle Color Mode"
				variant="ghost"
			/>

			{/* User Icons Section */}
			{user && (
				<Flex alignItems="center" gap={4}>
					<Tooltip label="Profile" placement="bottom">
						<Link as={RouterLink} to={`/${user.username}`}>
							<RxAvatar size={24} />
						</Link>
					</Tooltip>

					<Tooltip label="Messages" placement="bottom">
						<Link as={RouterLink} to="/chat">
							<BsFillChatQuoteFill size={20} />
						</Link>
					</Tooltip>

					<NotificationIcon unreadCount={3} />

					<Tooltip label="Settings" placement="bottom">
						<Link as={RouterLink} to="/settings">
							<MdOutlineSettings size={20} />
						</Link>
					</Tooltip>

					{/* Logout Button */}
					<Tooltip label="Logout" placement="bottom">
						<Button size="xs" onClick={logout} variant="ghost">
							<FiLogOut size={20} />
						</Button>
					</Tooltip>
				</Flex>
			)}
		</Flex>
	);
};

export default Header;
