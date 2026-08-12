import {
	Button,
	Flex,
	Image,
	Link,
	IconButton,
	useColorMode,
	Tooltip,
} from "@chakra-ui/react";
import { useRecoilValue } from "recoil";
import userAtom from "../atom/userAtom";
import { AiFillHome } from "react-icons/ai";
import { RxAvatar } from "react-icons/rx";
import { FiLogOut } from "react-icons/fi";
import { BsFillChatQuoteFill } from "react-icons/bs";
import { MdOutlineSettings } from "react-icons/md";
import { Link as RouterLink } from "react-router-dom";
import useLogout from "../hooks/useLogout";
import NotificationIcon from "./NotificationIcon";
import NotifyAtom from "../atom/notifyAtom";

const Header = () => {
	const { colorMode, toggleColorMode } = useColorMode();
	const user = useRecoilValue(userAtom);
	const logout = useLogout();
	const { unreadCount } = useRecoilValue(NotifyAtom);
	const logoBase = import.meta.env.BASE_URL || "/";
	const logoSrc = colorMode === "dark" ? `${logoBase}light-logo.svg` : `${logoBase}dark-logo.svg`;

	return (
		<Flex justifyContent="space-between" align="center" alignItems={"center"} mt={6} mb={6} px={4}>
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
				icon={
					<Image
						alt="logo"
						src={logoSrc}
						boxSize="28px"
						objectFit="contain"
					/>
				}
				onClick={toggleColorMode}
				aria-label="Toggle Color Mode"
				variant="ghost"
				minW={0}
				mx="auto"
				rounded="full"
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

					<NotificationIcon unreadCount={unreadCount > 0 ? unreadCount : ""} />

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