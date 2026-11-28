import { Avatar } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiBookmark, FiEye, FiPlay, FiSearch, FiX } from "react-icons/fi";
import { Link, useLocation, useNavigate, useNavigationType, useSearchParams } from "react-router-dom";
import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import { useAppValue } from "../state/store";
import userAtom from "../atom/userAtom";
import "./SearchExplore.css";

const searchSnapshots = new Map();
const exploreSnapshots = new Map();
const activeVideos = new Set();
const SNAPSHOT_TTL = 3 * 60 * 1000;
const SEARCH_CACHE_LIMIT = 24;
const EXPLORE_CACHE_LIMIT = 4;

function searchKey(userId, query) {
    return `${userId || "anonymous"}:${query}`;
}

function readSnapshot(cache, key) {
    const snapshot = cache.get(key);
    if (!snapshot || Date.now() - snapshot.updatedAt > SNAPSHOT_TTL) {
        cache.delete(key);
        return null;
    }
    return snapshot;
}

function saveSearchSnapshot(key, patch) {
    const existing = readSnapshot(searchSnapshots, key) || {
        accounts: [],
        topics: [],
        accountsLoaded: false,
        topicsLoaded: false,
        scrollTop: 0,
    };
    searchSnapshots.delete(key);
    searchSnapshots.set(key, { ...existing, ...patch, updatedAt: Date.now() });
    while (searchSnapshots.size > SEARCH_CACHE_LIMIT) {
        searchSnapshots.delete(searchSnapshots.keys().next().value);
    }
}

function saveExploreSnapshot(key, snapshot) {
    exploreSnapshots.delete(key);
    exploreSnapshots.set(key, { ...snapshot, updatedAt: Date.now() });
    while (exploreSnapshots.size > EXPLORE_CACHE_LIMIT) {
        exploreSnapshots.delete(exploreSnapshots.keys().next().value);
    }
}

function formatCount(value = 0) {
    return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function SearchSkeletonRows() {
    return (
        <div className="search-skeleton-list" aria-label="Loading search suggestions" aria-busy="true">
            {Array.from({ length: 5 }, (_, index) => (
                <div className="search-skeleton-row" key={index}>
                    <span className="search-skeleton-avatar" />
                    <span className="search-skeleton-copy">
                        <span />
                        <span />
                    </span>
                </div>
            ))}
        </div>
    );
}

function AccountSuggestion({ account, onSelect }) {
    return (
        <button className="search-suggestion-row" type="button" onClick={() => onSelect(account)}>
            <Avatar
                className="search-suggestion-avatar"
                name={account.fullName || account.username}
                src={account.profileImg}
                size="md"
            />
            <span className="search-suggestion-copy">
                <span className="search-suggestion-title">
                    @{account.username}
                    {account.isVerified && <span className="search-verified-mark" aria-label="Verified account"> ✓</span>}
                </span>
                <span className="search-suggestion-subtitle">{account.fullName || "Account"}</span>
            </span>
            <span className="search-account-stats">{formatCount(account.followersCount)} followers</span>
        </button>
    );
}

function TopicSuggestion({ topic, onSelect }) {
    return (
        <button className="search-suggestion-row search-topic-row" type="button" onClick={() => onSelect(topic.topic)}>
            <span className="search-topic-icon">#</span>
            <span className="search-suggestion-copy">
                <span className="search-suggestion-title">#{topic.topic}</span>
                <span className="search-suggestion-subtitle">{formatCount(topic.postCount)} posts</span>
            </span>
        </button>
    );
}

function ExploreTile({ post }) {
    const videoRef = useRef(null);
    const tileRef = useRef(null);
    const media = post.media?.[0] || (post.imageUrl ? { type: "image", url: post.imageUrl } : null);
    const author = post.postedBy?.username;
    const route = author
        ? `/${encodeURIComponent(author)}/post/${post._id}`
        : "/discover";
    const label = `${media?.type === "video" ? "Video" : "Photo"} post by ${author || "an account"}`;

    useEffect(() => {
        const video = videoRef.current;
        const tile = tileRef.current;
        if (
            !video ||
            !tile ||
            typeof IntersectionObserver === "undefined" ||
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) return undefined;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && activeVideos.size < 2) {
                activeVideos.add(video);
                video.play().catch(() => activeVideos.delete(video));
            } else {
                video.pause();
                activeVideos.delete(video);
            }
        }, { threshold: 0.6 });

        observer.observe(tile);
        return () => {
            observer.disconnect();
            video.pause();
            activeVideos.delete(video);
        };
    }, []);

    if (!media?.url) return null;

    return (
        <Link className="explore-tile" to={route} state={{ fromExplore: true }} aria-label={label} ref={tileRef}>
            {media.type === "video" ? (
                <>
                    <video
                        ref={videoRef}
                        src={media.url}
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        aria-hidden="true"
                    />
                    <span className="explore-video-indicator" aria-hidden="true"><FiPlay /></span>
                </>
            ) : (
                <img src={media.url} alt="" loading="lazy" />
            )}
            {post.viewCount > 0 && (
                <span className="explore-view-count"><FiEye aria-hidden="true" /> {formatCount(post.viewCount)}</span>
            )}
        </Link>
    );
}

