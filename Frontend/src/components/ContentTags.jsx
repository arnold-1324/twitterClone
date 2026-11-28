import PeopleSearch from "./PeopleSearch";

export default function ContentTags({ tags, onChange, viewer, disabled }) {
  return <fieldset className="content-tags" disabled={disabled}>
    <legend>Tag people</legend>
    {tags.length > 0 && <div className="content-tag-list">{tags.map((person) =>
      <button key={person._id} type="button" aria-label={`Remove @${person.username}`}
        onClick={() => onChange(tags.filter(({ _id }) => _id !== person._id))}>@{person.username} ×</button>)}</div>}
    {tags.length < 10 && <PeopleSearch label="Find people to tag"
      exclude={[viewer, ...tags.map(({ _id }) => _id)]} onSelect={(person) => onChange([...tags, person])} />}
  </fieldset>;
}
