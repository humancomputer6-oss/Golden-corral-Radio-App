import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC<{ simulatedOffline?: boolean }> = ({
  simulatedOffline = false,
}) => {
  const isOnline = useOnlineStatus();
  const offline = !isOnline || simulatedOffline;

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 lg:bottom-6 left-4 z-40 flex items-center gap-2 rounded-xl bg-[#1A1614] text-amber-300 border border-amber-700/50 px-3.5 py-2 text-xs font-medium shadow-lg"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Offline Playback Active · Streaming Cached Tracks</span>
    </div>
  );
};
