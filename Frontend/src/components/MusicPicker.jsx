import { useEffect, useRef, useState } from "react";
import { FiMusic, FiPause, FiPlay, FiSearch, FiTrendingUp, FiX } from "react-icons/fi";
import { loadMusic } from "../lib/music";
import { SpotifyPreview } from "./SpotifyPlayer";

export default function MusicPicker({ onSelect, onClose }) {
  const [state, setState] = useState({});
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(null);
  const [provider, setProvider] = useState("library");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("suggested");
  const [page, setPage] = useState(1);
  const [audioError, setAudioError] = useState("");
  const [spotifyPreview, setSpotifyPreview] = useState(null);
  const [retry, setRetry] = useState(0);
  const audio = useRef();
  const currentTrack = useRef(null);

  useEffect(() => {
    let mounted = true;
    const term = query.trim();
    const timer = setTimeout(() => {
      loadMusic(term, provider, category, page, sort).then((result) => {
        if (!mounted) return;
        setState((previous) => {
          const tracks = page > 1 ? [...previous.tracks, ...result.tracks] : result.tracks;
          return { ...result, tracks: [...new Map(tracks.map((track) => [track.id, track])).values()], term, provider, category, page, sort };
        });
      }).catch((error) => {
        if (mounted) setState((previous) => ({
          ...(page > 1 ? previous : {}), error: error.message, term, provider, category, page, sort,
        }));
      });
    }, term && page === 1 ? 290 : 0);
    return () => { mounted = false; clearTimeout(timer); };
  }, [query, retry, provider, category, page, sort]);

  function changeSource(value) {
    audio.current.pause();
    setAudioError("");
    setCategory("");
    setSort("suggested");
    setPage(1);
    setProvider(value);
  }

  function listen(track) {
    const player = audio.current;
    setAudioError("");
    if (track.provider === "spotify") {
      player.pause();
      setSpotifyPreview(track);
      return;
    }
    if (preview === track.id && !player.paused) {
      player.pause();
      return;
    }
    currentTrack.current = track.id;
    player.src = track.url;
    void player.play().catch((error) => {
      if (error.name !== "AbortError") setAudioError("Could not play this track. Try again.");
      setPreview(null);
    });
  }

  const ready = state.term === query.trim() && state.provider === provider && state.category === category && state.sort === sort;
  const tracks = ready ? state.tracks : undefined;

  return <section className="music-picker" aria-label="Music library">
    <div className="music-picker-heading"><strong><FiMusic aria-hidden="true" /> Music library</strong>
      <button type="button" onClick={onClose} aria-label="Close music library"><FiX /></button>
    </div>
    <div className="music-provider-switch" role="group" aria-label="Music source">
      <button type="button" aria-pressed={provider === "library"} onClick={() => changeSource("library")}>Clip library</button>
      <button type="button" aria-pressed={provider === "spotify"} onClick={() => changeSource("spotify")}>Spotify</button>
      <button type="button" aria-pressed={provider === "commons"} onClick={() => changeSource("commons")}>Open recordings</button>
    </div>
    <label className="people-search-field"><FiSearch aria-hidden="true" />
      <input type="search" autoComplete="off" aria-label="Search music" maxLength={150}
        placeholder={provider === "commons" ? "Search open recordings" : "Search songs or artists"} value={query}
        onChange={(event) => { setPage(1); setQuery(event.target.value); }} />
    </label>
    {provider === "library" && <div className="music-browse">
      <div role="group" aria-label="Browse music">
        <button type="button" aria-pressed={sort === "suggested"} onClick={() => { setPage(1); setSort("suggested"); }}>For you</button>
        <button type="button" aria-pressed={sort === "trending"} onClick={() => { setPage(1); setSort("trending"); }}><FiTrendingUp />Trending</button>
      </div>
      <label className="clip-category">
      <select aria-label="Category" value={category} onChange={(event) => { setPage(1); setCategory(event.target.value); }}>
        <option value="">All categories</option><option value="tamil">Tamil</option>
        <option value="tamil-christian">Tamil Christian</option><option value="english">English</option>
        <option value="hindi">Hindi</option><option value="malayalam">Malayalam</option>
      </select>
      </label>
    </div>}
    {audioError && <p role="alert">{audioError}</p>}
    <audio ref={audio} onPlay={() => setPreview(currentTrack.current)} onPause={() => setPreview(null)} onEnded={() => setPreview(null)} />
    {ready && state.error && <p role="alert">{state.error} <button type="button"
      onClick={() => setRetry((value) => value + 1)}>Retry</button></p>}
    {!tracks ? !(ready && state.error) && <p role="status">Loading tracks…</p>
        : !tracks.length ? <p role="status">{state.scope === "featured" ? "No matching featured Spotify tracks."
          : sort === "trending" && provider === "library" ? "Popular clips will appear as people share them."
          : provider === "library" && !query.trim() ? "No recordings in this category yet." : "No matching tracks."}</p>
          : <div className="music-results">{tracks.map((track) => (
            <div key={track.id}>
              <button className="music-sample" style={{ "--track-color": track.accent }} type="button"
                aria-label={`${preview === track.id ? "Pause" : "Preview"} ${track.title}`} onClick={() => listen(track)}>
                {track.artwork && <img src={track.artwork} alt="" loading="lazy" />}
                <span>{preview === track.id ? <FiPause aria-hidden="true" /> : <FiPlay aria-hidden="true" />}</span>
              </button>
              <button type="button" className="music-choice" onClick={() => onSelect(track)}>
                <strong>{track.title}</strong><small>{track.artist}
                  {track.duration > 0 && ` · ${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}`}
                  {track.album && ` · ${track.album}`}{track.year && ` · ${track.year}`}</small>
              </button>
              {track.trending?.length ? <span className="music-trend" title="Popular sections"><FiTrendingUp /><span className="sr-only">Popular sections</span></span> : <FiMusic aria-hidden="true" />}
            </div>
          ))}</div>}
    {ready && state.hasMore && <button type="button" className="music-more" disabled={state.page !== page || Boolean(state.error)}
      onClick={() => setPage((value) => value + 1)}>{state.page === page ? "More tracks" : "Loading…"}</button>}
    {ready && state.scope === "featured" && <small className="music-picker-scope">Featured Spotify tracks. You can also paste a Spotify track link.</small>}
    {spotifyPreview && <SpotifyPreview track={spotifyPreview} onClose={() => setSpotifyPreview(null)} />}
  </section>;
}
