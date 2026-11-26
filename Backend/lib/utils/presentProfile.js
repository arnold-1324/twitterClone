import { mediaUrl } from "../mediaStore.js";

export async function presentProfile(user) {
  const profile = user.toObject ? user.toObject() : { ...user };
  const image = profile.profileImg;
  if (image && !/^https?:\/\//i.test(image)) {
    profile.profileImg = await mediaUrl(image);
  }
  return profile;
}
