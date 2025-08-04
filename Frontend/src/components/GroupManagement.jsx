import React, { useState, useEffect } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Button,
  Input,
  Textarea,
  VStack,
  HStack,
  Text,
  Avatar,
  Box,
  Divider,
  Badge,
  useColorModeValue,
  IconButton,
  Flex,
  Image,
  useToast,
  Spinner,
  List,
  ListItem,
  ListIcon,
} from "@chakra-ui/react";
import { FaUsers, FaCrown, FaShieldAlt, FaEdit, FaCamera } from "react-icons/fa";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { selectedConversationAtom, conversationsAtom } from "../atom/messagesAtom";
import userAtom from "../atom/userAtom";
import useShowToast from "../hooks/useShowToast";

const GroupManagement = ({ isOpen, onClose }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groupData, setGroupData] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const selectedConversation = useRecoilValue(selectedConversationAtom);
  const currentUser = useRecoilValue(userAtom);
  const setConversations = useSetRecoilState(conversationsAtom);
  const showToast = useShowToast();
  const toast = useToast();

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");

  // Check if current user is admin or owner
  const isAdmin = groupData?.admins?.some(admin => admin._id === currentUser._id);
  const isOwner = groupData?.owner?._id === currentUser._id;
  const canEdit = isAdmin || isOwner;

  useEffect(() => {
    if (isOpen && selectedConversation.groupId) {
      fetchGroupDetails();
    }
  }, [isOpen, selectedConversation.groupId]);

  const fetchGroupDetails = async () => {
    try {
      const res = await fetch(`/api/groups/${selectedConversation.groupId}`);
      const data = await res.json();
      
      if (data.error) {
        showToast("Error", data.error, "error");
        return;
      }
      
      setGroupData(data);
      setEditForm({
        name: data.name || "",
        description: data.description || "",
      });
      setImagePreview(data.profileImage);
    } catch (error) {
      showToast("Error", "Failed to fetch group details", "error");
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!editForm.name.trim()) {
      showToast("Error", "Group name is required", "error");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", editForm.name);
      formData.append("description", editForm.description);
      if (selectedImage) {
        formData.append("profileImage", selectedImage);
      }

      const res = await fetch(`/api/groups/${selectedConversation.groupId}`, {
        method: "PUT",
        body: formData,
      });

      const data = await res.json();
      
      if (data.error) {
        showToast("Error", data.error, "error");
        return;
      }

      // Update conversations list
      setConversations(prev => 
        prev.map(conv => 
          conv.groupId === selectedConversation.groupId 
            ? { ...conv, username: editForm.name, groupInfo: data }
            : conv
        )
      );

      setGroupData(data);
      setIsEditing(false);
      setSelectedImage(null);
      showToast("Success", "Group updated successfully", "success");
    } catch (error) {
      showToast("Error", "Failed to update group", "error");
    } finally {
      setLoading(false);
    }
  };

  const getMemberRole = (memberId) => {
    if (groupData?.owner?._id === memberId) return "Owner";
    if (groupData?.admins?.some(admin => admin._id === memberId)) return "Admin";
    return "Member";
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case "Owner": return <FaCrown color="gold" />;
      case "Admin": return <FaShieldAlt color="blue" />;
      default: return <FaUsers color="gray" />;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "Owner": return "yellow";
      case "Admin": return "blue";
      default: return "gray";
    }
  };

  if (!groupData) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent bg={bgColor}>
          <ModalBody>
            <Flex justify="center" align="center" h="200px">
              <Spinner size="lg" />
            </Flex>
          </ModalBody>
        </ModalContent>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent bg={bgColor} maxH="90vh" overflow="hidden">
        <ModalHeader>
          <Flex align="center" gap={2}>
            <FaUsers />
            <Text>Group Info</Text>
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody overflowY="auto">
          <VStack spacing={6} align="stretch">
            {/* Group Profile Section */}
            <Box textAlign="center">
              <Box position="relative" display="inline-block">
                <Avatar
                  size="2xl"
                  src={imagePreview || groupData.profileImage}
                  bg={!imagePreview && !groupData.profileImage ? "teal.500" : undefined}
                >
                  <FaUsers size="2xl" />
                </Avatar>
                {canEdit && isEditing && (
                  <IconButton
                    as="label"
                    htmlFor="group-image-input"
                    icon={<FaCamera />}
                    size="sm"
                    position="absolute"
                    bottom="0"
                    right="0"
                    colorScheme="teal"
                    cursor="pointer"
                  />
                )}
                <input
                  id="group-image-input"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: "none" }}
                />
              </Box>
              
              {isEditing ? (
                <VStack mt={4} spacing={3}>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Group name"
                    size="lg"
                    textAlign="center"
                    fontWeight="bold"
                  />
                  <Textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Group description"
                    rows={3}
                    resize="none"
                  />
                </VStack>
              ) : (
                <VStack mt={4} spacing={2}>
                  <Text fontSize="xl" fontWeight="bold">
                    {groupData.name}
                  </Text>
                  {groupData.description && (
                    <Text color="gray.500" textAlign="center">
                      {groupData.description}
                    </Text>
                  )}
                  {canEdit && (
                    <Button
                      leftIcon={<FaEdit />}
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                    >
                      Edit Group
                    </Button>
                  )}
                </VStack>
              )}
            </Box>

            <Divider />

            {/* Group Stats */}
            <Box>
              <Text fontWeight="bold" mb={2}>Group Statistics</Text>
              <HStack justify="space-between" p={3} bg={useColorModeValue("gray.50", "gray.700")} borderRadius="md">
                <Text>Members</Text>
                <Badge colorScheme="teal">{groupData.members?.length || 0}</Badge>
              </HStack>
            </Box>

            <Divider />

            {/* Members List */}
            <Box>
              <Text fontWeight="bold" mb={3}>Members ({groupData.members?.length || 0})</Text>
              <List spacing={2}>
                {groupData.members?.map((member) => {
                  const role = getMemberRole(member._id);
                  return (
                    <ListItem key={member._id}>
                      <HStack spacing={3} p={2} borderRadius="md" _hover={{ bg: useColorModeValue("gray.50", "gray.700") }}>
                        <Avatar size="sm" src={member.profileImg} name={member.username} />
                        <Box flex="1">
                          <HStack>
                            <Text fontWeight="medium">{member.username}</Text>
                            {member._id === currentUser._id && (
                              <Badge size="sm" colorScheme="green">You</Badge>
                            )}
                          </HStack>
                        </Box>
                        <HStack spacing={1}>
                          {getRoleIcon(role)}
                          <Badge size="sm" colorScheme={getRoleColor(role)}>
                            {role}
                          </Badge>
                        </HStack>
                      </HStack>
                    </ListItem>
                  );
                })}
              </List>
            </Box>

            {/* Edit Actions */}
            {isEditing && (
              <VStack spacing={3} pt={4}>
                <HStack spacing={3} w="full">
                  <Button
                    flex="1"
                    onClick={() => {
                      setIsEditing(false);
                      setEditForm({
                        name: groupData.name || "",
                        description: groupData.description || "",
                      });
                      setSelectedImage(null);
                      setImagePreview(groupData.profileImage);
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button
                    flex="1"
                    colorScheme="teal"
                    onClick={handleSave}
                    isLoading={loading}
                    loadingText="Saving..."
                  >
                    Save Changes
                  </Button>
                </HStack>
              </VStack>
            )}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default GroupManagement; 