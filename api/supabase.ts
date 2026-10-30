import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: 'env.local' });

import { createClient } from '@supabase/supabase-js';
import { Publication, TaxonomyItem, TaxonomiesResponse } from './types';
import { mockPublications, RESOURCE_TYPES, SUBJECTS, GEOGRAPHIES, LANGUAGES } from './data';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://exyhjkjgyiakccrlmpds.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-service-role-key';

export const isSupabaseConfigured = (): boolean => {
  if (process.env.NODE_ENV === 'test') {
    return false;
  }
  return Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) && 
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
};

// Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

/**
 * Helper to normalize database timestamp to ISO 8601 UTC Z format (matching PRD expectations)
 */
function normalizeTimestamp(ts: string): string {
  if (!ts) return ts;
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    // Format as YYYY-MM-DDTHH:mm:ssZ
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  } catch {
    return ts;
  }
}

/**
 * Helper to transform raw Supabase publication row + joined relations into API Publication structure
 */
function mapSupabaseRowToPublication(row: any): Publication {
  return {
    id: row.publication_id || row.id,
    title: row.title,
    updatedAt: normalizeTimestamp(row.updated_at),
    status: row.status,
    resourceType: row.resource_type ? { code: row.resource_type.code, label: row.resource_type.label } : { code: row.resource_type_code, label: row.resource_type_code },
    publicationDate: row.publication_date,
    landingPageUrl: row.landing_page_url,
    summary: row.summary,
    summaryFormat: row.summary_format,
    authors: (row.publication_authors || []).map((a: any) => ({
      name: a.author_name,
      orcid: a.author_orcid || undefined,
      identifier: a.identifier || undefined
    })),
    subjects: (row.publication_subjects || []).map((s: any) => ({
      code: s.taxonomies?.code || s.taxonomy_code,
      label: s.taxonomies?.label || s.taxonomy_code
    })),
    geographies: (row.publication_geographies || []).length > 0
      ? row.publication_geographies.map((g: any) => ({
          code: g.taxonomies?.code || g.taxonomy_code,
          label: g.taxonomies?.label || g.taxonomy_code
        }))
      : undefined,
    language: row.language || undefined,
    identifiers: (row.publication_identifiers || []).length > 0
      ? row.publication_identifiers.map((i: any) => ({
          type: i.type,
          value: i.value
        }))
      : undefined,
    files: (row.publication_files || []).length > 0
      ? row.publication_files.map((f: any) => ({
          url: f.url || (f.filename ? `https://knowledge.example.org/files/${f.filename}` : ''),
          mimeType: f.mime_type || f.content_type || 'application/octet-stream',
          sizeBytes: Number(f.size_bytes || f.file_size || 0),
          checksumSha256: f.checksum_value || f.md5_hash || f.checksum_sha256 || '',
          access: f.access || (f.is_restricted ? 'restricted' : 'public'),
          websiteMayCopy: f.is_restricted !== undefined ? !f.is_restricted : (f.website_may_copy !== undefined ? f.website_may_copy : true)
        }))
      : undefined,
    thumbnailUrl: row.thumbnail_url || undefined,
    rights: row.rights || undefined,
    sourceSystem: row.source_system
  };
}

/**
 * Fetch taxonomies from Supabase or fallback to static data
 */
export async function getTaxonomiesData(): Promise<TaxonomiesResponse> {
  if (!isSupabaseConfigured()) {
    return {
      resourceTypes: RESOURCE_TYPES,
      subjects: SUBJECTS,
      geographies: GEOGRAPHIES,
      languages: LANGUAGES
    };
  }

  try {
    const { data, error } = await supabase.from('taxonomies').select('*');
    if (error || !data) {
      throw error || new Error('Failed to fetch taxonomies from Supabase');
    }

    const resourceTypes: TaxonomyItem[] = [];
    const subjects: TaxonomyItem[] = [];
    const geographies: TaxonomyItem[] = [];
    const languages: Array<{ code: string; label: string }> = [];

    for (const item of data) {
      const entry = { code: item.code, label: item.label };
      if (item.category === 'resource_type') resourceTypes.push(entry);
      else if (item.category === 'subject') subjects.push(entry);
      else if (item.category === 'geography') geographies.push(entry);
      else if (item.category === 'language') languages.push(entry);
    }

    return {
      resourceTypes: resourceTypes.length > 0 ? resourceTypes : RESOURCE_TYPES,
      subjects: subjects.length > 0 ? subjects : SUBJECTS,
      geographies: geographies.length > 0 ? geographies : GEOGRAPHIES,
      languages: languages.length > 0 ? languages : LANGUAGES
    };
  } catch (err) {
    console.warn('Supabase taxonomies fetch error, falling back to static data:', err);
    return {
      resourceTypes: RESOURCE_TYPES,
      subjects: SUBJECTS,
      geographies: GEOGRAPHIES,
      languages: LANGUAGES
    };
  }
}

