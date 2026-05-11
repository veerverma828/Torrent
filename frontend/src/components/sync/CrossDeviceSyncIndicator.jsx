import { useState, useEffect } from 'react';
import { crossDeviceSync } from "../../services/sync/crossDeviceSync.js";

export default function CrossDeviceSyncIndicator() {
  const [syncStatus, setSyncStatus] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [lastSyncMessage, setLastSyncMessage] = useState('');

  useEffect(() => {
    // Start cross-device sync
    crossDeviceSync.startRealTimeSync();

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
      setSyncStatus(crossDeviceSync.getSyncStatus());
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

  if (!syncStatus) return null;

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
