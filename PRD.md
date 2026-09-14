# Product Requirements Document (PRD)
## Project Name: PC-Kenya Knowledge Hub API Server

---

### 1. Document Control & Metadata
* **Version**: 1.0.0
* **Date**: September 14, 2026
* **Status**: Draft / Under Review
* **Target Environment**: Node.js, TypeScript, Vercel Serverless
* **Author**: Gemini CLI (Lead Software Engineer)
* **Client / Stakeholder**: Population Council Kenya (PC-Kenya)

---

### 2. Executive Summary & Purpose
The PC-Kenya Knowledge Hub API Server is a highly secure, performant, and reliable metadata synchronization service. It serves as the authoritative interface exposing publication metadata from Population Council Kenya to its new website. 

The website uses a server-side sync worker to retrieve publication metadata, normalize the records inside a headless WordPress instance, and render them through a public-facing Next.js frontend. The public frontend will never access this API directly.

#### Sync Workflow Topology
```
[Authoritative Knowledge Hub Source]
               │
               ▼ (Node.js/TypeScript API Server on Vercel)
       [PC-Kenya API]
               │
               ▼ (Secure Server-to-Server /v1/publications sync)
       [WordPress Sync Worker]
               │
               ▼ (Normalizes and stores)
      [Headless WordPress]
               │
               ▼ (ISR / SSR)
     [Next.js Frontend]
```

This API must handle three core synchronization behaviors:
1. **Full Initial Import**: Bulk retrieval of all publications without initial filters.
2. **Scheduled Incremental Synchronization**: Daily or hourly cron-based pulls of changes since the last sync watermark.
3. **Ad-Hoc Synchronization**: Authorized manual synchronizations triggered by website administrators.
4. **Local Preservation**: Support safe metadata updates without overwriting locally-curated website fields.

---

### 3. Functional Requirements

#### 3.1. API Endpoints Specification
All routes must return standard JSON payloads. The base path for all endpoints is `/v1`.

##### 3.1.1. `GET /v1/publications`
Retrieves a paginated list of publication records matching search or delta sync criteria.
* **Query Parameters**:
  * `updatedSince` (string, optional): ISO 8601 UTC timestamp (e.g., `2026-09-03T08:30:00Z`). If provided, returns only records created, modified, or transitioned to `withdrawn`/`deleted` status after this time.
  * `cursor` (string, optional): An opaque pagination cursor. When requested with `cursor`, the `updatedSince` parameter must be handled consistently or embedded in the cursor.
  * `limit` (integer, optional): Maximum number of records to return. Defaults to `100`. Max permitted is `100`.
* **Behavior**:
  * Return records in a deterministic order: sorted by `updatedAt` ascending, then by `id` ascending to prevent records from being skipped or duplicated during active writes.
  * Return an opaque `nextCursor` string if more records remain. If no records remain, `nextCursor` must be `null`.
  * Return a `syncWatermark` representing the maximum `updatedAt` value processed in the current dataset. The client will store this watermark only after successfully persisting all pages in a sync sequence.
  * If `updatedSince` is omitted, this acts as a **Full Export** endpoint.

##### 3.1.2. `GET /v1/publications/{id}`
Retrieves a single publication record by its source identifier.
* **Path Parameters**:
  * `id` (string, required): The immutable, globally unique source identifier.
* **Response**:
  * Returns the full publication object if found.
  * Returns `404 Not Found` if the publication does not exist.

##### 3.1.3. `GET /v1/taxonomies`
Exposes the controlled taxonomies, value mappings, and classifications used within the system to ensure correct field alignment on the client side.
* **Response**:
  * A dictionary containing key-value pairs or code-label structures for:
    * `resourceType`
    * `subjects` / `topics`
    * `geographies`
    * `languages`

---

### 4. Data Models & TypeScript Types

#### 4.1. Publication Object Structure
Below is the definitive TypeScript schema for a publication record:

```typescript
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
```

#### 4.2. Taxonomy Model
The taxonomy response standardizes classifications:

```typescript
export interface TaxonomiesResponse {
  resourceTypes: TaxonomyItem[];
  subjects: TaxonomyItem[];
  geographies: TaxonomyItem[];
  languages: Array<{ code: string; label: string }>;
}
```

---

### 5. Behaviour, Security, & Reliability

#### 5.1. Authentication and Authorization
1. **Channel Security**: All API traffic must be encrypted over **HTTPS only**. Cleartext HTTP requests must be rejected.
2. **Server-to-Server Authentication**:
   * The primary protocol must be **OAuth 2.0 Client Credentials Flow** or a rotatable **read-only Bearer Token** specified in the HTTP `Authorization` header.
   * Credentials must have **read-only access** restricted specifically to publication endpoints.
   * **Anti-Pattern**: Personal administrator accounts or user passwords must never be used. API tokens must never be exposed to browser environments.

