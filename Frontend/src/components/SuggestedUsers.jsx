import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import { Box, Button, Flex, Skeleton, SkeletonCircle, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import SuggestedUser from "./SuggestedUser";

const SuggestedUsers = () => {
	const [loading, setLoading] = useState(true);
	const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    const request = new AbortController();
    async function getSuggestedUsers() {
      setLoading(true);
      setError(false);
      try {
        const response = await apiFetch("/api/users/suggested", { signal: request.signal });
        if (!response.ok) throw new Error("Could not load suggestions.");
        const data = await readApiJson(response);
        if (!Array.isArray(data)) throw new Error("Could not load suggestions.");
        if (!request.signal.aborted) setSuggestedUsers(data);
      } catch {
        if (!request.signal.aborted) setError(true);
      } finally {
        if (!request.signal.aborted) setLoading(false);
      }
    }
    void getSuggestedUsers();
    return () => request.abort();
  }, [retry]);

	return (
		<>
			<Text mb={4} fontWeight={"bold"}>
				Suggested people
			</Text>
			<Flex direction={"column"} gap={4}>
        {error && <Text fontSize="sm">Couldn’t load suggestions. <Button size="xs" variant="outline" onClick={() => setRetry((value) => value + 1)}>Retry</Button></Text>}
        {!loading && !error && suggestedUsers.length === 0 && <Text fontSize="sm" color="var(--dayline-dim)">No suggestions yet.</Text>}
				{!loading && suggestedUsers.map((user) => <SuggestedUser key={user._id} user={user} />)}
				{loading &&
					[0, 1, 2, 3, 4].map((_, idx) => (
						<Flex key={idx} gap={2} alignItems={"center"} p={"1"} borderRadius={"md"}>
							{/* avatar skeleton */}
							<Box>
								<SkeletonCircle size={"10"} />
							</Box>
							{/* username and fullname skeleton */}
							<Flex w={"full"} flexDirection={"column"} gap={2}>
								<Skeleton h={"8px"} w={"80px"} />
								<Skeleton h={"8px"} w={"90px"} />
							</Flex>
							{/* follow button skeleton */}
							<Flex>
								<Skeleton h={"20px"} w={"60px"} />
							</Flex>
						</Flex>
					))}
			</Flex>
		</>
	);
};

export default SuggestedUsers;
