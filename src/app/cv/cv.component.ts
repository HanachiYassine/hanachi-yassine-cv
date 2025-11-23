// src/app/cv/cv.component.ts
import { CommonModule } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';

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
  imports: [CommonModule, HttpClientModule],
  templateUrl: './cv.component.html',
  styleUrls: ['./cv.component.scss'],

})
export class CvComponent implements OnInit {
  infos: any;
  profil: string = '';
  competences: any;
  experiences: any[] = [];
  formation: any[] = [];
  langues: any[] = [];
  certificats: string[] = [];
  centresInteret: string[] = [];

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.http.get<any>('http://localhost:3000/api/cv').subscribe(data => {
      this.infos = data.infos;
      this.profil = data.profil;
      this.competences = data.competences;
      this.experiences = data.experiences;
      this.formation = data.formation;
      this.langues = data.langues;
      this.certificats = data.certificats;
      this.centresInteret = data.centresInteret;
    });
  }

  trackByIndex(index: number, item: any): number {
    return index;
  }

  public downloadCV(): void {
    // Temporarily hide the download button
    const btn = document.querySelector('.cv-download-btn') as HTMLElement;
    if (btn) btn.style.display = 'none';

    // Call GET /api/pdf directly
    this.http.get('http://localhost:3000/api/pdf', { responseType: 'blob' })
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const now = new Date();
          const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
          link.download = `CV_Yassine_Hannachi_${timestamp}.pdf`;
          link.click();
          window.URL.revokeObjectURL(url);
          if (btn) btn.style.display = 'block';
        },
        error: (error: unknown) => {
          console.error('Error downloading PDF:', error);
          alert('Une erreur est survenue lors du téléchargement du PDF.');
          if (btn) btn.style.display = 'block';
        }
      });
  }
}
