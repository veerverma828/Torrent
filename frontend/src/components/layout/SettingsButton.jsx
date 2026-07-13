import { motion } from "framer-motion";
import { Settings } from "lucide-react";
import { useSettingsContext } from "../../context/SettingsContext.jsx";

export default function SettingsButton() {
  const { setIsSettingsOpen, setTempAddonApis, addonApis } = useSettingsContext();

  return (
    <button
      className="fixed bottom-4 right-4 md:top-4 md:bottom-auto z-50 flex items-center justify-center w-12 h-12 rounded-full bg-bg-surface/90 backdrop-blur border border-border-subtle shadow-lg text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
      onClick={() => {
        setTempAddonApis([...addonApis]);
        setIsSettingsOpen(true);
      }}
      title="Settings"
    >
      <motion.span
        className="flex items-center justify-center"
        whileHover={{ rotate: 45 }}
        transition={{ duration: 0.2 }}
      >
        <Settings size={24} />
      </motion.span>
    </button>
  );
}
