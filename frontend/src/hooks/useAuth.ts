import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/api';
import type { User } from '../types';
import type { ApiFetch } from './useApi';

interface AuthResult {
  success: boolean;
  message?: string;
}

interface UserResponse {
  user: User;
}

interface LoginResponse {
  user: User;
  csrfToken?: string;
}

interface RegisterResponse {
  user: User;
  csrfToken?: string;
}

interface RefreshResponse {
  user: User;
  csrfToken?: string;
}

const ACCESS_TOKEN_CHECK_INTERVAL = 60000;

export const useAuth = (apiFetch: ApiFetch) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [csrfToken, setCsrfTokenState] = useState<string | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  const setCsrfToken = useCallback((token: string | null) => {
    setCsrfTokenState(token);
    if (token) {
      localStorage.setItem('skyllswap_csrf', token);
    } else {
      localStorage.removeItem('skyllswap_csrf');
    }
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('skyllswap_csrf');
    if (storedToken) {
      setCsrfTokenState(storedToken);
      apiService.setCsrfToken(storedToken);
    }
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    try {
      const { response, data } = await apiService.postJson<RefreshResponse>(
        '/api/auth/refresh',
        {}
      );

      if (!response.ok) {
        return false;
      }

      setCurrentUser(data.user);
      if (data.csrfToken) {
        setCsrfToken(data.csrfToken);
        apiService.setCsrfToken(data.csrfToken);
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const startRefreshTimer = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    refreshIntervalRef.current = setInterval(async () => {
      const success = await refreshAccessToken();
      if (!success) {
        setCurrentUser(null);
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      }
    }, ACCESS_TOKEN_CHECK_INTERVAL);
  }, [refreshAccessToken]);

  useEffect(() => {
    const fetchMe = async () => {
      setAuthResolved(false);

      try {
        const response = await apiFetch('/api/auth/me');

        if (!response.ok) {
          if (response.status === 401) {
            const refreshed = await refreshAccessToken();
            if (!refreshed) {
              setCurrentUser(null);
              return;
            }
          } else {
            setCurrentUser(null);
            return;
          }
        }

        const data = (await response.json()) as UserResponse;
        setCurrentUser(data.user);
        startRefreshTimer();
      } catch {
        setCurrentUser(null);
      } finally {
        setAuthResolved(true);
      }
    };

    fetchMe();

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [apiFetch, refreshAccessToken, startRefreshTimer]);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const { response, data } = await apiService.postJson<LoginResponse>(
          '/api/auth/login',
          {
            email,
            password,
          }
        );

        if (!response.ok) {
          const errorData = data as { message?: string };
          return {
            success: false,
            message: errorData.message || 'Erreur de connexion',
          };
        }

        setCurrentUser(data.user);
        if (data.csrfToken) {
          setCsrfToken(data.csrfToken);
          apiService.setCsrfToken(data.csrfToken);
        }
        startRefreshTimer();

        return { success: true };
      } catch {
        return { success: false, message: 'Erreur de connexion' };
      }
    },
    [startRefreshTimer]
  );

  const register = useCallback(
    async (
      name: string,
      email: string,
      password: string
    ): Promise<AuthResult> => {
      try {
        const { response, data } = await apiService.postJson<RegisterResponse>(
          '/api/auth/register',
          {
            name,
            email,
            password,
          }
        );

        if (!response.ok) {
          const errorData = data as { message?: string };
          return {
            success: false,
            message: errorData.message || "Erreur d'inscription",
          };
        }

        setCurrentUser(data.user);
        if (data.csrfToken) {
          setCsrfToken(data.csrfToken);
          apiService.setCsrfToken(data.csrfToken);
        }
        startRefreshTimer();

        return { success: true };
      } catch {
        return { success: false, message: "Erreur d'inscription" };
      }
    },
    [startRefreshTimer]
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // no-op
    }

    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    setCurrentUser(null);
    setCsrfToken(null);
    apiService.clearCsrfToken();
  }, [apiFetch]);

  return {
    currentUser,
    setCurrentUser,
    authResolved,
    csrfToken,
    setCsrfToken,
    login,
    register,
    logout,
  };
};