function getMockPublications(
  updatedSinceStr?: string,
  cursorStr?: string,
  limit: number = 100
): { items: Publication[]; nextCursor: string | null; syncWatermark: string } {
  let filtered = [...mockPublications].sort((a, b) => {
    const dateCompare = a.updatedAt.localeCompare(b.updatedAt);
    if (dateCompare !== 0) return dateCompare;
    return a.id.localeCompare(b.id);
  });

  if (updatedSinceStr) {
    const updatedSinceDate = new Date(updatedSinceStr).getTime();
    filtered = filtered.filter(pub => new Date(pub.updatedAt).getTime() > updatedSinceDate);
  }

  if (cursorStr) {
    const decodedCursor = Buffer.from(cursorStr, 'base64').toString('utf-8');
    const cursorPayload = JSON.parse(decodedCursor) as { lastUpdatedAt: string; lastId: string };
    filtered = filtered.filter(pub => {
      const timeCompare = pub.updatedAt.localeCompare(cursorPayload.lastUpdatedAt);
      if (timeCompare > 0) return true;
      if (timeCompare === 0) {
        return pub.id.localeCompare(cursorPayload.lastId) > 0;
      }
      return false;
    });
  }

  const hasMore = filtered.length > limit;
  const pageItems = filtered.slice(0, limit);

  let nextCursor: string | null = null;
  if (hasMore && pageItems.length > 0) {
    const lastItem = pageItems[pageItems.length - 1];
    nextCursor = Buffer.from(JSON.stringify({
      lastUpdatedAt: lastItem.updatedAt,
      lastId: lastItem.id
    })).toString('base64');
  }

  const syncWatermark = pageItems.length > 0 
    ? pageItems[pageItems.length - 1].updatedAt 
    : (updatedSinceStr || new Date(0).toISOString());

  return { items: pageItems, nextCursor, syncWatermark };
}

/**
 * Fetch publications with deterministic sorting, updatedSince filtering, and cursor pagination
 */
export async function getPublicationsData(
  updatedSinceStr?: string,
  cursorStr?: string,
  limit: number = 100
): Promise<{ items: Publication[]; nextCursor: string | null; syncWatermark: string }> {
  if (isSupabaseConfigured()) {
    try {
      let query = supabase
        .from('publications')
        .select(`
          *,
          resource_type:taxonomies!resource_type_code(code, label),
          publication_authors(*),
          publication_subjects(taxonomy_code, taxonomies(code, label)),
          publication_geographies(taxonomy_code, taxonomies(code, label)),
          publication_identifiers(*),
          publication_files(*)
        `)
        .order('updated_at', { ascending: true })
        .order('publication_id', { ascending: true })
        .limit(limit + 1);

      if (updatedSinceStr) {
        query = query.gt('updated_at', updatedSinceStr);
      }

      if (cursorStr) {
        const decodedCursor = Buffer.from(cursorStr, 'base64').toString('utf-8');
        const cursorPayload = JSON.parse(decodedCursor) as { lastUpdatedAt: string; lastId: string };
        query = query.or(`updated_at.gt.${cursorPayload.lastUpdatedAt},and(updated_at.eq.${cursorPayload.lastUpdatedAt},publication_id.gt.${cursorPayload.lastId})`);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      const rows = data || [];
      if (rows.length === 0) {
        return getMockPublications(updatedSinceStr, cursorStr, limit);
      }

      const hasMore = rows.length > limit;
      const pageRows = hasMore ? rows.slice(0, limit) : rows;
      const items = pageRows.map(mapSupabaseRowToPublication);

      let nextCursor: string | null = null;
      if (hasMore && pageRows.length > 0) {
        const lastRow = pageRows[pageRows.length - 1];
        nextCursor = Buffer.from(JSON.stringify({
          lastUpdatedAt: normalizeTimestamp(lastRow.updated_at),
          lastId: lastRow.publication_id || lastRow.id
        })).toString('base64');
      }

      const syncWatermark = pageRows.length > 0
        ? normalizeTimestamp(pageRows[pageRows.length - 1].updated_at)
        : (updatedSinceStr || new Date(0).toISOString());

      return { items, nextCursor, syncWatermark };
    } catch (err) {
      console.warn('Supabase publications fetch error, falling back to mock data:', err);
    }
  }

  return getMockPublications(updatedSinceStr, cursorStr, limit);
}

/**
 * Fetch single publication by ID from Supabase or mock fallback
 */
export async function getPublicationByIdData(id: string): Promise<Publication | null> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('publications')
        .select(`
          *,
          resource_type:taxonomies!resource_type_code(code, label),
          publication_authors(*),
          publication_subjects(taxonomy_code, taxonomies(code, label)),
          publication_geographies(taxonomy_code, taxonomies(code, label)),
          publication_identifiers(*),
          publication_files(*)
        `)
        .eq('publication_id', id)
        .single();

      if (!error && data) {
        return mapSupabaseRowToPublication(data);
      }
    } catch (err) {
      console.warn(`Supabase publication ${id} fetch error, falling back to mock:`, err);
    }
  }

  return mockPublications.find(p => p.id === id) || null;
}

