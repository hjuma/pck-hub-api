# PC-Kenya Knowledge Hub API - Postman Testing Guide & Documentation

This guide provides step-by-step instructions and request definitions for testing the newly refactored **Publication-Level Gated Download & Lead Capture API** using Postman.

---

## 1. Postman Environment Setup

1. Open **Postman**.
2. Create a new Environment named `PC-Kenya Local / Staging`.
3. Add the following environment variables:
   - `base_url`: `http://localhost:3000` (or your deployed Vercel URL)
   - `auth_token`: `pck_test_token_2026` (or your Supabase ES256 JWT)

---

## 2. API Endpoints & Postman Requests

### A. Submit Guest Download Request (Public Endpoint)
Allows an anonymous visitor to submit their contact details for a specific publication (`publicationId`). If the publication files are public/instant, it immediately returns time-bound Supabase signed URLs for **all related files** (`0 to N files`) attached to that publication.

- **Method:** `POST`
- **URL:** `{{base_url}}/v1/downloads/request`
- **Headers:**
  - `Content-Type`: `application/json`
- **Request Body (JSON):**
  ```json
  {
    "publicationId": "7273340",
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "profileType": "standard",
    "accepted": true,
    "acceptedAt": "2026-11-12T10:15:30Z",
    "download_request": {
      "questions": [
        {
          "id": "download_purpose",
          "type": "multiple_choice",
          "allow_multiple": true,
          "options": [
            {
              "id": "secondary_longitudinal_analysis",
              "label": "Secondary and Longitudinal Analysis"
            },
            {
              "id": "replication_methodological_verification",
              "label": "Replication and Methodological Verification"
            },
            {
              "id": "policy_modeling_program_design",
              "label": "Policy Modeling and Program Design"
            },
            {
              "id": "instrument_survey_schema_design",
              "label": "Instrument and Survey Schema Design"
            },
            {
              "id": "data_enrichment_benchmarking_joins",
              "label": "Data Enrichment, Benchmarking, and Joins"
            },
            {
              "id": "model_training_testing_evaluation",
              "label": "Model Training, Testing, and Evaluation"
            },
            {
              "id": "systematic_reviews_meta_analyses",
              "label": "Systematic Reviews and Meta-Analyses"
            },
            {
              "id": "teaching_training_method_workshops",
              "label": "Teaching, Training, and Method Workshops"
            }
          ]
        },
        {
          "id": "downloader_profile_type",
          "type": "single_choice",
          "allow_multiple": false,
          "options": [
            {
              "id": "academic_researcher",
              "label": "Academic Researcher or Faculty"
            },
            {
              "id": "student_postgrad",
              "label": "Graduate or Undergraduate Student"
            },
            {
              "id": "ngo_nonprofit_practitioner",
              "label": "NGO or Non-Profit Practitioner"
            },
            {
              "id": "government_policy_analyst",
              "label": "Government or Public Policy Analyst"
            },
            {
              "id": "multilateral_donor_agency",
              "label": "Multilateral or Donor Agency Specialist"
            },
            {
              "id": "data_scientist_engineer",
              "label": "Data Scientist or Data Engineer"
            },
            {
              "id": "private_sector_consultant",
              "label": "Private Sector Consultant or Analyst"
            },
            {
              "id": "journalist_media",
              "label": "Journalist or Media Researcher"
            }
          ]
        }
      ]
    }
  }
  ```
- **Expected Response (`201 Created` - Instant Fulfillment):**
  ```json
  {
    "success": true,
    "status": "approved",
    "submissionId": "sub-xyz123abc",
    "downloadUrls": [
      {
        "fileId": "file-pk-001",
        "filename": "adolescent-health-baseline-2026.pdf",
        "signedUrl": "https://exyhjkjgyiakccrlmpds.supabase.co/storage/v1/object/sign/protected-downloads/...",
        "expiresIn": 900,
        "expiresAt": "2026-10-30T14:15:00.000Z",
        "mimeType": "application/pdf"
      }
    ],
    "expiresAt": "2026-10-30T14:15:00.000Z",
    "message": "Download request approved. Secure download links generated successfully for all publication files."
  }
  ```

---

### B. List Pending Download Requests (Admin Endpoint)
Retrieves guest submissions that are currently pending administrative review.

- **Method:** `GET`
- **URL:** `{{base_url}}/v1/downloads/requests`
- **Headers:**
  - `Authorization`: `Bearer {{auth_token}}`
- **Expected Response (`200 OK`):**
  ```json
  {
    "items": [
      {
        "id": "mock-sub-001",
        "publication_id": "pub-2026-001",
        "name": "John Doe",
        "email": "john.doe@example.com",
        "profile_type": "standard",
        "status": "pending",
        "created_at": "2026-10-30T13:00:00.000Z"
      }
    ]
  }
  ```

---

### C. Approve Pending Request (Admin Endpoint)
Approves a pending publication download request and generates fresh signed URLs for all files associated with that publication.

- **Method:** `POST`
- **URL:** `{{base_url}}/v1/downloads/requests/mock-sub-001/approve`
- **Headers:**
  - `Authorization`: `Bearer {{auth_token}}`
