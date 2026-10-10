# CV de Yassine Hanachi — Développeur Full-Stack Java / Angular

Application personnelle destinée à présenter mon parcours, mes compétences et mes expériences aux recruteurs. Le CV web et le PDF utilisent les mêmes données professionnelles. Ce projet illustre la réalisation d’une interface Angular, d’une API Express, d’une administration authentifiée et d’un stockage relationnel.

**État au 10 octobre 2026 : GitHub Pages est activé, mais le site reste indisponible. La création Render est bloquée par une demande de carte bancaire. Cette configuration prépare un backend Netlify Free sans carte, avec Turso ; les huit paramètres privés du backend sont configurés dans Netlify en production ; la publication conjointe backend/frontend reste à valider.**

Adresse cible, actuellement indisponible : `https://hanachiyassine.github.io/hanachi-yassine-cv/`. Le lien de consultation sera ajouté après vérification du premier déploiement réussi. L’administration sera accessible à l’adresse HTTPS effective du backend Netlify, suivie de `/admin/`.

## Fonctionnalités

- Consultation du profil, des compétences, expériences et sous-projets, formations, langues, certifications et centres d’intérêt.
- Téléchargement du CV PDF A4 produit avec le modèle EJS existant et Puppeteer.
- Administration en ligne de toutes les rubriques, avec formulaires de gestion des expériences et de leurs sous-projets.
- Connexion administrateur avec bcrypt et jeton JWT valable une heure.
- Sauvegardes JSON avant et après chaque modification, téléchargement et restauration d’une version précédente.
- Choix entre SQLite local et Turso distant, y compris depuis un PC de développement.
- Pipeline de compilation, de vérification et de déploiement GitHub Actions, dont la publication nécessite la configuration décrite ci-dessous.

Le backend de cette application est écrit en Node.js ; Java et Spring apparaissent dans le parcours professionnel présenté par le CV.

## Architecture et technologies

| Élément | Technologie / emplacement |
|---|---|
| Interface publique | Angular 16, TypeScript 4.9, RxJS, HTML et SCSS ; `src/app/cv/` |
| API et administration | Node.js 22.17 minimum, Express 4 ; `backend/` |
| Authentification | bcrypt, jsonwebtoken ; `backend/auth.js` |
| Persistance | SQLite embarqué ou Turso/libSQL distant, avec `@libsql/client` |
| PDF | EJS et Puppeteer 25 ; `backend/template.ejs`, `backend/pdf.service.js` |
| Déploiement | GitHub Pages pour Angular, Netlify Functions Free pour Express, Turso pour les données |
| Vérifications | Tests d’intégration avec `node:test`, test PDF réel et compilation Angular |

Le navigateur consulte `/api/cv` et `/api/pdf`. En développement, le proxy Angular transmet ces requêtes au backend local. Sur GitHub Pages, la compilation reçoit l’adresse HTTPS du backend via `PUBLIC_API_URL`. Les identifiants Turso restent exclusivement dans le backend.

Le nom interne `angular-quickstart` subsiste dans Angular CLI et dans le dossier `dist/angular-quickstart` ; il ne désigne pas le contenu de l’application.

## Prérequis

- Git et npm.
- **Frontend Angular 16 : Node.js 18** pour utiliser la combinaison compatible avec cette version d’Angular CLI. Les workflows isolent cet ancien outil de compilation du backend.
- **Backend : Node.js 22.17 ou ultérieur.** Utiliser deux terminaux avec les versions appropriées, par exemple avec nvm.
- Puppeteer télécharge Chrome lors de l’installation du backend. Sous Linux, ses dépendances système doivent être disponibles. Le Dockerfile installe Chromium, ses dépendances et les polices pour les vérifications CI. Sur Netlify, Puppeteer Core utilise Chromium serverless, téléchargé depuis la version officielle figée 153.0.0 de Sparticuz au premier appel PDF ; le binaire est ensuite réutilisé dans `/tmp` tant que l’instance reste disponible.
- Un accès Internet et une URL / un jeton Turso pour le mode distant. SQLite fonctionne sans serveur de base de données ni connexion Internet après installation.

## Démarrage local

### Installation

```bash
git clone https://github.com/HanachiYassine/hanachi-yassine-cv.git
cd hanachi-yassine-cv
# Avec Node.js 18
npm ci
# Avec Node.js 22.17+ dans le terminal du backend
cd backend
npm ci
cp .env.example .env
```

