import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiActivity, FiDatabase, FiMessageCircle, FiTrendingUp, FiUsers } from "react-icons/fi";
import { apiFetch, readApiJson } from "../lib/apiFetch";

const types = { messages: "Messages", posts: "Posts and Reels", signups: "New accounts" };
const number = new Intl.NumberFormat();
const bytes = (amount) => {
  if (!Number.isFinite(amount)) return "Unavailable";
  if (amount < 1024) return `${number.format(amount)} B`;
  const unit = Math.min(4, Math.floor(Math.log(amount) / Math.log(1024)));
  return `${(amount / 1024 ** unit).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${["B", "KiB", "MiB", "GiB", "TiB"][unit]}`;
};

function useAdminData(path) {
  const [state, setState] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    apiFetch(path, { signal: controller.signal }).then(async (response) => {
      if (response.status === 404) return { denied: true };
      if (!response.ok) throw new Error("Data is temporarily unavailable.");
      return { data: await readApiJson(response) };
    }).then((result) => {
      if (!controller.signal.aborted) setState({ ...result, path });
    }).catch((error) => {
      if (!controller.signal.aborted) setState({ error: error.message, path });
    });
    return () => controller.abort();
  }, [path]);
  return state?.path === path ? state : {};
}

function Stat({ label, value }) {
  return <div className="admin-stat"><small>{label}</small><strong>{value}</strong></div>;
}

function Activity() {
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState("messages");
  const { data, error } = useAdminData(`/api/admin/activity?days=${days}`);
  const highest = Math.max(1, ...(data?.timeline.map((row) => row[metric]) ?? []));
  return <>
    <div className="admin-filters"><label>Time range <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
      {[7, 30, 90].map((days) => <option key={days} value={days}>Last {days} days</option>)}</select></label></div>
    {error ? <p role="alert">{error}</p> : !data ? <p role="status">Loading activity…</p> : <>
      <div className="admin-stats">
        <Stat label="Accounts" value={number.format(data.accounts)} />
        <Stat label="Active chat senders" value={number.format(data.activeSenders)} />
        <Stat label="Direct chats" value={number.format(data.chats.find((row) => row._id === "direct")?.count ?? 0)} />
        <Stat label="Group chats" value={number.format(data.chats.find((row) => row._id === "group")?.count ?? 0)} />
        <Stat label="Post and Reel likes" value={number.format(data.content.reduce((sum, row) => sum + row.likes, 0))} />
        <Stat label="Post and Reel replies" value={number.format(data.content.reduce((sum, row) => sum + row.replies, 0))} />
      </div>
      <section className="admin-panel">
        <div className="admin-panel-heading"><h2>Daily activity</h2><label>Metric <select value={metric} onChange={(event) => setMetric(event.target.value)}>
          {Object.entries(types).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label></div>
        <strong>{number.format(data.timeline.reduce((sum, row) => sum + row[metric], 0))} {types[metric].toLowerCase()}</strong>
        <figure className="admin-plot"><div className="admin-bars" role="img" aria-label={`Daily ${types[metric].toLowerCase()} over ${days} days`}>
          {data.timeline.map((row) => <span key={row.date} title={`${row.date} · ${row[metric]}`}
            style={{ height: `${(row[metric] / highest) * 100}%` }} />)}
        </div><figcaption><span>{data.timeline[0].date}</span><span>{data.timeline.at(-1).date} UTC</span></figcaption></figure>
        <details><summary>View daily counts</summary><ul>{data.timeline.map((row) => <li key={row.date}>{row.date} · {row[metric]}</li>)}</ul></details>
      </section>
    </>}
  </>;
}

function Users() {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { data, error } = useAdminData(`/api/admin/users?${new URLSearchParams({ q: query, page })}`);
  return <section className="admin-panel">
    <form className="admin-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(term); }}>
      <input type="search" aria-label="Search accounts" placeholder="Search by name or username" maxLength={80} value={term} onChange={(event) => setTerm(event.target.value)} />
      <button type="submit">Search</button>
    </form>
    {error ? <p role="alert">{error}</p> : !data ? <p role="status">Loading accounts…</p> : <>
      <div className="admin-table-wrap"><table><thead><tr><th>Account</th><th>Followers</th><th>Messages (30d)</th><th>Posts/Reels (30d)</th><th>Last active</th><th>Status</th></tr></thead>
        <tbody>{data.users.map((user) => <tr key={user._id}><td><Link to={`/${encodeURIComponent(user.username)}`}>{user.fullName || user.username}</Link>
          <small>@{user.username}</small></td><td>{user.followers}</td><td>{user.messages}</td><td>{user.posts}</td><td>{user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleDateString() : "—"}</td>
          <td>{user.isFrozen ? "Frozen" : "Active"}</td></tr>)}</tbody></table></div>
      {!data.users.length && <p>No accounts found.</p>}
      <div className="admin-filters"><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page}</span><button type="button" disabled={!data.hasMore} onClick={() => setPage(page + 1)}>Next</button></div>
    </>}
  </section>;
}

