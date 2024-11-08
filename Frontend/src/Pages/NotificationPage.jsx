import { useEffect, useState } from "react";
import {
  Box,
  Text,
  Flex,
  Button,
  VStack,
  Image,
  Skeleton,
  useColorModeValue,
  IconButton,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { useRecoilState } from "recoil";
import { DeleteIcon } from "@chakra-ui/icons";
import NotifyAtom from "../atom/notifyAtom";
import useShowToast from "../hooks/useShowToast";
import { motion } from "framer-motion";

const MotionBox = motion(Box); // Wrapping Chakra's Box with motion for animations

const NotificationPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [notify, setNotify] = useRecoilState(NotifyAtom);
  const navigate = useNavigate();
  const showToast = useShowToast();

  // Chakra UI color modes
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.300", "gray.600");
  const readBgColor = useColorModeValue("gray.100", "#2d2d2d");
  const unreadBgColor = useColorModeValue("blue.50", "#1e1e30");
  const textColor = useColorModeValue("gray.800", "whiteAlpha.900");

  // Fetch notifications
  useEffect(() => {
    const getNotifications = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("api/notification/");
        if (!res.ok) throw new Error("Failed to fetch notifications");

        const data = await res.json();
        setNotify(data);
      } catch (error) {
        showToast("Error", error.message || "Failed to fetch data", "error");
      } finally {
        setIsLoading(false);
      }
    };
    getNotifications();
  }, [setNotify]);

  // Delete specific notification
  const handleDeleteNotification = async (notificationId) => {
    try {
      const res = await fetch("api/notification/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });

      const data = await res.json();
      if (data.error) {
        showToast("Error", data.error, "error");
        return;
      }

      setNotify((prevNotify) => prevNotify.filter((notif) => notif._id !== notificationId));
      showToast("Success", "Notification deleted", "success");
    } catch (error) {
      showToast("Error", "Error deleting notification", "error");
    }
  };

  return (
    <VStack spacing={4} align="start" w="full" p={4} bg={bgColor} color={textColor}>
      <Flex justifyContent="space-between" w="full" mb={4}>
        <Text fontSize="2xl" fontWeight="bold">
          Notifications
        </Text>
        <Button size="sm" onClick={() => navigate(-1)}>
          Back
        </Button>
      </Flex>

      {isLoading ? (
        <VStack spacing={3} w="full">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} height="60px" w="full" borderRadius="md" />
          ))}
        </VStack>
      ) : notify.length === 0 ? (
        <Text>No notifications</Text>
      ) : (
        notify.map((notif) => (
          <MotionBox
            key={notif._id}
            w="full"
            p={3}
            bg={notif.read ? readBgColor : unreadBgColor}
            borderRadius="md"
            boxShadow="sm"
            borderLeftWidth="4px"
            borderLeftColor={notif.read ? borderColor : "blue.400"}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            _hover={{
              scale: 1.02, // Slight scale effect to simulate hover inside the card
              boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.15)", // Elevation effect on hover
            }}
          >
            <Flex alignItems="center" justifyContent="space-between">
              <Flex alignItems="center">
                <Image
                  src={notif.from.profileImg}
                  alt={`${notif.from.username} profile`}
                  boxSize="40px"
                  borderRadius="full"
                  mr={3}
                />
                <Box>
                  <Text fontWeight="bold" color={textColor}>
                    {notif.from.username}
                  </Text>
                  <Text fontSize="sm" color={useColorModeValue("gray.600", "gray.400")}>
                    {notif.type === "like"
                      ? "❤️ liked your post"
                      : notif.type === "follow"
                      ? "👤 started following you"
                      : notif.type === "post"
                      ? "📸 added a new post"
                      : ""}
                  </Text>
                </Box>
              </Flex>

              <Text fontSize="xs" color={useColorModeValue("gray.500", "gray.500")}>
                {new Date(notif.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "numeric",
                })}
              </Text>

              <IconButton
                icon={<DeleteIcon />}
                colorScheme="red"
                size="sm"
                onClick={() => handleDeleteNotification(notif._id)}
                aria-label="Delete notification"
              />
            </Flex>
          </MotionBox>
        ))
      )}
    </VStack>
  );
};

export default NotificationPage;
