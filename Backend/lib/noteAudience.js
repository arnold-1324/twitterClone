export function canSeeNote(viewer, author) {
  const id = String(author);
  return String(viewer._id) === id || (
    viewer.following?.some((user) => String(user) === id)
      && viewer.followers?.some((user) => String(user) === id)
  );
}
