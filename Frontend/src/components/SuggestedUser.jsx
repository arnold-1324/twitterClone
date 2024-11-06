import { Avatar, Box, Button, Flex, Text, Tooltip, Badge ,useColorModeValue} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { FiCheckCircle } from "react-icons/fi";
import useFollowUnfollow from "../hooks/useFollowUnfollow";

const SuggestedUser = ({ user }) => {
	const { handleFollowUnfollow, following, updating } = useFollowUnfollow(user);

	console.log(user);
	return (
		<Flex
			p={4}
			bg={useColorModeValue('white', 'gray.800')}
			borderRadius="md"
			boxShadow="md"
			justifyContent="space-between"
			alignItems="center"
			_hover={{ boxShadow: "lg" }}
			width="100%"
			maxW="350px"
		>
			{/* Left Side */}
			<Flex gap={3} alignItems="center" as={Link} to={`/${user.username}`}>
				<Avatar
					src={user.profileImg}
					size="md"
					border="2px solid"
					borderColor="blue.500"
					alt={user.username}
				/>
				<Box>
					<Flex alignItems="center">
						<Text fontSize="md" fontWeight="bold" color={useColorModeValue("gray.700", "whiteAlpha.900")} mr={1}>
							{user.username}
						</Text>
						{user.isVerified && (
							<Tooltip label="Verified" aria-label="Verified user">
								<Badge colorScheme="blue">
									<FiCheckCircle />
								</Badge>
							</Tooltip>
						)}
					</Flex>
					<Text fontSize="sm" color="gray.500">
						{user.fullName}
					</Text>
					{user.bio && (
						<Text fontSize="xs" color="gray.400" mt={1} noOfLines={1}>
							{user.bio}
						</Text>
					)}
				</Box>
			</Flex>

			{/* Follow/Unfollow Button */}
			<Button
				size="sm"
				variant="solid"
				colorScheme={following ? "gray" : "blue"}
				onClick={handleFollowUnfollow}
				isLoading={updating}
				_hover={{
					bg: following ? "gray.200" : "blue.500",
					transform: "scale(1.05)",
				}}
				_disabled={{
					opacity: 0.6,
					cursor: "not-allowed",
				}}
			>
				{following ? "Unfollow" : "Follow"}
			</Button>
		</Flex>
	);
};

export default SuggestedUser;
