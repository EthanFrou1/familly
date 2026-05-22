import { useNavigate } from 'react-router-dom'

export default function Privacy() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl text-gray-500 active:bg-gray-100 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">Politique de confidentialité</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8 text-sm text-gray-700 leading-relaxed">

        <section className="space-y-2">
          <p className="text-xs text-gray-400">Dernière mise à jour : mai 2026</p>
          <p>
            MyBigFamily est une application web privée, accessible sur invitation uniquement, destinée à une famille.
            Cette politique explique quelles données nous collectons, pourquoi, et quels sont vos droits.
          </p>
        </section>

        <Section title="1. Responsable du traitement">
          <p>
            Le responsable du traitement des données est l'administrateur de l'espace famille MyBigFamily.
            Pour toute question ou demande relative à vos données, contactez-nous à l'adresse :{' '}
            <a href="mailto:bonjour@mybigfamily.fr" className="text-primary underline">bonjour@mybigfamily.fr</a>.
          </p>
        </Section>

        <Section title="2. Données collectées">
          <p>Nous collectons les données suivantes selon les fonctionnalités utilisées :</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Identité :</strong> prénom, nom de famille</li>
            <li><strong>Contact :</strong> adresse e-mail, numéro de téléphone</li>
            <li><strong>Profil :</strong> date de naissance, biographie, profession, loisirs, photo de profil</li>
            <li><strong>Adresse :</strong> adresse postale, code postal, ville, pays, coordonnées GPS</li>
            <li><strong>Réseaux sociaux :</strong> lien Facebook, nom Instagram, numéro WhatsApp (facultatifs)</li>
            <li><strong>Compte :</strong> adresse e-mail, mot de passe chiffré (bcrypt), rôle</li>
            <li><strong>Activité :</strong> logs des actions réalisées dans l'application</li>
            <li><strong>Notifications :</strong> identifiant d'abonnement aux notifications push</li>
          </ul>
        </Section>

        <Section title="3. Finalités du traitement">
          <ul className="list-disc pl-5 space-y-1">
            <li>Fournir un espace de partage familial privé (arbre généalogique, photos, carte, événements)</li>
            <li>Gérer l'authentification et la sécurité des accès</li>
            <li>Envoyer des emails transactionnels (invitations, réinitialisation de mot de passe)</li>
            <li>Envoyer des notifications push pour les événements familiaux</li>
          </ul>
          <p className="mt-2">
            Base légale : <strong>intérêt légitime</strong> (accès réservé à la famille, aucune finalité commerciale)
            et <strong>consentement</strong> pour les notifications push.
          </p>
        </Section>

        <Section title="4. Durée de conservation">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Compte utilisateur :</strong> conservé jusqu'à suppression du compte</li>
            <li><strong>Profil membre :</strong> conservé tant que l'espace famille est actif</li>
            <li><strong>Logs d'activité :</strong> conservés 12 mois</li>
            <li><strong>Photos :</strong> conservées jusqu'à suppression manuelle ou date d'expiration définie</li>
            <li><strong>Tokens de réinitialisation :</strong> expirés après 1 heure</li>
          </ul>
        </Section>

        <Section title="5. Sous-traitants (partage des données)">
          <p>Vos données peuvent transiter par les prestataires suivants, dans le cadre strict de l'hébergement et de l'envoi d'emails :</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Brevo (anciennement Sendinblue)</strong> — envoi d'emails transactionnels (e-mail, prénom)</li>
            <li><strong>Cloudflare R2</strong> — stockage des photos et images de profil</li>
            <li><strong>Railway</strong> — hébergement du serveur backend</li>
            <li><strong>Neon</strong> — base de données PostgreSQL hébergée</li>
            <li><strong>Vercel</strong> — hébergement du frontend</li>
          </ul>
          <p className="mt-2">Aucune donnée n'est vendue ni partagée à des fins publicitaires.</p>
        </Section>

        <Section title="6. Vos droits (RGPD)">
          <p>Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Droit d'accès</strong> — obtenir une copie de vos données personnelles</li>
            <li><strong>Droit de rectification</strong> — corriger vos informations depuis votre profil</li>
            <li><strong>Droit à l'effacement</strong> — supprimer votre compte depuis les paramètres de votre profil</li>
            <li><strong>Droit à la portabilité</strong> — télécharger vos données au format JSON depuis votre profil</li>
            <li><strong>Droit d'opposition</strong> — désactiver les notifications push à tout moment</li>
          </ul>
          <p className="mt-2">
            Pour exercer ces droits, rendez-vous sur votre profil ou contactez-nous à{' '}
            <a href="mailto:bonjour@mybigfamily.fr" className="text-primary underline">bonjour@mybigfamily.fr</a>.
          </p>
          <p className="mt-2">
            Vous pouvez également déposer une réclamation auprès de la{' '}
            <strong>CNIL</strong> (Commission Nationale de l'Informatique et des Libertés) :{' '}
            <span className="text-gray-500">www.cnil.fr</span>
          </p>
        </Section>

        <Section title="7. Sécurité">
          <p>
            Vos mots de passe sont chiffrés avec l'algorithme bcrypt et ne sont jamais stockés en clair.
            Les accès à l'application sont sécurisés par token JWT et cookies HttpOnly.
            L'accès est strictement limité aux membres invités.
          </p>
        </Section>

        <Section title="8. Cookies">
          <p>
            MyBigFamily utilise un cookie technique (<code className="bg-gray-100 px-1 rounded text-xs">access_token</code>) nécessaire
            au fonctionnement de l'authentification. Aucun cookie publicitaire ou analytique n'est utilisé.
          </p>
        </Section>

        <div className="pt-4 border-t border-gray-100 text-xs text-gray-400 text-center">
          MyBigFamily · Accès sur invitation uniquement
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      {children}
    </section>
  )
}
