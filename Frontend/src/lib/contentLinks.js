export function contentLink({ type, id, username }) {
  return type === "story" ? `/stories/${encodeURIComponent(username)}?story=${id}`
    : `/${encodeURIComponent(username)}/post/${id}`;
}
