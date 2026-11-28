import { Provider } from "react-redux";
import { useState } from "react";
import { makeAppStore } from "./store";

export function AppStateProvider({ children }) {
  const [store] = useState(makeAppStore);
  return <Provider store={store}>{children}</Provider>;
}
