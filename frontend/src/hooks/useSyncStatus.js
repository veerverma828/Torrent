import { useState, useEffect } from 'react';
import { syncQueueService } from '../services/syncQueueService.js';

export function useSyncStatus() {
  const [syncStatus, setSyncStatus] = useState(() => syncQueueService.getSyncStatus());

  useEffect(() => {
    const updateStatus = () => {
      setSyncStatus(syncQueueService.getSyncStatus());
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
    return syncQueueService.retryAll();
  };

  return {
    ...syncStatus,
    retrySync,
    isSyncing: syncStatus.isProcessing || syncStatus.queueLength > 0,
    hasIssues: !syncStatus.isOnline || syncStatus.hasFailedOperations
  };
}
