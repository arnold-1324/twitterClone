import { mediaUrl, streamUrl } from "../mediaStore.js";
import { presentProfile } from "./presentProfile.js";

export const presentPost = async (post) => {
    const postData = post.toObject
        ? post.toObject()
        : { ...post };

    if (postData.postedBy?.username) postData.postedBy = await presentProfile(postData.postedBy);
    if (Array.isArray(postData.likes)) {
        postData.likes = await Promise.all(postData.likes.map((like) => like?.username ? presentProfile(like) : like));
    }
    const media = postData.media?.length ? postData.media
        : postData.images ? [{ type: "image", key: postData.images }] : [];
    postData.media = await Promise.all(media.map(async ({ type, key }) => ({
        type, url: await mediaUrl(key), ...(type === "video" && { streamUrl: streamUrl(key) }),
    })));
    postData.media = postData.media.filter(({ url }) => url);
    if (postData.replies?.length) {
        postData.replies = await Promise.all(postData.replies.map(async (reply) => ({
            ...reply, profileImg: await mediaUrl(reply.profileImg),
        })));
    }
    postData.imageUrl = postData.media.find(({ type }) => type === "image")?.url ?? null;

    return postData;
};
