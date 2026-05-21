const STRING_SIZES = {
  xs: { cls: 'h-6 w-6',   fontSize: 10 },
  sm: { cls: 'h-8 w-8',   fontSize: 12 },
  md: { cls: 'h-12 w-12', fontSize: 14 },
  lg: { cls: 'h-20 w-20', fontSize: 20 },
  xl: { cls: 'h-28 w-28', fontSize: 30 },
}

export default function Avatar({ src, name, member, size = 'md', className = '' }) {
  const resolvedSrc  = src  ?? member?.profilePictureUrl
  const resolvedName = name ?? (member ? `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim() : null)

  const initials = resolvedName
    ?.split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'

  const isNumeric = typeof size === 'number'
  const sizeCls   = isNumeric ? '' : (STRING_SIZES[size]?.cls ?? STRING_SIZES.md.cls)
  const sizeStyle = isNumeric
    ? { width: size, height: size, minWidth: size, minHeight: size, fontSize: Math.round(size * 0.38) }
    : { fontSize: STRING_SIZES[size]?.fontSize ?? STRING_SIZES.md.fontSize }

  return resolvedSrc ? (
    <img
      src={resolvedSrc}
      alt={resolvedName ?? ''}
      className={`${sizeCls} rounded-full object-cover shrink-0 ${className}`}
      style={sizeStyle}
    />
  ) : (
    <div
      className={`${sizeCls} rounded-full bg-primary flex items-center p-1 justify-center text-white font-semibold shrink-0 select-none ${className}`}
      style={sizeStyle}
    >
      {initials}
    </div>
  )
}
