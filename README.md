# CV de Yassine Hanachi — Développeur Full-Stack Java / Angular

Application personnelle destinée à présenter mon parcours, mes compétences et mes expériences aux recruteurs. Le CV web et le PDF utilisent les mêmes données professionnelles. Ce projet illustre la réalisation d’une interface Angular, d’une API Express, d’une administration authentifiée et d’un stockage relationnel.

**État au 10 octobre 2026 : base Turso connectée, CV importé et vérifié. Le backend Render reste à créer, son adresse HTTPS à configurer et GitHub Pages à activer. Le site public n’est pas encore déployé.**

Adresse cible, actuellement indisponible : `https://hanachiyassine.github.io/hanachi-yassine-cv/`. Le lien de consultation sera ajouté après vérification du premier déploiement réussi. L’administration sera accessible à l’adresse HTTPS effective du backend Render, suivie de `/admin/`.

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
| API et administration | Node.js 22.12 minimum, Express 4 ; `backend/` |
| Authentification | bcrypt, jsonwebtoken ; `backend/auth.js` |
| Persistance | SQLite embarqué ou Turso/libSQL distant, avec `@libsql/client` |
| PDF | EJS et Puppeteer 25 ; `backend/template.ejs`, `backend/pdf.service.js` |
| Déploiement | GitHub Pages pour Angular, Render pour Express, Turso pour les données |
| Vérifications | Tests d’intégration avec `node:test`, test PDF réel et compilation Angular |

Le navigateur consulte `/api/cv` et `/api/pdf`. En développement, le proxy Angular transmet ces requêtes au backend local. Sur GitHub Pages, la compilation reçoit l’adresse HTTPS du backend via `PUBLIC_API_URL`. Les identifiants Turso restent exclusivement dans le backend.

Le nom interne `angular-quickstart` subsiste dans Angular CLI et dans le dossier `dist/angular-quickstart` ; il ne désigne pas le contenu de l’application.

## Prérequis

- Git et npm.
- **Frontend Angular 16 : Node.js 18** pour utiliser la combinaison compatible avec cette version d’Angular CLI. Les workflows isolent cet ancien outil de compilation du backend.
- **Backend : Node.js 22.12 ou ultérieur.** Utiliser deux terminaux avec les versions appropriées, par exemple avec nvm.
- Puppeteer télécharge Chrome lors de l’installation du backend. Sous Linux, ses dépendances système doivent être disponibles. Le Dockerfile installe Chromium, ses dépendances et les polices pour Render et les vérifications CI.
- Un accès Internet et une URL / un jeton Turso pour le mode distant. SQLite fonctionne sans serveur de base de données ni connexion Internet après installation.

## Démarrage local

### Installation

```bash
git clone https://github.com/HanachiYassine/hanachi-yassine-cv.git
cd hanachi-yassine-cv
# Avec Node.js 18
npm ci
# Avec Node.js 22.12+ dans le terminal du backend
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

Depuis `backend/`, avec Node.js 22.12+ :

```bash
npm test
npm run test:pdf
```

Les neuf tests d’intégration utilisent des bases temporaires : données initiales, authentification, modification du CV, sous-projets avec équipes et rôles, sauvegardes sans comptes, restauration, rollback, mise à niveau d’un ancien schéma et conservation des données au redémarrage. Ils ont été validés localement le 10 octobre 2026. La connexion réelle à Turso, l’import des sept expériences et neuf sous-projets, leur cohérence avec `data.json`, les relations SQL et deux sauvegardes ont également été vérifiés à cette date.

À la racine, avec Node.js 22.12+, vérifier les contrôles de publication :

```bash
node --test scripts/check-live-backend.test.cjs
```

Ces six tests simulent un déploiement progressif et vérifient que la publication est bloquée si le commit reste ancien, si le CV est incomplet, si CORS empêche le navigateur d’accéder à l’API ou si le PDF est invalide ou en erreur. Ils ont été validés localement le 10 octobre 2026.

`test:pdf` lance réellement Chrome. Son exécution demande les bibliothèques système et les permissions du navigateur. Le workflow le vérifie dans le même conteneur Docker que le backend déployé. La construction du conteneur, les neuf tests backend, la génération réelle du PDF et la compilation Angular ont été validés le 10 octobre 2026 dans [GitHub Actions](https://github.com/HanachiYassine/hanachi-yassine-cv/actions/runs/38021956315). Le déploiement public reste à vérifier après activation de Render et GitHub Pages.

Le script frontend historique `npm test` lance Karma et ses anciens tests de modèle. Il n’est pas utilisé comme validation du déploiement ; la compilation de production et les tests backend sont les contrôles du workflow. Cypress n’a pas de suite dédiée configurée dans ce projet.

## Déploiement gratuit et automatique

Le déploiement nécessite les comptes et paramètres suivants ; leur création ne signifie pas que le site est déjà en ligne.

### Pourquoi les déploiements étaient « skipped »

Dans [l’exécution du 10 octobre 2026](https://github.com/HanachiYassine/hanachi-yassine-cv/actions/runs/38016433628), les contrôles `frontend` et `backend` ont réussi, mais l’envoi de l’artefact Pages, `deploy-backend` et `deploy-pages` ont été ignorés. Leur condition exigeait une variable `PUBLIC_API_URL` non vide ; celle-ci n’était pas définie. La compilation utilisait `https://example.invalid` uniquement pour vérifier Angular, sans produire de site publié. GitHub Pages n’était pas activé non plus.

