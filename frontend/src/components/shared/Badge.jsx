const VARIANTS = {
  admin: 'bg-purple-100 text-purple-800',
  member: 'bg-blue-100 text-blue-800',
  readonly: 'bg-gray-100 text-gray-600',
  birthday: 'bg-pink-100 text-pink-800',
  default: 'bg-gray-100 text-gray-700',
}

export default function Badge({ label, variant = 'default' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANTS[variant] ?? VARIANTS.default}`}>
      {label}
    </span>
  )
}
