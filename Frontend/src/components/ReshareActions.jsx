import { useState } from "react";
import { Button } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { useAppValue } from "../state/store";
import userAtom from "../atom/userAtom";
import { invalidateStories } from "../lib/ephemeralCache";
import StoryComposer from "./StoryComposer";

export default function ReshareActions({ source, onNavigate }) {
  const [addStory, setAddStory] = useState(false);
  const navigate = useNavigate();
  const user = useAppValue(userAtom);
  if (!user || !source?.id || !source?.username) return null;
  function post(reel) {
    onNavigate?.();
    navigate(reel ? "/create?type=reel" : "/create", { state: { source } });
  }

  return <div className="reshare-actions">
    <Button size="xs" variant="outline" onClick={() => setAddStory(true)}>Add to my story</Button>
    <Button size="xs" variant="outline" onClick={() => post(false)}>Share as a post</Button>
    {source.video && <Button size="xs" variant="outline" onClick={() => post(true)}>Share as a reel</Button>}
    {addStory && <StoryComposer user={user} source={source} onPublished={() => {
      invalidateStories(user._id, user.username);
      setAddStory(false);
    }} onClose={() => setAddStory(false)} />}
  </div>;
}
