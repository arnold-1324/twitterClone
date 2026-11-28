import { Component } from "react";
import { Button } from "@chakra-ui/react";

export default class PageErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="social-panel feed-state page-recovery" role="alert">
      <strong>This page couldn’t load.</strong>
      <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Reload page</Button>
    </section>;
  }
}