- **Expected Response (`200 OK`):**
  ```json
  {
    "success": true,
    "status": "approved",
    "submissionId": "mock-sub-001",
    "email": "john.doe@example.com",
    "downloadUrls": [
      {
        "fileId": "file-pk-001",
        "filename": "adolescent-health-baseline-2026.pdf",
        "signedUrl": "https://exyhjkjgyiakccrlmpds.supabase.co/storage/v1/object/sign/protected-downloads/...",
        "expiresIn": 900,
        "expiresAt": "2026-10-30T14:20:00.000Z",
        "mimeType": "application/pdf"
      }
    ],
    "expiresAt": "2026-10-30T14:20:00.000Z",
    "message": "Request approved and signed URLs generated for all publication files."
  }
  ```

---

### D. Reject Pending Request (Admin Endpoint)
Rejects a guest download submission.

- **Method:** `POST`
- **URL:** `{{base_url}}/v1/downloads/requests/mock-sub-001/reject`
- **Headers:**
  - `Authorization`: `Bearer {{auth_token}}`
- **Expected Response (`200 OK`):**
  ```json
  {
    "success": true,
    "status": "rejected",
    "submissionId": "mock-sub-001",
    "message": "Request rejected successfully (mock mode)."
  }
  ```

---

## 3. Importing into Postman (Postman Collection JSON)

You can save the following JSON block as `pck_downloads.postman_collection.json` and import it directly into Postman:

```json
{
  "info": {
    "name": "PC-Kenya Gated Downloads API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Submit Download Request (Public)",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"publicationId\": \"7273340\",\n  \"name\": \"Jane Doe\",\n  \"email\": \"jane.doe@example.com\",\n  \"profileType\": \"standard\",\n  \"accepted\": true,\n  \"acceptedAt\": \"2026-11-12T10:15:30Z\",\n  \"download_request\": {\n    \"questions\": [\n      {\n        \"id\": \"download_purpose\",\n        \"type\": \"multiple_choice\",\n        \"allow_multiple\": true,\n        \"options\": [\n          {\n            \"id\": \"secondary_longitudinal_analysis\",\n            \"label\": \"Secondary and Longitudinal Analysis\"\n          },\n          {\n            \"id\": \"replication_methodological_verification\",\n            \"label\": \"Replication and Methodological Verification\"\n          },\n          {\n            \"id\": \"policy_modeling_program_design\",\n            \"label\": \"Policy Modeling and Program Design\"\n          },\n          {\n            \"id\": \"instrument_survey_schema_design\",\n            \"label\": \"Instrument and Survey Schema Design\"\n          },\n          {\n            \"id\": \"data_enrichment_benchmarking_joins\",\n            \"label\": \"Data Enrichment, Benchmarking, and Joins\"\n          },\n          {\n            \"id\": \"model_training_testing_evaluation\",\n            \"label\": \"Model Training, Testing, and Evaluation\"\n          },\n          {\n            \"id\": \"systematic_reviews_meta_analyses\",\n            \"label\": \"Systematic Reviews and Meta-Analyses\"\n          },\n          {\n            \"id\": \"teaching_training_method_workshops\",\n            \"label\": \"Teaching, Training, and Method Workshops\"\n          }\n        ]\n      },\n      {\n        \"id\": \"downloader_profile_type\",\n        \"type\": \"single_choice\",\n        \"allow_multiple\": false,\n        \"options\": [\n          {\n            \"id\": \"academic_researcher\",\n            \"label\": \"Academic Researcher or Faculty\"\n          },\n          {\n            \"id\": \"student_postgrad\",\n            \"label\": \"Graduate or Undergraduate Student\"\n          },\n          {\n            \"id\": \"ngo_nonprofit_practitioner\",\n            \"label\": \"NGO or Non-Profit Practitioner\"\n          },\n          {\n            \"id\": \"government_policy_analyst\",\n            \"label\": \"Government or Public Policy Analyst\"\n          },\n          {\n            \"id\": \"multilateral_donor_agency\",\n            \"label\": \"Multilateral or Donor Agency Specialist\"\n          },\n          {\n            \"id\": \"data_scientist_engineer\",\n            \"label\": \"Data Scientist or Data Engineer\"\n          },\n          {\n            \"id\": \"private_sector_consultant\",\n            \"label\": \"Private Sector Consultant or Analyst\"\n          },\n          {\n            \"id\": \"journalist_media\",\n            \"label\": \"Journalist or Media Researcher\"\n          }\n        ]\n      }\n    ]\n  }\n}"
        },
        "url": {
          "raw": "{{base_url}}/v1/downloads/request",
          "host": ["{{base_url}}"],
          "path": ["v1", "downloads", "request"]
        }
      }
    },
    {
      "name": "List Pending Requests (Admin)",
      "request": {
        "method": "GET",
        "header": [
          { "key": "Authorization", "value": "Bearer {{auth_token}}" }
        ],
        "url": {
          "raw": "{{base_url}}/v1/downloads/requests",
          "host": ["{{base_url}}"],
          "path": ["v1", "downloads", "requests"]
        }
      }
    },
    {
      "name": "Approve Request (Admin)",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Authorization", "value": "Bearer {{auth_token}}" }
        ],
        "url": {
          "raw": "{{base_url}}/v1/downloads/requests/mock-sub-001/approve",
          "host": ["{{base_url}}"],
          "path": ["v1", "downloads", "requests", "mock-sub-001", "approve"]
        }
      }
    },
    {
      "name": "Reject Request (Admin)",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Authorization", "value": "Bearer {{auth_token}}" }
        ],
        "url": {
          "raw": "{{base_url}}/v1/downloads/requests/mock-sub-001/reject",
          "host": ["{{base_url}}"],
          "path": ["v1", "downloads", "requests", "mock-sub-001", "reject"]
        }
      }
    }
  ]
}
```
