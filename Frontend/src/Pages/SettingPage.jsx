import React, { useState } from "react";
import {
  Box,
  Flex,
  Text,
  VStack,
  HStack,
  Avatar,
  IconButton,
  Divider,
  useColorModeValue,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Stack,
  Heading,
  FormLabel,
  FormControl,
} from "@chakra-ui/react";
import { Link, useNavigate } from "react-router-dom";
import { FaChevronRight, FaUserEdit, FaLock, FaSignOutAlt, FaShieldAlt, FaHistory, FaEnvelope, FaQuestionCircle, FaExclamationTriangle } from "react-icons/fa";
import { useRecoilValue, useSetRecoilState } from "recoil";
import userAtom from "../atom/userAtom";
import NotifyAtom from "../atom/notifyAtom";
import { motion } from "framer-motion";
import useLogout from "../hooks/useLogout";
import UpdateProfile from "../Pages/UpdateProfile";

const MotionBox = motion(Box);

const SettingPage = () => {
  const user = useRecoilValue(userAtom);
  const setNotify = useSetRecoilState(NotifyAtom);
  const bgColor = useColorModeValue("white", "gray.800");
  const textColor = useColorModeValue("gray.800", "white");
  const toast = useToast();
  const navigate = useNavigate();
  const logout = useLogout();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const menuItems = [
    { label: "Edit Profile", path: "/update", icon: FaUserEdit },
    { label: "Change Password", path: "/change-password", icon: FaLock },
    { label: "Privacy and Security", path: "/privacy-security", icon: FaShieldAlt },
    { label: "Login Activity", path: "/login-activity", icon: FaHistory },
    { label: "Help", path: "/help", icon: FaQuestionCircle },
    { label: "Log Out", path: "/logout", icon: FaSignOutAlt },
  ];

  const handleMenuClick = (item) => {
    if (item.path === "/logout") {
      // Handle logout
      logout();
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      setNotify({ notifications: [], unreadCount: 0 });
      navigate("/auth");
    } else if (item.path === "/edit-profile") {
      setModalContent("Edit Profile");
      setIsModalOpen(true);
    } else {
      setModalContent(item.label);
      setIsModalOpen(true);
    }
  };

  return (
    <Flex direction={{ base: "column", md: "row" }}>
      <Box
        bg={bgColor}
        color={textColor}
        minHeight="100vh"
        p={4}
        width={{ base: "full", md: isSidebarOpen ? "250px" : "90px" }}
        transition="width 0.3s ease"
        onMouseEnter={() => setIsSidebarOpen(true)}
        onMouseLeave={() => setIsSidebarOpen(false)}
      >
        <VStack spacing={4} align="stretch">
          {menuItems.map((item, index) => (
            <MotionBox
              key={index}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <HStack
                borderRadius={isSidebarOpen ? "md" : "full"}
                justifyContent="space-between"
                p={4}
                bg={useColorModeValue("gray.100", "gray.700")}
                _hover={{ bg: useColorModeValue("gray.200", "gray.600") }}
                onClick={() => handleMenuClick(item)}
                cursor="pointer"
              >
                <item.icon />
                {isSidebarOpen && <Text>{item.label}</Text>}
                <IconButton
                  icon={<FaChevronRight />}
                  variant="ghost"
                  aria-label="Navigate"
                  display={isSidebarOpen ? "block" : "none"}
                />
              </HStack>
              {index < menuItems.length - 1 && <Divider />}
            </MotionBox>
          ))}
        </VStack>
      </Box>

      <Box flex="1" p={4}>
        <Flex justifyContent="center" mb={8}>
          <Avatar size="xl" name={user.fullName} src={user.profileImg} />
        </Flex>

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>{modalContent}</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {modalContent === "Edit Profile" && <UpdateProfile />}
              {modalContent === "Change Password" && (
                <Box>
                  <Flex align={"center"} justify={"center"}>
                    <Stack spacing={4} w={"full"} maxW={"md"} bg={useColorModeValue("white", "gray.800")} rounded={"xl"} boxShadow={"lg"} p={6} my={12}>
                      <Heading lineHeight={1.1} fontSize={{ base: "2xl", md: "3xl" }}>
                        Change Password
                      </Heading>
                      <FormControl id="currentPassword" isRequired>
                        <FormLabel>Current Password</FormLabel>
                        <Input type="password" />
                      </FormControl>
                      <FormControl id="newPassword" isRequired>
                        <FormLabel>New Password</FormLabel>
                        <Input type="password" />
                      </FormControl>
                      <FormControl id="confirmNewPassword" isRequired>
                        <FormLabel>Confirm New Password</FormLabel>
                        <Input type="password" />
                      </FormControl>
                      <Stack spacing={6}>
                        <Button bg={"blue.400"} color={"white"} _hover={{ bg: "blue.500" }}>
                          Save
                        </Button>
                      </Stack>
                    </Stack>
                  </Flex>
                </Box>
              )}
              {/* Add more conditions for other menu items as needed */}
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Box>
    </Flex>
  );
};

export default SettingPage;
