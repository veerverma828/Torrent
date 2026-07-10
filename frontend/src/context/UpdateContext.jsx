import { createContext, useContext } from "react";
import { useAppUpdate } from "../hooks/useAppUpdate.js";

// One update-check shared across the app (banner, settings badge, settings
// tab) so we don't fire three separate unauthenticated GitHub API calls.
const UpdateContext = createContext(null);

export function UpdateProvider({ children }) {
  const value = useAppUpdate();
  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}

export function useUpdate() {
  const ctx = useContext(UpdateContext);
  if (!ctx) throw new Error("useUpdate must be used within an UpdateProvider");
  return ctx;
}
