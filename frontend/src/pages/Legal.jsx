import { useNavigate } from 'react-router-dom'

export default function Legal() {
  const navigate = useNavigate()

  return (
    <div className="h-screen overflow-y-auto bg-surface">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-dark px-4 pt-safe-top">
        <div className="flex items-center gap-3 py-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl text-white/70 active:bg-white/10 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-base font-bold text-white">Mentions légales</h1>
        </div>
      </div>

      <div className="px-4 py-5 space-y-3 pb-10">

        <Section title="Éditeur du site">
          <Row label="Site" value="www.mybigfamily.fr" />
          <Row label="Type" value="Application web privée, accès sur invitation" />
          <Row label="Contact" value="bonjour@mybigfamily.fr" isEmail />
        </Section>

        <Section title="Développement">
          <div className="rounded-xl bg-gray-50 px-3 py-2.5 space-y-0.5">
            <p className="text-sm font-semibold text-gray-800">etnof</p>
            <p className="text-xs text-gray-500">Conception & développement de l'application</p>
            <a
              href="https://website-etnof-web.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline"
            >
              website-etnof-web.vercel.app
            </a>
          </div>
        </Section>

        <Section title="Hébergement">
          <div className="space-y-2">
            {[
              { name: 'Vercel Inc.', role: 'Frontend (interface web)', detail: '340 Pine Street, San Francisco, CA — vercel.com' },
              { name: 'Railway Corp.', role: 'Backend (serveur API)', detail: 'San Francisco, CA — railway.app' },
              { name: 'Neon Inc.', role: 'Base de données PostgreSQL', detail: 'San Francisco, CA — neon.tech' },
              { name: 'Cloudflare R2', role: 'Stockage des photos et médias', detail: '101 Townsend St, San Francisco, CA — cloudflare.com' },
            ].map(({ name, role, detail }) => (
              <div key={name} className="rounded-xl bg-gray-50 px-3 py-2.5 space-y-0.5">
                <p className="text-sm font-semibold text-gray-800">{name}</p>
                <p className="text-xs text-gray-500">{role}</p>
                <p className="text-xs text-gray-400">{detail}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Propriété intellectuelle">
          <p className="text-sm text-gray-600 leading-relaxed">
            Le contenu de cette application (textes, photos, données familiales) appartient à ses membres.
            La structure et le code de l&apos;application sont la propriété de son éditeur.
            Toute reproduction sans autorisation est interdite.
          </p>
        </Section>

        <Section title="Données personnelles">
          <p className="text-sm text-gray-600 leading-relaxed">
            Le traitement des données personnelles est détaillé dans la{' '}
            <a href="/privacy" className="text-primary font-medium underline">
              politique de confidentialité
            </a>.
            Conformément au RGPD, vous pouvez exercer vos droits depuis votre profil ou en contactant{' '}
            <a href="mailto:bonjour@mybigfamily.fr" className="text-primary font-medium underline">
              bonjour@mybigfamily.fr
            </a>.
          </p>
        </Section>

        <Section title="Limitation de responsabilité">
          <p className="text-sm text-gray-600 leading-relaxed">
            L&apos;application est fournie à titre privé, sans garantie de disponibilité permanente.
            L&apos;éditeur ne saurait être tenu responsable des contenus publiés par les membres.
          </p>
        </Section>

        <p className="text-center text-xs text-gray-300 pt-2">
          MyBigFamily · Accès sur invitation uniquement
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl bg-white shadow-sm p-4 space-y-3">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</h2>
      {children}
    </div>
  )
}

function Row({ label, value, isEmail }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 font-semibold text-gray-800">{label} :</span>
      {isEmail ? (
        <a href={`mailto:${value}`} className="text-primary underline">{value}</a>
      ) : (
        <span className="text-gray-500">{value}</span>
      )}
    </div>
  )
}
