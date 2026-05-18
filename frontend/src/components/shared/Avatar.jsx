export default function Avatar({ src, name, size = 'md', className = '' }) {
  const sizes = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-12 w-12 text-sm', lg: 'h-20 w-20 text-xl', xl: 'h-28 w-28 text-3xl' }
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'

  return src ? (
    <img src={src} alt={name} className={`${sizes[size]} rounded-full object-cover ${className}`} />
  ) : (
    <div className={`${sizes[size]} rounded-full bg-primary flex items-center justify-center text-white font-semibold ${className}`}>
      {initials}
    </div>
  )
}
