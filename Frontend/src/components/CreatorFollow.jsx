import { useAppValue } from "../state/store";
import userAtom from "../atom/userAtom";
import useFollowUnfollow from "../hooks/useFollowUnfollow";

export default function CreatorFollow({ creator }) {
  const viewer = useAppValue(userAtom);
  const { following, updating, handleFollowUnfollow } = useFollowUnfollow(creator);
  if (!viewer || !creator._id || viewer._id === creator._id) return null;
  return <button className="stream-follow" type="button" disabled={updating} aria-pressed={following}
    onClick={handleFollowUnfollow}>{following ? "Following" : "Follow"}</button>;
}
