import { apiFetch } from "./apiFetch";
import { prefetchEphemeral, storyProfilePath } from "./ephemeralCache";

const warmed = new Map();

export const canPreloadMedia = () => !navigator.connection?.saveData
  && !["slow-2g", "2g"].includes(navigator.connection?.effectiveType);

export function preloadStoryMedia(viewer, story) {
  const asset = story?.sharedContent?.media?.[0] ?? story;
  if (!viewer || !asset?.url || !canPreloadMedia()) return;
  const now = Date.now();
  const until = Math.min(Date.parse(story.expiresAt), now + 60000);
  if (!(until > now)) return;
  const key = `${viewer}:${asset.url}`;
  if (warmed.get(key) > now) return;
  for (const [candidate, expiry] of warmed) {
    if (expiry <= now || warmed.size >= 24) warmed.delete(candidate);
    else break;
  }
  warmed.set(key, until);
  const retryable = () => {
    if (warmed.get(key) === until) warmed.delete(key);
  };

  if ((asset.type ?? story.kind) === "image") {
    const image = new Image();
    image.fetchPriority = "low";
    image.onerror = retryable;
    image.src = asset.url;
  } else if (asset.streamUrl) {
    // The adaptive player can reuse the manifest. Let it choose the rendition and download segments.
    void apiFetch(asset.streamUrl, { priority: "low" }).then((response) => {
      if (!response.ok) throw new Error("Could not preload the story manifest.");
      return response.text();
    }).catch(retryable);
    void import("hls.js/light").catch(() => {});
  } else {
    const video = document.createElement("video");
    video.preload = "metadata";
    const release = () => {
      clearTimeout(timeout);
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
    };
    const timeout = setTimeout(release, 8000);
    video.onloadedmetadata = release;
    video.onerror = () => { retryable(); release(); };
    video.src = asset.url;
  }
}

export async function preloadStoryProfile(viewer, username) {
  const data = await prefetchEphemeral(viewer, storyProfilePath(username));
  const active = data?.stories.filter(({ expiresAt }) => Date.parse(expiresAt) > Date.now());
  const story = active?.find(({ seen }) => !seen) ?? active?.[0];
  preloadStoryMedia(viewer, story);
}