Le workflow comporte désormais un contrôle **Vérifier la configuration du déploiement** sur `main`. Une URL d’API manquante ou invalide, ou un secret Render absent ou invalide, produit un échec explicite et un résumé des paramètres à renseigner. Les contrôles du code restent indépendants. La publication attend la réussite de ce contrôle et des tests ; elle est normalement ignorée sur les pull requests. Une exécution verte sur `main` ne doit donc plus masquer ces paramètres manquants.

GitHub Pages héberge uniquement le frontend Angular. L’API Express, la génération du PDF et l’administration nécessitent le service Render et la base Turso : le backend ne peut pas s’exécuter sur `github.io`.

### 1. Turso

La base du projet est `libsql://cv-hanachiyassine.aws-eu-west-1.turso.io`. Son URL est préremplie dans `render.yaml` et `backend/.env.example`. La connexion et l’import du CV ont été vérifiés le 10 octobre 2026. La base contient les sept expériences, neuf sous-projets et deux sauvegardes de mise à niveau ; le CV courant correspond aux données professionnelles de `data.json`. L’URL seule ne permet pas de lire ou modifier la base.

Enregistrer ce jeton dans le paramètre sécurisé `TURSO_AUTH_TOKEN` de Render ou dans le fichier local `backend/.env`, jamais dans le dépôt. Le backend crée les tables et importe le CV initial lorsque la base est vide. Les comptes administrateurs et sauvegardes sont ensuite conservés dans cette base.

Le compte administrateur n’est pas encore créé dans cette base. Il sera initialisé au premier démarrage du backend avec les paramètres `ADMIN_EMAIL` et `ADMIN_PASSWORD` renseignés dans Render.

### 2. Backend Render

[Créer le backend sur Render à partir de ce dépôt](https://render.com/deploy?repo=https://github.com/HanachiYassine/hanachi-yassine-cv), puis utiliser le Blueprint `render.yaml`. Il définit un service Docker sur l’offre `free`, un contrôle `/health` et le mode Turso. Renseigner dans Render :

- `TURSO_DATABASE_URL`, préremplie avec l’URL de la base du projet ; à vérifier lors de la création du service.
- `TURSO_AUTH_TOKEN`, à saisir dans le paramètre sécurisé correspondant.
- `ADMIN_EMAIL` et `ADMIN_PASSWORD` pour le premier compte.
- `JWT_SECRET`, généré par le Blueprint.
- `CORS_ORIGINS`, avec l’origine du site frontend, par défaut `https://hanachiyassine.github.io`.

Le serveur lit le port fourni par Render via `PORT` et écoute sur `0.0.0.0`. Le Dockerfile exclut les fichiers SQLite, sauvegardes et `.env` du déploiement. Après démarrage, vérifier `/health`, `/api/cv`, `/api/pdf` et la connexion `/admin/` sur l’URL Render effective.

### 3. GitHub Actions et GitHub Pages

Dans les paramètres du dépôt :

1. Choisir **Pages → Source → GitHub Actions**.
2. Ajouter la variable Actions `PUBLIC_API_URL` contenant l’origine HTTPS effective du backend Render, sans `/api`.
3. Ajouter le secret Actions `RENDER_DEPLOY_HOOK_URL`, obtenu dans les paramètres du service Render. Cette URL doit rester secrète.
4. Exécuter le workflow **Vérification et déploiement du CV**, ou pousser une modification sur `main`.

Le workflow vérifie la configuration de publication, construit et teste le conteneur backend, vérifie le PDF réel, compile Angular avec l’adresse de l’API puis déclenche Render pour le commit vérifié et publie le frontend sur Pages. Le déclenchement Render lance un déploiement asynchrone. Avant de publier Pages, le workflow attend jusqu’à vingt minutes que `/health` annonce le commit vérifié via `RENDER_GIT_COMMIT`, puis contrôle le chargement du CV, les en-têtes CORS pour l’origine Pages et une génération PDF réelle. Un échec bloque la publication du frontend ; un ancien backend encore disponible ne suffit pas à valider le nouveau déploiement. Tant que les paramètres de déploiement manquent, leur contrôle échoue explicitement et aucun site n’est publié. Après publication, les modifications effectuées depuis l’administration sont visibles au prochain chargement du CV, sans commit ni reconstruction Angular.

Le paramètre `autoDeployTrigger: 'off'` évite un déploiement Render avant les contrôles GitHub Actions. Les jetons Turso et mots de passe ne sont jamais intégrés à la compilation Angular.

La configuration vise uniquement les offres gratuites : espace Render **Hobby**, service **Free** (`plan: free`), base Turso **Free** et GitHub Pages pour ce dépôt public. Aucun abonnement payant, disque persistant Render ou nom de domaine acheté n’est nécessaire. Vérifier les offres effectives des comptes avant la première création ; la connexion à la base Turso ne permet pas à elle seule de vérifier son abonnement.

Pour conserver la contrainte « aucun coût », ne pas ajouter de moyen de paiement à Render ni activer d’option payante. Si la création du service impose un paiement, arrêter cette procédure. Render peut facturer les dépassements de quotas lorsqu’un moyen de paiement est enregistré ; sans moyen de paiement, les services ou nouvelles compilations sont suspendus lorsque les quotas concernés sont épuisés. Voir les [conditions officielles de l’offre gratuite](https://render.com/docs/free).

Ces offres gratuites ont des quotas. Render met le service en veille après une période d’inactivité : la première consultation peut attendre son réveil. Les données restent dans Turso.

Documentation officielle : [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Render gratuit](https://render.com/docs/free), [déclenchement Render](https://render.com/docs/deploy-hooks), [Turso JavaScript](https://docs.turso.tech/sdk/ts/reference), [Puppeteer](https://pptr.dev/troubleshooting).

