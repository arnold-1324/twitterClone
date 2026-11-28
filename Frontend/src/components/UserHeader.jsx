import { Avatar } from "@chakra-ui/avatar";
import { Box, Flex, Link, Text, VStack } from "@chakra-ui/layout";
import { Menu, MenuButton, MenuItem, MenuList } from "@chakra-ui/menu";
import { Portal } from "@chakra-ui/portal";
import { Button, useToast } from "@chakra-ui/react";
import { CgMoreO } from "react-icons/cg";
import { useAppValue } from "../state/store";
import userAtom from "../atom/userAtom";
import { Link as RouterLink } from "react-router-dom";
import useFollowUnfollow from "../hooks/useFollowUnfollow";
import useEphemeralShelf from "../hooks/useEphemeralShelf";
import { storyProfilePath } from "../lib/ephemeralCache";
import { StoryLink } from "./StoryShelf";
import ProfileNote from "./ProfileNote";

const UserHeader = ({ user }) => {
  const toast = useToast();
  const currentUser = useAppValue(userAtom);
  const { handleFollowUnfollow, following, updating } = useFollowUnfollow(user);
  const { data: story } = useEphemeralShelf(user ? `${storyProfilePath(user.username)}/status` : null, currentUser?._id);

  const copyURL = () => {
    const currentURL = window.location.href;
    navigator.clipboard.writeText(currentURL).then(() => {
      toast({
        title: "Success",
        description: "Profile link copied",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    });
  };

  return (
    <VStack gap={4} alignItems={"start"}>
      <Flex justifyContent={"space-between"} w={"full"}>
        <Box>
          <Text fontSize={"2xl"} fontWeight={"bold"}>
            {user.fullName}
          </Text>
          <Flex gap={2} alignItems={"center"}>
            <Text fontSize={"sm"}>{user.username}</Text>
            <Text fontSize={"xs"} bg={"gray.dark"} color={"gray.light"} p={1} borderRadius={"full"}>
              threads.net
            </Text>
          </Flex>
        </Box>
        <div className="profile-avatar-stack">
          <ProfileNote key={user._id} person={user} viewer={currentUser} />
          {story && new Date(story.expiresAt).getTime() > Date.now()
            ? <StoryLink person={user} viewer={currentUser?._id} from={`/${encodeURIComponent(user.username)}`}
              own={currentUser?._id === user._id} seen={!story.unseen} profile />
            : <Avatar name={user.fullName} src={user.profileImg} size="xl" />}
        </div>
      </Flex>
      <Text>{user.bio}</Text>
      {currentUser?._id === user._id ? (
        <Link as={RouterLink} to='/update'>
          <Button size={"sm"}>Update Profile</Button>
        </Link>
      ) : (
        <Button size={"sm"} onClick={handleFollowUnfollow} isLoading={updating}>
          {following ? "Unfollow" : "Follow"}
        </Button>
      )}
      <Flex w={"full"} justifyContent={"space-between"}>
        <Flex gap={2} alignItems={"center"}>
          <Text color={"gray.light"}>{user.followers.length} followers</Text>
          <Box w='1' h='1' bg={"gray.light"} borderRadius={"full"}></Box>
          <Link color={"gray.light"}>instagram.com</Link>
        </Flex>
        <Menu>
          <MenuButton>
            <CgMoreO size={24} cursor={"pointer"} />
          </MenuButton>
          <Portal>
            <MenuList bg={"gray.dark"}>
              <MenuItem bg={"gray.dark"} onClick={copyURL}>
                Copy link
              </MenuItem>
              {currentUser?._id === user._id && <MenuItem as={RouterLink} to="/settings" bg={"gray.dark"}>Settings</MenuItem>}
            </MenuList>
          </Portal>
        </Menu>
      </Flex>
    </VStack>
  );
};

export default UserHeader;
