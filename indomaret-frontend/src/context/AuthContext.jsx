import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchMe, login as loginRequest, logout as logoutRequest } from "../api/auth";
import { getToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const loggedInUser = await loginRequest(email, password);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const isManager = user?.role === "manager";
  const isSupervisor = user?.role === "supervisor";
  const isCashier = user?.role === "cashier";

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isManager,
        isSupervisor,
        isCashier,
        // manager = akun pusat: lihat semua gerai + kelola akun & master data
        hasUnscopedAccess: isManager,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
