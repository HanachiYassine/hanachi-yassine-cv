# CV de Yassine Hanachi — Développeur Full-Stack Java / Angular

Application personnelle destinée à présenter mon parcours, mes compétences et mes expériences aux recruteurs. Le CV web et le PDF utilisent les mêmes données professionnelles. Ce projet illustre la réalisation d’une interface Angular, d’une API Express, d’une administration authentifiée et d’un stockage relationnel.

**État au 10 octobre 2026 : le déploiement cible est Netlify Free Legacy, sans carte bancaire. Angular, Express, l’administration et le PDF sont construits depuis le vrai dépôt `HanachiYassine/hanachi-yassine-cv` et publiés ensemble sur `soft-tartufo-259d9b`. La validation publique de cette configuration reste en cours.**

Adresse cible : `https://soft-tartufo-259d9b.netlify.app/`. L’administration utilise `/admin/` sur la même origine. Le dépôt `hanachi-yassine-cv-ebd5a`, créé depuis le modèle Angular Netlify, ne contient pas cette application CV.


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
| Déploiement | Netlify Free Legacy pour Angular et Express Functions, Turso pour les données |
| Vérifications | Tests d’intégration avec `node:test`, test PDF réel et compilation Angular |

Le navigateur consulte `/api/cv` et `/api/pdf`. En développement, le proxy Angular transmet ces requêtes au backend local. Sur Netlify, Angular et l’API utilisent la même origine ; la compilation reçoit cette adresse HTTPS via `PUBLIC_API_URL` ou la variable Netlify `URL`. Les identifiants Turso restent exclusivement dans le backend.

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

Chaque modification validée s’effectue dans une transaction : le CV précédent et le CV enregistré sont conservés dans `cv_backups` avec la date et le motif. Une erreur annule toute l’écriture. Ces sauvegardes sont stockées dans la base sélectionnée, donc dans Turso en ligne ; elles restent disponibles après le redéploiement de Netlify.

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

Ces huit tests simulent un déploiement progressif et vérifient que la publication est bloquée si le commit reste ancien, si le CV est incomplet, si CORS empêche le navigateur d’accéder à l’API ou si le PDF est invalide ou en erreur. Ils ont été validés localement le 10 octobre 2026.

