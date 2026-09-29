# Product Requirements Document: Supabase Migration (PRD_MIGRATION.md)

## 1. Document Control & Metadata
* **Project Name**: PC-Kenya Knowledge Hub API Server
* **Document Type**: Migration Specification Document
* **Status**: Draft / Ready for Review
* **Target Environment**: Node.js, TypeScript, Supabase PostgreSQL, Vercel Serverless
* **Supabase Project Name**: `pck-kenya`
* **Supabase Project ID**: `exyhjkjgyiakccrlmpds`
* **Supabase Region**: `eu-west-1`
* **Supabase URL**: `https://exyhjkjgyiakccrlmpds.supabase.co`

---

## 2. Executive Summary & Objective
The purpose of this migration PRD is to transition the PC-Kenya Knowledge Hub API Server from serving static in-memory mock data (`api/data.ts`) to a robust, scalable, cloud-backed PostgreSQL database hosted on **Supabase**. 

In addition to persisting publications, taxonomies, files, and authors in Supabase tables, this migration upgrades the authentication architecture from static shared bearer tokens to **Supabase JWT verification via JWKS (JSON Web Key Set)**, leveraging the provided cryptographic keys.

---

## 3. Supabase Integration Architecture

### 3.1. Connection & Credentials
* **Project Reference ID**: `exyhjkjgyiakccrlmpds`
* **API Base URL**: `https://exyhjkjgyiakccrlmpds.supabase.co`
* **Region**: `eu-west-1`
* **Environment Variables Required**:
  * `SUPABASE_URL`: `https://exyhjkjgyiakccrlmpds.supabase.co`
  * `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (for server-side administrative reads/writes)
  * `SUPABASE_ANON_KEY`: Supabase anonymous public key (optional for client-facing public calls if applicable)

### 3.2. Authentication & JWKS Verification
The API will replace or augment the static token middleware with Supabase JWT validation:
* **Discovery URL / JWKS Endpoint**: `https://exyhjkjgyiakccrlmpds.supabase.co/auth/v1/.well-known/jwks.json`
* **Key ID (`kid`)**: `3bfb7087-54f7-4a5c-b5a4-18965cedd682`
* **Algorithm**: `ES256` (Elliptic Curve Digital Signature Algorithm with P-256 curve and SHA-256)
* **Public Key Set Configuration**:
  ```json
  {
    "keys": [
      {
        "x": "TiXSaIbq4ylvbGk6HUjVN627jwMh1xao0DSHJfU0OtM",
        "y": "mJZ1s0vfA5E08Et7vVktr8EW2Vp1Q1lGiWJ1GZVABi8",
        "alg": "ES256",
        "crv": "P-256",
        "ext": true,
        "kid": "3bfb7087-54f7-4a5c-b5a4-18965cedd682",
        "kty": "EC",
        "key_ops": ["verify"]
      }
    ]
  }
  ```
* **Auth Middleware Workflow**:
  1. Extract `Authorization: Bearer <JWT>` header from incoming requests.
  2. Fetch or cache public keys from the Supabase JWKS discovery endpoint (`https://exyhjkjgyiakccrlmpds.supabase.co/auth/v1/.well-known/jwks.json`).
  3. Verify the token signature using the ES256 key matching `kid: "3bfb7087-54f7-4a5c-b5a4-18965cedd682"`.
  4. Ensure token claims (`exp`, `iss`, `aud`) are valid.

---

## 4. Database Schema Design (Supabase PostgreSQL)

To support all properties defined in `PRD.md`, the Supabase database will feature the following tables and relationships:

### 4.1. Table: `taxonomies`
Stores controlled taxonomy categories (resource types, subjects, geographies, languages).
* `code` (VARCHAR, Primary Key)
* `category` (VARCHAR NOT NULL: 'resource_type', 'subject', 'geography', 'language')
* `label` (TEXT NOT NULL)
* `created_at` (TIMESTAMPTZ DEFAULT NOW())

