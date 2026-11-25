# Mise à jour du parcours — 25 novembre 2026

## Contenu professionnel

| Rubrique | Avant | Correctif |
| --- | --- | --- |
| SNCF Réseau / OPIPRO | `05/2024 – Actuel` | `05/2024 – 13/11/2026` |
| France Travail | Absente | `21/11/2026 – Actuel`, Strasbourg, développeur Java senior |
| Positionnement | Intitulé Java EE | Développeur Full-Stack senior Java / Angular |
| Localisation du profil | Ancienne adresse à Bagnolet | Strasbourg, France |
| Quarkus | Absent | `Quarkus (mission en cours)` dans les compétences et contexte de la nouvelle mission |
| Contrôles de publication | Exactement 7 expériences / 9 sous-projets | Présence et contenu des expériences de référence ; ajouts autorisés |

OPIPRO : synthèse de 21 missions en 11 points valorisant le socle applicatif, les API, les règles métier et transactions, Spring Batch, QueryDSL / PostgreSQL, la migration Angular 18 vers 21 / PrimeNG 21, les formulaires complexes, les tests, la CI/CD et l’accompagnement. Les noms de flux internes, le nom du socle client et les paramètres de verrouillage sont retirés de la présentation.

France Travail : mission en démarrage, prise en main et étude Java / Quarkus ; périmètre de responsabilité Spring Batch pour collecter, transformer et enregistrer des données de satisfaction ; API de consultation globale et détaillée et échanges avec un composant web développé par une autre équipe. Aucun résultat livré, indicateur de performance, version technique, composition d’équipe ou déploiement client n’est affirmé.

Les six autres expériences, les neuf sous-projets historiques, les formations, langues, certifications et coordonnées de contact restent conservés. Le web lit `GET /api/cv` et le PDF lit le même service `getCvData()` ; aucune copie professionnelle n’est ajoutée dans Angular ou EJS. Le correctif ne change pas le schéma de base.

Le PDF conserve ses deux colonnes et ses couleurs. Des marges verticales de 8 mm et des règles de saut évitent le texte coupé aux limites de page et les titres d’expérience isolés en pied de page.

## État public constaté en lecture seule

Le 25 novembre 2026, `GET https://hanachiyassine.netlify.app/health` a répondu `ok`, commit `6a3730a26bfee4efde32581b115d9b830139a925`. `GET /api/cv` a retourné sept expériences, OPIPRO `05/2024 – Actuel` (id 1), sans France Travail. Cette lecture publique ne vaut pas un export de sauvegarde authentifié.

## Préparer la mise à jour sans connexion à la base

1. Utiliser cette branche du correctif, avec les dépendances backend installées et Node.js 22.17+.
2. Depuis l’administration existante, télécharger le CV courant avec **Export JSON** (`GET /api/admin/export`, authentifié). Conserver l’original comme `backend/backups/career-before.json`, hors Git. Cet export contient les identifiants à préserver et ne contient pas les comptes ni les jetons.
3. Depuis `backend/`, préparer le résultat à relire :

```bash
node scripts/update-career.js \
  --input backups/career-before.json \
  --output backups/career-reviewed.json
git diff --no-index -- backups/career-before.json backups/career-reviewed.json
```

La préparation ne charge ni `db.js`, ni `.env`, ni client SQL ; elle ne peut pas écrire en production. La sortie refuse d’écraser un fichier existant. `git diff --no-index` retourne normalement le code 1 lorsqu’il affiche des différences.

Le résultat conserve les identifiants et les sous-projets de SNCF et toutes les autres expériences, y compris des expériences ajoutées en ligne depuis le dernier seed. Il remplace uniquement le titre, la ville et le profil, la description de SNCF, ajoute la compétence Quarkus et crée France Travail en tête. Une France Travail déjà conforme rend la préparation idempotente ; un contenu divergent ou plusieurs SNCF entraînent un refus et nécessitent un rapprochement explicite.

## Application ultérieure, manuelle et transactionnelle

**Cette étape n’a pas été exécutée dans le cadre du correctif.** La fusion et la publication ne doivent pas être déclenchées avant la décision de mettre les données à jour. Une modification de `data.json` ou un redéploiement n’actualise pas une base Turso déjà renseignée.

Après relecture du JSON et décision d’appliquer la mise à jour : utiliser un environnement de confiance avec `DATABASE_PROVIDER=turso`, `TURSO_DATABASE_URL` et `TURSO_AUTH_TOKEN` configurés de manière privée. Ne pas copier les secrets dans Git, le navigateur, la PR ou une commande conservée dans l’historique. Depuis `backend/` :

