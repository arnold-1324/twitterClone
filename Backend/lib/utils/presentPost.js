import { mediaUrl, streamUrl } from "../mediaStore.js";
import { presentProfile } from "./presentProfile.js";
import { resolveContentReference } from "../contentReference.js";

export const presentPost = async (post, { includeStory = true } = {}) => {
    const postData = post.toObject
        ? post.toObject()
        : { ...post };

    if (postData.postedBy?.username) postData.postedBy = await presentProfile(postData.postedBy);
    const likes = Array.isArray(postData.likes) ? postData.likes : [];
    postData.likes = await Promise.all(likes.map((like) => like?.username ? presentProfile(like) : like));
    const media = Array.isArray(postData.media) && postData.media.length ? postData.media.filter(Boolean)
        : postData.images ? [{ type: "image", key: postData.images }] : [];
    const canResolve = postData.sharedContent && (postData.sharedContent.type !== "story" || includeStory);
    const source = canResolve && await resolveContentReference(postData.sharedContent);
    if (postData.sharedContent) {
        postData.sharedContent = source ? {
            type: source.type, id: source.id, kind: source.kind, username: source.username, caption: source.caption, expiresAt: source.expiresAt,
        } : { unavailable: true };
    }
    postData.media = source?.media ?? await Promise.all(media.map(async ({ type, key, credit }) => ({
        type, url: await mediaUrl(key), ...(type === "video" && { streamUrl: streamUrl(key) }),
        ...(credit?.source && { credit }),
    })));
    postData.media = postData.media.filter(({ url }) => url);
    const replies = Array.isArray(postData.replies) ? postData.replies.filter(Boolean) : [];
    postData.replies = await Promise.all(replies.map(async ({ mediaKey, ...reply }) => ({
            ...reply, profileImg: await mediaUrl(reply.profileImg), ...(mediaKey && { mediaUrl: await mediaUrl(mediaKey) }),
    })));
    postData.imageUrl = postData.media.find(({ type }) => type === "image")?.url ?? null;

    return postData;
};
