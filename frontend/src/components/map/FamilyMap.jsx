import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MarkerClusterer } from '@googlemaps/markerclusterer'

const MAP_STYLE = [
  { featureType: 'all', elementType: 'geometry', stylers: [{ color: '#f8f8f8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dce8f7' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9ac0dc' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#ebebeb' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#aaaaaa' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ffd966' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#c9c9c9' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#444444' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f0f0f0' }] },
]

function groupByLocation(members) {
  const groups = {}
  for (const m of members) {
    if (!m.latitude || !m.longitude) continue
    const key = `${Math.round(m.latitude * 5000)},${Math.round(m.longitude * 5000)}`
    if (!groups[key]) groups[key] = { lat: m.latitude, lng: m.longitude, members: [] }
    groups[key].members.push(m)
  }
  return Object.values(groups)
}

function getPrimaryColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--c-primary').trim() || '#52B788'
}

function makeSvgMarker(count) {
  const size = count > 1 ? 46 : 36
  const bg = getPrimaryColor()
  const inner = `<text x="${size / 2}" y="${size / 2 + 5}" text-anchor="middle" fill="white" font-size="15" font-weight="700" font-family="system-ui,sans-serif">${count}</text>`
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="${bg}" stroke="white" stroke-width="2.5"/>
    ${inner}
  </svg>`
  return {
    url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(size, size),
    anchor: new window.google.maps.Point(size / 2, size / 2),
  }
}

function makeInfoContent(members) {
  const primary = getPrimaryColor()
  return members.map((m, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:6px 0;${i < members.length - 1 ? 'border-bottom:1px solid #f0f0f0;' : ''}min-width:200px">
      <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;background:#e8e7f7;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        ${m.profilePictureUrl
          ? `<img src="${m.profilePictureUrl}" style="width:100%;height:100%;object-fit:cover" />`
          : `<span style="font-size:13px;font-weight:700;color:${primary}">${m.firstName[0]}${m.lastName[0]}</span>`}
      </div>
      <div style="flex:1">
        <p style="font-size:13px;font-weight:600;color:#111;margin:0">${m.firstName} ${m.lastName}</p>
        <p style="font-size:11px;color:#888;margin:2px 0 4px">${m.city ?? ''}</p>
        <a href="/profile/${m.id}" onclick="window._gmNav('${m.id}');return false"
          style="font-size:11px;color:${primary};font-weight:600;text-decoration:none">Voir le profil →</a>
      </div>
      ${i === 0 ? `<button onclick="window._gmClose();return false"
        style="background:none;border:none;cursor:pointer;font-size:26px;color:#aaa;line-height:1;padding:0 4px;flex-shrink:0;align-self:flex-start">&times;</button>` : ''}
    </div>`).join('')
}

export default function FamilyMap({ members, currentMemberId }) {
  const mapRef = useRef(null)
  const instanceRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    window._gmNav = (id) => navigate(`/profile/${id}`)
    window._gmClose = () => {
      if (window._gmOpenWindow) { window._gmOpenWindow.close(); window._gmOpenWindow = null }
    }
    return () => { delete window._gmNav; delete window._gmClose; delete window._gmOpenWindow }
  }, [navigate])

  useEffect(() => {
    let cancelled = false
    let attempts = 0

    function initMap() {
      if (cancelled || !mapRef.current) return
      if (!window.google?.maps) {
        if (attempts++ < 30) setTimeout(initMap, 200)
        return
      }

      const located = members.filter(m => m.latitude && m.longitude)

      // Center on current user's location first, then fallback to bounding box or France
      let center = { lat: 46.5, lng: 2.5 }
      let zoom = 5
      const currentMember = currentMemberId ? located.find(m => m.id === currentMemberId) : null
      if (currentMember) {
        center = { lat: currentMember.latitude, lng: currentMember.longitude }
        zoom = 12
      } else if (located.length === 1) {
        center = { lat: located[0].latitude, lng: located[0].longitude }
        zoom = 12
      } else if (located.length > 1) {
        const lats = located.map(m => m.latitude)
        const lngs = located.map(m => m.longitude)
        center = {
          lat: (Math.min(...lats) + Math.max(...lats)) / 2,
          lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
        }
        zoom = 6
      }

      if (instanceRef.current) {
        instanceRef.current.__clusterer?.clearMarkers()
        instanceRef.current.__infoWindows?.forEach(w => w.close())
        instanceRef.current.setCenter(center)
      } else {
        instanceRef.current = new window.google.maps.Map(mapRef.current, {
          center, zoom,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_CENTER },
          gestureHandling: 'greedy',
          styles: MAP_STYLE,
          minZoom: 2,
        })
      }

      const map = instanceRef.current
      const infoWindows = []

      const groups = groupByLocation(located)
      const groupMarkers = groups.map(group => {
        const count = group.members.length
        const marker = new window.google.maps.Marker({
          position: { lat: group.lat, lng: group.lng },
          icon: makeSvgMarker(count),
        })
        marker.__memberCount = count

        const iw = new window.google.maps.InfoWindow({
          content: `<div style="font-family:system-ui,sans-serif;padding:4px 0">${makeInfoContent(group.members)}</div>`,
          pixelOffset: new window.google.maps.Size(0, -10),
        })

        window.google.maps.event.addListener(iw, 'domready', () => {
          document.querySelectorAll('.gm-style-iw-chr').forEach(el => { el.style.display = 'none' })
        })

        marker.addListener('click', () => {
          if (window._gmOpenWindow) window._gmOpenWindow.close()
          iw.open(map, marker)
          window._gmOpenWindow = iw
        })

        infoWindows.push(iw)
        return marker
      })

      map.addListener('click', () => {
        if (window._gmOpenWindow) { window._gmOpenWindow.close(); window._gmOpenWindow = null }
      })

      const clusterer = new MarkerClusterer({
        map,
        markers: groupMarkers,
        renderer: {
          render({ position, markers: clusterMarkers }) {
            const total = clusterMarkers.reduce((s, m) => s + (m.__memberCount || 1), 0)
            return new window.google.maps.Marker({
              position,
              icon: makeSvgMarker(total),
              zIndex: Number(window.google.maps.Marker.MAX_ZINDEX) + total,
            })
          },
        },
      })

      map.__clusterer = clusterer
      map.__infoWindows = infoWindows
    }

    initMap()
    return () => { cancelled = true }
  }, [members])

  return <div ref={mapRef} className="w-full h-full" />
}
