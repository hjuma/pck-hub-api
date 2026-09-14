import { Publication, TaxonomyItem } from './types';

// Controlled Taxonomy Values
export const RESOURCE_TYPES: TaxonomyItem[] = [
  { code: 'policy-brief', label: 'Policy Brief' },
  { code: 'research-report', label: 'Research Report' },
  { code: 'fact-sheet', label: 'Fact Sheet' },
  { code: 'journal-article', label: 'Journal Article' },
  { code: 'working-paper', label: 'Working Paper' }
];

export const SUBJECTS: TaxonomyItem[] = [
  { code: 'adolescent-health', label: 'Adolescent Health' },
  { code: 'gender-equality', label: 'Gender Equality' },
  { code: 'reproductive-health', label: 'Reproductive Health' },
  { code: 'hiv-prevention', label: 'HIV & AIDS Prevention' },
  { code: 'poverty-dynamics', label: 'Poverty & Vulnerability' },
  { code: 'education-outcomes', label: 'Education Outcomes' }
];

export const GEOGRAPHIES: TaxonomyItem[] = [
  { code: 'KE', label: 'Kenya' },
  { code: 'KE-30', label: 'Nairobi County' },
  { code: 'KE-19', label: 'Kisumu County' },
  { code: 'TZ', label: 'Tanzania' },
  { code: 'UG', label: 'Uganda' }
];

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'fr', label: 'French' }
];

