export default function TypingIndicator({ usernames = [] }) {
  if (!usernames.length) return null;
  return (
    <div className="typing-cat">
      <img src="/kitten.png" alt="" />
      <span>{usernames.join(", ")} {usernames.length === 1 ? "is" : "are"} typing</span>
      <span className="typing-cat-dots" aria-hidden="true">•••</span>
    </div>
  );
}
