import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import { Avatar, Spinner } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FiSearch } from "react-icons/fi";

export default function PeopleSearch({ onSelect, exclude = [], label = "Search people" }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState({ query: "", items: [], error: "" });
  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await apiFetch(`/api/users/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Could not search right now.");
        const items = await readApiJson(response);
        if (!controller.signal.aborted) setState({ query: term, items, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) setState({ query: term, items: [], error: error.message });
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  const ready = state.query === term;
  const results = ready ? state.items.filter(({ _id }) => !exclude.includes(_id)) : [];
  return (
    <div className="people-search">
      <label className="people-search-field">
        <FiSearch aria-hidden="true" />
        <input type="search" aria-label={label} placeholder={label} value={query}
          onChange={(event) => setQuery(event.target.value)} autoComplete="off" />
      </label>
      {term.length >= 2 && (
        <div className="people-results" aria-label="Search results">
          {!ready && <Spinner size="sm" aria-label="Searching" />}
          {ready && state.error && <p role="alert">{state.error}</p>}
          {ready && !state.error && !results.length && <p>No matching people.</p>}
          {results.map((person) => (
            <button type="button" key={person._id} onClick={() => { onSelect(person); setQuery(""); }}>
              <Avatar size="sm" name={person.fullName || person.username} src={person.profileImg} />
              <span><strong>{person.fullName || person.username}</strong><small>@{person.username}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
