import { useEffect, useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { photosApi } from '../services/api'

const TABS = ['feed', 'album']
const TAB_LABELS = { feed: 'Éphémères (30j)', album: 'Albums' }

export default function Photos() {
  const [tab, setTab] = useState('feed')
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    photosApi.getAll(tab)
      .then(({ data }) => setPhotos(data))
      .finally(() => setLoading(false))
  }, [tab])

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.4, maxWidthOrHeight: 1200 })
      const expiresAt = tab === 'feed' ? new Date(Date.now() + 30 * 86400 * 1000).toISOString() : null
      const { data } = await photosApi.upload(compressed, tab, null, expiresAt)
      setPhotos(prev => [data, ...prev])
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-gray-200 bg-white">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium transition-colors min-h-touch ${
              tab === t ? 'border-b-2 border-primary text-primary' : 'text-gray-500'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5 p-0.5">
            {photos.map(photo => (
              <div key={photo.id} className="aspect-square">
                <img src={photo.cloudinaryUrl} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-gray-200">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUpload} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-white min-h-touch active:bg-primary-dark disabled:opacity-50"
        >
          {uploading ? 'Envoi...' : '+ Ajouter une photo'}
        </button>
      </div>
    </div>
  )
}
