export function isAppOwner(user) {
  const id = process.env.MUSIC_ADMIN_USER_ID;
  return /^[a-f0-9]{24}$/.test(id ?? "") && String(user?._id) === id && !user.isFrozen;
}
