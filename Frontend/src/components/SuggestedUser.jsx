import { Avatar, Button, Flex, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import useFollowUnfollow from "../hooks/useFollowUnfollow";

export default function SuggestedUser({ user }) {
  const { handleFollowUnfollow, following, updating } = useFollowUnfollow(user);
  return (
    <Flex align="center" justify="space-between" gap={3}>
      <Flex as={Link} to={`/${user.username}`} align="center" gap={2} minW={0}>
        <Avatar size="sm" name={user.fullName} src={user.profileImg} />
        <Flex direction="column" minW={0}>
          <Text noOfLines={1} fontSize="sm" fontWeight="bold">{user.fullName || user.username}</Text>
          <Text noOfLines={1} fontSize="xs" color="var(--dayline-dim)">@{user.username}</Text>
        </Flex>
      </Flex>
      <Button size="xs" flexShrink={0} variant="outline" color="var(--dayline-accent)"
        isLoading={updating} onClick={handleFollowUnfollow}>
        {following ? "Unfollow" : "Follow"}
      </Button>
    </Flex>
  );
}
