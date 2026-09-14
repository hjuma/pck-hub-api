export type PublicationStatus = 'published' | 'withdrawn' | 'deleted';

export interface TaxonomyItem {
  code: string;  // Stable taxonomy key (e.g., "adolescent-health")
  label: string; // Human-readable label (e.g., "Adolescent Health")
}

export interface Author {
  name: string;
  orcid?: string;     // Optional Open Researcher and Contributor ID
  identifier?: string; // Optional internal or external system author ID
}

export interface FileAttachment {
  url: string;             // Stable HTTPS URL to the file
  mimeType: string;        // Official MIME type (e.g., "application/pdf")
  sizeBytes: number;       // Size in bytes
  checksumSha256: string;  // SHA-256 hash for integrity verification
  access: 'public' | 'restricted';
  websiteMayCopy: boolean; // Permission indicator for downloading/local storage
}

export interface PublicationIdentifier {
  type: 'DOI' | 'ISBN' | 'ReportNumber' | 'Other';
  value: string;
}

export interface Publication {
  id: string;                      // Immutable, globally unique source key (never recycled)
  title: string;                   // Plain text title
  updatedAt: string;               // ISO 8601 UTC timestamp (updated for every material change)
  status: PublicationStatus;       // 'published', 'withdrawn', or 'deleted'
  resourceType: TaxonomyItem;      // Primary categorization
  publicationDate: string;         // ISO date (YYYY-MM-DD or YYYY)
  landingPageUrl: string;          // Stable HTTPS source record URL
  summary: string;                 // Plain text or sanitized HTML summary
  summaryFormat: 'text' | 'html';  // Discriminator for summary format
  authors: Author[];               // Ordered list of contributors
  subjects: TaxonomyItem[];        // Ordered list of subject/keyword mappings
  geographies?: TaxonomyItem[];    // Optional geography codes (strongly recommended)
  language?: string;               // Optional ISO 639 language code (strongly recommended)
  identifiers?: PublicationIdentifier[]; // Optional standard identifiers
  files?: FileAttachment[];        // Conditional: present if files are attached
  thumbnailUrl?: string;           // Optional Cover image URL (public HTTPS)
  rights?: string;                 // Strongly recommended license statement
  sourceSystem: string;            // System name and optional version (e.g., "knowledgehub-v1")
}

export interface PublicationsResponse {
  items: Publication[];
  nextCursor: string | null;
  syncWatermark: string; // ISO 8601 UTC timestamp of the latest record
}

export interface TaxonomiesResponse {
  resourceTypes: TaxonomyItem[];
  subjects: TaxonomyItem[];
  geographies: TaxonomyItem[];
  languages: Array<{ code: string; label: string }>;
}
