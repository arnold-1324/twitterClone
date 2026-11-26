import { Button } from "@chakra-ui/react";
import { FiCompass } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import PeopleSearch from "../components/PeopleSearch";
import SuggestedUsers from "../components/SuggestedUsers";

export default function SearchPage() {
  const navigate = useNavigate();
  return (
    <main className="dayline-tool-page stream-page">
      <div className="discovery-header">
        <h1>Search</h1>
        <Button as={Link} to="/discover" variant="outline" size="sm" leftIcon={<FiCompass />}>Discover posts</Button>
      </div>
      <div className="social-panel dayline-tool-panel">
        <PeopleSearch label="Search by username" onSelect={({ username }) => navigate(`/${encodeURIComponent(username)}`)} />
      </div>
      <div className="social-panel dayline-tool-panel search-suggestions"><SuggestedUsers /></div>
    </main>
  );
}
