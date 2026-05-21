import { useEffect, useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { externalMediaApi, photosApi } from '../services/api'
import AddVideoModal from '../components/photos/AddVideoModal'
import VideoCard from '../components/photos/VideoCard'

const PHOTO_TABS = ['feed', 'album']
const TAB_LABELS = { feed: 'Éphémères (30j)', album: 'Albums' }
const MEDIA_FILTERS = ['tous', 'photos', 'videos']
const FILTER_LABELS = { tous: 'Tous', photos: 'Photos', videos: 'Vidéos' }

export default function Photos() {
  const [tab, setTab] = useState('feed')
  const [mediaFilter, setMediaFilter] = useState('tous')
  const [photos, setPhotos] = useState([])
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showAddVideo, setShowAddVideo] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    const fetches = [
      photosApi.getAll(tab).then(({ data }) => setPhotos(data)),
      externalMediaApi.getAll().then(({ data }) => setVideos(data)),
    ]
    Promise.all(fetches).finally(() => setLoading(false))
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

  const showPhotos = mediaFilter === 'tous' || mediaFilter === 'photos'
  const showVideos = mediaFilter === 'tous' || mediaFilter === 'videos'

  const hasContent = (showPhotos && photos.length > 0) || (showVideos && videos.length > 0)

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-gray-200 bg-white">
        {PHOTO_TABS.map(t => (
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

      <div className="flex gap-2 px-4 py-2.5 bg-white border-b border-gray-100">
        {MEDIA_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setMediaFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              mediaFilter === f
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 active:bg-gray-200'
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : !hasContent ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
            <svg className="h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 18h16.5M3.75 21h16.5" />
            </svg>
            <p className="text-sm">Aucun média pour l'instant</p>
          </div>
        ) : (
          <div className="p-3 flex flex-col gap-4">
            {showVideos && videos.length > 0 && (
              <div className="flex flex-col gap-2">
                {videos.map(video => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    onDelete={id => setVideos(prev => prev.filter(v => v.id !== id))}
                  />
                ))}
              </div>
            )}

            {showPhotos && photos.length > 0 && (
              <div className="grid grid-cols-3 gap-0.5">
                {photos.map(photo => (
                  <div key={photo.id} className="aspect-square">
                    <img src={photo.cloudinaryUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-gray-200 flex gap-2">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUpload} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex-1 rounded-xl bg-primary py-3 font-semibold text-white min-h-touch active:bg-primary-dark disabled:opacity-50"
        >
          {uploading ? 'Envoi…' : '+ Photo'}
        </button>
        <button
          onClick={() => setShowAddVideo(true)}
          className="flex-1 rounded-xl border-2 border-primary py-3 font-semibold text-primary min-h-touch active:bg-primary/5"
        >
          + Vidéo
        </button>
      </div>

      <AddVideoModal
        open={showAddVideo}
        onClose={() => setShowAddVideo(false)}
        onAdded={video => setVideos(prev => [video, ...prev])}
      />
    </div>
  )
}
