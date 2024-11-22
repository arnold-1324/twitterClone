import { Link } from "react-router-dom";
import { IconButton, Badge, Tooltip, Box } from "@chakra-ui/react";
import { BsBellFill } from "react-icons/bs";
import { motion } from "framer-motion";

// Wrapping Chakra Box and Badge with motion for animations
const MotionBox = motion(Box);
const MotionBadge = motion(Badge);

const NotificationIcon = ({ unreadCount }) => {
  return (
    <Tooltip label="Notifications" placement="bottom">
      <Box position="relative">
        <Link to="/notifications">
          <IconButton
            icon={<BsBellFill size={20} />}
            variant="ghost"
            aria-label="Notifications"
            _hover={{ bg: "gray.100" }} // Adding hover effect for the button
          />
          {unreadCount > 0 && (
            <MotionBadge
              position="absolute"
              top="-1"
              right="-1"
              colorScheme="red"
              borderRadius="full"
              fontSize="0.7em"
              px={2}
              initial={{ scale: 0 }} // Initial state (hidden)
              animate={{ scale: 1 }} // Animate to normal size
              exit={{ scale: 0 }} // Exit animation (shrink when removed)
              transition={{ duration: 0.2 }} // Smooth transition for the scale effect
            >
              {unreadCount}
            </MotionBadge>
          )}
        </Link>
      </Box>
    </Tooltip>
  );
};

export default NotificationIcon;
