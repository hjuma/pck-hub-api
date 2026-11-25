-- ============================================================================
-- Migration: Add Download Request Questions & Terms Acceptance
-- Date: 2026-11-25
-- Description:
-- 1. Updates `public.lead_submissions` to capture:
--    - `accepted` (BOOLEAN): confirmation of download agreement/terms
--    - `accepted_at` (TIMESTAMPTZ): timestamp when terms were accepted
--    - `download_request` (JSONB): complete structured survey/question payload
-- 2. Creates a dedicated normalized table `public.lead_submission_questions`
--    for relational aggregation and analytics on question responses.
-- 3. Adds GIN and B-Tree indexes for efficient querying.
-- 4. Establishes Row Level Security (RLS) policies for the new table.
-- 5. Creates an analytics reporting view `public.v_lead_submission_responses`.
-- ============================================================================

-- 1. Alter public.lead_submissions to add new columns
ALTER TABLE public.lead_submissions
    ADD COLUMN IF NOT EXISTS accepted BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS download_request JSONB DEFAULT '{}'::jsonb;

-- Indexes on lead_submissions for fast lookup
CREATE INDEX IF NOT EXISTS idx_lead_submissions_accepted 
    ON public.lead_submissions USING btree (accepted);

CREATE INDEX IF NOT EXISTS idx_lead_submissions_download_request 
    ON public.lead_submissions USING gin (download_request);

-- 2. Dedicated normalized table for questions & answers
CREATE TABLE IF NOT EXISTS public.lead_submission_questions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL,
    question_id VARCHAR(128) NOT NULL,
    question_type VARCHAR(64) NOT NULL,
    allow_multiple BOOLEAN NOT NULL DEFAULT false,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT lead_submission_questions_pkey PRIMARY KEY (id),
    CONSTRAINT lead_submission_questions_submission_id_fkey 
        FOREIGN KEY (submission_id) REFERENCES public.lead_submissions (id) ON DELETE CASCADE
);

-- Indexes for lead_submission_questions
CREATE INDEX IF NOT EXISTS idx_lsq_submission_id 
    ON public.lead_submission_questions USING btree (submission_id);

CREATE INDEX IF NOT EXISTS idx_lsq_question_id 
    ON public.lead_submission_questions USING btree (question_id);

CREATE INDEX IF NOT EXISTS idx_lsq_options 
    ON public.lead_submission_questions USING gin (options);

-- 3. Row Level Security (RLS) setup
ALTER TABLE public.lead_submission_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access on lead_submission_questions" ON public.lead_submission_questions;
CREATE POLICY "Allow service role full access on lead_submission_questions" ON public.lead_submission_questions
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 4. Convenient Reporting View for Analytics / Dashboards
CREATE OR REPLACE VIEW public.v_lead_submission_responses AS
SELECT 
    ls.id AS submission_id,
    ls.publication_id,
    ls.name,
    ls.email,
    ls.profile_type,
    ls.status,
    ls.accepted,
    ls.accepted_at,
    lsq.id AS question_entry_id,
    lsq.question_id,
    lsq.question_type,
    lsq.allow_multiple,
    opt->>'id' AS option_id,
    opt->>'label' AS option_label,
    ls.created_at
FROM public.lead_submissions ls
LEFT JOIN public.lead_submission_questions lsq ON ls.id = lsq.submission_id
LEFT JOIN LATERAL jsonb_array_elements(lsq.options) AS opt ON true;