`test:pdf` lance réellement Chrome. Son exécution demande les bibliothèques système et les permissions du navigateur. Le workflow le vérifie dans le même conteneur Docker que le backend déployé. La construction du conteneur, les neuf tests backend, la génération réelle du PDF et la compilation Angular ont été validés le 10 octobre 2026 dans [GitHub Actions](https://github.com/HanachiYassine/hanachi-yassine-cv/actions/runs/38021956315). La publication publique doit aussi vérifier la fonction Netlify, le PDF et le frontend du même commit.

Le script frontend historique `npm test` lance Karma et ses anciens tests de modèle. Il n’est pas utilisé comme validation du déploiement ; la compilation de production et les tests backend sont les contrôles du workflow. Cypress n’a pas de suite dédiée configurée dans ce projet.

## Déploiement gratuit sur Netlify

Angular, Express, le PDF et l’administration sont publiés **ensemble dans un seul déploiement Netlify**, avec la base Turso existante. Render et GitHub Pages ne sont plus nécessaires à ce workflow. Le Dockerfile conserve les tests d’intégration Linux.

Le compte existant utilise **Free Legacy, à 0 $, sans carte bancaire** : 300 minutes de compilation, 100 Go de bande passante, 125 000 appels de fonctions et 100 heures de fonctions par mois. Les limites gratuites peuvent suspendre le service ; conserver cette offre sans changer d’abonnement. L’offre Turso du compte n’a pas été vérifiée indépendamment.

### Projet et compilation

Relier **`soft-tartufo-259d9b` au vrai dépôt `HanachiYassine/hanachi-yassine-cv`**. Le dépôt généré `hanachi-yassine-cv-ebd5a` contient seulement le modèle Angular et n’est pas la source du CV.

Dans **Project configuration → Developer settings → Branches and deploy contexts**, choisir **`netlify-production`** comme branche de production, **None** pour les branch deploys et les Deploy Previews. Seul le workflow de `main` avance cette branche après tous les tests, sans force push ; ne pas y ajouter de commits manuels.

`netlify.toml` définit : base `backend`, commande `npm ci --include=dev --no-audit --no-fund && npm run build:netlify`, publication `netlify/public`, fonctions `netlify/functions`, Node 22. La réinstallation propre remplace les anciens modules natifs suivis dans Git, dont le binaire bcrypt incompatible. Le build installe les dépendances Angular et utilise Node 18.20.8 pour Angular 16, puis assemble Angular à la racine `/`, l’administration et la fonction Express dans le même déploiement. Node 22 reste le runtime de l’API et du PDF. `ignore = "exit 1"` reconstruit chaque commit pour conserver le même SHA frontend/backend.

### Variables privées Netlify

Dans **Project configuration → Environment variables**, définir dans le seul contexte **Production** :

| Clé | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_PROVIDER` | `turso` |
| `TURSO_DATABASE_URL` | URL libSQL de la base existante |
| `TURSO_AUTH_TOKEN` | Jeton Turso privé autorisant les opérations nécessaires |
| `ADMIN_EMAIL` | Adresse de l’administrateur |
| `ADMIN_PASSWORD` | Mot de passe initial privé d’au moins 12 caractères |
| `JWT_SECRET` | Clé privée d’au moins 32 caractères |
| `CORS_ORIGINS` | `https://soft-tartufo-259d9b.netlify.app` |

Les trois credentials `TURSO_AUTH_TOKEN`, `ADMIN_PASSWORD` et `JWT_SECRET` doivent être marqués **Contains secret values**. Les valeurs configurées ne doivent pas être exposées aux previews, branches, agents ou au développement local. Les anciens marqueurs de secret sur les paramètres publics sont irréversibles : `SECRETS_SCAN_OMIT_KEYS` exclut uniquement `ADMIN_EMAIL,CORS_ORIGINS,DATABASE_PROVIDER,NODE_ENV,TURSO_DATABASE_URL` pour éviter les faux positifs. Le scan reste actif pour les vrais secrets ; aucun credential n’est inclus dans Angular.

Une base vide est initialisée une seule fois ; les données d’une base existante sont conservées. `ADMIN_PASSWORD` ne remplace pas le mot de passe d’un compte déjà enregistré.

### GitHub Actions

L’origine publique **`PUBLIC_API_URL=https://soft-tartufo-259d9b.netlify.app`** est définie une seule fois dans l’environnement du workflow versionné. Les anciennes variables Actions de ce nom ne sont plus utilisées. Aucun jeton personnel Netlify ni `RENDER_DEPLOY_HOOK_URL` n’est utilisé. L’intégration GitHub existante lance Netlify ; le workflow utilise le `GITHUB_TOKEN` temporaire avec `contents: write` uniquement dans le job de publication. Ce job récupère l’historique Git complet (`fetch-depth: 0`) pour vérifier le fast-forward de la branche distante.

À chaque commit de `main`, le workflow :

1. Valide la configuration HTTPS, le backend Linux, les transactions, sauvegardes et le PDF.
2. Teste le handler Netlify et le paquet final contenant la fonction, puis compile Angular.
3. Avance `netlify-production` vers le même commit testé ; Netlify publie les fichiers Angular et Express ensemble.
4. Attend `/health` avec le SHA exact, vérifie `/deployment.json` et Angular à la racine, les sept expériences et neuf sous-projets, CORS et un PDF binaire réel.

Les pull requests exécutent les tests sans publication ni paramètres privés. Si Netlify échoue pour un commit déjà promu, corriger sa configuration puis utiliser **Deploys → Retry with latest branch commit**. Relancer ensuite le workflow complet si ses contrôles ont expiré. Le succès d’une compilation ne suffit pas à déclarer le site fonctionnel : vérifier réellement `/`, `/health`, `/api/cv`, `/api/pdf`, CORS et `/admin/` en production.

Le premier PDF d’une instance télécharge Chromium ; les suivants réutilisent `/tmp`. Les fonctions ont une limite d’exécution de 60 secondes, 1 Go de mémoire et environ 4,5 Mo de réponse binaire. Les vérifications locales et CI ne remplacent pas les contrôles publics.

Documentation officielle : [offres Netlify Legacy](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/legacy-pricing-plans/), [branche de production Netlify](https://docs.netlify.com/deploy/deploy-overview/), [Netlify Free sans carte](https://www.netlify.com/blog/introducing-netlify-free-plan/), [Netlify Free et limite de crédits des nouveaux comptes](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), [Express sur Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/express/), [limites des fonctions](https://docs.netlify.com/build/functions/configuration/), [Chromium serverless](https://github.com/Sparticuz/chromium), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Turso JavaScript](https://docs.turso.tech/sdk/ts/reference).
