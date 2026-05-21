import { useEffect, useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { albumsApi, externalMediaApi, photosApi } from '../services/api'
import AddVideoModal from '../components/photos/AddVideoModal'
import VideoCard from '../components/photos/VideoCard'
import PhotoViewer from '../components/photos/PhotoViewer'
import CreateAlbumModal from '../components/photos/CreateAlbumModal'

const PHOTO_TABS = ['feed', 'album']
const TAB_LABELS = { feed: 'Éphémères (30j)', album: 'Albums' }
const MEDIA_FILTERS = ['tous', 'photos', 'videos']
const FILTER_LABELS = { tous: 'Tous', photos: 'Photos', videos: 'Vidéos' }

export default function Photos() {
  const [tab, setTab] = useState('feed')

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-gray-200 bg-white shrink-0">
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

      {tab === 'feed' ? <FeedTab /> : <AlbumsTab />}
    </div>
  )
}

function FeedTab() {
  const [mediaFilter, setMediaFilter] = useState('tous')
  const [photos, setPhotos] = useState([])
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showAddVideo, setShowAddVideo] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      photosApi.getAll('feed').then(({ data }) => setPhotos(data)),
      externalMediaApi.getAll().then(({ data }) => setVideos(data)),
    ]).finally(() => setLoading(false))
  }, [])

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.4, maxWidthOrHeight: 1200 })
      const expiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString()
      const { data } = await photosApi.upload(compressed, 'feed', null, expiresAt)
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
    <>
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-100 shrink-0">
        <div className="flex gap-2 flex-1">
          {MEDIA_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setMediaFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                mediaFilter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
              }`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => fileRef.current?.click()} disabled={uploading} title="Ajouter une photo"
            className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:bg-gray-200 disabled:opacity-50">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button onClick={() => setShowAddVideo(true)} title="Ajouter une vidéo"
            className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:bg-gray-200">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : !hasContent ? (
          <EmptyState />
        ) : (
          <div className="p-3 flex flex-col gap-4">
            {showVideos && videos.length > 0 && (
              <div className="flex flex-col gap-2">
                {videos.map(video => (
                  <VideoCard key={video.id} video={video} onDelete={id => setVideos(prev => prev.filter(v => v.id !== id))} />
                ))}
              </div>
            )}
            {showPhotos && photos.length > 0 && (
              <div className="grid grid-cols-3 gap-0.5">
                {photos.map((photo, i) => (
                  <button key={photo.id} className="aspect-square active:opacity-80" onClick={() => setViewerIndex(i)}>
                    <img src={photo.cloudinaryUrl} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUpload} />

      {viewerIndex !== null && (
        <PhotoViewer
          photos={photos}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onPrev={() => setViewerIndex(i => Math.max(0, i - 1))}
          onNext={() => setViewerIndex(i => Math.min(photos.length - 1, i + 1))}
        />
      )}

      <AddVideoModal open={showAddVideo} onClose={() => setShowAddVideo(false)} onAdded={video => setVideos(prev => [video, ...prev])} />
    </>
  )
}

function AlbumsTab() {
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedAlbum, setSelectedAlbum] = useState(null)

  useEffect(() => {
    albumsApi.getAll().then(({ data }) => setAlbums(data)).finally(() => setLoading(false))
  }, [])

  if (selectedAlbum) {
    return (
      <AlbumDetail
        albumId={selectedAlbum.id}
        albumName={selectedAlbum.name}
        onBack={() => setSelectedAlbum(null)}
        onDeleted={() => {
          setAlbums(prev => prev.filter(a => a.id !== selectedAlbum.id))
          setSelectedAlbum(null)
        }}
      />
    )
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-100 shrink-0">
        <span className="text-xs text-gray-500 font-medium">{albums.length} album{albums.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white active:bg-primary-dark"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nouvel album
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : albums.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
            <svg className="h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            <p className="text-sm">Aucun album</p>
          </div>
        ) : (
          <div className="p-3 grid grid-cols-2 gap-3">
            {albums.map(album => (
              <button key={album.id} onClick={() => setSelectedAlbum(album)} className="flex flex-col rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100 active:opacity-80 text-left">
                <div className="aspect-square w-full bg-gray-100">
                  {album.coverUrl
                    ? <img src={album.coverUrl} alt="" className="h-full w-full object-cover" />
                    : <div className="h-full w-full flex items-center justify-center text-gray-300">
                        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909" />
                        </svg>
                      </div>
                  }
                </div>
                <div className="px-2.5 py-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">{album.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{album.photoCount} photo{album.photoCount !== 1 ? 's' : ''}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <CreateAlbumModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={a => setAlbums(prev => [a, ...prev])} />
    </>
  )
}

function AlbumDetail({ albumId, albumName, onBack, onDeleted }) {
  const [album, setAlbum] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    albumsApi.getById(albumId).then(({ data }) => setAlbum(data)).finally(() => setLoading(false))
  }, [albumId])

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.4, maxWidthOrHeight: 1200 })
      const { data } = await albumsApi.addPhoto(albumId, compressed)
      setAlbum(prev => ({ ...prev, photos: [data, ...prev.photos] }))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleDeletePhoto(photoId) {
    await albumsApi.removePhoto(albumId, photoId)
    setAlbum(prev => ({ ...prev, photos: prev.photos.filter(p => p.id !== photoId) }))
    if (viewerIndex !== null) setViewerIndex(null)
  }

  const photos = album?.photos ?? []

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shrink-0">
        <button onClick={onBack} className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:bg-gray-200 shrink-0">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-bold text-gray-900 flex-1 truncate">{albumName}</span>
        <button onClick={() => fileRef.current?.click()} disabled={uploading} title="Ajouter une photo"
          className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:bg-gray-200 disabled:opacity-50 shrink-0">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
            <p className="text-sm">Aucune photo dans cet album</p>
            <button onClick={() => fileRef.current?.click()} className="text-xs text-primary font-semibold">+ Ajouter une photo</button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5 p-0.5">
            {photos.map((photo, i) => (
              <button key={photo.id} className="aspect-square active:opacity-80 relative" onClick={() => setViewerIndex(i)}>
                <img src={photo.cloudinaryUrl} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUpload} />

      {viewerIndex !== null && (
        <PhotoViewer
          photos={photos}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onPrev={() => setViewerIndex(i => Math.max(0, i - 1))}
          onNext={() => setViewerIndex(i => Math.min(photos.length - 1, i + 1))}
          onDelete={handleDeletePhoto}
        />
      )}
    </>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
      <svg className="h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 18h16.5M3.75 21h16.5" />
      </svg>
      <p className="text-sm">Aucun média pour l'instant</p>
    </div>
  )
}
