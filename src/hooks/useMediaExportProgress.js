import { useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';

export default function useMediaExportProgress(loading) {
  const [progress, setProgress] = useState(null);
  useEffect(() => {
    if (!loading) { setProgress(null); return undefined; }
    const listener = DeviceEventEmitter.addListener('PolicyBhandarExportProgress', setProgress);
    return () => listener.remove();
  }, [loading]);
  if (!loading) return '';
  if (progress?.phase === 'exporting' && progress.percent >= 0) return `Preparing your reel… ${progress.percent}%`;
  return progress?.phase === 'loading' ? 'Loading your media and profile…' : 'Preparing your personalized file…';
}
