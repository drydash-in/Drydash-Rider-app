import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { locationService } from "@/services/locationService";
import { trackingLegService } from "@/services/trackingLegService";
import { API_AUTH_URL } from "@/constants/apiConfig";

/* =====================================================
   CONFIG
===================================================== */

const API_URL = API_AUTH_URL;

const USER_KEY = "DRYDASH_RIDER_USER";
const TOKEN_KEY = "DRYDASH_RIDER_TOKEN";

/* =====================================================
   TYPES
===================================================== */

export interface Rider {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  plantName: string;
}

interface AuthContextType {
  user: Rider | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: Rider, token: string) => Promise<void>;
  logout: () => Promise<void>;
}

/* =====================================================
   CONTEXT
===================================================== */

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

/* =====================================================
   PROVIDER
===================================================== */

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<Rider | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isAuthenticated = !!token;

  const hasRestoredRef = useRef(false);

  /* --------------------------------------------------
     Restore auth + validate token
  -------------------------------------------------- */
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const parseStoredUser = (rawUser: string | null): Rider | null => {
      if (!rawUser) return null;

      try {
        return JSON.parse(rawUser) as Rider;
      } catch (error) {
        console.warn("Failed to parse stored rider user:", error);
        return null;
      }
    };

    const fetchProfileWithTimeout = async (storedToken: string) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        return await fetch(`${API_URL}/profile`, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const restoreAuth = async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);

        if (!storedToken) {
          setIsLoading(false);
          return;
        }

        const cachedUser = parseStoredUser(storedUser);
        setToken(storedToken);
        if (cachedUser) {
          setUser(cachedUser);
        }
        setIsLoading(false);

        try {
          const res = await fetchProfileWithTimeout(storedToken);

          if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
              await AsyncStorage.multiRemove([USER_KEY, TOKEN_KEY]);
              setUser(null);
              setToken(null);
            }
            return;
          }

          const data = await res.json();
          const profile = data.profile;

          const mappedUser: Rider = {
            _id: profile._id,
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            role: profile.role,
            plantName: profile.plantName,
          };

          setUser(mappedUser);
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(mappedUser));
        } catch (error) {
          console.warn("Profile refresh skipped during startup:", error);
        }
      } catch (error) {
        console.error("Auth restore failed:", error);
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreAuth();
  }, []);

  const login = async (userData: Rider, accessToken: string) => {
    setUser(userData);
    setToken(accessToken);

    await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
    await AsyncStorage.setItem(TOKEN_KEY, accessToken);
  };

  /* --------------------------------------------------
     Logout
  -------------------------------------------------- */
  const logout = async () => {
    await locationService.stopTracking();
    await locationService.setCachedUser(null);
    await trackingLegService.cancelActiveLeg();
    setUser(null);
    setToken(null);
    await AsyncStorage.multiRemove([USER_KEY, TOKEN_KEY]);
  };

  /* --------------------------------------------------
     Memoized context value
  -------------------------------------------------- */
  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      isLoading,
      login,
      logout,
    }),
    [user, token, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
