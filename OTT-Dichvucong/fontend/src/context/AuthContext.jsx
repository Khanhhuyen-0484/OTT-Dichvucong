import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  getMe,
  patchProfile
} from "../lib/api.js";

const AuthContext = createContext(null);

function profileCacheKey(id) {
  return `ott_profile_${id}`;
}

function readProfileCache(id) {
  try {
    const raw = sessionStorage.getItem(profileCacheKey(id));
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u && u.id === id ? u : null;
  } catch {
    return null;
  }
}

function writeProfileCache(data) {
  if (!data?.id) return;
  try {
    sessionStorage.setItem(profileCacheKey(data.id), JSON.stringify(data));
  } catch {
    /* quota */
  }
}

/** Chỉ để lấy `id` khi cần khớp cache — không dùng làm hồ sơ thay thế API. */
function decodeJwtPayload(token) {
  try {
    const p = token.split(".")[1];
    if (!p) return null;
    const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    const payload = JSON.parse(json);
    if (payload?.id && payload?.email) {
      return { id: payload.id, email: payload.email };
    }
    return null;
  } catch {
    return null;
  }
}

function resolveDisplayAvatar(user, legacyLocal) {
  const u = user?.avatarUrl;
  if (u && String(u).trim()) return String(u).trim();
  if (legacyLocal && legacyLocal.length > 0) return legacyLocal;
  return null;
}

async function getMeWithRetry(maxAttempts = 3) {
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await getMe();
    } catch (err) {
      lastErr = err;
      const s = err?.response?.status;
      if (s === 401 || s === 403) throw err;
      if (i < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 350 * (i + 1)));
      }
    }
  }
  throw lastErr;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [ready, setReady] = useState(false);

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUser(null);
      setAvatarUrl(null);
      setReady(true);
      return;
    }
    try {
      const { data } = await getMeWithRetry(3);
      setUser(data);
      writeProfileCache(data);
      const legacy = localStorage.getItem(`avatar_${data.id}`);
      setAvatarUrl(resolveDisplayAvatar(data, legacy));
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setUser(null);
        setAvatarUrl(null);
        localStorage.removeItem("token");
      } else {
        const id = decodeJwtPayload(token)?.id;
        const cached = id ? readProfileCache(id) : null;
        if (cached) {
          setUser(cached);
          const legacy = localStorage.getItem(`avatar_${cached.id}`);
          setAvatarUrl(resolveDisplayAvatar(cached, legacy));
        } else {
          const basic = decodeJwtPayload(token);
          if (basic) {
            setUser({
              id: basic.id,
              email: basic.email,
              fullName: "",
              phone: "",
              address: "",
              avatarUrl: null
            });
            setAvatarUrl(
              resolveDisplayAvatar(
                { avatarUrl: null },
                localStorage.getItem(`avatar_${basic.id}`)
              )
            );
          } else {
            setUser(null);
            setAvatarUrl(null);
            localStorage.removeItem("token");
          }
        }
      }
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const loginWithToken = useCallback(
    async (token) => {
      localStorage.setItem("token", token);
      await refreshProfile();
    },
    [refreshProfile]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
    setAvatarUrl(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Không tìm thấy token");
    }
    const response = await fetch("/api/me", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      const msg = await response.text();
      throw new Error(msg || "Không thể xóa tài khoản");
    }
    // Logout sau khi xóa thành công
    logout();
  }, [logout]);

  const uploadAvatarFile = useCallback(
    async (file) => {
      if (!user?.id) return;
      try {
        // Create FormData with the file
        const formData = new FormData();
        formData.append("file", file);

        // Send to backend which will upload to S3
        const { data } = await fetch("/api/me/avatar/upload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: formData
        }).then((res) => {
          if (!res.ok) throw new Error(`Upload failed (${res.status})`);
          return res.json();
        });

        localStorage.removeItem(`avatar_${user.id}`);
        await refreshProfile();
      } catch (err) {
        throw err;
      }
    },
    [user?.id, refreshProfile]
  );

  const removeAvatar = useCallback(async () => {
    if (!user?.id) return;
    localStorage.removeItem(`avatar_${user.id}`);
    if (user.avatarUrl) {
      await patchProfile({ avatarUrl: "" });
      await refreshProfile();
    } else {
      setAvatarUrl(null);
    }
  }, [user?.id, user?.avatarUrl, refreshProfile]);

  const updateAvatar = useCallback(
    (dataUrl) => {
      if (!user?.id) return;
      if (dataUrl) {
        localStorage.setItem(`avatar_${user.id}`, dataUrl);
        setAvatarUrl(dataUrl);
      } else {
        localStorage.removeItem(`avatar_${user.id}`);
        setAvatarUrl(null);
      }
    },
    [user?.id]
  );

  const value = useMemo(
    () => ({
      user,
      avatarUrl,
      ready,
      refreshProfile,
      loginWithToken,
      logout,
      deleteAccount,
      updateAvatar,
      uploadAvatarFile,
      removeAvatar
    }),
    [
      user,
      avatarUrl,
      ready,
      refreshProfile,
      loginWithToken,
      logout,
      deleteAccount,
      updateAvatar,
      uploadAvatarFile,
      removeAvatar
    ]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
