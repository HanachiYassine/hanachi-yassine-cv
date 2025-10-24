// src/app/cv/cv.component.ts
import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy } from '@angular/core';

type StrArr = ReadonlyArray<string>;

interface Projet {
  titre: string;
  contexte?: string;
  equipe?: string;
  role?: string;
  missions: StrArr;
  technologies: StrArr;
}

interface Experience {
  poste: string;
  entreprise: string;
  localisation: string;
  periode: string;
  projet?: string;
  client?: string;
  equipe?: string;
  role?: string;
  missions?: StrArr;
  technologies?: StrArr;
  projets?: ReadonlyArray<Projet>;
}

@Component({
  selector: 'app-cv',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cv.component.html',
  styleUrls: ['./cv.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CvComponent {
  readonly infos = {
    nom: 'YASSINE HANNACHI',
    titre: "INGÉNIEUR D'ÉTUDES ET DÉVELOPPEMENT JAVA EE – 7 ans d’expérience (4 ans Java EE)",
    adresse: '50 Rue Robes Pierre, 93170 Bagnolet',
    tel: '+33758567709',
    email: 'hanachiyassine@hotmail.fr',
    preavis: '3 mois',
    linkedin: 'https://www.linkedin.com/in/yassine-hannachi-47682897/',
    age: '30 ans',
    nationalite: 'Tunisienne',
    statut: 'Célibataire'
  } as const;

  readonly profil =
    "Développeur Full-stack passionné, expérimenté en Java, Spring Boot et Angular. " +
    "Spécialisé microservices et bases relationnelles/non relationnelles. " +
    "Expérience chez Orange (secteurs variés). À l’aise en Scrum (raffinement, planning poker...). " +
    "Orienté code propre, maintenable, qualité, tests automatisés et revues de code.";

  readonly competences = {
    langagesFrameworks: [
      'Java', 'Angular', 'Spring Boot', 'Spring Data', 'JPA', 'Hibernate', 'Spring Security',
      'WS REST', 'Angular Library', 'Angular Material'
    ] as StrArr,
    outils: ['Maven', 'Git', 'GitLab'] as StrArr,
    serveurs: ['Apache Tomcat'] as StrArr,
    bdd: ['PostgreSQL', 'SQL Server', 'MySQL'] as StrArr,
    systemes: ['MS Windows', 'Linux'] as StrArr,
    methodos: ['AGILE SCRUM', 'Safe'] as StrArr,
    ide: ['IntelliJ', 'Visual Studio Code'] as StrArr
  } as const;

  readonly experiences: ReadonlyArray<Experience> = [
    {
      poste: 'Développeur Full-stack Java/Angular',
      entreprise: 'SNCF',
      localisation: 'Lille',
      periode: '05/2024 – Actuel',
      projet: 'Outils de Pilotage de programmes',
      client: 'SNCF',
      equipe: '1 Scrum Master, 2 PO, 3 Dev, 1 Testeur, 1 Tech Lead',
      role: 'Développeur Full-stack',
      missions: [
        'Fonctionnalités gestion programmes de maintenance et infrastructures ferroviaires',
        'UI dynamiques avec Angular 18 et PrimeNG',
        'Intégration REST avec Spring Boot 3.0',
        'Gestion utilisateurs/rôles via Spring Security',
        'Optimisation SQL avec QueryDSL',
        'Tests unitaires/intégration (JUnit, Mockito, Jest)',
        'Traitements parallèles pour appels API et vérifs BDD',
        'Participation aux cérémonies Scrum'
      ],
      technologies: [
        'Java 21', 'Spring Boot 3.0', 'QueryDSL', 'Maven',
        'Angular 18', 'PrimeNG', 'TypeScript',
        'PostgreSQL', 'GitLab', 'Docker', 'CI/CD', 'Scrum'
      ]
    },
    {
      poste: 'Développeur Full-stack Java/Angular',
      entreprise: 'OPEN',
      localisation: 'Paris',
      periode: '02/2023 – 04/2024',
      projet: 'Plateforme de Gestion des Bourses Scolaires',
      client: "Ministère de l'Éducation nationale",
      equipe: '2 SM, 2 Proxy PO, 1 PO, 9 Dev, 1 Testeur, 1 Tech Lead',
      role: 'Développeur Full-stack',
      missions: [
        'Modules demandes, établissements, campagnes, paiements',
        'Front réactif avec Angular 15 + Ngxs',
        'Batchs d’automatisation',
        'Amélioration continue & revues de code',
        'Cérémonies agiles (raffinement, planning poker, rituels Scrum)',
        'Couverture 75–90 % (JUnit, Jest)'
      ],
      technologies: [
        'Java 17', 'Spring Boot 3.0', 'Angular 15', 'Ngxs',
        'PostgreSQL', 'QueryDSL', 'GitLab', 'Maven', 'Git', 'Scrum'
      ]
    },
    {
      poste: 'Développeur Java',
      entreprise: 'GROUPAMA',
      localisation: 'Lyon',
      periode: '10/2022 – 01/2023',
      projet: 'Portail Agences',
      client: 'GAN Assurance',
      equipe: '1 PO, 1 SM, 5 Dev, 2 Release Managers',
      role: 'Développeur Full-stack',
      missions: [
        'Migration vers Spring Batch (MAJ contrats, exports CSV)',
        'Maintenance des batchs et corrections',
        'Corrections front/back, résolution d’anomalies'
      ],
      technologies: [
        'Java 11', 'Spring Boot', 'Spring Data JPA', 'Spring Security',
        'Microservices', 'Maven', 'Angular Libraries', 'Swagger v2',
        'WS REST', 'Angular 13', 'TypeScript', 'HTML/CSS', 'Angular Material',
        'MySQL', 'GitLab', 'Jira', 'IntelliJ', 'VS Code', 'Scrum'
      ]
    },
    {
      poste: 'Développeur Full-stack Java/Angular',
      entreprise: 'Sofrecom Tunisie (CDI)',
      localisation: 'Tunis',
      periode: '10/2018 – 09/2022',
      projets: [
        {
          titre: 'Plateforme de prise de RDV (Orange)',
          contexte:
            'Permettre aux clients de prendre RDV en boutique avec conseiller selon motif.',
          equipe: '2 PO, 1 SM, 4 Dev Full-stack, 1 Testeur, 2 OPS',
          role: 'Développeur Full-stack',
          missions: [
            'Backend : boutiques, conseillers, plannings, RDV',
            'IHM en librairies Angular intégrables',
            'Conception archi front (Angular library)',
            'Batchs de synchro avec référentiels Orange',
            'Corrections front/back, analyse perf front'
          ],
          technologies: [
            'Java 11', 'Spring Boot', 'Spring Data JPA', 'Spring Security',
            'Microservices', 'Maven', 'Angular Libraries', 'Swagger v2', 'WS REST',
            'Angular 13', 'TS', 'HTML/CSS', 'Material', 'MySQL', 'GitLab', 'Jira', 'IntelliJ', 'VS Code', 'Scrum'
          ]
        },
        {
          titre: 'Plateforme de gestion des interactions (Orange)',
          contexte:
            "Référentiel traçant les échanges d'information entre Orange et les clients.",
          equipe: '2 PO, 1 SM, 4 Dev Full-stack, 1 Testeur, 2 OPS',
          role: 'Développeur Full-stack',
          missions: [
            'APIs métiers (plusieurs domaines)',
            'Librairie Angular pour créer une interaction'
          ],
          technologies: [
            'Java 11', 'Spring Boot', 'Spring Data JPA', 'Spring Security',
            'Microservices', 'Maven', 'Angular Libraries', 'Swagger v2', 'WS REST',
            'Angular 13', 'TS', 'HTML/CSS', 'Material', 'MySQL', 'GitLab', 'Jira', 'IntelliJ', 'VS Code', 'Scrum'
          ]
        },
        {
          titre: 'Gestion dynamique des files d’attente (Orange Boutiques)',
          contexte:
            'SI pour piloter les files d’attente dans les boutiques (vue 360 client).',
          equipe: '2 PO, 1 SM, 4 Dev Full-stack, 1 Testeur, 2 OPS',
          role: 'Développeur Full-stack',
          missions: [
            'APIs métiers',
            'Batchs d’import des RDV',
            'Développement/maintenance IHM'
          ],
          technologies: [
            'Java 11', 'Spring Boot', 'Spring Data JPA', 'Spring Security',
            'Maven', 'Swagger v2', 'WS REST', 'Angular 12', 'TS', 'HTML/CSS',
            'Material', 'MySQL', 'GitLab', 'Jira', 'IntelliJ', 'VS Code', 'Scrum'
          ]
        }
      ]
    },
    {
      poste: 'Développeur',
      entreprise: 'TouchLink',
      localisation: 'Tunis',
      periode: '11/2017 – 09/2018',
      projets: [
        {
          titre: 'Application mobile Medespoir',
          contexte:
            'Agence de tourisme médical – app mobile de demandes de devis.',
          equipe: '1 Front, 1 Back',
          role: 'Développeur IONIC (front)',
          missions: [
            'IHM complètes',
            'Conso WS REST',
            'Template + structure',
            'Suivi maquettes et bonnes pratiques UI/UX'
          ],
          technologies: ['IONIC 3', 'TS', 'HTML/CSS', 'Bootstrap', 'REST', 'Git', 'Trello', 'VS Code']
        },
        {
          titre: 'Android MeeTime (dating)',
          contexte:
            'Plateforme de dating – conception et dev Android + web',
          equipe: '2 Mobiles, 1 PHP, 1 NodeJS',
          role: 'Dév Android & Angular',
          missions: [
            'Conception BDD (MySQL)',
            'Fonctionnalités Android',
            'IHM Angular',
            'Template + structure',
            'Correction anomalies'
          ],
          technologies: ['Android', 'REST', 'Angular 8', 'TS', 'HTML/CSS', 'Git', 'VS Code', 'Trello']
        }
      ]
    },
    {
      poste: 'Développeur',
      entreprise: 'Rebusiness',
      localisation: 'Tunis',
      periode: '12/2016 – 10/2017',
      projets: [
        {
          titre: 'Prostreet Soccer (mobile)',
          contexte:
            'Mise en relation recruteurs pro ↔ joueurs de football.',
          equipe: '1 Front, 1 Back',
          role: 'Développeur IONIC (front)',
          missions: [
            'IHM complètes',
            'Conso WS REST',
            'Template + structure',
            'Maquettes + UI/UX'
          ],
          technologies: ['IONIC 3', 'TS', 'HTML/CSS', 'Bootstrap', 'REST', 'Git', 'Trello', 'VS Code']
        },
        {
          titre: 'Fleetsi (web)',
          contexte:
            'Gestion collaborateurs terrain par localisation.',
          equipe: '1 Mobile, 1 NodeJS',
          role: 'Développeur Ionic / Angular',
          missions: [
            'Fonctionnalités IONIC',
            'IHM Angular',
            'Template + structure',
            'Correction anomalies'
          ],
          technologies: ['IONIC 3', 'REST', 'Angular 8', 'TS', 'HTML/CSS', 'Git', 'VS Code', 'Trello']
        }
      ]
    },
    {
      poste: 'Développeur PHP',
      entreprise: 'MINDENGINEERING (CDD)',
      localisation: 'Tunis',
      periode: '12/2015 – 11/2016',
      projets: [
        {
          titre: 'Carnet Adresses (web)',
          contexte:
            'Gestion des répertoires et carnets d’adresses.',
          equipe: '1 Dev PHP',
          role: 'Développeur PHP',
          missions: ['IHM complètes', 'Conception BDD (MySQL)'],
          technologies: ['CodeIgniter 3', 'jQuery', 'HTML/CSS', 'Bootstrap']
        },
        {
          titre: 'MIND-IBILLING (web)',
          contexte:
            'Gestion devis, commandes, factures clients.',

          equipe: '2 Dev PHP',
          role: 'Développeur PHP',
          missions: [
            'Fonctionnalités complètes',
            'Template + structure',
            'Correction anomalies'
          ],
          technologies: ['CakePHP', 'jQuery', 'Bootstrap', 'HTML/CSS', 'Git']
        }
      ]
    }
  ];

  readonly formation = [
    { etab: 'Lycée 2 mars 1934, Siliana', periode: '06/2012', diplome: 'Baccalauréat – Informatique' },
    { etab: "Institut Supérieur des Études Technologiques, Tunis", periode: '09/2012 – 06/2015', diplome: 'Licence – Informatique' }
  ] as const;

  readonly langues = [
    { langue: 'Français', niveau: 'Opérationnel' },
    { langue: 'Anglais', niveau: 'Notions' }
  ] as const;

  readonly certificats = [
    '2022 Certified SAFe 5 Practitioner',
    '2021 Oracle Certified Associate, Java SE 8 Programmer'
  ] as StrArr;

  trackByIndex(i: number): number { return i; }
}
