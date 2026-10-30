Based on your requirements (**Supabase Storage** backend and **100% anonymous guest users** who must fill out a form before *any* download), the design adapts to secure private storage buckets, signed URL generation via Supabase Server SDK / Edge Functions, and stateful tracking of submissions.

Here is your updated, refined implementation plan divided into Epics and Stories tailored to this architecture.

---

## Updated Architecture & Workflow Overview

```
                      +-----------------------------+
                      | Anonymous User Clicks File  |
                      +--------------+--------------+
                                     |
                                     v
                       [Show Mandatory Lead Form]
                                     |
                           User Fills & Submits
                                     |
                                     v
                   [Backend API: POST /api/download-request]
                                     |
                     +---------------+---------------+
                     |                               |
                     v                               v
             [Auto-Approval Path]           [Manual Validation Path]
                     |                               |
         Generate Supabase Signed URL         Save to DB as 'PENDING'
                     |                               |
          Return URL directly to UI          Admin Approves Request
                     |                               |
                     v                               v
              Instant Download                Email Tokenized Link
                                                via Supabase Mail

```

---

## Epic 1: Supabase Storage & Database Schema Setup

**Goal:** Configure Supabase private buckets, file metadata storage, lead capture tables, and access security policies.

* ### Story 1.1: Supabase Private Storage Bucket Configuration


* **Description:** Set up a private storage bucket in Supabase to block public direct-bucket access.
* **Acceptance Criteria:**
* Create a bucket named `protected-downloads` with Public Access set to `false`.
* Ensure files can only be accessed server-side via Service Role keys or generated Signed URLs.




* ### Story 1.2: Database Schema for Leads, Files, and Requests


* **Description:** Create PostgreSQL tables in Supabase to track files, guest lead submissions, and download tokens.
* **Acceptance Criteria:**
* `files` table: stores `id`, `filename`, `storage_path`, `access_field` (e.g., `instant` vs `restricted`).
* `lead_submissions` table: stores visitor details (`email`, `name`, `metadata`), `file_id`, `status` (`pending`, `approved`, `rejected`), and `profile_type`.
* Row Level Security (RLS) enabled, ensuring anonymous clients cannot read storage files or raw submission tables directly.





---

## Epic 2: Frontend Gated Download Flow & Form Capture

**Goal:** Intercept all guest download interactions and present the mandatory data-capture modal.

* ### Story 2.1: Global Click Interceptor & Modal Component


* **Description:** Implement a frontend click handler that intercepts any file download trigger across the website.
* **Acceptance Criteria:**
* Prevent default browser behavior / direct URL navigation.
* Trigger a modal popup prompting the anonymous user for their details regardless of the file.




* ### Story 2.2: Lead Form Submission Handling


* **Description:** Build form validation and asynchronous submission logic communicating with the backend API.
* **Acceptance Criteria:**
* Validate user inputs (e.g., valid email address syntax).
* Post submission payload (`file_id`, user contact data) to backend endpoint (`/api/v1/downloads/request`).
* Display loading state and handle UX feedback based on whether the file requires instant delivery or manual verification.





---

## Epic 3: Backend Supabase Signed URL & Profile Expiration Engine

**Goal:** Leverage Supabase Storage API to generate time-bound signed URLs based on user profiles.

* ### Story 3.1: Supabase Signed URL Generator Service


* **Description:** Implement a backend service using the Supabase JS/Server SDK to generate temporary signed URLs.
* **Acceptance Criteria:**
* Call `supabase.storage.from('protected-downloads').createSignedUrl(path, expiresInSeconds)`.
* Dynamically calculate `expiresInSeconds` based on the user profile configuration (e.g., Standard profile = 900 seconds / 15 minutes; Premium/Partner profile = 86400 seconds / 24 hours).




* ### Story 3.2: Instant Fulfillment API Endpoint


* **Description:** Handle form submissions that qualify for immediate automated download links.
* **Acceptance Criteria:**
* Validate request data and store lead info in PostgreSQL.
* Generate the Supabase Signed URL.
* Return the signed URL in the JSON response so the frontend can instantly invoke the file download.