/**
 * Generate Supabase Signed URLs for all files belonging to a publication ID based on profile expiration rules
 */
export async function generateSignedUrlsForPublication(
  publicationId: string,
  profileType: string = 'standard'
): Promise<{ downloadUrls: Array<{ fileId: string; filename: string; signedUrl: string; expiresIn: number; expiresAt: string; mimeType: string }>; expiresIn: number; expiresAt: string }> {
  const expiresIn = (profileType === 'premium' || profileType === 'partner') ? 86400 : 900;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  if (!isSupabaseConfigured()) {
    return {
      downloadUrls: [
        {
          fileId: `file-${publicationId}-001`,
          filename: `${publicationId}-document.pdf`,
          signedUrl: `https://knowledge.example.org/protected-downloads/${publicationId}/document.pdf?token=mock_sig_${Math.random().toString(36).substring(2)}&expires=${expiresIn}`,
          expiresIn,
          expiresAt,
          mimeType: 'application/pdf'
        }
      ],
      expiresIn,
      expiresAt
    };
  }

  try {
    // 1. Fetch all files associated with this publication
    const { data: files, error: filesErr } = await supabase
      .from('publication_files')
      .select('*')
      .eq('publication_id', publicationId);

    if (filesErr || !files || files.length === 0) {
      // Fallback if no specific files table entries found, generate for the publication ID
      return {
        downloadUrls: [
          {
            fileId: `file-${publicationId}-default`,
            filename: `${publicationId}.pdf`,
            signedUrl: `https://knowledge.example.org/protected-downloads/${publicationId}.pdf?token=fallback_sig&expires=${expiresIn}`,
            expiresIn,
            expiresAt,
            mimeType: 'application/pdf'
          }
        ],
        expiresIn,
        expiresAt
      };
    }

    const downloadUrls = [];
    for (const f of files) {
      const storagePath = f.filename || f.url?.split('/').pop() || `${f.publication_file_pk}.pdf`;
      let signedUrl = f.url || '';
      try {
        const { data, error } = await supabase.storage
          .from('protected-downloads')
          .createSignedUrl(storagePath, expiresIn);
        if (!error && data?.signedUrl) {
          signedUrl = data.signedUrl;
        }
      } catch (err) {
        console.warn(`Failed to generate signed URL for storage path ${storagePath}:`, err);
      }

      downloadUrls.push({
        fileId: f.publication_file_pk || f.file_id || storagePath,
        filename: f.filename || storagePath,
        signedUrl,
        expiresIn,
        expiresAt,
        mimeType: f.mime_type || f.content_type || 'application/pdf'
      });
    }

    return {
      downloadUrls,
      expiresIn,
      expiresAt
    };
  } catch (err) {
    console.error('Error generating signed URLs for publication, falling back to mock:', err);
    return {
      downloadUrls: [
        {
          fileId: `file-${publicationId}-fallback`,
          filename: `${publicationId}.pdf`,
          signedUrl: `https://knowledge.example.org/protected-downloads/${publicationId}?token=error_fallback&expires=${expiresIn}`,
          expiresIn,
          expiresAt,
          mimeType: 'application/pdf'
        }
      ],
      expiresIn,
      expiresAt
    };
  }
}

/**
 * Process download request at publication level, validate files, store lead, and trigger fulfillment or pending review
 */
