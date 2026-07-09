import { useEffect, useState } from 'react';
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { traktReconciliation } from "../../services/trakt/traktReconciliation.js";

function formatRelativeTime(timestamp) {
  if (!timestamp) return "Not synced yet";

  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return "Synced just now";
  if (seconds < 60) return `Synced ${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Synced ${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  return `Synced ${hours}h ago`;
}

export default function CrossDeviceSyncIndicator() {
  const [lastSyncedAt, setLastSyncedAt] = useState(() => traktReconciliation.getLastSyncedAt());
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setLastSyncedAt(traktReconciliation.getLastSyncedAt());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await traktReconciliation.reconcileNow({ trigger: "manual" });
      setLastSyncedAt(traktReconciliation.getLastSyncedAt());
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="cross-device-sync-icon">
      <div
        className={`sync-icon-only ${isSyncing ? "active" : "inactive"}`}
        onClick={handleManualSync}
        title={isSyncing ? "Syncing with Trakt..." : formatRelativeTime(lastSyncedAt)}
      >
        <motion.span
          style={{ display: "flex" }}
          animate={isSyncing ? { rotate: 360 } : { rotate: 0 }}
          transition={isSyncing ? { repeat: Infinity, duration: 1.5, ease: "linear" } : {}}
        >
          <RefreshCw size={18} />
        </motion.span>
      </div>
    </div>
  );
}
