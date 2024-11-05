import { useEffect, useState } from "react";
import useShowToast from "./useShowToast";
import userAtom from "../atom/userAtom";
import { useRecoilValue } from "recoil";

const useFollowUnfollow = (user) => {
  const currentUser = useRecoilValue(userAtom);
  const [following, setFollowing] = useState(user.followers.includes(currentUser?._id));
  const [updating, setUpdating] = useState(false);
  const showToast = useShowToast();

  useEffect(() => {
   
    setFollowing(user.followers.includes(currentUser?._id));
  }, [user, currentUser]);

  const handleFollowUnfollow = async () => {
    if (!currentUser) {
      showToast("Error", "Please log in to follow", "error");
      return;
    }
    if (updating) return;

    setUpdating(true);
    try {
      const res = await fetch(`api/users/follow/${user._id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update follow status");
      }

      const data = await res.json();

      if (following) {
        showToast("Success", `Unfollowed ${user.name}`, "success");
        setFollowing(false);
      } else {
        showToast("Success", `Followed ${user.name}`, "success");
        setFollowing(true);
      }

     
      const updatedFollowers = following
        ? user.followers.filter(follower => follower !== currentUser?._id)
        : [...user.followers, currentUser?._id];

      

      console.log(data);
    } catch (error) {
      showToast("Error", error.message || "An unexpected error occurred", "error");
    } finally {
      setUpdating(false);
    }
  };

  return { handleFollowUnfollow, updating, following };
};

export default useFollowUnfollow;
