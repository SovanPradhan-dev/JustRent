import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function useSocket(enabled = true) {
  const [socket, setSocket] = useState(null);
  useEffect(() => {
    const token = localStorage.getItem('vc_token');
    if (!enabled || !token) return undefined;
    const connection = io('/', { path: '/socket.io', auth: { token }, transports: ['websocket', 'polling'] });
    setSocket(connection);
    return () => {
      connection.disconnect();
      setSocket(null);
    };
  }, [enabled]);
  return socket;
}