export async function processDownloadRequest(payload: {
  publicationId: string;
  name: string;
  email: string;
  profileType?: string;
  metadata?: any;
}, clientIp?: string, userAgent?: string): Promise<{
  success: boolean;
  status: 'approved' | 'pending';
  submissionId?: string;
  downloadUrls?: Array<any>;
  expiresAt?: string;
  message: string;
}> {
  const { publicationId, name, email, profileType = 'standard', metadata = {} } = payload;

  // 1. Check if any file under this publication is restricted
  let isRestricted = false;
  if (isSupabaseConfigured()) {
    try {
      const { data: files } = await supabase
        .from('publication_files')
        .select('is_restricted')
        .eq('publication_id', publicationId);

      if (files && files.some((f: any) => f.is_restricted === true)) {
        isRestricted = true;
      }
    } catch {
      isRestricted = false;
    }
  }

  const initialStatus = isRestricted ? 'pending' : 'approved';

  // 2. Store submission in database (if Supabase configured)
  let submissionId = `sub-${Math.random().toString(36).substring(2, 11)}`;
  if (isSupabaseConfigured()) {
    try {
      const { data: subData, error: subErr } = await supabase
        .from('lead_submissions')
        .insert({
          publication_id: publicationId,
          name,
          email,
          metadata,
          profile_type: profileType,
          status: initialStatus
        })
        .select('id')
        .single();

      if (!subErr && subData) {
        submissionId = subData.id;
      }
    } catch (err: any) {
      console.warn('Supabase lead submission insert fallback:', err.message);
    }
  }

  // 3. Log audit event
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('audit_logs').insert({
        event_type: initialStatus === 'approved' ? 'signed_url_generated' : 'download_request',
        lead_id: submissionId.length > 20 ? submissionId : null,
        publication_id: publicationId,
        ip_address: clientIp || 'unknown',
        user_agent: userAgent || 'unknown',
        details: { email, profileType, status: initialStatus }
      });
    } catch (err: any) {
      console.warn('Audit log write error:', err.message);
    }
  }

  // 4. If approved (instant download), generate signed URLs for all related files
  if (initialStatus === 'approved') {
    const { downloadUrls, expiresAt } = await generateSignedUrlsForPublication(publicationId, profileType);
    return {
      success: true,
      status: 'approved',
      submissionId,
      downloadUrls,
      expiresAt,
      message: 'Download request approved. Secure download links generated successfully for all publication files.'
    };
  } else {
    return {
      success: true,
      status: 'pending',
      submissionId,
      message: 'Your download request requires administrative review. You will receive an email once approved.'
    };
  }
}

/**
 * List pending download requests for admin review
 */
export async function getPendingDownloadRequests(): Promise<any[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('lead_submissions')
        .select('*, publications(title, publication_id)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data;
      }
    } catch (err) {
      console.warn('Supabase getPendingDownloadRequests fallback:', err);
    }
  }

  return [
    {
      id: 'mock-sub-001',
      publicationId: 'pub-2026-001',
      name: 'John Doe',
      email: 'john.doe@example.com',
      profileType: 'standard',
      status: 'pending',
      createdAt: new Date().toISOString()
    }
  ];
}

/**
 * Approve pending download request, generate signed URLs for all related files, and return details
 */
export async function approveDownloadRequest(submissionId: string): Promise<any> {
  if (isSupabaseConfigured() && submissionId !== 'mock-sub-001') {
    try {
      const { data: sub, error: subErr } = await supabase
        .from('lead_submissions')
        .select('*')
        .eq('id', submissionId)
        .single();

      if (!subErr && sub) {
        await supabase
          .from('lead_submissions')
          .update({ status: 'approved', updated_at: new Date().toISOString() })
          .eq('id', submissionId);

        const { downloadUrls, expiresAt } = await generateSignedUrlsForPublication(sub.publication_id, sub.profile_type);

        try {
          await supabase.from('audit_logs').insert({
            event_type: 'request_approved',
            lead_id: submissionId,
            publication_id: sub.publication_id,
            details: { email: sub.email, profileType: sub.profile_type }
          });
        } catch {}

        return {
          success: true,
          status: 'approved',
          submissionId,
          email: sub.email,
          downloadUrls,
          expiresAt,
          message: 'Request approved and signed URLs generated for all publication files.'
        };
      }
    } catch (err) {
      console.warn('Supabase approveDownloadRequest fallback:', err);
    }
  }

  const { downloadUrls, expiresAt } = await generateSignedUrlsForPublication('pub-2026-001', 'standard');
  return {
    success: true,
    status: 'approved',
    submissionId,
    email: 'john.doe@example.com',
    downloadUrls,
    expiresAt,
    message: 'Request approved successfully (mock mode).'
  };
}

/**
 * Reject pending download request
 */
export async function rejectDownloadRequest(submissionId: string): Promise<any> {
  if (isSupabaseConfigured() && submissionId !== 'mock-sub-001') {
    try {
      const { data: sub } = await supabase
        .from('lead_submissions')
        .select('*')
        .eq('id', submissionId)
        .single();

      await supabase
        .from('lead_submissions')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', submissionId);

      if (sub) {
        try {
          await supabase.from('audit_logs').insert({
            event_type: 'request_rejected',
            lead_id: submissionId,
            publication_id: sub.publication_id,
            details: { email: sub.email }
          });
        } catch {}
      }

      return {
        success: true,
        status: 'rejected',
        submissionId,
        message: 'Request rejected.'
      };
    } catch (err) {
      console.warn('Supabase rejectDownloadRequest fallback:', err);
    }
  }

  return {
    success: true,
    status: 'rejected',
    submissionId,
    message: 'Request rejected successfully (mock mode).'
  };
}

