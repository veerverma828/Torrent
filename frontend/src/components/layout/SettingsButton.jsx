import { motion } from "framer-motion";
import { Settings } from "lucide-react";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { useUpdate } from "../../context/UpdateContext.jsx";

export default function SettingsButton() {
  const { setIsSettingsOpen, setTempAddonApis, addonApis, setSettingsTab } = useSettingsContext();
  const { update } = useUpdate();

  return (
    <button
      className="fixed bottom-4 right-4 md:top-4 md:bottom-auto z-50 flex items-center justify-center w-12 h-12 rounded-full bg-bg-surface/90 backdrop-blur border border-border-subtle shadow-lg text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
      onClick={() => {
        setTempAddonApis([...addonApis]);
        // jump straight to the Update tab when an update is waiting
        if (update) setSettingsTab?.("update");
        setIsSettingsOpen(true);
      }}
      title={update ? "Update available" : "Settings"}
    >
      <motion.span
        className="flex items-center justify-center"
        whileHover={{ rotate: 45 }}
        transition={{ duration: 0.2 }}
      >
        <Settings size={24} />
      </motion.span>

      {update && (
        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-primary opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-accent-primary border border-bg-base" />
        </span>
      )}
    </button>
  );
}
