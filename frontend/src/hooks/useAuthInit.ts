import { useEffect } from 'react';
import { useAuthStore } from '@stores/authStore';
import { authService } from '@services/authService';

/**
 * Initialize auth state on app load.
 * If tokens exist in storage, fetch current user.
 */
export function useAuthInit() {
  const { accessToken, setUser, logout, setLoading } = useAuthStore();

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    authService
      .getMe()
      .then((res) => {
        setUser(res.data.data);
        setLoading(false);
      })
      .catch(() => {
        logout();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