function Chats() {
  const [kind, setKind] = useState("all");
  const [page, setPage] = useState(1);
  const { data, error } = useAdminData(`/api/admin/chats?${new URLSearchParams({ kind, page })}`);
  return <section className="admin-panel">
    <h2>Conversation activity</h2>
    <label>Chat type <select value={kind} onChange={(event) => { setKind(event.target.value); setPage(1); }}>
      <option value="all">All chats</option><option value="direct">Direct</option><option value="group">Group</option>
    </select></label>
    {error ? <p role="alert">{error}</p> : !data ? <p role="status">Loading conversations…</p> : <>
      <div className="admin-table-wrap"><table><thead><tr><th>Conversation</th><th>Type</th><th>Participants</th>
        <th>Messages (30d)</th><th>Last message</th></tr></thead>
        <tbody>{data.chats.map((chat) => <tr key={chat.id}><td title={chat.id}>{chat.id.slice(-8)}</td><td>{chat.kind}</td>
          <td>{chat.participants}</td><td>{chat.messages}</td><td>{chat.lastActivity ? new Date(chat.lastActivity).toLocaleString() : "—"}</td></tr>)}</tbody>
      </table></div>
      {!data.chats.length && <p>No conversations match this filter.</p>}
      <div className="admin-filters"><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page}</span><button type="button" disabled={!data.hasMore} onClick={() => setPage(page + 1)}>Next</button></div>
    </>}
  </section>;
}

function StoragePanel({ title, data, children }) {
  return <section className="admin-panel"><h2>{title}</h2>
    {data.error ? <p role="alert">{data.error}</p> : <>
      <div className="admin-stats"><Stat label="Used" value={bytes(data.usage)} /><Stat label="Total capacity" value={data.limit === null ? "Quota unavailable" : bytes(data.limit)} />
        <Stat label="Remaining" value={data.remaining === null ? "Quota unavailable" : bytes(data.remaining)} /></div>
      {children}
    </>}
  </section>;
}

function Storage() {
  const { data, error } = useAdminData("/api/admin/storage");
  if (error || !data) return <p role={error ? "alert" : "status"}>{error || "Measuring storage…"}</p>;
  return <>
    <StoragePanel title="Railway S3" data={data.s3}>
      <div className="admin-table-wrap"><table><thead><tr><th>Files</th><th>Objects</th><th>Space used</th></tr></thead>
        <tbody>{data.s3.groups?.map((row) => <tr key={row.name}><td>{row.name}</td><td>{number.format(row.count)}</td><td>{bytes(row.bytes)}</td></tr>)}</tbody></table></div>
    </StoragePanel>
    <StoragePanel title="MongoDB" data={data.database}>
      <p>Database usage includes document data and indexes. Collections share the database capacity.</p>
      <div className="admin-table-wrap"><table><thead><tr><th>Collection</th><th>Documents</th><th>Data</th><th>Indexes</th><th>Allocated</th></tr></thead>
        <tbody>{data.database.collections?.map((row) => <tr key={row.name}><td>{row.name}</td><td>{row.documents ?? "—"}</td>
          <td>{bytes(row.data)}</td><td>{bytes(row.indexes)}</td><td>{bytes(row.allocated)}</td></tr>)}</tbody></table></div>
    </StoragePanel>
    <small>Measured {new Date(data.measuredAt).toLocaleString()}</small>
  </>;
}

const timingColumns = { backend: "API completion", database: "MongoDB command time", objectStorage: "S3 first response",
  browser: "Browser API round trip", decode: "Browser JSON decode", navigation: "Page DOM ready" };
const milliseconds = (value) => value == null ? "—" : `${number.format(value)} ms`;

