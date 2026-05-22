import { useNavigate } from 'react-router-dom'

export default function Privacy() {
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
          <h1 className="text-base font-bold text-white">Politique de confidentialité</h1>
        </div>
      </div>

      <div className="px-4 py-5 space-y-3 pb-10">

        {/* Intro */}
        <div className="rounded-2xl bg-white shadow-sm p-4 space-y-2">
          <p className="text-xs text-gray-400">Dernière mise à jour : mai 2026</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            MyBigFamily est une application web privée, accessible sur invitation uniquement, destinée à une famille.
            Cette politique explique quelles données nous collectons, pourquoi, et quels sont vos droits.
          </p>
        </div>

        <Section title="1. Responsable du traitement">
          <p className="text-sm text-gray-600 leading-relaxed">
            Le responsable du traitement des données est l'administrateur de l'espace famille MyBigFamily.
            Pour toute question ou demande relative à vos données, contactez-nous à{' '}
            <a href="mailto:bonjour@mybigfamily.fr" className="text-primary font-medium underline">
              bonjour@mybigfamily.fr
            </a>.
          </p>
        </Section>

        <Section title="2. Données collectées">
          <p className="text-sm text-gray-600 mb-3">Nous collectons les données suivantes selon les fonctionnalités utilisées :</p>
          <div className="space-y-2">
            {[
              { label: 'Identité', value: 'Prénom, nom de famille' },
              { label: 'Contact', value: 'Adresse e-mail, numéro de téléphone' },
              { label: 'Profil', value: 'Date de naissance, biographie, profession, loisirs, photo de profil' },
              { label: 'Adresse', value: 'Adresse postale, code postal, ville, pays, coordonnées GPS' },
              { label: 'Réseaux sociaux', value: 'Lien Facebook, nom Instagram, numéro WhatsApp (facultatifs)' },
              { label: 'Compte', value: 'Adresse e-mail, mot de passe chiffré (bcrypt), rôle' },
              { label: 'Activité', value: 'Logs des actions réalisées dans l'application' },
              { label: 'Notifications', value: 'Identifiant d'abonnement aux notifications push' },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-2 text-sm">
                <span className="shrink-0 font-semibold text-gray-800">{label} :</span>
                <span className="text-gray-500">{value}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="3. Finalités du traitement">
          <ul className="space-y-2 text-sm text-gray-600">
            {[
              'Fournir un espace de partage familial privé (arbre généalogique, photos, carte, événements)',
              'Gérer l'authentification et la sécurité des accès',
              'Envoyer des emails transactionnels (invitations, réinitialisation de mot de passe)',
              'Envoyer des notifications push pour les événements familiaux',
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-3 rounded-xl bg-primary/8 border border-primary/15 px-3 py-2.5">
            <p className="text-xs text-gray-600">
              Base légale : <span className="font-semibold text-gray-800">intérêt légitime</span> (accès réservé à la famille, aucune finalité commerciale)
              et <span className="font-semibold text-gray-800">consentement</span> pour les notifications push.
            </p>
          </div>
        </Section>

        <Section title="4. Durée de conservation">
          <div className="space-y-2">
            {[
              { label: 'Compte utilisateur', value: 'Jusqu'à suppression du compte' },
              { label: 'Profil membre', value: 'Tant que l'espace famille est actif' },
              { label: 'Logs d'activité', value: '12 mois maximum' },
              { label: 'Photos', value: 'Jusqu'à suppression manuelle ou date d'expiration définie' },
              { label: 'Tokens de réinitialisation', value: 'Expirés après 1 heure' },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-2 text-sm">
                <span className="shrink-0 font-semibold text-gray-800">{label} :</span>
                <span className="text-gray-500">{value}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="5. Sous-traitants">
          <p className="text-sm text-gray-600 mb-3">
            Vos données peuvent transiter par les prestataires suivants, dans le cadre strict de l'hébergement et de l'envoi d'emails :
          </p>
          <div className="space-y-2">
            {[
              { name: 'Brevo', role: 'Envoi d'emails transactionnels (e-mail, prénom)' },
              { name: 'Cloudflare R2', role: 'Stockage des photos et images de profil' },
              { name: 'Railway', role: 'Hébergement du serveur backend' },
              { name: 'Neon', role: 'Base de données PostgreSQL hébergée' },
              { name: 'Vercel', role: 'Hébergement du frontend' },
            ].map(({ name, role }) => (
              <div key={name} className="flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
                <span className="text-sm font-semibold text-gray-800 shrink-0">{name}</span>
                <span className="text-xs text-gray-500 pt-px">{role}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">Aucune donnée n'est vendue ni partagée à des fins publicitaires.</p>
        </Section>

        <Section title="6. Vos droits (RGPD)">
          <div className="space-y-2">
            {[
              { right: 'Droit d'accès', desc: 'Obtenir une copie de vos données personnelles' },
              { right: 'Droit de rectification', desc: 'Corriger vos informations depuis votre profil' },
              { right: 'Droit à l'effacement', desc: 'Supprimer votre compte depuis les paramètres de votre profil' },
              { right: 'Droit à la portabilité', desc: 'Télécharger vos données au format JSON depuis votre profil' },
              { right: 'Droit d'opposition', desc: 'Désactiver les notifications push à tout moment' },
            ].map(({ right, desc }) => (
              <div key={right} className="flex items-start gap-3 rounded-xl bg-primary/5 px-3 py-2.5">
                <div className="mt-0.5 h-4 w-4 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{right}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-3 leading-relaxed">
            Pour exercer ces droits, rendez-vous sur votre profil ou contactez-nous à{' '}
            <a href="mailto:bonjour@mybigfamily.fr" className="text-primary font-medium underline">
              bonjour@mybigfamily.fr
            </a>.
          </p>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            Vous pouvez également déposer une réclamation auprès de la{' '}
            <span className="font-semibold text-gray-800">CNIL</span> (Commission Nationale de l'Informatique et des Libertés) : cnil.fr
          </p>
        </Section>

        <Section title="7. Sécurité">
          <p className="text-sm text-gray-600 leading-relaxed">
            Vos mots de passe sont chiffrés avec l'algorithme bcrypt et ne sont jamais stockés en clair.
            Les accès sont sécurisés par token JWT et cookies HttpOnly.
            L'accès à l'application est strictement limité aux membres invités.
          </p>
        </Section>

        <Section title="8. Cookies">
          <p className="text-sm text-gray-600 leading-relaxed">
            MyBigFamily utilise un cookie technique (<span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">access_token</span>) nécessaire
            au fonctionnement de l'authentification. Aucun cookie publicitaire ou analytique n'est utilisé.
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