### 4.2. Table: `publications`
Stores the core publication records.
* `id` (VARCHAR(64), Primary Key) - e.g., `pub-2026-001`
* `title` (TEXT NOT NULL)
* `updated_at` (TIMESTAMPTZ NOT NULL) - Indexed for deterministic pagination (`updated_at ASC, id ASC`)
* `status` (VARCHAR(32) NOT NULL) - Values: `'published'`, `'withdrawn'`, `'deleted'`
* `resource_type_code` (VARCHAR(64) REFERENCES taxonomies(code))
* `publication_date` (VARCHAR(32) NOT NULL)
* `landing_page_url` (TEXT NOT NULL)
* `summary` (TEXT NOT NULL)
* `summary_format` (VARCHAR(16) NOT NULL) - Values: `'text'`, `'html'`
* `language` (VARCHAR(16))
* `thumbnail_url` (TEXT)
* `rights` (TEXT)
* `source_system` (VARCHAR(64) NOT NULL)
* `created_at` (TIMESTAMPTZ DEFAULT NOW())

### 4.3. Table: `publication_authors`
Stores publication authors (1-to-many relationship).
* `id` (SERIAL, Primary Key)
* `publication_id` (VARCHAR(64) REFERENCES publications(id) ON DELETE CASCADE)
* `name` (TEXT NOT NULL)
* `orcid` (VARCHAR(64))
* `identifier` (VARCHAR(64))

### 4.4. Table: `publication_subjects`
Stores publication subjects (many-to-many relationship).
* `publication_id` (VARCHAR(64) REFERENCES publications(id) ON DELETE CASCADE)
* `taxonomy_code` (VARCHAR(64) REFERENCES taxonomies(code))
* Primary Key: `(publication_id, taxonomy_code)`

### 4.5. Table: `publication_geographies`
Stores publication geographies (many-to-many relationship).
* `publication_id` (VARCHAR(64) REFERENCES publications(id) ON DELETE CASCADE)
* `taxonomy_code` (VARCHAR(64) REFERENCES taxonomies(code))
* Primary Key: `(publication_id, taxonomy_code)`

### 4.6. Table: `publication_identifiers`
Stores external identifiers (DOI, ISBN, etc.).
* `id` (SERIAL, Primary Key)
* `publication_id` (VARCHAR(64) REFERENCES publications(id) ON DELETE CASCADE)
* `type` (VARCHAR(32) NOT NULL) - Values: `'DOI'`, `'ISBN'`, `'ReportNumber'`, `'Other'`
* `value` (TEXT NOT NULL)

### 4.7. Table: `publication_files`
Stores file attachments linked to publications.
* `id` (SERIAL, Primary Key)
* `publication_id` (VARCHAR(64) REFERENCES publications(id) ON DELETE CASCADE)
* `url` (TEXT NOT NULL)
* `mime_type` (VARCHAR(128) NOT NULL)
* `size_bytes` (BIGINT NOT NULL)
* `checksum_sha256` (VARCHAR(64) NOT NULL)
* `access` (VARCHAR(32) NOT NULL) - Values: `'public'`, `'restricted'`
* `website_may_copy` (BOOLEAN NOT NULL DEFAULT TRUE)

---

## 5. Migration Execution Plan & Steps

### Phase 1: Supabase Environment Setup
1. Provision and configure Supabase project `pck-kenya` (`exyhjkjgyiakccrlmpds`).
2. Execute SQL schema creation script (creating tables, foreign keys, and indexes).
3. Populate controlled taxonomies (`taxonomies` table) and seed initial publication data.

### Phase 2: Application Code Refactoring
1. Install `@supabase/supabase-js` and `jose` (for ES256 JWT JWKS verification).
2. Create Supabase client utility (`api/supabase.ts`).
3. Replace mock data queries in `api/index.ts` with direct PostgreSQL queries via Supabase client:
   * Implement `GET /v1/taxonomies` fetching from Supabase `taxonomies` table.
   * Implement `GET /v1/publications` with deterministic sorting (`ORDER BY updated_at ASC, id ASC`), `updatedSince` delta filtering, base64 cursor decoding/encoding, and pagination limit capping.
   * Implement `GET /v1/publications/{id}` fetching single publication with joined authors, subjects, geographies, identifiers, and files.
4. Update authentication middleware to validate Supabase JWTs against `https://exyhjkjgyiakccrlmpds.supabase.co/auth/v1/.well-known/jwks.json`.

### Phase 3: Testing & Validation
1. Update existing unit/integration tests (`api/index.test.ts`) to mock or connect against Supabase test instance.
2. Verify all 10 QA acceptance criteria (Full sync, pagination continuity, incremental sync precision, idempotency, JWKS auth validation, rate limiting, and error handling).
3. Deploy to Vercel and set production environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

---
*End of Migration PRD*
