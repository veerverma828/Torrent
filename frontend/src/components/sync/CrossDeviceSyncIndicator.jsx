import { useState, useEffect } from 'react';
import { crossDeviceSync } from "../../services/sync/crossDeviceSync.js";

export default function CrossDeviceSyncIndicator() {
  const [syncStatus, setSyncStatus] = useState({
    isPolling: false,
    changes: [],
    message: 'Initializing sync...'
  });
  const [showNotification, setShowNotification] = useState(false);
  const [lastSyncMessage, setLastSyncMessage] = useState('');

  useEffect(() => {
    // Start cross-device sync
    crossDeviceSync.startRealTimeSync();

    // Load initial status immediately if available
    const initialStatus = crossDeviceSync.getSyncStatus?.();
    if (initialStatus) {
      setSyncStatus(initialStatus);
    }

    // Listen for sync updates
    const unsubscribe = crossDeviceSync.addSyncListener((update) => {
      setSyncStatus(update);
      setLastSyncMessage(update.message);
      
      // Show notification for sync changes
      if (update.changes.length > 0) {
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 5000);
      }
    });

    // Update status periodically
    const statusInterval = setInterval(() => {
      const currentStatus = crossDeviceSync.getSyncStatus();
      if (currentStatus) {
        setSyncStatus(currentStatus);
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(statusInterval);
      crossDeviceSync.stopRealTimeSync();
    };
  }, []);

  const handleForceSync = () => {
    if (syncStatus?.isPolling) {
      crossDeviceSync.forceSync();
    }
  };

  return (
    <>
      {/* Sync Status Icon */}
      <div className="cross-device-sync-icon">
        <div 
          className={`sync-icon-only ${syncStatus?.isPolling ? 'active' : 'inactive'}`}
          onClick={handleForceSync}
          title={syncStatus?.isPolling ? 'Cross-device sync active' : 'Cross-device sync paused'}
        >
          {syncStatus?.isPolling ? '🔄' : '⏸️'}
        </div>
      </div>

      {/* Sync Notification */}
      {showNotification && (
        <div className="cross-device-sync-notification">
          <div className="notification-content">
            <div className="notification-icon">📱</div>
            <div className="notification-message">
              <div className="notification-title">Cross-Device Sync</div>
              <div className="notification-text">{lastSyncMessage}</div>
            </div>
            <button 
              className="notification-close"
              onClick={() => setShowNotification(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </>
  );
}