---

## Epic 4: Asynchronous Validation & Email Notification Pipeline

**Goal:** Handle restricted/unverified requests that require administrative or automated review before sending download links via email.

* ### Story 4.1: Admin Review & Status Management Workflow


* **Description:** Create an internal dashboard view or API webhook to review pending guest download submissions.
* **Acceptance Criteria:**
* List submissions where status is `PENDING`.
* Provide action buttons for admins to **Approve** or **Reject**.




* ### Story 4.2: Automated Email Dispatcher with Supabase/SMTP


* **Description:** Trigger email delivery when a request transitions to `APPROVED`.
* **Acceptance Criteria:**
* Upon approval, backend generates a fresh Supabase Signed URL with the appropriate profile expiration time.
* Send an email to the guest's submitted address containing the secure download link and clear expiration text.





---

## Epic 5: Security, Abuse Mitigation & Audit Logging

**Goal:** Prevent bot abuse on lead capture forms and track download lifecycles.

* ### Story 5.1: Anti-Abuse & Rate Limiting


* **Description:** Protect the public form submission endpoint from spam bots and script attacks.
* **Acceptance Criteria:**
* Implement IP and email-based rate limiting on `/api/v1/downloads/request`.
* Optional integration with invisible CAPTCHA (e.g., Turnstile or reCAPTCHA v3) on the popup form.




* ### Story 5.2: Audit Logs & Telemetry


* **Description:** Track download link generation events, link expiration checks, and file access counts for reporting.
* **Acceptance Criteria:**
* Log every successful token generation and actual file download event against the lead record.





---


Based on your confirmation—using your **dbt, Airflow, and Snowflake Medallion architecture** for analytics/logs, and **React/Next.js** for the separate Admin Dashboard website—here is the complete, expanded Epic and Story breakdown, along with the updated team mapping.

---

## Architecture & Data Flow Overview

```
 [Public Website] --(Form Submit)--> [Backend API / Supabase] --(Storage/DB)--> [Raw Logs / DB]
                                                                                   |
                                                                       [Airflow Ingestion Pipeline]
                                                                                   |
                                                                                   v
 [Admin Dashboard Website] <--(Snowflake API)--> [Snowflake (Gold Layer)] <--(dbt Transforms)-- [Bronze / Silver Lakehouse]

```

---

## New & Expanded Epics & Stories

### Epic 6: Administrative Dashboard Web Application (React / Next.js)

**Goal:** Build a standalone secure admin portal to review pending guest download requests, approve/reject leads, and view platform metrics.

* ### Story 6.1: Admin Dashboard Scaffold & Authentication


* **Description:** Initialize the standalone admin React/Next.js application with secure authentication restricting access to authorized personnel only.
* **Acceptance Criteria:**
* Setup admin UI layout (navigation, protected routes, layout wrappers).
* Implement secure login/session management (e.g., Supabase Auth with admin role checks).




* ### Story 6.2: Pending Requests Review & Action Interface


* **Description:** Build the interface to display guest submissions pending validation, with quick-action buttons to **Approve** or **Reject**.
* **Acceptance Criteria:**
* Table listing guest details, requested file name, submission timestamp, and current status (`PENDING`).
* Clicking **Approve** triggers backend API call to update status, generate signed URL, and dispatch the email.
* Clicking **Reject** updates status and notifies the system.





---

### Epic 7: Medallion Architecture Data Pipeline (Lakehouse & Snowflake)

**Goal:** Stream operational logs and download analytics through a Medallion architecture (Bronze -> Silver -> Gold) stored in Snowflake, then feed them to the admin dashboard.

* ### Story 7.1: Raw Log Capture & Bronze Layer Ingestion


* **Description:** Capture raw events (form submissions, file link generations, download triggers, and expiration events) from the backend and stream them to Snowflake Bronze storage.
* **Acceptance Criteria:**
* Write structured JSON audit logs for every user interaction to a secure cloud staging location or Snowflake stage table (Bronze Layer).