```bash
node scripts/update-career.js --apply \
  --before backups/career-before.json \
  --after backups/career-reviewed.json
```

Le script n’initialise pas la base et ne lance aucune migration automatique. Une transaction d’écriture :

1. Compare le CV courant avec l’export relu ; toute modification intervenue depuis l’export bloque l’opération avant écriture. Refaire alors l’export et la préparation, sans contourner le contrôle.
2. Vérifie que le JSON approuvé correspond exactement au résultat prévu par cette version du correctif.
3. Sauvegarde le CV précédent dans `cv_backups` (`avant : carrière 2026-11`).
4. Modifie la seule ligne SNCF et ses missions / technologies, préserve son id et ses sous-projets ; crée France Travail avec un nouvel id et un ordre placé avant les expériences existantes. Les autres lignes d’expériences, leurs relations, les comptes et les paramètres d’authentification sont conservés.
5. Met à jour le titre, la ville et le profil, ajoute Quarkus sans supprimer les compétences existantes.
6. Relit et compare le résultat au JSON approuvé, contrôle les clés étrangères, sauvegarde le résultat (`carrière 2026-11`) puis valide. Une erreur annule l’ensemble. Une nouvelle exécution avec un nouvel export déjà à jour ne crée ni doublon ni sauvegarde superflue.

Ne pas utiliser `migrate-from-data.js`, un import global de `data.json`, une restauration complète ou un remplacement de la collection d’expériences pour appliquer cette évolution.

## Ordre de publication et retour arrière

Le backend actuellement publié sait déjà afficher une expérience supplémentaire et générer le PDF à partir de la base. Lors de l’exécution ultérieure : sauvegarder, relire et appliquer la mise à jour ciblée, contrôler `/api/cv`, le CV web et le PDF public, puis fusionner la PR quand la publication est souhaitée. Le workflow de `main` publiera alors le nouveau code. Les nouveaux contrôles refuseront une base restée à l’ancienne période ou dépourvue de France Travail ; ils accepteront de futures expériences et de nouveaux sous-projets sans changement de compteur.

En cas de problème avant commit SQL, le rollback est automatique. Après commit, conserver l’export original et les deux sauvegardes. Si aucune édition ultérieure n’a eu lieu, l’administration permet de restaurer la sauvegarde `avant : carrière 2026-11` ; une restauration remplace le CV complet. En présence d’éditions ultérieures, préparer une correction ciblée à partir d’un nouvel export pour les conserver. Les comptes administrateurs ne sont pas inclus dans les sauvegardes CV.

## Vérifications reproductibles

À la racine :

```bash
node --test scripts/*.test.cjs
npm test --prefix backend
PUPPETEER_EXECUTABLE_PATH=/chemin/vers/chrome npm run test:pdf --prefix backend
npm run test:netlify --prefix backend
# Node.js 18 pour Angular 16
npm run build -- --configuration production --base-href /
```

Les tests de la mise à jour utilisent des bases SQLite temporaires et n’ont besoin d’aucun secret Turso. Ils couvrent la conservation des expériences ajoutées en ligne, des identifiants, sous-projets et comptes, la réexécution, la concurrence et le rollback après un échec d’insertion. Les contrôles HTTP simulent le backend et vérifient également les expériences manquantes, les anciennes périodes, les doublons, les pertes de missions / technologies, CORS, les SHA et les PDF invalides. Le test PDF compare les expériences et missions du HTML imprimé aux données du service commun.

## Résultats locaux du 25 novembre 2026

- Contrôles de publication / configuration : 19 tests réussis.
- Backend : 35 tests réussis, dont 7 sur la mise à jour ciblée et sa préparation hors ligne.
- PDF : 2 tests réussis avec un vrai Chromium ; rendu A4 de 7 pages contrôlé visuellement, dates et texte extraits, aucun bloc de texte hors page.
- Handler Netlify : 5 tests réussis, incluant deux générations réelles du PDF.
- Angular : compilation de production réussie avec Node.js 18.20.8 ; avertissement SCSS préexistant de 4,22 ko pour un seuil de 2 ko.
- Vérification navigateur du build Angular contre une base SQLite temporaire : 8 expériences, France Travail en tête, dates et missions conformes au JSON exposé par l’API, aucune erreur JavaScript.
- Aucun déploiement, aucune fusion et aucune écriture Turso exécutés. La construction Docker et le bundle Netlify final ne sont pas revendiqués comme validés localement ; ils restent couverts par le workflow de PR.