function ExploreSkeleton() {
    return (
        <div className="explore-grid explore-skeleton-grid" aria-label="Loading explore posts" aria-busy="true">
            {Array.from({ length: 12 }, (_, index) => <span className="explore-skeleton-tile" key={index} />)}
        </div>
    );
}

export default function SearchPage() {
    const [params, setParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const navigationType = useNavigationType();
    const user = useAppValue(userAtom);
    const userId = user?._id || user?.id || "anonymous";
    const query = params.get("q") || "";
    const normalizedQuery = query.trim().normalize("NFKC");
    const isFocused = params.get("focus") === "1";
    const normalizedSearch = normalizedQuery.toLocaleLowerCase();
    const currentSearchKey = searchKey(userId, normalizedSearch);
    const exploreKey = String(userId);

    const inputRef = useRef(null);
    const resultsRef = useRef(null);
    const exploreScrollRef = useRef(null);
    const sentinelRef = useRef(null);
    const requestRef = useRef(null);
    const [accounts, setAccounts] = useState([]);
    const [topics, setTopics] = useState([]);
    const [accountsLoading, setAccountsLoading] = useState(false);
    const [topicsLoading, setTopicsLoading] = useState(false);
    const [accountError, setAccountError] = useState("");
    const [topicError, setTopicError] = useState("");
    const [searchRetry, setSearchRetry] = useState(0);
    const [posts, setPosts] = useState([]);
    const [cursor, setCursor] = useState("");
    const [exploreLoading, setExploreLoading] = useState(false);
    const [exploreError, setExploreError] = useState("");
    const [exploreHasLoaded, setExploreHasLoaded] = useState(false);
    const [feedRetry, setFeedRetry] = useState(0);

    useEffect(() => {
        if (!isFocused || !location.state?.openedFromExplore || navigationType !== "PUSH") return;
        requestAnimationFrame(() => inputRef.current?.focus());
    }, [isFocused, location.state, navigationType]);

    useEffect(() => {
        if (!isFocused) return;
        const snapshot = readSnapshot(searchSnapshots, currentSearchKey);
        if (!snapshot) return;
        requestAnimationFrame(() => {
            if (resultsRef.current) resultsRef.current.scrollTop = snapshot.scrollTop || 0;
        });
    }, [currentSearchKey, isFocused, navigationType]);

    useEffect(() => {
        if (isFocused || !exploreHasLoaded) return;
        const snapshot = readSnapshot(exploreSnapshots, exploreKey);
        if (!snapshot) return;
        requestAnimationFrame(() => {
            if (exploreScrollRef.current) exploreScrollRef.current.scrollTop = snapshot.scrollTop || 0;
        });
    }, [exploreHasLoaded, exploreKey, isFocused, navigationType]);

    useEffect(() => {
        if (!isFocused || !normalizedSearch) {
            setAccounts([]);
            setTopics([]);
            setAccountsLoading(false);
            setTopicsLoading(false);
            setAccountError("");
            setTopicError("");
            return undefined;
        }

        const accountTerm = normalizedQuery.replace(/^@/, "");
        const topicTerm = normalizedQuery.replace(/^#/, "");
        const canSearchAccounts = /^[a-zA-Z0-9_]{2,24}$/.test(accountTerm);
        const canSearchTopics = /^[\p{L}\p{N}_]{1,32}$/u.test(topicTerm);
        const cached = readSnapshot(searchSnapshots, currentSearchKey);
        const hasCachedAccounts = !canSearchAccounts || Boolean(cached?.accountsLoaded);
        const hasCachedTopics = !canSearchTopics || Boolean(cached?.topicsLoaded);
        if (cached) {
            setAccounts(cached.accounts || []);
            setTopics(cached.topics || []);
        } else {
            setAccounts([]);
            setTopics([]);
        }
        setAccountsLoading(canSearchAccounts && !hasCachedAccounts);
        setTopicsLoading(canSearchTopics && !hasCachedTopics);
        setAccountError("");
        setTopicError("");
        if (hasCachedAccounts && hasCachedTopics) return undefined;

        const controller = new AbortController();

        const timer = window.setTimeout(() => {
            if (canSearchAccounts && !hasCachedAccounts) {
                apiFetch(`/api/users/search?q=${encodeURIComponent(accountTerm)}`, { signal: controller.signal })
                    .then(async (response) => {
                        const data = await readApiJson(response);
                        if (!response.ok) throw new Error(data.error || "Could not load accounts.");
                        return data;
                    })
                    .then((data) => {
                        const nextAccounts = Array.isArray(data) ? data : [];
                        setAccounts(nextAccounts);
                        setAccountsLoading(false);
                        saveSearchSnapshot(currentSearchKey, {
                            accounts: nextAccounts,
                            accountsLoaded: true,
                        });
                    })
                    .catch((error) => {
                        if (error.name === "AbortError") return;
                        setAccountError("Could not load accounts. Try again.");
                        setAccountsLoading(false);
                    });
            }

            if (canSearchTopics && !hasCachedTopics) {
                apiFetch(`/api/posts/search-topics?q=${encodeURIComponent(topicTerm)}`, { signal: controller.signal })
                    .then(async (response) => {
                        const data = await readApiJson(response);
                        if (!response.ok) throw new Error(data.error || "Could not load topics.");
                        return data;
                    })
                    .then((data) => {
                        const nextTopics = Array.isArray(data) ? data : [];
                        setTopics(nextTopics);
                        setTopicsLoading(false);
                        saveSearchSnapshot(currentSearchKey, {
                            topics: nextTopics,
                            topicsLoaded: true,
                            accountsLoaded: !canSearchAccounts || Boolean(cached?.accountsLoaded),
                        });
                    })
                    .catch((error) => {
                        if (error.name === "AbortError") return;
                        setTopicError("Could not load topics. Try again.");
                        setTopicsLoading(false);
                    });
            } else if (!canSearchTopics) {
                saveSearchSnapshot(currentSearchKey, { topicsLoaded: true });
            }
        }, 220);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [currentSearchKey, isFocused, normalizedQuery, normalizedSearch, searchRetry]);

    useEffect(() => {
        if (isFocused) return undefined;
        const cached = readSnapshot(exploreSnapshots, exploreKey);
        if (cached) {
            setPosts(cached.posts || []);
            setCursor(cached.cursor || "");
            setExploreHasLoaded(true);
            setExploreLoading(false);
            setExploreError("");
            return undefined;
        }

        const controller = new AbortController();
        requestRef.current = controller;
        setPosts([]);
        setCursor("");
        setExploreLoading(true);
        setExploreHasLoaded(false);
        setExploreError("");

        apiFetch("/api/posts/discover", { signal: controller.signal })
            .then(async (response) => {
                const nextPosts = await readApiJson(response);
                if (!response.ok) throw new Error(nextPosts.error || "Explore posts could not be loaded.");
                const nextCursor = response.headers.get("X-Next-Cursor") || "";
                setPosts(Array.isArray(nextPosts) ? nextPosts : []);
                setCursor(nextCursor);
                setExploreHasLoaded(true);
                saveExploreSnapshot(exploreKey, {
                    posts: Array.isArray(nextPosts) ? nextPosts : [],
                    cursor: nextCursor,
                    scrollTop: 0,
                });
            })
            .catch((error) => {
                if (error.name === "AbortError") return;
                setExploreError("Explore posts could not be loaded.");
                setExploreHasLoaded(true);
            })
            .finally(() => {
                if (requestRef.current === controller) requestRef.current = null;
                setExploreLoading(false);
            });

        return () => {
            controller.abort();
            if (requestRef.current === controller) requestRef.current = null;
        };
    }, [exploreKey, feedRetry, isFocused]);

    const loadMore = useCallback(async () => {
        if (!cursor || requestRef.current || isFocused) return;
        const controller = new AbortController();
        requestRef.current = controller;
        setExploreLoading(true);
        setExploreError("");

        try {
            const response = await apiFetch(`/api/posts/discover?before=${encodeURIComponent(cursor)}`, {
                signal: controller.signal,
            });
            const nextPage = await readApiJson(response);
            if (!response.ok) throw new Error(nextPage.error || "More posts could not be loaded.");
            const nextCursor = response.headers.get("X-Next-Cursor") || "";
            const nextPosts = [...posts, ...(Array.isArray(nextPage) ? nextPage : [])];
            setPosts(nextPosts);
            setCursor(nextCursor);
            saveExploreSnapshot(exploreKey, {
                posts: nextPosts,
                cursor: nextCursor,
                scrollTop: exploreScrollRef.current?.scrollTop || 0,
            });
        } catch (error) {
            if (error.name !== "AbortError") setExploreError("More posts could not be loaded. Scroll to retry.");
        } finally {
            if (requestRef.current === controller) requestRef.current = null;
            setExploreLoading(false);
        }
    }, [cursor, exploreKey, isFocused, posts]);

    useEffect(() => {
        const root = exploreScrollRef.current;
        const sentinel = sentinelRef.current;
        if (isFocused || !root || !sentinel || !cursor || typeof IntersectionObserver === "undefined") return undefined;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !exploreError) loadMore();
        }, { root, rootMargin: "320px" });
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [cursor, exploreError, isFocused, loadMore]);

    function updateQuery(value) {
        const next = new URLSearchParams(location.search);
        next.set("focus", "1");
        if (value) next.set("q", value);
        else next.delete("q");
        setParams(next, { replace: true });
    }

    function leaveSearch() {
        if (location.state?.openedFromExplore) navigate(-1);
        else navigate("/search", { replace: true });
    }

    function selectAccount(account) {
        const currentScrollTop = resultsRef.current?.scrollTop || 0;
        saveSearchSnapshot(currentSearchKey, { accounts, topics, scrollTop: currentScrollTop });
        const returnTo = `${location.pathname}${location.search}`;
        navigate(`/${encodeURIComponent(account.username)}`, {
            state: {
                fromSearch: true,
                fromExplore: true,
                returnTo,
                returnScrollTop: currentScrollTop,
                exploreScrollTop: exploreScrollRef.current?.scrollTop || 0,
            },
        });
    }

    function selectTopic(topic) {
        navigate(`/discover?topic=${encodeURIComponent(topic)}`, {
            state: { fromSearch: true, searchQuery: normalizedQuery },
        });
    }

    function handleExploreScroll(event) {
        saveExploreSnapshot(exploreKey, {
            posts,
            cursor,
            scrollTop: event.currentTarget.scrollTop,
        });
    }

    function handleSearchScroll(event) {
        saveSearchSnapshot(currentSearchKey, {
            accounts,
            topics,
            scrollTop: event.currentTarget.scrollTop,
        });
    }

    function handleSubmit(event) {
        event.preventDefault();
        const term = normalizedQuery.replace(/^#/, "");
        if (!/^[\p{L}\p{N}_]{1,32}$/u.test(term)) return;
        navigate(`/discover?topic=${encodeURIComponent(term)}`, {
            state: { fromSearch: true, searchQuery: normalizedQuery },
        });
    }

    function handleInputKeyDown(event) {
        if (event.key === "Escape") {
            event.preventDefault();
            if (query) updateQuery("");
            else leaveSearch();
        }
    }

    const primaryAccounts = accounts.slice(0, 2);
    const moreAccounts = accounts.slice(2);
    const mediaPosts = posts.filter((post) => post.media?.[0]?.url || post.imageUrl);
    const hasSuggestions = primaryAccounts.length > 0 || topics.length > 0 || moreAccounts.length > 0;

    return (
        <main className={`search-explore-shell${isFocused ? " search-explore-focused" : ""}`}>
            {isFocused ? (
                <>
                    <header className="search-focused-header">
                        <button className="search-back-button" type="button" onClick={leaveSearch} aria-label="Back to Explore">
                            <FiArrowLeft />
                        </button>
                        <form className="search-input-form" onSubmit={handleSubmit} role="search">
                            <label className="sr-only" htmlFor="search-explore-input">Search accounts and topics</label>
                            <FiSearch className="search-field-icon" aria-hidden="true" />
                            <input
                                id="search-explore-input"
                                ref={inputRef}
                                type="search"
                                value={query}
                                onChange={(event) => updateQuery(event.target.value)}
                                onKeyDown={handleInputKeyDown}
                                placeholder="Search"
                                autoComplete="off"
                                aria-controls="search-suggestions"
                                aria-expanded={Boolean(normalizedSearch)}
                            />
                            {query && (
                                <button
                                    className="search-clear-button"
                                    type="button"
                                    onClick={() => {
                                        updateQuery("");
                                        inputRef.current?.focus();
                                    }}
                                    aria-label="Clear search"
                                >
                                    <FiX />
                                </button>
                            )}
                        </form>
                        <button
                            className="search-submit-button"
                            type="button"
                            onClick={handleSubmit}
                            aria-label="Show search results"
                            disabled={!normalizedQuery}
                        >
                            Search
                        </button>
                    </header>

                    <section
                        className="search-suggestions-panel"
                        id="search-suggestions"
                        ref={resultsRef}
                        onScroll={handleSearchScroll}
                        aria-live="polite"
                    >
                        {!normalizedSearch ? (
                            <div className="search-empty-prompt">
                                <FiSearch aria-hidden="true" />
                                <p>Search for people and topics</p>
                            </div>
                        ) : (
                            <>
                                {primaryAccounts.map((account) => (
                                    <AccountSuggestion key={account._id} account={account} onSelect={selectAccount} />
                                ))}
                                {accountError && (
                                    <p className="search-inline-error" role="alert">
                                        {accountError}
                                        <button type="button" onClick={() => setSearchRetry((retry) => retry + 1)}>Retry</button>
                                    </p>
                                )}
                                {topicError && (
                                    <p className="search-inline-error" role="alert">
                                        {topicError}
                                        <button type="button" onClick={() => setSearchRetry((retry) => retry + 1)}>Retry</button>
                                    </p>
                                )}
                                {topics.map((topic) => (
                                    <TopicSuggestion key={topic.topic} topic={topic} onSelect={selectTopic} />
                                ))}
                                {(accountsLoading || topicsLoading) && <SearchSkeletonRows />}
                                {moreAccounts.map((account) => (
                                    <AccountSuggestion key={account._id} account={account} onSelect={selectAccount} />
                                ))}
                                {!accountsLoading && !topicsLoading && !hasSuggestions && !accountError && !topicError && (
                                    <p className="search-no-results">No results found.</p>
                                )}
                            </>
                        )}
                    </section>
                </>
            ) : (
                <>
                    <div className="explore-topbar">
                        <button
                            type="button"
                            className="explore-search-launch"
                            onClick={() => navigate("/search?focus=1", { state: { openedFromExplore: true } })}
                            aria-label="Search"
                        >
                            <FiSearch aria-hidden="true" />
                            <span>Search</span>
                        </button>
                        <Link className="explore-saved-link" to="/saved" aria-label="Saved posts">
                            <FiBookmark />
                        </Link>
                    </div>
                    <div className="explore-scroll-area" ref={exploreScrollRef} onScroll={handleExploreScroll}>
                        {exploreLoading && !exploreHasLoaded ? (
                            <ExploreSkeleton />
                        ) : (
                            <div className="explore-grid">
                                {mediaPosts.map((post) => <ExploreTile key={post._id} post={post} />)}
                            </div>
                        )}
                        {exploreError && (
                            <div className="explore-status-message" role="alert">
                                <p>{exploreError}</p>
                                <button type="button" onClick={cursor ? () => setExploreError("") : () => {
                                    exploreSnapshots.delete(exploreKey);
                                    setFeedRetry((retry) => retry + 1);
                                }}>Retry</button>
                            </div>
                        )}
                        {exploreHasLoaded && !exploreError && mediaPosts.length === 0 && (
                            <p className="explore-status-message">Nothing to explore yet.</p>
                        )}
                        {cursor && <div className="explore-load-sentinel" ref={sentinelRef} aria-hidden="true" />}
                        {exploreLoading && exploreHasLoaded && <p className="explore-loading-more" aria-live="polite">Loading more posts…</p>}
                        {!cursor && exploreHasLoaded && mediaPosts.length > 0 && (
                            <p className="explore-end-message">You’re all caught up.</p>
                        )}
                    </div>
                </>
            )}
        </main>
    );
}
