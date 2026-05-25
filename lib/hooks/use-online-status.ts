import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/** Returns true when the device has a live network connection. */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Immediate fetch so the initial render reflects actual state
    NetInfo.fetch().then((state) => setIsOnline(state.isConnected ?? true));

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });

    return unsubscribe;
  }, []);

  return isOnline;
}