function Performance() {
  const [hours, setHours] = useState(6);
  const [metric, setMetric] = useState("backend");
  const { data, error } = useAdminData(`/api/admin/performance?hours=${hours}`);
  const limit = Math.max(1, ...(data?.trend.map((point) => point.metrics[metric].p99 ?? 0) ?? []));
  const totals = data?.rows.reduce((sum, row) => ({ requests: sum.requests + row.requests, errors: sum.errors + row.errors,
    cancelled: sum.cancelled + row.cancelled }), { requests: 0, errors: 0, cancelled: 0 });
  const findings = data?.rows.filter((row) => row.metrics.backend.count >= 20)
    .sort((a, b) => b.metrics.backend.p99 - a.metrics.backend.p99).slice(0, 3) ?? [];
  return <>
    <div className="admin-filters">
      <label>Time range <select value={hours} onChange={(event) => setHours(Number(event.target.value))}>
        {[1, 6, 24].map((value) => <option key={value} value={value}>Last {value} hours</option>)}</select></label>
      <label>Timing <select value={metric} onChange={(event) => setMetric(event.target.value)}>
        {Object.entries(timingColumns).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {error ? <p role="alert">{error}</p> : !data ? <p role="status">Loading performance report…</p> : <>
      <div className="admin-stats"><Stat label="API requests" value={number.format(totals.requests)} />
        <Stat label="5xx responses" value={number.format(totals.errors)} /><Stat label="Cancelled requests" value={number.format(totals.cancelled)} /></div>
      <section className="admin-panel">
        <h2>{timingColumns[metric]} p99</h2>
        <p>15-minute buckets · percentile estimates are rounded to histogram boundaries.</p>
        {data.omitted > 0 && <p>{number.format(data.omitted)} endpoint summaries exceeded the storage budget.</p>}
        {data.trend.some((point) => point.metrics[metric].count) ? <figure className="admin-plot">
          <div className="admin-bars" role="img" aria-label={`${timingColumns[metric]} p99 by 15-minute interval`}>
            {data.trend.map((point) => <span key={point.time}
              title={`${new Date(point.time).toLocaleString()} · ${milliseconds(point.metrics[metric].p99)} · ${point.metrics[metric].count} samples`}
              style={{ height: `${(point.metrics[metric].p99 ?? 0) / limit * 100}%` }} />)}
          </div><figcaption><span>{new Date(data.trend[0].time).toLocaleTimeString()}</span><span>{new Date(data.trend.at(-1).time).toLocaleTimeString()}</span></figcaption>
        </figure> : <p>No samples yet for this timing.</p>}
      </section>
      <section className="admin-panel">
        <h2>Where to focus</h2>
        {findings.length ? <ol>{findings.map((row) => <li key={`${row.surface}:${row.route}:${row.method}`}>
          <strong>{row.method} /api/{row.surface}{row.route === "/" ? "" : row.route}</strong>
          {" · "}p99 {milliseconds(row.metrics.backend.p99)} across {row.metrics.backend.count} requests
          {row.metrics.database.count > 0 && ` · MongoDB command p99 ${milliseconds(row.metrics.database.p99)}`}
          {row.metrics.objectStorage.count > 0 && ` · S3 first-response p99 ${milliseconds(row.metrics.objectStorage.p99)}`}
        </li>)}</ol> : <p>Waiting for at least 20 requests on a route before ranking it.</p>}
      </section>
      <section className="admin-panel">
        <h2>Latency by endpoint</h2>
        <div className="admin-table-wrap"><table><thead><tr><th>Endpoint</th><th>Samples</th><th>Mean</th><th>p50</th><th>p95</th><th>p99</th></tr></thead>
          <tbody>{data.rows.filter((row) => row.metrics[metric].count).map((row) => <tr key={`${row.surface}:${row.route}:${row.method}`}>
            <td>{row.method === "BROWSER" ? row.surface : `${row.method} /api/${row.surface}${row.route === "/" ? "" : row.route}`}</td>
            <td>{row.metrics[metric].count}</td><td>{milliseconds(row.metrics[metric].mean)}</td><td>{milliseconds(row.metrics[metric].p50)}</td>
            <td>{milliseconds(row.metrics[metric].p95)}</td><td>{milliseconds(row.metrics[metric].p99)}</td></tr>)}</tbody></table></div>
        <small>Browser timing samples use the API resource family. MongoDB command time is summed per request and can overlap when queries run in parallel.</small>
      </section>
    </>}
  </>;
}

export default function AdminPage() {
  const [tab, setTab] = useState("activity");
  const state = useAdminData("/api/music/admin/access");
  if (state.error || state.denied || !state.data?.allowed) return <main className="dayline-tool-page"><p role="status">
    {state.error || (state.denied || state.data ? "Dashboard unavailable for this account." : "Checking dashboard access…")}</p></main>;
  return <main className="dayline-tool-page admin-page"><h1>Admin dashboard</h1>
    <nav aria-label="Admin sections">
      {[["activity", "Activity", FiActivity], ["users", "Accounts", FiUsers], ["chats", "Chats", FiMessageCircle], ["performance", "Performance", FiTrendingUp], ["storage", "Storage", FiDatabase]].map(([value, label, Icon]) =>
        <button type="button" key={value} aria-pressed={tab === value} onClick={() => setTab(value)}><Icon aria-hidden="true" />{label}</button>)}
      <Link to="/settings">Settings</Link>
    </nav>
    {tab === "activity" ? <Activity /> : tab === "users" ? <Users /> : tab === "chats" ? <Chats /> : tab === "performance" ? <Performance /> : <Storage />}
  </main>;
}
