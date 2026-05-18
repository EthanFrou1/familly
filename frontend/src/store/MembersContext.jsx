import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { membersApi } from '../services/api'

const MembersContext = createContext(null)

export function MembersProvider({ children }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const { data } = await membersApi.getAll()
      setMembers(data)
    } catch {}
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  return (
    <MembersContext.Provider value={{ members, loading, refresh }}>
      {children}
    </MembersContext.Provider>
  )
}

export function useMembers() {
  return useContext(MembersContext)
}
