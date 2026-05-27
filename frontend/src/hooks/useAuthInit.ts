import { useEffect } from 'react';
import { useAuthStore } from '@stores/authStore';
import { authService } from '@services/authService';

export function useAuthInit() {
  const { accessToken, setUser, logout, setLoading } = useAuthStore();

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    authService
      .getMe()
      .then((res) => {
        if (!isMounted) return;
        setUser(res.data.data);
      })
      .catch(() => {
        if (!isMounted) return;
        logout();
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [accessToken, logout, setLoading, setUser]);
}