* ### Story 7.2: dbt Transformations for Silver & Gold Layers


* **Description:** Build dbt models to clean, structure, and aggregate download analytics into reporting-ready tables in Snowflake.
* **Acceptance Criteria:**
* **Silver Layer:** Parse JSON logs, clean null values, and standardize timestamps and user domains.
* **Gold Layer:** Create aggregated summary models (e.g., total downloads per file, approval rates, peak traffic hours, unique lead counts).




* ### Story 7.3: Admin Dashboard Analytics Views & API Integration


* **Description:** Expose Snowflake Gold layer metrics via a secure API endpoint so the Admin Dashboard can render download counts, trends, and lead analytics widgets.
* **Acceptance Criteria:**
* API endpoint queries Snowflake data warehouse efficiently.
* Admin dashboard renders charts and metrics cards (Total Downloads, Pending Requests, Popular Files) powered by Snowflake analytics.





---

## Comprehensive Team Responsibility Matrix

| Epic | Story ID & Title | Assigned Team | Core Focus & Deliverables |
| --- | --- | --- | --- |
| **Epic 1: Supabase & DB** | **1.1:** Private Storage Bucket Config | **API Dev Team** | Configuring Supabase storage bucket privacy and security rules. |
|  | **1.2:** Database Schema for Leads, Files, Requests | **API Dev Team** | Designing PostgreSQL tables (`files`, `lead_submissions`) and RLS policies. |
| **Epic 2: Frontend & Forms** | **2.1:** Global Click Interceptor & Modal Component | **Web Dev Team** | Building the UI modal popup and intercepting guest download clicks on public site. |
|  | **2.2:** Lead Form Submission Handling | **Web Dev Team** | Managing form state, client validation, and API communication on public site. |
| **Epic 3: Signed URL Engine** | **3.1:** Supabase Signed URL Generator Service | **API Dev Team** | Implementing backend logic to create time-bound signed URLs based on profiles. |
|  | **3.2:** Instant Fulfillment API Endpoint | **API Dev Team** | Creating the `POST` endpoint to process submissions and return instant download links. |
| **Epic 4: Validation & Email** | **4.1:** Admin Review & Status Management Workflow | **API Dev Team** | Managing request status state machine (`PENDING`, `APPROVED`, `REJECTED`) and status endpoints. |
|  | **4.2:** Automated Email Dispatcher | **API Dev Team** | Integrating email service (Supabase Mail / SendGrid) to dispatch tokenized links upon approval. |
| **Epic 5: Security & Logging** | **5.1:** Anti-Abuse & Rate Limiting | **API Dev Team** | Implementing rate limiting and CAPTCHA verification on submission endpoints. |
|  | **5.2:** Audit Logs & Telemetry | **API Dev Team** | Emitting structured audit logs of download events for pipeline ingestion. |
| **Epic 6: Admin Dashboard UI** | **6.1:** Admin Dashboard Scaffold & Authentication | **Web Dev Team** | Building the separate Next.js admin app layout and secure login. |
|  | **6.2:** Pending Requests Review & Action Interface | **Web Dev Team** | Building the admin UI table and action buttons to approve/reject guest requests. |
| **Epic 7: Lakehouse / Snowflake** | **7.1:** Raw Log Capture & Bronze Layer Ingestion | **API Dev Team** | Streaming backend operational logs into Snowflake Bronze stage tables. |
|  | **7.2:** dbt Transformations for Silver & Gold Layers | **API Dev Team / Data Eng** | Developing dbt models for cleaning and aggregating data in Snowflake. |
|  | **7.3:** Admin Dashboard Analytics Views & API | **API Dev Team** | Creating endpoints querying Snowflake Gold layer metrics for dashboard visualization. |
|  | **7.3 (UI charts)** | **Web Dev Team** | Rendering metrics, charts, and download count widgets in the Admin Dashboard. |



