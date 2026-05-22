import { createContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../services/api'
import { setToken, clearToken, getToken } from '../services/api'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) { setLoading(false); return }
    authApi.me()
      .then(({ data }) => setUser(data))
      .catch((err) => { if (err.response?.status === 401) clearToken(); setUser(null) })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const { data } = await authApi.login(email, password)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try { await authApi.logout() } catch {}
    clearToken()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}