// Mock database containing representative records addressing all edge cases from the API requirements
export const mockPublications: Publication[] = [
  // 1. Normal published record
  {
    id: 'pub-2026-001',
    title: 'Adolescent Health and Wellbeing in Urban Kenya: A Baseline Study',
    updatedAt: '2026-09-01T10:00:00Z',
    status: 'published',
    resourceType: { code: 'research-report', label: 'Research Report' },
    publicationDate: '2026-08-20',
    landingPageUrl: 'https://knowledge.example.org/publications/pub-2026-001',
    summary: '<p>This comprehensive report highlights key challenges faced by adolescents in informal settlements of Nairobi, including access to healthcare and education.</p>',
    summaryFormat: 'html',
    authors: [
      { name: 'Dr. Jane Atieno', orcid: '0000-0002-1825-0097' }
    ],
    subjects: [
      { code: 'adolescent-health', label: 'Adolescent Health' }
    ],
    geographies: [
      { code: 'KE', label: 'Kenya' },
      { code: 'KE-30', label: 'Nairobi County' }
    ],
    language: 'en',
    identifiers: [
      { type: 'DOI', value: '10.3189/pck.2026.001' },
      { type: 'ReportNumber', value: 'PCK-RR-2026-12' }
    ],
    files: [
      {
        url: 'https://knowledge.example.org/files/adolescent-health-baseline-2026.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2457600,
        checksumSha256: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        access: 'public',
        websiteMayCopy: true
      }
    ],
    thumbnailUrl: 'https://knowledge.example.org/thumbnails/pub-2026-001-thumb.jpg',
    rights: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
    sourceSystem: 'pc-kenya-hub-v1'
  },

  // 2. Missing optional fields
  {
    id: 'pub-2026-002',
    title: 'PC-Kenya Annual Strategic Vision Statement',
    updatedAt: '2026-09-02T11:30:00Z',
    status: 'published',
    resourceType: { code: 'fact-sheet', label: 'Fact Sheet' },
    publicationDate: '2026', // Minimum four digit year as allowed
    landingPageUrl: 'https://knowledge.example.org/publications/pub-2026-002',
    summary: 'An overview of PC-Kenya strategic priorities targeting key demographic developments over the coming decade.',
    summaryFormat: 'text',
    authors: [
      { name: 'Population Council Kenya Secretariat' }
    ],
    subjects: [
      { code: 'poverty-dynamics', label: 'Poverty & Vulnerability' }
    ],
    // Optional geographies omitted
    // Optional language omitted
    // Optional identifiers omitted
    // Optional files omitted
    // Optional thumbnailUrl omitted
    // Optional rights omitted
    sourceSystem: 'pc-kenya-hub-v1'
  },

  // 3. Multiple authors and multiple topics
  {
    id: 'pub-2026-003',
    title: 'Bridging Gender Gaps in Reproductive Health Education and HIV Prevention',
    updatedAt: '2026-09-03T08:30:00Z',
    status: 'published',
    resourceType: { code: 'policy-brief', label: 'Policy Brief' },
    publicationDate: '2026-09-01',
    landingPageUrl: 'https://knowledge.example.org/publications/pub-2026-003',
    summary: 'A critical policy brief highlighting intersectional approaches to gender parity in public health programs, with a focus on adolescent healthcare delivery systems.',
    summaryFormat: 'text',
    authors: [
      { name: 'Prof. John Kamau', identifier: 'pck-auth-908' },
      { name: 'Grace Mutua', orcid: '0000-0001-5231-9023' },
      { name: 'Dr. Sarah Jenkins' }
    ],
    subjects: [
      { code: 'gender-equality', label: 'Gender Equality' },
      { code: 'reproductive-health', label: 'Reproductive Health' },
      { code: 'hiv-prevention', label: 'HIV & AIDS Prevention' }
    ],
    geographies: [
      { code: 'KE', label: 'Kenya' },
      { code: 'UG', label: 'Uganda' },
      { code: 'TZ', label: 'Tanzania' }
    ],
    language: 'en',
    identifiers: [
      { type: 'ISBN', value: '978-9966-123-45-6' }
    ],
    files: [
      {
        url: 'https://knowledge.example.org/files/bridging-gender-gaps-policy-2026.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1048576,
        checksumSha256: '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e',
        access: 'public',
        websiteMayCopy: true
      }
    ],
    thumbnailUrl: 'https://knowledge.example.org/thumbnails/pub-2026-003-thumb.jpg',
    rights: 'All rights reserved. Metadata may be reused; link to the source file.',
    sourceSystem: 'pc-kenya-hub-v1'
  },

  // 4. Restricted file record
  {
    id: 'pub-2026-004',
    title: 'Kenya National Survey on Reproductive Health Rights (Restricted Annex)',
    updatedAt: '2026-09-04T14:15:00Z',
    status: 'published',
    resourceType: { code: 'working-paper', label: 'Working Paper' },
    publicationDate: '2026-07-15',
    landingPageUrl: 'https://knowledge.example.org/publications/pub-2026-004',
    summary: 'This working paper includes detailed geospatial breakdowns of surveyed clinics. File download is restricted to authorized partners with permission to access sensitive public health datasets.',
    summaryFormat: 'text',
    authors: [
      { name: 'Dr. Jane Atieno', orcid: '0000-0002-1825-0097' },
      { name: 'Prof. John Kamau', identifier: 'pck-auth-908' }
    ],
    subjects: [
      { code: 'reproductive-health', label: 'Reproductive Health' }
    ],
    geographies: [
      { code: 'KE', label: 'Kenya' }
    ],
    language: 'en',
    files: [
      {
        url: 'https://knowledge.example.org/files/national-survey-restricted-2026.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 8192000,
        checksumSha256: 'bc901a23b4cd56ef78ab901c23de45fg67hi89jk01lm23no45op67qr89st01uv',
        access: 'restricted',
        websiteMayCopy: false // Indicates the headless WordPress sync worker should NOT download or mirror this file
      }
    ],
    rights: 'Confidential. Restricted publication. Internal use only.',
    sourceSystem: 'pc-kenya-hub-v1'
  },

  // 5. Withdrawn / tombstoned record
  {
    id: 'pub-2026-005',
    title: '[Withdrawn] Primary Education Outcome Projections (2020-2025 Study)',
    updatedAt: '2026-09-05T09:00:00Z',
    status: 'withdrawn', // Withdrawn status allows client to unpublish
    resourceType: { code: 'working-paper', label: 'Working Paper' },
    publicationDate: '2020',
    landingPageUrl: 'https://knowledge.example.org/publications/pub-2026-005',
    summary: 'This paper has been withdrawn because the historical baseline projections have been superceded by 2026 census outcomes.',
    summaryFormat: 'text',
    authors: [
      { name: 'Dr. Sarah Jenkins' }
    ],
    subjects: [
      { code: 'education-outcomes', label: 'Education Outcomes' }
    ],
    sourceSystem: 'pc-kenya-hub-v1'
  }
];
