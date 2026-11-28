import { Avatar } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiGrid } from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import useFollowUnfollow from "../hooks/useFollowUnfollow";
import { useAppValue } from "../state/store";
import userAtom from "../atom/userAtom";
import "./SearchExplore.css";

function SearchProfileContent({ profile, posts, onFollow, following, updating, loadingPosts, error, onRetry, cursor, onLoadMore }) {
    const currentUser = useAppValue(userAtom);
    const ownProfile = currentUser?._id === profile._id;
    const initiallyFollowing = (profile.followers || []).some((id) => String(id) === String(currentUser?._id));
    const followerCount = Math.max(
        0,
        (profile.followers?.length || 0) + Number(following && !initiallyFollowing) - Number(!following && initiallyFollowing),
    );

    return (
        <>
            <section className="search-profile-overview">
                <div className="search-profile-avatar-wrap">
                    <Avatar
                        name={profile.fullName || profile.username}
                        src={profile.profileImg}
                        className="search-profile-avatar"
                    />
                </div>
                <div className="search-profile-summary">
                    <h1>{profile.fullName || profile.username}</h1>
                    <p className="search-profile-handle">@{profile.username}</p>
                    <div className="search-profile-stats">
                        <span><strong>{profile.postsCount ?? posts.length}</strong> posts</span>
                        <span><strong>{followerCount}</strong> followers</span>
                        <span><strong>{profile.following?.length ?? 0}</strong> following</span>
                    </div>
                    <div className="search-profile-actions">
                        {ownProfile ? (
                            <Link className="search-profile-edit" to="/update">Edit profile</Link>
                        ) : (
                            <button
                                type="button"
                                className={`search-profile-follow${following ? " is-following" : ""}`}
                                onClick={onFollow}
                                disabled={updating}
                                aria-pressed={following}
                            >
                                {updating ? "Please wait…" : following ? "Following" : "Follow"}
                            </button>
                        )}
                        {profile.mutuals?.length > 0 && (
                            <span className="search-profile-mutuals" aria-label={`${profile.mutuals.length} mutual followers`}>
                                {profile.mutuals.slice(0, 3).map((person) => (
                                    <Avatar
                                        key={person._id}
                                        name={person.fullName || person.username}
                                        src={person.profileImg}
                                        size="xs"
                                    />
                                ))}
                                <span>Followed by {profile.mutuals[0].username}</span>
                            </span>
                        )}
                    </div>
                    {profile.bio && <p className="search-profile-bio">{profile.bio}</p>}
                </div>
            </section>

            <section className="search-profile-posts" aria-label="Posts">
                <div className="search-profile-posts-heading">
                    <FiGrid aria-hidden="true" />
                    <span>Posts</span>
                </div>
                {error ? (
                    <div className="search-profile-state" role="alert">
                        <p>{error}</p>
                        <button type="button" onClick={onRetry}>Retry</button>
                    </div>
                ) : (
                    <div className="search-profile-grid">
                        {posts.map((post) => {
                            const media = post.media?.[0] || (post.imageUrl ? { type: "image", url: post.imageUrl } : null);
                            if (!media?.url) return null;
                            return (
                                <Link
                                    className="search-profile-tile"
                                    key={post._id}
                                    to={`/${encodeURIComponent(profile.username)}/post/${post._id}`}
                                    aria-label={`Open post by ${profile.username}`}
                                >
                                    {media.type === "video" ? (
                                        <video src={media.url} muted playsInline preload="metadata" aria-hidden="true" />
                                    ) : (
                                        <img src={media.url} alt="" loading="lazy" />
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                )}
                {loadingPosts && <p className="search-profile-loading" aria-live="polite">Loading posts…</p>}
                {!loadingPosts && !error && posts.length === 0 && (
                    <p className="search-profile-state">No posts yet.</p>
                )}
                {cursor && (
                    <button className="search-profile-load-more" type="button" onClick={onLoadMore} disabled={loadingPosts}>
                        Load more
                    </button>
                )}
            </section>
        </>
    );
}

export default function SearchProfileScreen() {
    const { username = "" } = useParams();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [posts, setPosts] = useState([]);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [error, setError] = useState("");
    const [cursor, setCursor] = useState("");
    const [retry, setRetry] = useState(0);
    const requestRef = useRef(null);
    const { handleFollowUnfollow, following, updating } = useFollowUnfollow(profile || { _id: "" });

    useEffect(() => () => requestRef.current?.abort(), []);

    useEffect(() => {
        const controller = new AbortController();
        setProfile(null);
        setPosts([]);
        setCursor("");
        setLoadingProfile(true);
        setLoadingPosts(true);
        setError("");

        Promise.all([
            apiFetch(`/api/users/profile/${encodeURIComponent(username)}`, { signal: controller.signal })
                .then(async (response) => {
                    const data = await readApiJson(response);
                    if (!response.ok) throw new Error(data.error || "Profile could not be loaded.");
                    setProfile(data);
                }),
            apiFetch(`/api/posts/user/${encodeURIComponent(username)}`, { signal: controller.signal })
                .then(async (response) => {
                    const data = await readApiJson(response);
                    if (!response.ok) throw new Error(data.error || "Posts could not be loaded.");
                    const page = Array.isArray(data) ? data : [];
                    setPosts(page);
                    setCursor(response.headers.get("X-Next-Cursor") || "");
                    setLoadingPosts(false);
                })
                .catch((fetchError) => {
                    if (fetchError.name !== "AbortError") {
                        setError(fetchError.message || "Posts could not be loaded.");
                        setLoadingPosts(false);
                    }
                }),
        ])
            .catch((fetchError) => {
                if (fetchError.name !== "AbortError") setError(fetchError.message || "Profile could not be loaded.");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingProfile(false);
            });

        return () => controller.abort();
    }, [retry, username]);

    const loadMore = useCallback(async () => {
        if (!cursor || requestRef.current) return;
        const controller = new AbortController();
        requestRef.current = controller;
        setLoadingPosts(true);
        setError("");
        try {
            const response = await apiFetch(
                `/api/posts/user/${encodeURIComponent(username)}?before=${encodeURIComponent(cursor)}`,
                { signal: controller.signal },
            );
            const data = await readApiJson(response);
            if (!response.ok) throw new Error(data.error || "More posts could not be loaded.");
            const nextPage = Array.isArray(data) ? data : [];
            setPosts((current) => [...current, ...nextPage]);
            setCursor(response.headers.get("X-Next-Cursor") || "");
        } catch (fetchError) {
            if (fetchError.name !== "AbortError") setError(fetchError.message || "More posts could not be loaded.");
        } finally {
            if (requestRef.current === controller) requestRef.current = null;
            setLoadingPosts(false);
        }
    }, [cursor, username]);

    function goBack() {
        navigate(-1);
    }

    if (loadingProfile) {
        return <main className="search-profile-shell"><p className="search-profile-loading">Loading profile…</p></main>;
    }
    if (!profile) {
        return (
            <main className="search-profile-shell">
                <header className="search-profile-toolbar">
                    <button type="button" onClick={goBack} aria-label="Back"><FiArrowLeft /></button>
                    <h1>Profile</h1>
                </header>
                <p className="search-profile-state" role="alert">{error || "Profile not found."}</p>
            </main>
        );
    }

    return (
        <main className="search-profile-shell">
            <header className="search-profile-toolbar">
                <button type="button" onClick={goBack} aria-label="Back"><FiArrowLeft /></button>
                <h1>{profile.username}</h1>
                {profile.isVerified && <span className="search-profile-verified" aria-label="Verified account">✓</span>}
            </header>
            <SearchProfileContent
                profile={profile}
                posts={posts}
                onFollow={handleFollowUnfollow}
                following={following}
                updating={updating}
                loadingPosts={loadingPosts}
                error={error}
                onRetry={() => setRetry((current) => current + 1)}
                cursor={cursor}
                onLoadMore={loadMore}
            />
        </main>
    );
}
