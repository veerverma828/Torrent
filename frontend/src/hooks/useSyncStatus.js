import { useState, useEffect } from 'react';
import { traktSyncQueue } from '../services/trakt/traktSyncQueue.js';

export function useSyncStatus() {
  const [syncStatus, setSyncStatus] = useState(() => traktSyncQueue.getSyncStatus());

  useEffect(() => {
    const updateStatus = () => {
      setSyncStatus(traktSyncQueue.getSyncStatus());
    };

    // Update status every 5 seconds
    const interval = setInterval(updateStatus, 5000);

    // Listen for network events
    const handleOnline = () => setTimeout(updateStatus, 100);
    const handleOffline = updateStatus;

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const retrySync = () => {
    return traktSyncQueue.retryAll();
  };

  return {
    ...syncStatus,
    retrySync,
    isSyncing: syncStatus.isProcessing || syncStatus.queueLength > 0,
    hasIssues: !syncStatus.isOnline || syncStatus.hasFailedOperations
  };
}
