# Product Requirement Document (PRD): Secure Gated Downloads & Lead Capture System

**Document Version:** 1.1.0  
**Status:** Implemented & Tested (Publication-Level Gated Downloads & Schema)  
**Target Architecture:** Supabase Private Storage, PostgreSQL (Supabase DB), Node/Express Backend API, Next.js Admin Dashboard, Snowflake Lakehouse (Medallion Architecture with dbt).  
**Note:** Epic 2 is excluded from this repository scope as it will be implemented by another team.

---

## 1. Executive Summary & Objectives

This PRD outlines the end-to-end implementation plan for securing file downloads across the PC-Kenya Knowledge Hub. To ensure high-quality lead generation and data compliance, anonymous guest users must complete a mandatory lead capture form before accessing any protected document. 

**Core Design Architecture (Publication-Level Gating):**
- A publication (`publication_id`) has **0 to many files** (`file_id`).
- Download requests are initiated at the **`publication_id` level** rather than individual files.
- Once a download request for a `publication_id` is granted (instant approval or admin approval), **all related files** associated with that publication are made available via secure time-bound Supabase signed URLs.

The system utilizes:
- **Supabase Private Storage (`protected-downloads`)** to prevent direct public URL access.
- **Backend Signed URL Generation Engine (Publication-Level)** to grant time-bound access to all associated files based on user profiles.
- **Stateful Lead Tracking & Asynchronous Approval Workflow** for restricted publications.
- **Admin Review Dashboard (Next.js)** for managing pending publication requests.
- **Medallion Architecture Analytics (Snowflake + dbt)** for operational telemetry and audit logging.

---

## 2. Implementation Status Summary

| Epic | Title | Status |
| :--- | :--- | :--- |
| **Epic 1** | Supabase Storage & Database Schema Setup (Publication-Level) | `[x]` Completed |
| **Epic 2** | Frontend Gated Download Flow & Form Capture | `[SKIPPED]` Handled by another team |
| **Epic 3** | Backend Supabase Signed URL & Profile Expiration Engine | `[x]` Completed |
| **Epic 4** | Asynchronous Validation & Email Notification Pipeline | `[x]` Completed (Backend API & Workflows) |
| **Epic 5** | Security, Abuse Mitigation & Audit Logging | `[x]` Completed (Rate limiting & Audit logs) |
| **Epic 6** | Administrative Dashboard Web Application (React / Next.js) | `[ ]` Out of scope (Separate App Repo) |
| **Epic 7** | Medallion Architecture Data Pipeline (Lakehouse & Snowflake) | `[ ]` Out of scope (Data Eng Pipeline Repo) |

---

## 3. Detailed Epic & Story Breakdown with Tracking Markers

### Epic 1: Supabase Storage & Database Schema Setup
**Goal:** Configure Supabase private buckets, file metadata storage, lead capture tables, and access security policies.

- [x] **Story 1.1: Supabase Private Storage Bucket Configuration**
  - **Description:** Set up a private storage bucket in Supabase to block public direct-bucket access.
  - **Acceptance Criteria:**
    - [x] Create a storage bucket named `protected-downloads` with Public Access set to `false`.
    - [x] Configure bucket security policies ensuring files can only be accessed server-side via Service Role keys or generated Signed URLs.

- [x] **Story 1.2: Database Schema for Leads, Files, and Requests**
  - **Description:** Create PostgreSQL tables in Supabase to track publications, guest lead submissions, and download tokens at the publication level.
  - **Acceptance Criteria:**
    - [x] Ensure `publications` and `publication_files` tables exist where each publication has 0-N files.
    - [x] Create `lead_submissions` table referencing `publication_id`, storing visitor details (`email`, `name`, `metadata`, `profile_type`), and `status` (`pending`, `approved`, `rejected`).
    - [x] Create `audit_logs` table tracking download requests and token generation events at the publication level.
    - [x] Enable Row Level Security (RLS) on submission and storage tables.

---

### Epic 2: Frontend Gated Download Flow & Form Capture
**Goal:** Intercept all guest download interactions and present the mandatory data-capture modal.  
**Status:** `[SKIPPED]` — Excluded from this repository scope (implemented by another team).

- [SKIPPED] **Story 2.1: Global Click Interceptor & Modal Component**
- [SKIPPED] **Story 2.2: Lead Form Submission Handling**

---

### Epic 3: Backend Supabase Signed URL & Profile Expiration Engine
**Goal:** Leverage Supabase Storage API to generate time-bound signed URLs based on user profiles for all publication files.

- [x] **Story 3.1: Publication-Level Signed URL Generator Service**
  - **Description:** Implement a backend service generating temporary signed URLs for all files linked to a given `publication_id`.
  - **Acceptance Criteria:**
    - [x] Query all files associated with `publication_id`.
    - [x] Invoke `supabase.storage.from('protected-downloads').createSignedUrl(path, expiresInSeconds)` for each related file.
    - [x] Dynamically calculate `expiresInSeconds` based on profile configuration (Standard = 900s; Premium/Partner = 86400s).

- [x] **Story 3.2: Instant Publication Fulfillment API Endpoint**
  - **Description:** Handle form submissions that qualify for immediate automated download links for the entire publication package.
  - **Acceptance Criteria:**
    - [x] Implement `POST /v1/downloads/request` endpoint accepting `publicationId`.
    - [x] Validate request data, store lead info in PostgreSQL `lead_submissions` table.
    - [x] Generate signed URLs for all files under the publication.
    - [x] Return `downloadUrls` array in the JSON response.

---

### Epic 4: Asynchronous Validation & Email Notification Pipeline
**Goal:** Handle restricted/unverified requests requiring administrative or automated review before dispatching download links for publication files.

- [x] **Story 4.1: Admin Review & Status Management Workflow**
  - **Description:** Review pending publication-level submissions.
  - **Acceptance Criteria:**
    - [x] Implement API endpoints (`GET /v1/downloads/requests`, `POST /v1/downloads/requests/:id/approve`, `POST /v1/downloads/requests/:id/reject`).

- [x] **Story 4.2: Automated Email Dispatcher with Supabase/SMTP**
  - **Description:** Trigger email delivery when a publication request transitions to `APPROVED`.
  - **Acceptance Criteria:**
    - [x] Upon approval, backend generates signed URLs for all files associated with the approved `publication_id`.

---

### Epic 5: Security, Abuse Mitigation & Audit Logging
**Goal:** Prevent bot abuse on lead capture forms and track download lifecycles.

- [x] **Story 5.1: Anti-Abuse & Rate Limiting**
  - **Description:** Protect public submission endpoint from spam bots.
  - **Acceptance Criteria:**
    - [x] Implement rate limiting middleware on API endpoints.

- [x] **Story 5.2: Audit Logs & Telemetry**
  - **Description:** Track download link generation events and publication-level access.
  - **Acceptance Criteria:**
    - [x] Log events into `audit_logs` referencing `publication_id`.

---

### Epic 6 & Epic 7: Admin Dashboard & Medallion Pipeline
**Status:** Out of scope for this repository (separate repositories/teams).

---

## 4. Verification & Testing

- **Automated Tests:** Comprehensive unit test suite (`api/index.test.ts`) covering publication-level download requests, validation errors, authentication, admin review listings, approval workflows (returning `downloadUrls` array), and rejection workflows. All 16 tests pass successfully (`100% passing`).
- **Build Verification:** TypeScript compilation (`npm run build`) succeeds cleanly with zero errors.
