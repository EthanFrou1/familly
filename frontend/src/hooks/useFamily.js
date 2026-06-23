import { useState, useEffect, useCallback } from 'react'
import { membersApi, relationsApi } from '../services/api'
import { usePageRefresh } from './usePageRefresh'

export function useFamily() {
  const [members, setMembers] = useState([])
  const [relations, setRelations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([membersApi.getAll(), relationsApi.getAll()])
      .then(([mRes, rRes]) => {
        setMembers(mRes.data)
        setRelations(rRes.data)
      })
      .finally(() => setLoading(false))
  }, [])

  const reloadRelations = useCallback(() => {
    relationsApi.getAll().then(({ data }) => setRelations(data)).catch(() => {})
  }, [])

  const reloadAll = useCallback(() => {
    membersApi.getAll().then(({ data }) => setMembers(data)).catch(() => {})
    relationsApi.getAll().then(({ data }) => setRelations(data)).catch(() => {})
  }, [])

  usePageRefresh(reloadAll)

  return { members, relations, loading, reloadRelations }
}