Sous Windows, copier `.env.example` vers `.env` avec PowerShell ou l’explorateur. Réinstaller les dépendances même si `backend/node_modules` est présent dans le dépôt : ses anciens fichiers ne remplacent pas une installation adaptée au PC.

### Backend avec SQLite

Modifier `backend/.env` :

```dotenv
DATABASE_PROVIDER=sqlite
SQLITE_PATH=cv.local.db
PORT=3000
NODE_ENV=development
CORS_ORIGINS=http://localhost:4200
```

Définir également `ADMIN_EMAIL`, un `ADMIN_PASSWORD` d’au moins 12 caractères et `JWT_SECRET`. Une clé peut être générée avec :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copier la valeur dans `.env`, puis démarrer depuis `backend/` :

```bash
npm start
```

Une base vide est initialisée une seule fois depuis `backend/data.json`. Le compte administrateur est créé uniquement si aucun compte n’existe déjà. Modifier `ADMIN_PASSWORD` ne change pas le mot de passe d’un compte existant.

`SQLITE_PATH=cv.local.db` utilise une nouvelle base locale ignorée par Git. Sans ce paramètre, la base historique `backend/cv.db` est utilisée. Sa migration du 10 octobre 2026 conserve les identifiants, coordonnées et comptes existants.

### Backend avec Turso, même depuis le PC

Dans le même `.env`, remplacer la configuration de persistance :

```dotenv
DATABASE_PROVIDER=turso
TURSO_DATABASE_URL=libsql://cv-hanachiyassine.aws-eu-west-1.turso.io
TURSO_AUTH_TOKEN=jeton-a-renseigner-localement
```

Lancer ensuite `npm start` depuis `backend/`. Les requêtes lisent et modifient la base distante : le PC utilise alors les mêmes données que le site déployé. Le jeton doit autoriser les écritures pour l’administration.

SQLite et Turso sont deux bases distinctes. Changer le fournisseur ne synchronise pas automatiquement leurs contenus. L’export et la restauration JSON permettent de transférer explicitement un CV entre les deux.

### Frontend et administration

Dans un second terminal, à la racine du dépôt et avec Node.js 18 :

```bash
npm start
```

