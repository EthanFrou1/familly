import { useEffect, useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { albumsApi, photosApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { usePageRefresh } from '../hooks/usePageRefresh'
import PhotoViewer from '../components/photos/PhotoViewer'
import CreateAlbumModal from '../components/photos/CreateAlbumModal'
import GalleryPickerModal from '../components/photos/GalleryPickerModal'
import PhotoDeleteModal from '../components/photos/PhotoDeleteModal'
import ConfirmModal from '../components/shared/ConfirmModal'
const BATCH_SIZE = 30

function getDownloadedIds(albumId) {
  try { return new Set(JSON.parse(localStorage.getItem(`dl_${albumId}`) ?? '[]')) }
  catch { return new Set() }
}

function persistDownloadedIds(albumId, newIds) {
  const all = getDownloadedIds(albumId)
  newIds.forEach(id => all.add(id))
  localStorage.setItem(`dl_${albumId}`, JSON.stringify([...all]))
  return all
}

const PHOTO_TABS = ['galerie', 'album']
const TAB_LABELS = { galerie: 'Galerie', album: 'Albums' }
const AUTHOR_FILTERS = ['tous', 'moi', 'autres']
const AUTHOR_LABELS = { tous: 'Tous', moi: 'Mes photos', autres: 'Les autres' }

export default function Photos() {
  const [tab, setTab] = useState('galerie')

  return (
    <div className="flex flex-col h-full">
      <div className="flex shrink-0 bg-dark">
        {PHOTO_TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-5 text-sm font-medium transition-colors min-h-touch ${
              tab === t ? 'border-b-2 border-white text-white' : 'text-white/50'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      {tab === 'galerie' ? <GalerieTab /> : <AlbumsTab />}
    </div>
  )
}

function GalerieTab() {
  const { user } = useAuth()
  const [authorFilter, setAuthorFilter] = useState('tous')
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [downloading, setDownloading] = useState(false)
  const [galleryDeleting, setGalleryDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    photosApi.getAll().then(({ data }) => setPhotos(data)).finally(() => setLoading(false))
  }, [])

  usePageRefresh(() => {
    photosApi.getAll().then(({ data }) => setPhotos(data)).catch(() => {})
  })

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.4, maxWidthOrHeight: 1200 })
      const { data } = await photosApi.upload(compressed, 'feed', null, null)
      setPhotos(prev => [data, ...prev])
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function handleAlbumLinked(photoId, albumId) {
    setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, albumId } : p))
  }

  async function handleDelete(photoId) {
    await photosApi.delete(photoId)
    setPhotos(prev => prev.filter(p => p.id !== photoId))
    setViewerIndex(null)
  }

  function toggleSelectionMode() {
    setSelectionMode(prev => !prev)
    setSelectedIds(new Set())
  }

  function togglePhotoSelect(photoId) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(photoId)) next.delete(photoId)
      else next.add(photoId)
      return next
    })
  }

  async function handleDownloadSelected() {
    const selected = filteredPhotos.filter(p => selectedIds.has(p.id))
    if (!selected.length) return
    setDownloading(true)
    try {
      const blobs = await Promise.all(
        selected.map(p => fetch(`/api/photos/${p.id}/download`, { credentials: 'include' }).then(r => r.blob()))
      )
      const files = blobs.map((b, i) => new File([b], `photo-${i + 1}.jpg`, { type: b.type || 'image/jpeg' }))
      if (navigator.canShare?.({ files })) {
        await navigator.share({ files })
      } else {
        for (let i = 0; i < selected.length; i++) {
          const a = document.createElement('a')
          a.href = `/api/photos/${selected[i].id}/download`
          a.download = `photo-${i + 1}.jpg`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          if (i < selected.length - 1) await new Promise(r => setTimeout(r, 150))
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Download failed', e)
    } finally {
      setDownloading(false)
    }
  }

  async function handleDeleteSelected() {
    const toDelete = filteredPhotos.filter(p =>
      selectedIds.has(p.id) && (p.uploaderId === user?.memberId || user?.role === 'Admin')
    )
    if (!toDelete.length) return
    setGalleryDeleting(true)
    try {
      await Promise.all(toDelete.map(p => photosApi.delete(p.id)))
      setPhotos(prev => prev.filter(p => !toDelete.some(d => d.id === p.id)))
      setSelectedIds(new Set())
      setSelectionMode(false)
      setShowDeleteConfirm(false)
    } finally {
      setGalleryDeleting(false)
    }
  }

  const filteredPhotos = photos.filter(p => {
    if (authorFilter === 'moi') return p.uploaderId === user?.memberId
    if (authorFilter === 'autres') return p.uploaderId !== user?.memberId
    return true
  })

  const hasContent = uploading || filteredPhotos.length > 0

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-100 shrink-0">
        <div className="flex gap-1.5 flex-1">
          {AUTHOR_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setAuthorFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                authorFilter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
              }`}
            >
              {AUTHOR_LABELS[f]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={toggleSelectionMode}
            title={selectionMode ? 'Annuler la sélection' : 'Sélectionner des photos'}
            className={`h-8 w-8 flex items-center justify-center rounded-full transition-colors ${
              selectionMode ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
            }`}
          >
            {selectionMode
              ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            }
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} title="Ajouter une photo"
            className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:bg-gray-200 disabled:opacity-50">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
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
          <div className="grid grid-cols-3 gap-0.5 p-0.5">
            {uploading && <UploadPlaceholder />}
            {filteredPhotos.map((photo, i) => (
              <PhotoThumb
                key={photo.id}
                photo={photo}
                onClick={selectionMode ? () => togglePhotoSelect(photo.id) : () => setViewerIndex(i)}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(photo.id)}
              />
            ))}
          </div>
        )}
      </div>

      {selectionMode && selectedIds.size > 0 && (() => {
        const deletableCount = filteredPhotos.filter(p =>
          selectedIds.has(p.id) && (p.uploaderId === user?.memberId || user?.role === 'Admin')
        ).length
        return (
          <div className="shrink-0 px-4 pt-3 pb-5 bg-white border-t border-gray-100 flex gap-2">
            {deletableCount > 0 && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={downloading || galleryDeleting}
                className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white disabled:opacity-50 active:opacity-80"
              >
                Supprimer ({deletableCount})
              </button>
            )}
            <button
              onClick={handleDownloadSelected}
              disabled={downloading || galleryDeleting}
              className={`${deletableCount > 0 ? 'flex-1' : 'w-full'} rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50 active:opacity-80`}
            >
              {downloading ? 'Téléchargement…' : `Télécharger (${selectedIds.size})`}
            </button>
          </div>
        )
      })()}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

      {viewerIndex !== null && (() => {
        const currentPhoto = filteredPhotos[viewerIndex]
        const canDelete = user?.role === 'Admin' || currentPhoto?.uploaderId === user?.memberId
        return (
          <PhotoViewer
            photos={filteredPhotos}
            index={viewerIndex}
            onClose={() => setViewerIndex(null)}
            onPrev={() => setViewerIndex(i => Math.max(0, i - 1))}
            onNext={() => setViewerIndex(i => Math.min(filteredPhotos.length - 1, i + 1))}
            onAlbumLinked={handleAlbumLinked}
            onDelete={canDelete ? handleDelete : undefined}
          />
        )
      })()}

      <ConfirmModal
        open={showDeleteConfirm}
        title="Supprimer les photos ?"
        message={`Les photos sélectionnées seront définitivement supprimées.`}
        confirmLabel={galleryDeleting ? 'Suppression…' : 'Supprimer'}
        onConfirm={handleDeleteSelected}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  )
}

const ALBUM_FILTERS = ['tous', 'moi']
const ALBUM_FILTER_LABELS = { tous: 'Tous', moi: 'Mes albums' }

function AlbumsTab() {
  const { user } = useAuth()
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [albumFilter, setAlbumFilter] = useState('tous')

  useEffect(() => {
    albumsApi.getAll().then(({ data }) => setAlbums(data)).finally(() => setLoading(false))
  }, [])

  usePageRefresh(() => {
    albumsApi.getAll().then(({ data }) => setAlbums(data)).catch(() => {})
  })

  if (selectedAlbum) {
    return (
      <AlbumDetail
        album={selectedAlbum}
        onBack={() => setSelectedAlbum(null)}
        onDeleted={() => {
          setAlbums(prev => prev.filter(a => a.id !== selectedAlbum.id))
          setSelectedAlbum(null)
        }}
        onPhotoCountChange={(albumId, count) =>
          setAlbums(prev => prev.map(a => a.id === albumId ? { ...a, photoCount: count } : a))
        }
      />
    )
  }

  const filteredAlbums = albumFilter === 'moi'
    ? albums.filter(a => a.creatorId === user?.memberId)
    : albums

  return (
    <>
      <div className="flex flex-col bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between px-4 pt-2.5 pb-1.5">
          <div className="flex gap-2">
            {ALBUM_FILTERS.map(f => (
              <button key={f} onClick={() => setAlbumFilter(f)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  albumFilter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                }`}
              >
                {ALBUM_FILTER_LABELS[f]}
              </button>
            ))}
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white active:bg-primary-dark">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nouvel album
          </button>
        </div>
        <p className="text-xs text-gray-400 px-4 pb-2">{filteredAlbums.length} album{filteredAlbums.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filteredAlbums.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
            <svg className="h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            <p className="text-sm">{albumFilter === 'moi' ? 'Aucun album créé par vous' : 'Aucun album'}</p>
          </div>
        ) : (
          <div className="p-3 grid grid-cols-2 gap-3">
            {filteredAlbums.map(album => {
              const daysLeft = album.expiresAt
                ? Math.ceil((new Date(album.expiresAt) - new Date()) / 86400000)
                : null
              return (
                <button key={album.id} onClick={() => setSelectedAlbum(album)}
                  className="flex flex-col rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100 active:opacity-80 text-left">
                  <div className="aspect-square w-full bg-gray-100 relative overflow-hidden flex-shrink-0">
                    {album.coverUrl
                      ? <img src={album.coverUrl} alt="" className="h-full w-full object-cover" />
                      : <div className="h-full w-full flex items-center justify-center text-gray-300">
                          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909" />
                          </svg>
                        </div>
                    }
                    {daysLeft !== null && daysLeft <= 30 && (
                      <span className="absolute top-1.5 right-1.5 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        J-{daysLeft}
                      </span>
                    )}
                    {!album.allowMemberUploads && (
                      <span className="absolute top-1.5 left-1.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                        🔒
                      </span>
                    )}
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{album.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{album.photoCount} photo{album.photoCount !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-gray-400 truncate">Par {album.creatorName?.split(' ')[0]}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <CreateAlbumModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={a => setAlbums(prev => [a, ...prev])} />
    </>
  )
}

function AlbumDetail({ album, onBack, onDeleted, onPhotoCountChange }) {
  const { user } = useAuth()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadedIds, setDownloadedIds] = useState(() => getDownloadedIds(album.id))
  const [showGalleryPicker, setShowGalleryPicker] = useState(false)
  const [photoDeleteTarget, setPhotoDeleteTarget] = useState(null)
  const [photoDeleteLoading, setPhotoDeleteLoading] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [batchDownloading, setBatchDownloading] = useState(false)
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false)
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false)
  const fileRef = useRef(null)

  const isAdmin = user?.role === 'Admin'
  const isCreator = detail?.creatorId === user?.memberId
  const canUpload = album.allowMemberUploads || isCreator || isAdmin
  const canDelete = isCreator || isAdmin

  useEffect(() => {
    albumsApi.getById(album.id).then(({ data }) => setDetail(data)).finally(() => setLoading(false))
  }, [album.id])

  useEffect(() => {
    if (detail) onPhotoCountChange?.(album.id, detail.photos.length)
  }, [detail?.photos?.length])

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.4, maxWidthOrHeight: 1200 })
      const { data } = await albumsApi.addPhoto(album.id, compressed)
      setDetail(prev => ({ ...prev, photos: [data, ...prev.photos] }))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleRemoveFromAlbum(photoId) {
    setPhotoDeleteLoading(true)
    try {
      await photosApi.setAlbum(photoId, null)
      setDetail(prev => ({ ...prev, photos: prev.photos.filter(p => p.id !== photoId) }))
      setViewerIndex(null)
      setPhotoDeleteTarget(null)
    } finally {
      setPhotoDeleteLoading(false)
    }
  }

  async function handleDeletePermanently(photoId) {
    setPhotoDeleteLoading(true)
    try {
      await albumsApi.removePhoto(album.id, photoId)
      setDetail(prev => ({ ...prev, photos: prev.photos.filter(p => p.id !== photoId) }))
      setViewerIndex(null)
      setPhotoDeleteTarget(null)
    } finally {
      setPhotoDeleteLoading(false)
    }
  }

  function markPhotoDownloaded(photoId) {
    setDownloadedIds(persistDownloadedIds(album.id, [photoId]))
  }

  async function handleSaveToPhotos() {
    const photos = detail?.photos ?? []
    const remaining = photos.filter(p => !downloadedIds.has(p.id))
    const batch = remaining.slice(0, BATCH_SIZE)
    if (batch.length === 0) return
    setDownloading(true)
    try {
      const blobs = await Promise.all(batch.map(p => fetch(`/api/photos/${p.id}/download`, { credentials: 'include' }).then(r => r.blob())))
      const files = blobs.map((b, i) => new File([b], `photo-${i + 1}.jpg`, { type: b.type || 'image/jpeg' }))
      if (navigator.canShare?.({ files })) {
        await navigator.share({ files, title: album.name })
        setDownloadedIds(persistDownloadedIds(album.id, batch.map(p => p.id)))
      } else {
        // Fallback desktop : téléchargement de la première photo
        const url = batch[0].cloudinaryUrl.replace('/upload/', '/upload/fl_attachment/')
        const a = document.createElement('a')
        a.href = url
        a.download = 'photo.jpg'
        a.click()
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Share failed', e)
    } finally {
      setDownloading(false)
    }
  }

  function handleGalleryAdded(newPhotos) {
    setDetail(prev => ({ ...prev, photos: [...(prev?.photos ?? []), ...newPhotos] }))
  }

  function toggleSelectionMode() {
    setSelectionMode(prev => !prev)
    setSelectedIds(new Set())
  }

  function togglePhotoSelect(photoId) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(photoId)) next.delete(photoId)
      else next.add(photoId)
      return next
    })
  }

  async function handleBatchDownload() {
    const selected = photos.filter(p => selectedIds.has(p.id))
    if (!selected.length) return
    setBatchDownloading(true)
    try {
      const blobs = await Promise.all(
        selected.map(p => fetch(`/api/photos/${p.id}/download`, { credentials: 'include' }).then(r => r.blob()))
      )
      const files = blobs.map((b, i) => new File([b], `photo-${i + 1}.jpg`, { type: b.type || 'image/jpeg' }))
      if (navigator.canShare?.({ files })) {
        await navigator.share({ files })
      } else {
        for (let i = 0; i < selected.length; i++) {
          const a = document.createElement('a')
          a.href = `/api/photos/${selected[i].id}/download`
          a.download = `photo-${i + 1}.jpg`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          if (i < selected.length - 1) await new Promise(r => setTimeout(r, 150))
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Download failed', e)
    } finally {
      setBatchDownloading(false)
    }
  }

  async function handleBatchRemoveFromAlbum() {
    setBatchDeleteLoading(true)
    try {
      await Promise.all([...selectedIds].map(id => photosApi.setAlbum(id, null)))
      setDetail(prev => ({ ...prev, photos: prev.photos.filter(p => !selectedIds.has(p.id)) }))
      setSelectedIds(new Set())
      setShowBatchDeleteModal(false)
      setSelectionMode(false)
    } finally {
      setBatchDeleteLoading(false)
    }
  }

  async function handleBatchDeletePermanently() {
    setBatchDeleteLoading(true)
    try {
      await Promise.all([...selectedIds].map(id => albumsApi.removePhoto(album.id, id)))
      setDetail(prev => ({ ...prev, photos: prev.photos.filter(p => !selectedIds.has(p.id)) }))
      setSelectedIds(new Set())
      setShowBatchDeleteModal(false)
      setSelectionMode(false)
    } finally {
      setBatchDeleteLoading(false)
    }
  }

  async function handleDeleteAlbum() {
    setDeleting(true)
    try {
      await albumsApi.delete(album.id)
      onDeleted()
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const photos = detail?.photos ?? []
  const remaining = photos.filter(p => !downloadedIds.has(p.id))
  const allSaved = photos.length > 0 && remaining.length === 0
  const batchCount = Math.min(remaining.length, BATCH_SIZE)

  const expiryLabel = album.expiresAt
    ? new Date(album.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shrink-0">
        <button onClick={onBack} className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:bg-gray-200 shrink-0">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{album.name}</p>
          {expiryLabel && (
            <p className="text-[10px] text-amber-500 font-medium">Expire le {expiryLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Save to Photos */}
          {photos.length > 0 && (
            <button
              onClick={handleSaveToPhotos}
              disabled={downloading || allSaved}
              title={allSaved ? 'Toutes les photos enregistrées' : `Enregistrer dans Photos (${batchCount})`}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 disabled:opacity-50 relative"
            >
              {downloading
                ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                : allSaved
                  ? <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  : <>
                      <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      {remaining.length < photos.length && remaining.length > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-white text-[9px] flex items-center justify-center font-bold leading-none">
                          {remaining.length}
                        </span>
                      )}
                    </>
              }
            </button>
          )}
          {photos.length > 0 && (
            <button
              onClick={toggleSelectionMode}
              title={selectionMode ? 'Annuler la sélection' : 'Sélectionner des photos'}
              className={`h-8 w-8 flex items-center justify-center rounded-full transition-colors ${
                selectionMode ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
              }`}
            >
              {selectionMode
                ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
              }
            </button>
          )}
          {canUpload && !selectionMode && (
            <>
              <button onClick={() => setShowGalleryPicker(true)} title="Ajouter depuis la galerie"
                className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:bg-gray-200">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button onClick={() => fileRef.current?.click()} disabled={uploading} title="Prendre une photo"
                className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:bg-gray-200 disabled:opacity-50">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </>
          )}
          {canDelete && !selectionMode && (
            <button onClick={() => setConfirmDelete(true)} title="Supprimer l'album"
              className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-red-400 active:bg-red-50">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M3 7h18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : photos.length === 0 && !uploading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
            <p className="text-sm">Aucune photo dans cet album</p>
            {canUpload && (
              <button onClick={() => fileRef.current?.click()} className="text-xs text-primary font-semibold">+ Ajouter une photo</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5 p-0.5">
            {uploading && <UploadPlaceholder />}
            {photos.map((photo, i) => (
              <PhotoThumb
                key={photo.id}
                photo={photo}
                onClick={selectionMode ? () => togglePhotoSelect(photo.id) : () => setViewerIndex(i)}
                isDownloaded={!selectionMode && downloadedIds.has(photo.id)}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(photo.id)}
              />
            ))}
          </div>
        )}
      </div>

      {selectionMode && selectedIds.size > 0 && (
        <div className="shrink-0 px-4 pt-3 pb-5 bg-white border-t border-gray-100 flex gap-2">
          <button
            onClick={() => setShowBatchDeleteModal(true)}
            disabled={batchDownloading}
            className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white disabled:opacity-50 active:opacity-80"
          >
            Supprimer ({selectedIds.size})
          </button>
          <button
            onClick={handleBatchDownload}
            disabled={batchDownloading}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50 active:opacity-80"
          >
            {batchDownloading ? 'En cours…' : `Télécharger (${selectedIds.size})`}
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

      {viewerIndex !== null && !selectionMode && (
        <PhotoViewer
          photos={photos}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onPrev={() => setViewerIndex(i => Math.max(0, i - 1))}
          onNext={() => setViewerIndex(i => Math.min(photos.length - 1, i + 1))}
          onDeleteRequest={canDelete ? (id => setPhotoDeleteTarget(id)) : undefined}
          onShared={markPhotoDownloaded}
        />
      )}

      <ConfirmModal
        open={confirmDelete}
        title="Supprimer l'album ?"
        message={`L'album "${album.name}" et toutes ses photos seront supprimés définitivement.`}
        confirmLabel={deleting ? 'Suppression…' : 'Supprimer'}
        onConfirm={handleDeleteAlbum}
        onCancel={() => setConfirmDelete(false)}
      />

      <GalleryPickerModal
        open={showGalleryPicker}
        albumId={album.id}
        existingPhotoIds={new Set(photos.map(p => p.id))}
        onClose={() => setShowGalleryPicker(false)}
        onAdded={handleGalleryAdded}
      />

      <PhotoDeleteModal
        open={photoDeleteTarget !== null}
        loading={photoDeleteLoading}
        onClose={() => setPhotoDeleteTarget(null)}
        onRemoveFromAlbum={() => handleRemoveFromAlbum(photoDeleteTarget)}
        onDeletePermanently={() => handleDeletePermanently(photoDeleteTarget)}
      />

      <PhotoDeleteModal
        open={showBatchDeleteModal}
        loading={batchDeleteLoading}
        count={selectedIds.size}
        onClose={() => setShowBatchDeleteModal(false)}
        onRemoveFromAlbum={handleBatchRemoveFromAlbum}
        onDeletePermanently={handleBatchDeletePermanently}
      />
    </>
  )
}

function PhotoThumb({ photo, onClick, isDownloaded, selectionMode, isSelected }) {
  const daysLeft = photo.expiresAt
    ? Math.ceil((new Date(photo.expiresAt) - new Date()) / 86400000)
    : null
  const showExpiry = daysLeft !== null && daysLeft <= 7

  return (
    <button className="aspect-square active:opacity-80 relative overflow-hidden" onClick={onClick}>
      <img src={photo.cloudinaryUrl} alt="" className="h-full w-full object-cover" />
      {photo.uploaderName && !selectionMode && (
        <span className="absolute bottom-1 left-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white truncate max-w-[80%]" style={{ backgroundColor: 'rgba(42,18,8,0.82)' }}>
          {photo.uploaderName.split(' ')[0]}
        </span>
      )}
      {showExpiry && !selectionMode && (
        <span className="absolute top-1 right-1 rounded-full bg-amber-500/90 px-1 py-px text-[9px] font-bold text-white">
          J-{daysLeft}
        </span>
      )}
      {selectionMode && (
        <>
          {isSelected && <div className="absolute inset-0 bg-primary/30" />}
          <span className={`absolute top-1.5 right-1.5 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center transition-colors ${
            isSelected ? 'bg-primary' : 'bg-black/40'
          }`}>
            {isSelected && (
              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
          </span>
        </>
      )}
      {isDownloaded && !selectionMode && (
        <span className="absolute top-1 left-1 h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </span>
      )}
    </button>
  )
}

function UploadPlaceholder() {
  return (
    <div className="aspect-square bg-gray-100 flex items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
      <svg className="h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 18h16.5M3.75 21h16.5" />
      </svg>
      <p className="text-sm">Aucune photo pour l&apos;instant</p>
    </div>
  )
}
