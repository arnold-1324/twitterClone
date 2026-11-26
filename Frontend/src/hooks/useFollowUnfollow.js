import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import { useState } from "react";
import { useRecoilState } from "recoil";
import useShowToast from "./useShowToast";
import userAtom from "../atom/userAtom";

export default function useFollowUnfollow(user) {
  const [currentUser, setUser] = useRecoilState(userAtom);
  const following = Boolean(currentUser?.following?.includes(user._id));
  const [updating, setUpdating] = useState(false);
  const showToast = useShowToast();

  async function handleFollowUnfollow() {
    if (!currentUser || updating) return;
    setUpdating(true);
    try {
      const response = await apiFetch(`/api/users/follow/${user._id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ following: !following }),
      });
      const result = await readApiJson(response);
      if (!response.ok) throw new Error(result.error || "Failed to update follow status.");
      setUser((account) => {
        if (account?._id !== currentUser._id) return account;
        const ids = new Set(account.following ?? []);
        if (result.following) ids.add(user._id);
        else ids.delete(user._id);
        return { ...account, following: [...ids] };
      });
    } catch (error) {
      showToast("Could not update follow status", error.message, "error");
    } finally {
      setUpdating(false);
    }
  }

  return { handleFollowUnfollow, updating, following };
}
