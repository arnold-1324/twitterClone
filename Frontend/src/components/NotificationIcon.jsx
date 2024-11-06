import { Link } from "react-router-dom";
import { IconButton, Badge, Tooltip, Box } from "@chakra-ui/react";
import { BsBellFill } from "react-icons/bs";

const NotificationIcon = ({ unreadCount }) => {
	return (
		<Tooltip label="Notifications" placement="bottom">
			<Box position="relative">
				<Link to="/notifications">
					<IconButton
						icon={<BsBellFill size={20} />}
						variant="ghost"
						aria-label="Notifications"
					/>
					{unreadCount > 0 && (
						<Badge
							position="absolute"
							top="-1"
							right="-1"
							colorScheme="red"
							borderRadius="full"
							fontSize="0.7em"
							px={2}
						>
							{unreadCount}
						</Badge>
					)}
				</Link>
			</Box>
		</Tooltip>
	);
};

export default NotificationIcon;