#### 5.2. Deterministic Sync Pagination Protocol
* To guarantee zero records are skipped or duplicated during synchronization:
  1. Records must be queried using: `ORDER BY updatedAt ASC, id ASC`.
  2. The opaque `cursor` must encode:
     * The `updatedAt` timestamp of the last record in the current page.
     * The `id` of the last record (to resolve ties where multiple records share the exact millisecond value of `updatedAt`).
  3. Example cursor payload (Base64 encoded): `eyJsYXN0VXBkYXRlZEF0IjoiMjAyNi0wOS0wM1QwODozMDowMFoiLCJsYXN0SWQiOiJwdWItMjAyNi0wMDEifQ==`.

#### 5.3. Deleted & Withdrawn Records (Tombstoning)
* When a publication is withdrawn or deleted, its record must remain discoverable in incremental syncs.
* **Tombstone Structure**: When a record is deleted, it must return `status: "deleted"` or `status: "withdrawn"`. It must retain the mandatory properties (`id`, `title`, `updatedAt`, `status`, `sourceSystem`) but can omit non-mandatory payload elements to save bandwidth.
* Incremental results must include unpublishing events, rights changes, and file-link changes.

#### 5.4. Performance and Rate Limiting
* **Default Page Size**: 100 records per page.
* **Rate Limiting**:
  * Provide a reasonable rate limit for synchronization (e.g., 60 requests per minute).
  * If a client exceeds limits, return a `429 Too Many Requests` HTTP status code.
  * Responses for 429 must include a `Retry-After` header indicating the cooldown period in seconds.
* **Error Response Format**:
  Every error must return a standard schema with a correlation ID:
  ```json
  {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please retry after the specified time.",
    "correlationId": "err-908cf8aa-dfd0-47b1-9f93-cb7223bfe4c4"
  }
  ```

---

### 6. Technical Stack & Vercel Deployment

#### 6.1. Runtime and Language
* **Runtime**: Node.js v20.x or higher
* **Language**: TypeScript 5.x
* **Framework**: Express, Fastify, or Next.js API Routes (Serverless)
* **Metadata/OpenAPI**: Redoc or Swagger UI integrated for interactive API exploration.

#### 6.2. Vercel Serverless Architecture
Vercel is a serverless platform. A traditional long-running Express server is best split into Vercel-optimized Serverless Functions.

* **API Mapping (`vercel.json`)**:
  ```json
  {
    "version": 2,
    "builds": [
      {
        "src": "api/index.ts",
        "use": "@vercel/node"
      }
    ],
    "routes": [
      {
        "src": "/v1/(.*)",
        "dest": "api/index.ts"
      }
    ]
  }
  ```
* **State Management**:
  * Because Vercel serverless functions are stateless, any temporary token validation, pagination cursors, or rate-limiting state should be processed using a fast memory store like **Vercel KV (Redis)** or direct database reads (e.g., PostgreSQL).
* **Execution Limits**:
  * Vercel Serverless Function execution limit on Hobby is 10s (Pro is 60s/900s). The sync payloads must be optimized to ensure standard listing operations execute in less than **1.5 seconds**. Deterministic pagination with smaller chunk sizes (100 records) directly supports this constraint.

---

### 7. Deliverables Required

The Knowledge Hub team must provide the following:
1. **OpenAPI 3.1 Specification**: In JSON or YAML format.
2. **Interactive Base URLs**: Both Test (Sandbox) and Production URLs.
3. **Authentication Documentation**: Detail how to rotate client credentials or bearer tokens.
4. **Data Dictionary**: Comprehensive guide on the fields, taxonomy constraints, and pagination rules.
5. **Sample Payloads**:
   * Normal published record
   * Record with missing optional fields
   * Record with multiple authors or topics
   * Restricted file access record
   * Tombstoned / withdrawn record

---

### 8. Acceptance Criteria (QA Tests)

The API is considered complete and production-ready only when it satisfies these test assertions:

| ID | Acceptance Test Description | Expected Result |
|----|-----------------------------|-----------------|
| 1 | **Full Sync Run Verification** | A listing request without `updatedSince` returns all publications. Verify that all returned elements contain unique, immutable IDs and valid schemas. |
| 2 | **Pagination Continuity** | The client can follow `nextCursor` sequentially from the first page to the final page (where `nextCursor` is `null`) without skipping records or encountering duplicates. |
| 3 | **Incremental Sync Precision** | Querying with `updatedSince` returns exactly three types of updates: newly created records, metadata edits on existing records, and tombstoned/withdrawn records. |
| 4 | **Idempotency** | Processing the same sync sequence multiple times on the WordPress receiver side does not lead to duplicate database records. |
| 5 | **Resource URL Verification** | Landing-page URLs, cover thumbnails, and file URLs are fully reachable over HTTPS. Rights are explicitly declared. |
| 6 | **Resilience & Graceful Failures** | Unauthorized tokens must trigger a `401 Unauthorized` response. Exceeding limits triggers `429` with a functional `Retry-After` header. General errors return a standard JSON error block with a correlation ID. |

---
*End of Product Requirements Document*
