import React, { useEffect, useState, useCallback, useRef } from "react";
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
  Spinner,
  List,
  ListItem,
  Tag,
  TagLabel,
  TagCloseButton,
  RadioGroup,
  Radio,
  FormControl,
  FormLabel,
  FormHelperText,
} from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import { FaUsers, FaCrown, FaShieldAlt, FaEdit, FaCamera, FaPlus } from "react-icons/fa";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { selectedConversationAtom, conversationsAtom } from "../atom/messagesAtom";
import userAtom from "../atom/userAtom";
import useShowToast from "../hooks/useShowToast";

const MotionBox = motion(Box);

const roleColorMap = {
  Owner: "yellow",
  Admin: "blue",
  Member: "gray",
};

const getRoleIcon = (role) => {
  switch (role) {
    case "Owner":
      return <FaCrown />;
    case "Admin":
      return <FaShieldAlt />;
    default:
      return <FaUsers />;
  }
};

const GroupUIComponents = ({ isOpen, onClose, mode = "edit" }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groupData, setGroupData] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // Create flow states
  const [stage, setStage] = useState("select-members"); // select-members | group-info
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]); // array of user objects
  const [permissions, setPermissions] = useState({ canMessage: "all" });

  const selectedConversation = useRecoilValue(selectedConversationAtom);
  const currentUser = useRecoilValue(userAtom);
  const setConversations = useSetRecoilState(conversationsAtom);
  const showToast = useShowToast();

  const bgColor = useColorModeValue("white", "gray.800");

  const isAdmin = groupData?.admins?.some((admin) => admin._id === currentUser._id);
  const isOwner = groupData?.owner?._id === currentUser._id;
  const canEdit = isAdmin || isOwner || mode === "create";

  // Create ref for selectedMembers to avoid stale closures
  const selectedMembersRef = useRef(selectedMembers);
  useEffect(() => {
    selectedMembersRef.current = selectedMembers;
  }, [selectedMembers]);

  // Reset internal state when modal opens/closes or mode changes
  useEffect(() => {
    if (!isOpen) {
      setGroupData(null);
      setIsEditing(false);
      setSelectedImage(null);
      setImagePreview(null);
      setEditForm({ name: "", description: "" });
      setStage(mode === "create" ? "select-members" : "group-info");
      setSelectedMembers([]);
      setPermissions({ canMessage: "all" });
      setSearchResults([]);
      setQuery("");
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (!isOpen) return;
    if (mode === "edit" && selectedConversation?.groupId) {
      fetchGroupDetails();
    } else if (mode === "create") {
      // start at member selection stage
      setStage("select-members");
      setIsEditing(true); // allow upload in create flow
    }
  }, [isOpen, mode, selectedConversation?.groupId]);

  const fetchGroupDetails = async () => {
    try {
      const res = await fetch(`/api/groups/${selectedConversation.groupId}`);
      const data = await res.json();
      if (data.error) return showToast("Error", data.error, "error");

      setGroupData(data);
      setEditForm({ name: data.name || "", description: data.description || "" });
      setImagePreview(data.profileImage || null);
      setPermissions(data.permissions || { canMessage: "all" });
    } catch (err) {
      showToast("Error", "Failed to fetch group details", "error");
    }
  };

  const debounce = (fn, wait = 350) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  const doSearch = async (q) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      // FIXED: Correct endpoint usage with query parameter
      const res = await fetch(`/api/users/profile/${q}`);
      if (!res.ok) throw new Error("User not found");
      
      const user = await res.json();
      if (user.error) throw new Error(user.error);
      
      // Filter out already selected users using ref
      if (!selectedMembersRef.current.some(m => m._id === user._id)) {
        setSearchResults([user]);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(debounce(doSearch, 300), []);

  useEffect(() => {
    if (mode !== "create") return;
    debouncedSearch(query);
  }, [query, debouncedSearch, mode]);

  const handleAddMember = (user) => {
    setSelectedMembers(prev => [...prev, user]);
    setSearchResults([]);
    setQuery("");
  };

  const handleRemoveMember = (id) => {
    setSelectedMembers(prev => prev.filter(m => m._id !== id));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const createGroup = async () => {
    if (!editForm.name.trim()) return showToast("Error", "Group name is required", "error");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", editForm.name);
      formData.append("description", editForm.description || "");
      formData.append("permissions", JSON.stringify(permissions));
      if (selectedImage) formData.append("profileImage", selectedImage);

     const memberIds = selectedMembers.map(member => member._id); 
     formData.append("members", JSON.stringify(memberIds));

      // admins default to owner - backend will ensure owner is admin

      const res = await fetch(`/api/groups/create`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.error) return showToast("Error", data.error, "error");

      // Add to conversations list (server returns populated group)
      setConversations(prev => [ ...prev, data ]);
      showToast("Success", "Group created successfully", "success");
      onClose();
    } catch (err) {
      showToast("Error", "Failed to create group", "error");
    } finally {
      setLoading(false);
    }
  };

  const updateGroup = async () => {
    if (!editForm.name.trim()) return showToast("Error", "Group name is required", "error");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", editForm.name);
      formData.append("description", editForm.description || "");
      if (selectedImage) formData.append("profileImage", selectedImage);

      const res = await fetch(`/api/groups/${selectedConversation.groupId}`, {
        method: "PUT",
        body: formData,
      });
      const data = await res.json();
      if (data.error) return showToast("Error", data.error, "error");

      // Update conversations
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
    } catch (err) {
      showToast("Error", "Failed to update group", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (mode === "create") return createGroup();
    return updateGroup();
  };

  const getMemberRole = (memberId) => {
    if (groupData?.owner?._id === memberId) return "Owner";
    if (groupData?.admins?.some(admin => admin._id === memberId)) return "Admin";
    return "Member";
  };

  // Small UI pieces
  const MembersList = ({ members = [] }) => (
    <List spacing={2}>
      {members.map(member => {
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
              <HStack spacing={2}>
                <Box>{getRoleIcon(role)}</Box>
                <Badge size="sm" colorScheme={roleColorMap[role] || "gray"}>{role}</Badge>
              </HStack>
            </HStack>
          </ListItem>
        );
      })}
    </List>
  );

  // loading state for edit mode
  if (mode === "edit" && !groupData) {
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
            <Text>{mode === "create" ? "Create Group" : "Group Info"}</Text>
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody overflowY="auto">
          <VStack spacing={6} align="stretch">
            {/* CREATE FLOW - STEP 1: SELECT MEMBERS */}
            {mode === "create" && stage === "select-members" && (
              <MotionBox
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <FormControl>
                  <FormLabel>Search users to add</FormLabel>
                  <HStack>
                    <Input
                      placeholder="Search by username..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <Button onClick={() => setQuery("")}>Clear</Button>
                  </HStack>
                  <FormHelperText>Type a username and press enter to search</FormHelperText>
                </FormControl>

                <Box mt={4}>
                  <Text fontWeight="semibold">Selected Members</Text>
                  <HStack spacing={2} mt={2} wrap="wrap">
                    {selectedMembers.length === 0 ? (
                      <Text color="gray.500">No members selected yet</Text>
                    ) : (
                      selectedMembers.map(m => (
                        <Tag key={m._id} borderRadius="full" variant="subtle">
                          <Avatar size="xs" src={m.profileImg} mr={2} />
                          <TagLabel>{m.username}</TagLabel>
                          <TagCloseButton onClick={() => handleRemoveMember(m._id)} />
                        </Tag>
                      ))
                    )}
                  </HStack>
                </Box>

                <Divider my={4} />

                <Box>
                  <Text fontWeight="semibold">Search Results</Text>
                  <VStack spacing={2} align="stretch" mt={2}>
                    {searching && <Flex justify="center"><Spinner size="sm" /></Flex>}
                    {!searching && searchResults.length === 0 && query.trim() !== "" && (
                      <Text color="gray.500">No users found</Text>
                    )}
                    {searchResults.map(u => (
                      <HStack 
                        key={u._id} 
                        p={2} 
                        borderRadius="md" 
                        _hover={{ bg: useColorModeValue("gray.50", "gray.700") }}
                      >
                        <Avatar size="sm" src={u.profileImg} name={u.username} />
                        <Box flex="1">
                          <Text fontWeight="medium">{u.username}</Text>
                          {u.email && <Text fontSize="sm" color="gray.500">{u.email}</Text>}
                        </Box>
                        <Button 
                          size="sm" 
                          leftIcon={<FaPlus />} 
                          onClick={() => handleAddMember(u)}
                          isDisabled={selectedMembers.some(m => m._id === u._id)}
                        >
                          Add
                        </Button>
                      </HStack>
                    ))}
                  </VStack>
                </Box>

                <HStack spacing={3} pt={4} justify="flex-end">
                  <Button variant="outline" onClick={onClose}>Cancel</Button>
                  <Button 
                    colorScheme="teal" 
                    onClick={() => setStage("group-info")} 
                    isDisabled={selectedMembers.length === 0}
                  >
                    Next
                  </Button>
                </HStack>
              </MotionBox>
            )}

            {/* CREATE FLOW - STEP 2 & EDIT FLOW: GROUP INFO */}
            {((mode === "create" && stage === "group-info") || mode === "edit") && (
              <MotionBox initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Box textAlign="center">
                  <Box position="relative" display="inline-block">
                    <Avatar size="2xl" src={imagePreview || groupData?.profileImage} bg={!imagePreview && !groupData?.profileImage ? "teal.500" : undefined}>
                      <FaUsers size="2xl" />
                    </Avatar>

                    {/* camera only shown in edit/create mode when allowed */}
                    {(canEdit && (mode === "create" || isEditing)) && (
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

                  {/* If editing is enabled show inputs otherwise show static */}
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

                  <Divider my={4} />

                  {/* Permissions */}
                  <Box>
                    <Text fontWeight="bold" mb={2}>Permissions</Text>
                    <RadioGroup onChange={(val) => setPermissions({ ...permissions, canMessage: val })} value={permissions.canMessage}>
                      <HStack spacing={4}>
                        <Radio value="all">Everyone can message</Radio>
                        <Radio value="admins">Only admins</Radio>
                        <Radio value="owner">Only owner</Radio>
                      </HStack>
                    </RadioGroup>
                  </Box>

                  {/* Members list for edit mode */}
                  {mode === "edit" && (
                    <>
                      <Divider my={4} />
                      <Box>
                        <Text fontWeight="bold" mb={3}>Members ({groupData.members?.length || 0})</Text>
                        <MembersList members={groupData.members || []} />
                      </Box>
                    </>
                  )}

                  {/* For create mode show selected members */}
                  {mode === "create" && (
                    <>
                      <Divider my={4} />
                      <Box>
                        <Text fontWeight="bold" mb={3}>Members ({selectedMembers.length})</Text>
                        <List spacing={2}>
                          {selectedMembers.map(m => (
                            <ListItem key={m._id}>
                              <HStack spacing={3} p={2} borderRadius="md" _hover={{ bg: useColorModeValue("gray.50", "gray.700") }}>
                                <Avatar size="sm" src={m.profileImg} name={m.username} />
                                <Text fontWeight="medium">{m.username}</Text>
                                <Button size="sm" variant="ghost" onClick={() => handleRemoveMember(m._id)}>Remove</Button>
                              </HStack>
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    </>
                  )}

                  {/* Action buttons */}
                  <VStack spacing={3} pt={4}>
                    <HStack w="full">
                      <Button flex={1} variant="outline" onClick={() => {
                        if (mode === "edit" && isEditing) {
                          // cancel edits, revert
                          setIsEditing(false);
                          setEditForm({ name: groupData.name || "", description: groupData.description || "" });
                          setSelectedImage(null);
                          setImagePreview(groupData.profileImage);
                        } else if (mode === "create") {
                          // go back to member selection
                          setStage("select-members");
                        } else {
                          onClose();
                        }
                      }}>
                        {mode === "edit" && isEditing ? "Cancel" : mode === "create" ? "Back" : "Close"}
                      </Button>

                      <Button flex={1} colorScheme="teal" onClick={handleSave} isLoading={loading} loadingText={mode === "create" ? "Creating..." : "Saving..."}>
                        {mode === "create" ? "Create Group" : (isEditing ? "Save Changes" : "Edit Group")}
                      </Button>
                    </HStack>

                    {/* For edit mode show Edit button if not editing */}
                    {mode === "edit" && !isEditing && canEdit && (
                      <Button leftIcon={<FaEdit />} variant="outline" onClick={() => setIsEditing(true)}>Edit Group</Button>
                    )}
                  </VStack>
                </Box>
              </MotionBox>
            )}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default GroupUIComponents;