-- ============================================================================
-- PC-Kenya Knowledge Hub API Server - Supabase Schema & Seed Data Script
-- Project: pck-kenya (exyhjkjgyiakccrlmpds)
-- ============================================================================

-- 1. DROP EXISTING TABLES (if re-running)
DROP TABLE IF EXISTS public.publication_files CASCADE;
DROP TABLE IF EXISTS publication_identifiers CASCADE;
DROP TABLE IF EXISTS publication_geographies CASCADE;
DROP TABLE IF EXISTS publication_subjects CASCADE;
DROP TABLE IF EXISTS publication_authors CASCADE;
DROP TABLE IF EXISTS publications CASCADE;
DROP TABLE IF EXISTS taxonomies CASCADE;

-- ============================================================================
-- 2. CREATE TABLES
-- ============================================================================

-- Taxonomies Table
CREATE TABLE taxonomies (
    code VARCHAR(64) PRIMARY KEY,
    category VARCHAR(32) NOT NULL, -- 'resource_type', 'subject', 'geography', 'language'
    label TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Publications Table
CREATE TABLE publications (
    publication_id VARCHAR(255) PRIMARY KEY,
    title TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL, -- 'published', 'withdrawn', 'deleted'
    resource_type_code VARCHAR(64) REFERENCES taxonomies(code) ON UPDATE CASCADE,
    publication_date VARCHAR(32) NOT NULL,
    landing_page_url TEXT NOT NULL,
    summary TEXT NOT NULL,
    summary_format VARCHAR(16) NOT NULL, -- 'text', 'html'
    language VARCHAR(16),
    thumbnail_url TEXT,
    rights TEXT,
    source_system VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for deterministic pagination (updated_at ASC, publication_id ASC)
CREATE INDEX idx_publications_updated_at_id ON publications (updated_at ASC, publication_id ASC);

-- Publication Authors Table (1-to-many)
CREATE TABLE publication_authors (
    id SERIAL PRIMARY KEY,
    publication_id VARCHAR(255) REFERENCES publications(publication_id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    author_orcid VARCHAR(64),
    identifier VARCHAR(64)
);

-- Publication Subjects Table (many-to-many)
CREATE TABLE publication_subjects (
    publication_id VARCHAR(255) REFERENCES publications(publication_id) ON DELETE CASCADE,
    taxonomy_code VARCHAR(64) REFERENCES taxonomies(code) ON DELETE CASCADE,
    PRIMARY KEY (publication_id, taxonomy_code)
);

-- Publication Geographies Table (many-to-many)
CREATE TABLE publication_geographies (
    publication_id VARCHAR(255) REFERENCES publications(publication_id) ON DELETE CASCADE,
    taxonomy_code VARCHAR(64) REFERENCES taxonomies(code) ON DELETE CASCADE,
    PRIMARY KEY (publication_id, taxonomy_code)
);

-- Publication Identifiers Table (DOI, ISBN, etc.)
CREATE TABLE publication_identifiers (
    id SERIAL PRIMARY KEY,
    publication_id VARCHAR(255) REFERENCES publications(publication_id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL, -- 'DOI', 'ISBN', 'ReportNumber', 'Other'
    value TEXT NOT NULL
);

-- Publication Files Table
CREATE TABLE public.publication_files (
  publication_file_pk character varying(255) not null,
  publication_id character varying(255) null,
  file_label text null,
  is_restricted boolean null,
  dataset_version_id integer null,
  file_id integer null,
  filename text null,
  content_type character varying(255) null,
  file_size bigint null,
  friendly_type character varying(100) null,
  md5_hash character varying(255) null,
  checksum_type character varying(50) null,
  checksum_value character varying(255) null,
  synced_at timestamp with time zone null default CURRENT_TIMESTAMP,
  url character varying(255) null,
  mime_type character varying(255) null,
  size_bytes bigint null,
  constraint publication_files_pkey primary key (publication_file_pk),
  constraint publication_files_publication_id_fkey foreign KEY (publication_id) references publications (publication_id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_publication_files_pub_id on public.publication_files using btree (publication_id) TABLESPACE pg_default;

create index IF not exists idx_publication_files_filename on public.publication_files using btree (filename) TABLESPACE pg_default;

-- ============================================================================
-- 3. SEED TAXONOMIES
-- ============================================================================

INSERT INTO taxonomies (code, category, label) VALUES
-- Resource Types
('policy-brief', 'resource_type', 'Policy Brief'),
('research-report', 'resource_type', 'Research Report'),
('fact-sheet', 'resource_type', 'Fact Sheet'),
('journal-article', 'resource_type', 'Journal Article'),
('working-paper', 'resource_type', 'Working Paper'),
-- Subjects
('adolescent-health', 'subject', 'Adolescent Health'),
('gender-equality', 'subject', 'Gender Equality'),
('reproductive-health', 'subject', 'Reproductive Health'),
('hiv-prevention', 'subject', 'HIV & AIDS Prevention'),
('poverty-dynamics', 'subject', 'Poverty & Vulnerability'),
('education-outcomes', 'subject', 'Education Outcomes'),
-- Geographies
('KE', 'geography', 'Kenya'),
('KE-30', 'geography', 'Nairobi County'),
('KE-19', 'geography', 'Kisumu County'),
('TZ', 'geography', 'Tanzania'),
('UG', 'geography', 'Uganda'),
-- Languages
('en', 'language', 'English'),
('sw', 'language', 'Kiswahili'),
('fr', 'language', 'French');

-- ============================================================================
-- 4. SEED PUBLICATIONS (Matching api/data.ts)
-- ============================================================================

-- Publication 1
INSERT INTO publications (publication_id, title, updated_at, status, resource_type_code, publication_date, landing_page_url, summary, summary_format, language, thumbnail_url, rights, source_system)
VALUES (
    'pub-2026-001',
    'Adolescent Health and Wellbeing in Urban Kenya: A Baseline Study',
    '2026-09-01 10:00:00+00',
    'published',
    'research-report',
    '2026-08-20',
    'https://knowledge.example.org/publications/pub-2026-001',
    '<p>This comprehensive report highlights key challenges faced by adolescents in informal settlements of Nairobi, including access to healthcare and education.</p>',
    'html',
    'en',
    'https://knowledge.example.org/thumbnails/pub-2026-001-thumb.jpg',
    'Creative Commons Attribution 4.0 International (CC BY 4.0)',
    'pc-kenya-hub-v1'
);

INSERT INTO publication_authors (publication_id, author_name, author_orcid) VALUES
('pub-2026-001', 'Dr. Jane Atieno', '0000-0002-1825-0097');

INSERT INTO publication_subjects (publication_id, taxonomy_code) VALUES
('pub-2026-001', 'adolescent-health');

INSERT INTO publication_geographies (publication_id, taxonomy_code) VALUES
('pub-2026-001', 'KE'),
('pub-2026-001', 'KE-30');

INSERT INTO publication_identifiers (publication_id, type, value) VALUES
('pub-2026-001', 'DOI', '10.3189/pck.2026.001'),
('pub-2026-001', 'ReportNumber', 'PCK-RR-2026-12');

INSERT INTO publication_files (publication_file_pk, publication_id, url, mime_type, size_bytes, checksum_value, is_restricted) VALUES
('file-pk-001', 'pub-2026-001', 'https://knowledge.example.org/files/adolescent-health-baseline-2026.pdf', 'application/pdf', 2457600, 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', false);
