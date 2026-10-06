-- ============================================================================
-- PC-Kenya Knowledge Hub API Server - Supabase Schema & Seed Data Script
-- Project: pck-kenya (exyhjkjgyiakccrlmpds)
-- ============================================================================

-- 1. DROP EXISTING TABLES (if re-running)
DROP TABLE IF EXISTS publication_files CASCADE;
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
    id VARCHAR(64) PRIMARY KEY,
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

-- Index for deterministic pagination (updated_at ASC, id ASC)
CREATE INDEX idx_publications_updated_at_id ON publications (updated_at ASC, id ASC);

-- Publication Authors Table (1-to-many)
CREATE TABLE publication_authors (
    id SERIAL PRIMARY KEY,
    publication_id VARCHAR(64) REFERENCES publications(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    orcid VARCHAR(64),
    identifier VARCHAR(64)
);

-- Publication Subjects Table (many-to-many)
CREATE TABLE publication_subjects (
    publication_id VARCHAR(64) REFERENCES publications(id) ON DELETE CASCADE,
    taxonomy_code VARCHAR(64) REFERENCES taxonomies(code) ON DELETE CASCADE,
    PRIMARY KEY (publication_id, taxonomy_code)
);

-- Publication Geographies Table (many-to-many)
CREATE TABLE publication_geographies (
    publication_id VARCHAR(64) REFERENCES publications(id) ON DELETE CASCADE,
    taxonomy_code VARCHAR(64) REFERENCES taxonomies(code) ON DELETE CASCADE,
    PRIMARY KEY (publication_id, taxonomy_code)
);

-- Publication Identifiers Table (DOI, ISBN, etc.)
CREATE TABLE publication_identifiers (
    id SERIAL PRIMARY KEY,
    publication_id VARCHAR(64) REFERENCES publications(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL, -- 'DOI', 'ISBN', 'ReportNumber', 'Other'
    value TEXT NOT NULL
);

-- Publication Files Table
CREATE TABLE publication_files (
    id SERIAL PRIMARY KEY,
    publication_id VARCHAR(64) REFERENCES publications(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    size_bytes BIGINT NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,
    access VARCHAR(32) NOT NULL, -- 'public', 'restricted'
    website_may_copy BOOLEAN NOT NULL DEFAULT TRUE
);

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
INSERT INTO publications (id, title, updated_at, status, resource_type_code, publication_date, landing_page_url, summary, summary_format, language, thumbnail_url, rights, source_system)
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

INSERT INTO publication_authors (publication_id, name, orcid) VALUES
('pub-2026-001', 'Dr. Jane Atieno', '0000-0002-1825-0097');

INSERT INTO publication_subjects (publication_id, taxonomy_code) VALUES
('pub-2026-001', 'adolescent-health');

INSERT INTO publication_geographies (publication_id, taxonomy_code) VALUES
('pub-2026-001', 'KE'),
('pub-2026-001', 'KE-30');

INSERT INTO publication_identifiers (publication_id, type, value) VALUES
('pub-2026-001', 'DOI', '10.3189/pck.2026.001'),
('pub-2026-001', 'ReportNumber', 'PCK-RR-2026-12');

INSERT INTO publication_files (publication_id, url, mime_type, size_bytes, checksum_sha256, access, website_may_copy) VALUES
('pub-2026-001', 'https://knowledge.example.org/files/adolescent-health-baseline-2026.pdf', 'application/pdf', 2457600, 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'public', true);


-- Publication 2
INSERT INTO publications (id, title, updated_at, status, resource_type_code, publication_date, landing_page_url, summary, summary_format, source_system)
VALUES (
    'pub-2026-002',
    'PC-Kenya Annual Strategic Vision Statement',
    '2026-09-02 11:30:00+00',
    'published',
    'fact-sheet',
    '2026',
    'https://knowledge.example.org/publications/pub-2026-002',
    'An overview of PC-Kenya strategic priorities targeting key demographic developments over the coming decade.',
    'text',
    'pc-kenya-hub-v1'
);

INSERT INTO publication_authors (publication_id, name) VALUES
('pub-2026-002', 'Population Council Kenya Secretariat');

INSERT INTO publication_subjects (publication_id, taxonomy_code) VALUES
('pub-2026-002', 'poverty-dynamics');


-- Publication 3
INSERT INTO publications (id, title, updated_at, status, resource_type_code, publication_date, landing_page_url, summary, summary_format, language, rights, source_system)
VALUES (
    'pub-2026-003',
    'Reproductive Healthcare Access Among Young Women in Kisumu',
    '2026-09-03 08:15:00+00',
    'published',
    'journal-article',
    '2026-07-15',
    'https://knowledge.example.org/publications/pub-2026-003',
    'An empirical assessment of barriers and facilitators in accessing reproductive health services across Kisumu County.',
    'text',
    'en',
    'All rights reserved',
    'pc-kenya-hub-v1'
);

INSERT INTO publication_authors (publication_id, name, orcid) VALUES
('pub-2026-003', 'Prof. Samuel Ochieng', '0000-0001-9982-1102'),
('pub-2026-003', 'Amina Mohammed', '0000-0003-4412-8891');

INSERT INTO publication_subjects (publication_id, taxonomy_code) VALUES
('pub-2026-003', 'reproductive-health');

INSERT INTO publication_geographies (publication_id, taxonomy_code) VALUES
('pub-2026-003', 'KE'),
('pub-2026-003', 'KE-19');

INSERT INTO publication_identifiers (publication_id, type, value) VALUES
('pub-2026-003', 'DOI', '10.1016/j.pck.2026.03.003'),
('pub-2026-003', 'ISBN', '978-9966-09-123-4');

INSERT INTO publication_files (publication_id, url, mime_type, size_bytes, checksum_sha256, access, website_may_copy) VALUES
('pub-2026-003', 'https://knowledge.example.org/files/kisumu-RH-access-2026.pdf', 'application/pdf', 1230000, 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3', 'restricted', false);


-- Publication 4 (Withdrawn / Tombstone Record)
INSERT INTO publications (id, title, updated_at, status, resource_type_code, publication_date, landing_page_url, summary, summary_format, source_system)
VALUES (
    'pub-2026-004',
    '[WITHDRAWN] Preliminary Review on HIV Interventions (Superseded)',
    '2026-09-04 14:00:00+00',
    'withdrawn',
    'working-paper',
    '2026-01-10',
    'https://knowledge.example.org/publications/pub-2026-004',
    'This publication has been withdrawn and superseded by updated clinical guidelines issued in September 2026.',
    'text',
    'pc-kenya-hub-v1'
);

INSERT INTO publication_authors (publication_id, name) VALUES
('pub-2026-004', 'Dr. Beatrice Wanjiku');

INSERT INTO publication_subjects (publication_id, taxonomy_code) VALUES
('pub-2026-004', 'hiv-prevention');


-- Publication 5
INSERT INTO publications (id, title, updated_at, status, resource_type_code, publication_date, landing_page_url, summary, summary_format, language, thumbnail_url, rights, source_system)
VALUES (
    'pub-2026-005',
    'Gender Equality and Economic Empowerment in East Africa',
    '2026-09-05 09:00:00+00',
    'published',
    'research-report',
    '2026-09-01',
    'https://knowledge.example.org/publications/pub-2026-005',
    'A comparative regional analysis examining women-led micro-enterprises and policy frameworks in Kenya, Tanzania, and Uganda.',
    'text',
    'en',
    'https://knowledge.example.org/thumbnails/pub-2026-005-thumb.jpg',
    'Creative Commons Attribution 4.0 International (CC BY 4.0)',
    'pc-kenya-hub-v1'
);

INSERT INTO publication_authors (publication_id, name) VALUES
('pub-2026-005', 'Dr. David Kimani'),
('pub-2026-005', 'Grace A Notice');

INSERT INTO publication_subjects (publication_id, taxonomy_code) VALUES
('pub-2026-005', 'gender-equality'),
('pub-2026-005', 'poverty-dynamics');

INSERT INTO publication_geographies (publication_id, taxonomy_code) VALUES
('pub-2026-005', 'KE'),
('pub-2026-005', 'TZ'),
('pub-2026-005', 'UG');

INSERT INTO publication_identifiers (publication_id, type, value) VALUES
('pub-2026-005', 'DOI', '10.3189/pck.2026.005');

INSERT INTO publication_files (publication_id, url, mime_type, size_bytes, checksum_sha256, access, website_may_copy) VALUES
('pub-2026-005', 'https://knowledge.example.org/files/gender-equality-east-africa-2026.pdf', 'application/pdf', 4120000, 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', 'public', true);

-- ============================================================================
-- End of Migration & Seed Script
-- ============================================================================