- CV : [http://localhost:4200](http://localhost:4200).
- Administration : [http://localhost:3000/admin/](http://localhost:3000/admin/).
- API : [http://localhost:3000/api/cv](http://localhost:3000/api/cv).

Si le port du backend change, ajuster `proxy.conf.json`. Les composants Angular utilisent des chemins d’API configurables ; l’administration utilise des chemins relatifs à son propre serveur.

## Données, sauvegardes et restauration

`backend/data.json` est conservé comme source initiale du CV. Il n’est pas réécrit automatiquement et ne remplace jamais une base déjà renseignée au redémarrage ou au redéploiement.

Les tables du CV sont définies dans `backend/schema.sql` : informations, profil, compétences, expériences, missions, technologies, sous-projets, formations, langues, certifications et centres d’intérêt. Les tableaux du CV sont assemblés dans `cv.service.js` à partir de lectures groupées et cohérentes. Les expériences et formations suivent leur ordre enregistré.

Les sous-projets conservent également leurs champs `equipe` et `role` dans la base, l’administration et les exports JSON. Pour un ancien schéma, une migration transactionnelle ajoute ces colonnes et complète les valeurs absentes à partir des sous-projets correspondants de `data.json`, sans remplacer les valeurs déjà renseignées. Elle garde une sauvegarde avant et après la mise à niveau ; elle ne se réexécute pas lorsque les colonnes existent. Le modèle visuel du CV et du PDF est conservé.

Chaque modification validée s’effectue dans une transaction : le CV précédent et le CV enregistré sont conservés dans `cv_backups` avec la date et le motif. Une erreur annule toute l’écriture. Ces sauvegardes sont stockées dans la base sélectionnée, donc dans Turso en ligne ; elles restent disponibles après le redémarrage de Render.

L’administration permet de télécharger le CV courant sous forme de `data-<date>.json`, de télécharger une ancienne version ou de la restaurer. Les sauvegardes contiennent les données du CV et leurs identifiants, **aucun compte, hash de mot de passe ni jeton**. Une restauration conserve les comptes et sauvegarde d’abord le contenu remplacé.

Pour garder également une copie extérieure à la base, utiliser le téléchargement ou, depuis `backend/` :

```bash
npm run backup
npm run backup -- --output backups/data-ma-copie.json
npm run restore -- backups/data-ma-copie.json
```

L’export refuse d’écraser un fichier existant. Le dossier `backend/backups/` et les secrets `.env` sont ignorés par Git. Les versions stockées dans `cv_backups` protègent les erreurs d’édition ; télécharger une copie fournit une sauvegarde indépendante de la base.

L’ancien script `node migrate-from-data.js` reste un import explicite de `data.json`, désormais transactionnel et avec sauvegarde. Il ne supprime plus les comptes administrateurs. `update-profile.js` et `update-technos.js` utilisent également les sauvegardes.

## API HTTP

| Méthode et route | Fonction |
|---|---|
| `GET /health` | Disponibilité du backend après initialisation de la base ; commit en cours sur Render |
| `GET /api/cv` | Toutes les données publiques du CV au format JSON |
| `GET /api/pdf` | CV PDF A4 généré depuis les données courantes |
| `POST /api/admin/login` | Connexion avec `email` et `password`, retourne un JWT |
| `GET /api/admin/cv` | Lecture du CV pour l’administration |
| `PUT /api/admin/cv` | Mise à jour des rubriques hors expériences ; seules les rubriques fournies sont remplacées |
| `GET /api/admin/experiences` | Liste des expériences |
| `GET /api/admin/experiences/:id` | Expérience, missions, technologies et sous-projets |
| `POST /api/admin/experiences` | Ajout d’une expérience en tête de liste |
| `PUT /api/admin/experiences/:id` | Modification d’une expérience |
| `DELETE /api/admin/experiences/:id` | Suppression avec sauvegarde préalable |
| `GET /api/admin/export` | Téléchargement du CV courant en JSON |
| `GET /api/admin/backups` | Liste des dates et motifs de sauvegarde |
| `GET /api/admin/backups/:id` | Téléchargement d’une sauvegarde JSON |
| `POST /api/admin/backups/:id/restore` | Restauration récupérable d’une sauvegarde |

Toutes les routes `/api/admin` sauf `/login` nécessitent `Authorization: Bearer <jeton>`. Les données sont validées avant écriture ; une entrée invalide retourne `400`, un jeton absent `401`, un jeton invalide `403` et une ressource absente `404`. La connexion limite les tentatives répétées.

Le service PDF conserve le modèle HTML/CSS, la photo et les marges A4 existants. Il ferme le navigateur même après une erreur et limite la génération à un PDF à la fois ; une seconde requête simultanée retourne `503` et peut être relancée. Les ressources du modèle sont locales.

## Compilation et vérifications

À la racine, avec Node.js 18 :

```bash
npm run build -- --configuration production
npm run build -- --configuration production --base-href /hanachi-yassine-cv/
```

La limite d’erreur du budget SCSS a été ajustée à 6 ko pour autoriser les 4,22 ko du style existant ; aucun style du CV n’a été modifié. Le seuil d’avertissement de 2 ko reste en place.

Depuis `backend/`, avec Node.js 22.17+ :

```bash
npm test
npm run test:pdf
```

Les neuf tests d’intégration utilisent des bases temporaires : données initiales, authentification, modification du CV, sous-projets avec équipes et rôles, sauvegardes sans comptes, restauration, rollback, mise à niveau d’un ancien schéma et conservation des données au redémarrage. Ils ont été validés localement le 10 octobre 2026. La connexion réelle à Turso, l’import des sept expériences et neuf sous-projets, leur cohérence avec `data.json`, les relations SQL et deux sauvegardes ont également été vérifiés à cette date.

À la racine, avec Node.js 22.17+, vérifier les contrôles de publication :

```bash
node --test scripts/check-live-backend.test.cjs
```

Ces six tests simulent un déploiement progressif et vérifient que la publication est bloquée si le commit reste ancien, si le CV est incomplet, si CORS empêche le navigateur d’accéder à l’API ou si le PDF est invalide ou en erreur. Ils ont été validés localement le 10 octobre 2026.

`test:pdf` lance réellement Chrome. Son exécution demande les bibliothèques système et les permissions du navigateur. Le workflow le vérifie dans le même conteneur Docker que le backend déployé. La construction du conteneur, les neuf tests backend, la génération réelle du PDF et la compilation Angular ont été validés le 10 octobre 2026 dans [GitHub Actions](https://github.com/HanachiYassine/hanachi-yassine-cv/actions/runs/38021956315). Le déploiement public reste à vérifier après activation de Render et GitHub Pages.

Le script frontend historique `npm test` lance Karma et ses anciens tests de modèle. Il n’est pas utilisé comme validation du déploiement ; la compilation de production et les tests backend sont les contrôles du workflow. Cypress n’a pas de suite dédiée configurée dans ce projet.

## Déploiement gratuit sans carte bancaire

L’architecture conserve toutes les fonctionnalités : **GitHub Pages** pour Angular, **Netlify Functions Free** pour l’API Express, le PDF et l’administration, **Turso Free** pour la base existante. Render n’est plus nécessaire au workflow ; le Dockerfile reste utilisé pour les tests.

Le compte existant est sur **Free Legacy à 0 $/mois**, sans carte enregistrée, vérifié dans son tableau de bord le 10 octobre 2026. Cette offre inclut 300 minutes de build, 100 Go de bande passante et, pour les fonctions de ce projet, 125 000 requêtes et 100 heures par mois. Les limites de l’offre Free sont fixes ; aucun moyen de paiement ni option payante n’a été ajouté. Les nouveaux comptes Free utilisent une autre offre de 300 crédits mensuels : elle ne décrit pas le compte actuel. Gratuit ne signifie pas disponibilité ou capacité illimitée. L’abonnement Turso reste à vérifier depuis le compte personnel.

### 1. Projet Netlify Free et Turso

Réutiliser le projet Free existant et son intégration GitHub. Dans **Project configuration → Developer settings → Continuous deployment → Branches and deploy contexts**, définir la branche de production **`netlify-production`**, les branch deploys sur **None** et les Deploy Previews sur **None**. Le workflow avance cette branche uniquement après les tests de `main`, sans force push. Netlify compile le même commit ; `/health` doit ensuite annoncer son SHA exact avant publication Pages. La branche est réservée à ce workflow et ne doit pas recevoir de commits manuels.

`netlify.toml` définit la bonne configuration backend : base `backend`, commande `npm run build:netlify`, publication `netlify/public`, fonctions `netlify/functions`, Node 22. La commande `ignore = "exit 1"` demande une construction pour chaque commit promu, y compris si seul Angular a changé, afin de conserver le contrôle du SHA.

Dans **Project configuration → Environment variables**, renseigner les valeurs suivantes pour le contexte **Production**. Cocher **Contains secret values** et choisir **Specific deploy contexts → Production uniquement**, sans valeur dans les aperçus, branches, agents ou développement local. Sur Free, conserver les scopes de secrets proposés par Netlify (Builds, Functions, Runtime) ; une restriction plus fine nécessite une offre payante et n’est pas nécessaire ici :

| Paramètre | Valeur ou règle |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://cv-hanachiyassine.aws-eu-west-1.turso.io` |
| `TURSO_AUTH_TOKEN` | Jeton sécurisé de la base existante, jamais dans Git |
| `ADMIN_EMAIL` | E-mail du premier compte administrateur |
| `ADMIN_PASSWORD` | Mot de passe sécurisé d’au moins 12 caractères |
| `JWT_SECRET` | Clé sécurisée d’au moins 32 caractères, distincte du jeton Turso |
| `CORS_ORIGINS` | `https://hanachiyassine.github.io` |

L’adaptateur impose `NODE_ENV=production` et `DATABASE_PROVIDER=turso` en production : aucune base SQLite éphémère n’est utilisée dans les fonctions. Les données et sauvegardes restent dans Turso. Le premier démarrage crée un compte uniquement si la base ne contient aucun compte ; ces paramètres ne réinitialisent pas un compte existant. La connexion Turso et l’import des sept expériences et neuf sous-projets avaient été vérifiés le 10 octobre ; cela ne vérifie pas l’abonnement du compte.

Ne pas exposer les secrets aux Deploy Previews ou aux builds de pull requests. Ils restent des paramètres du backend et ne sont pas nécessaires à la compilation Angular. L’intégration GitHub existante suffit au déploiement Netlify ; aucun jeton personnel Netlify supplémentaire n’est nécessaire.

### 2. GitHub Actions et Pages

Dans **Settings → Pages → Source**, choisir **GitHub Actions**. Cette source a été activée le 10 octobre 2026.

Dans **Settings → Secrets and variables → Actions**, configurer :

| Type | Nom | Contenu |
|---|---|---|
| Variable | `PUBLIC_API_URL` | Origine HTTPS effective du projet Netlify, sans `/api` |
| Variable facultative | `NETLIFY_SITE_ID` | Project ID du projet Netlify, conservé comme repère : `bb2fa144-01c3-456a-9d02-ad73a583e1fd` |

Les secrets `RENDER_DEPLOY_HOOK_URL` et `NETLIFY_AUTH_TOKEN` ne sont pas utilisés. Le job `deploy-backend` utilise seulement le jeton temporaire GitHub Actions avec `contents: write` pour avancer `netlify-production` ; les autres jobs restent en lecture seule. Aucun identifiant Turso ou mot de passe d’administration n’est nécessaire dans GitHub Actions.

Lancer une **exécution complète** du workflow **Vérification et déploiement du CV** sur `main`. Le pipeline :

1. Vérifie les paramètres Actions et refuse une origine locale, une URL d’exemple ou une origine HTTPS invalide.
2. Construit le conteneur, vérifie les transactions/sauvegardes et génère un vrai PDF.
3. Teste le handler Lambda, puis le paquet réellement construit par Netlify : CV complet, CORS, administration protégée et transport binaire d’un vrai PDF Chromium.
4. Compile Angular avec l’origine HTTPS effective de l’API.
5. Avance `netlify-production` vers le commit validé ; l’intégration GitHub fait construire Netlify avec le SHA embarqué dans la fonction.
6. Vérifie `/health` et son SHA exact, `/api/cv`, CORS pour Pages et `/api/pdf` avant de publier Angular sur Pages.

Les déploiements sont ignorés sur les pull requests. En l’absence de configuration Actions, les tests restent indépendants et la publication est bloquée explicitement. Lancer uniquement le job précédemment échoué ne suffit pas : Angular doit être recompilé et son artefact Pages produit. Si le build Netlify échoue pour un commit déjà promu, corriger ses paramètres puis relancer ce build dans **Deploys → Trigger deploy**, avant de relancer le workflow complet.

### 3. Adresses et limites à vérifier

Sur l’origine Netlify effective, vérifier `/health`, `/api/cv`, `/api/pdf` et `/admin/`. Le frontend cible `https://hanachiyassine.github.io/hanachi-yassine-cv/` n’est considéré publié qu’après un workflow réussi et un contrôle HTTP réel.

Le fichier `netlify.toml` ne publie que les fichiers d’administration et la fonction API ; les bases SQLite, sauvegardes et `.env` sont exclus de ces fichiers. Le SHA retourné par `/health` est généré à la compilation depuis `GITHUB_SHA` ou `COMMIT_REF`, et non depuis un paramètre modifiable à l’exécution.

Les fonctions Netlify ont une limite d’exécution de 60 secondes, 1 Go de mémoire et une limite de réponse binaire d’environ 4,5 Mo. Le premier PDF de chaque nouvelle instance nécessite le téléchargement du navigateur et peut être plus lent. Un test local du handler ne remplace pas une vérification en production ; le pipeline bloque Pages si le PDF réel ne fonctionne pas.

Pour reproduire les vérifications serverless sans accéder à Turso :

```bash
cd backend
npm ci
npm run test:netlify
```

Les tests utilisent une base SQLite temporaire et des identifiants aléatoires de test. Les modifications administratives de production restent visibles au prochain chargement du CV, sans reconstruction Angular.

Documentation officielle : [offres Netlify Legacy](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/legacy-pricing-plans/), [branche de production Netlify](https://docs.netlify.com/deploy/deploy-overview/), [Netlify Free sans carte](https://www.netlify.com/blog/introducing-netlify-free-plan/), [Netlify Free et limite de crédits des nouveaux comptes](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), [Express sur Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/express/), [limites des fonctions](https://docs.netlify.com/build/functions/configuration/), [Chromium serverless](https://github.com/Sparticuz/chromium), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Turso JavaScript](https://docs.turso.tech/sdk/ts/reference).
