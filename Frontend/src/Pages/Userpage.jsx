import UserHeader from "../components/UserHeader";
import UserPost from "../components/UserPost";
import useGetUserProfile from "../hooks/useGetUserprofile";
import { useParams } from "react-router-dom";
import { useRecoilState } from "recoil";
import postsAtom from "../atom/postsAtom";
import { Flex, Spinner } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import useShowToast from "../hooks/useShowToast";
import Post from "../components/Post";

const UserPage = () => {
  const { user, loading } = useGetUserProfile();
  const { username } = useParams();
  const showToast = useShowToast();
  const [posts, setPosts] = useRecoilState(postsAtom);
  const [fetchingPosts, setFetchingPosts] = useState(false);

  useEffect(() => {
	const getPosts = async () => {
		if (!user) return;
		setFetchingPosts(true);
		try {
			const res = await fetch(`api/posts/user/${username}`);
			const data = await res.json();
			console.log(data);
			setPosts(data);
		} catch (error) {
			showToast("Error", error.message, "error");
			setPosts([]);
		} finally {
			setFetchingPosts(false);
		}
	};

	getPosts();
}, [username,  setPosts, user]);


  if (loading) {
    return (
      <Flex justifyContent="center" alignItems="center" minHeight="80vh">
        <Spinner size="xl" />
      </Flex>
    );
  }

  if (!user && !loading) return <h1>User not found</h1>;

  return (
    <>
      <UserHeader user={user} />
      {!fetchingPosts && posts.length === 0 && <h1>User has no posts.</h1>}
      {fetchingPosts && (
        <Flex justifyContent="center" my={12}>
          <Spinner size="xl" />
        </Flex>
      )}
      {posts.map((post) => (
        <Post key={post._id} post={post} postedBy={post.postedBy} />
      ))}
    </>
  );
};

export default UserPage;
