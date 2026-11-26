import ActivityList from "../components/ActivityList";

export default function NotificationPage() {
  return <main className="dayline-tool-page stream-page">
    <h1>Activity</h1>
    <div className="social-panel dayline-tool-panel"><ActivityList /></div>
  </main>;
}
