import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: 'env.local' });

import { createClient } from '@supabase/supabase-js';
import { Publication, TaxonomyItem, TaxonomiesResponse } from './types';
import { mockPublications, RESOURCE_TYPES, SUBJECTS, GEOGRAPHIES, LANGUAGES } from './data';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://exyhjkjgyiakccrlmpds.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-service-role-key';

export const isSupabaseConfigured = (): boolean => {
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
    id: row.id,
    title: row.title,
    updatedAt: normalizeTimestamp(row.updated_at),
    status: row.status,
    resourceType: row.resource_type ? { code: row.resource_type.code, label: row.resource_type.label } : { code: row.resource_type_code, label: row.resource_type_code },
    publicationDate: row.publication_date,
    landingPageUrl: row.landing_page_url,
    summary: row.summary,
    summaryFormat: row.summary_format,
    authors: (row.publication_authors || []).map((a: any) => ({
      name: a.name,
      orcid: a.orcid || undefined,
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
          url: f.url,
          mimeType: f.mime_type,
          sizeBytes: Number(f.size_bytes),
          checksumSha256: f.checksum_sha256,
          access: f.access,
          websiteMayCopy: f.website_may_copy
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

/**
 * Fetch publications with deterministic sorting, updatedSince filtering, and cursor pagination
 */
export async function getPublicationsData(
  updatedSinceStr?: string,
  cursorStr?: string,
  limit: number = 100
): Promise<{ items: Publication[]; nextCursor: string | null; syncWatermark: string }> {
  // If Supabase is not configured, fallback to mockPublications logic
  if (!isSupabaseConfigured()) {
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

  // Live Supabase query
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
      .order('id', { ascending: true })
      .limit(limit + 1); // fetch limit + 1 to detect if there is a next page

    if (updatedSinceStr) {
      query = query.gt('updated_at', updatedSinceStr);
    }

    if (cursorStr) {
      const decodedCursor = Buffer.from(cursorStr, 'base64').toString('utf-8');
      const cursorPayload = JSON.parse(decodedCursor) as { lastUpdatedAt: string; lastId: string };
      query = query.or(`updated_at.gt.${cursorPayload.lastUpdatedAt},and(updated_at.eq.${cursorPayload.lastUpdatedAt},id.gt.${cursorPayload.lastId})`);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const rows = data || [];
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const items = pageRows.map(mapSupabaseRowToPublication);

    let nextCursor: string | null = null;
    if (hasMore && pageRows.length > 0) {
      const lastRow = pageRows[pageRows.length - 1];
      nextCursor = Buffer.from(JSON.stringify({
        lastUpdatedAt: normalizeTimestamp(lastRow.updated_at),
        lastId: lastRow.id
      })).toString('base64');
    }

    const syncWatermark = pageRows.length > 0
      ? normalizeTimestamp(pageRows[pageRows.length - 1].updated_at)
      : (updatedSinceStr || new Date(0).toISOString());

    return { items, nextCursor, syncWatermark };
  } catch (err) {
    console.error('Error fetching publications from Supabase:', err);
    throw err;
  }
}

/**
 * Fetch single publication by ID from Supabase or mock fallback
 */
export async function getPublicationByIdData(id: string): Promise<Publication | null> {
  if (!isSupabaseConfigured()) {
    return mockPublications.find(p => p.id === id) || null;
  }

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
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return mapSupabaseRowToPublication(data);
  } catch (err) {
    console.error(`Error fetching publication ${id} from Supabase:`, err);
    return null;
  }
}
