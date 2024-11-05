import UserHeader from "../components/UserHeader"
import UserPost from "../components/UserPost";
import useGetUserProfile from "../hooks/useGetUserprofile";
import { useParams } from "react-router-dom";
import { useRecoilState } from "recoil";
import postsAtom from "../atom/postsAtom";
import { Flex, Spinner } from "@chakra-ui/react";
import { useEffect,useState } from "react";
import useShowToast from "../hooks/useShowToast";
import Post from "../components/Post";


const Userpage = () => {
  const { user, loading } = useGetUserProfile();
	const { username } = useParams();
	const showToast = useShowToast();
	const [posts, setPosts] = useRecoilState(postsAtom);
	const [fetchingPosts, setFetchingPosts] = useState(true);

  useEffect(() => {
		const getPosts = async () => {
			if (!user) return;
			setFetchingPosts(true);
			try {
				const res = await fetch(`/api/posts/user/${username}`);
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
	}, [username, showToast, setPosts, user]);

	if (!user && loading) {
		return (
			<Flex justifyContent={"center"}>
				<Spinner size={"xl"} />
			</Flex>
		);
	}

	if (!user && !loading) return <h1>User not found</h1>;


  return (
    <>
    <UserHeader user={user} />
    {!fetchingPosts && posts.length === 0 && <h1>User has not posts.</h1>}
			{fetchingPosts && (
				<Flex justifyContent={"center"} my={12}>
					<Spinner size={"xl"} />
				</Flex>
			)}

			{posts.map((post) => (
				<Post key={post._id} post={post} postedBy={post.postedBy} />
			))}
    {/* <UserPost likes={1200} replies={1056} postImg="/db-super.jpg" postTitle="never ever give up" />
    <UserPost likes={500} replies={225} postImg="/aot.jpg" postTitle="change is the only thing that does't change" />
    <UserPost likes={700} replies={654} postImg="/dr.stone.jpg" postTitle="Science is like a 🌊" />
    <UserPost likes={960} replies={745} postImg="/img3.png" postTitle="beauty of nature." />
    <UserPost likes={450} replies={5285} postImg="/zero.jpg" postTitle="darling in the franxx" /> */}
    </>
  )
}

export default Userpage
