import http from './httpClient';
import type {
  Culture,
  Location,
  Field,
  Bed,
  PlantingPlan,
  PaginatedResponse,
  Supplier,
  SeedDemand,
  YieldCalendarWeek,
  NoteAttachment,
  CultureHistoryEntry,
  CultureDuplicateCheckResponse,
  MediaFileRef,
  PublicCulture,
  PublicCultureChangeProposal,
  PublicCultureDiscussionComment,
  PublicCultureMatchResponse,
  PublicCultureRemovalReason,
  PublicCultureRevision,
  PublicCultureDuplicateCandidate,
  CropSpecies,
  PublishPublicCulturePreview,
  PublishPublicCultureResponse,
  RemainingAreaResponse,
  BedLayoutEntry,
  FieldLayoutEntry,
  LocationLayoutsResponse,
  CultureSupplierData,
  SupplierDeleteUsage,
  SupplierDeleteUndoPayload,
  SupplierRestoreUnlinkedDeleteResponse,
  SupplierUnlinkDeleteResponse,
} from './types';

export async function fetchAllPaginated<T>(
  initialPath: string,
): Promise<PaginatedResponse<T>> {
  const results: T[] = [];
  const initialSeparator = initialPath.includes('?') ? '&' : '?';
  let nextPath: string | null = `${initialPath}${initialSeparator}page_size=1000`;
  let count = 0;

  while (nextPath) {
    const response: { data: PaginatedResponse<T> } = await http.get<
      PaginatedResponse<T>
    >(nextPath);
    results.push(...response.data.results);
    count = response.data.count;
    // DRF returns an absolute URL for `next`, built from the backend's own host.
    // Following it directly would bypass the frontend's dev proxy (and drop
    // same-origin cookies), so only the query string is reused against the
    // original relative path.
    const next = response.data.next;
    nextPath = next ? `${initialPath}?${new URL(next, window.location.origin).searchParams.toString()}` : null;
  }

  return {
    count,
    next: null,
    previous: null,
    results,
  };
}

const getActiveProjectId = (): number | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const rawValue = window.localStorage.getItem('activeProjectId');
  if (!rawValue) {
    return null;
  }
  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
};

const withActiveProject = <T extends object>(data: T): T | (T & { project: number }) => {
  const payload = data as T & { project?: unknown };
  if (typeof payload.project === 'number' && payload.project > 0) {
    return data;
  }
  const activeProjectId = getActiveProjectId();
  if (!activeProjectId) {
    return data;
  }
  return { ...data, project: activeProjectId };
};

export const cultureAPI = {
  list: (url = '/cultures/') => http.get<PaginatedResponse<Culture>>(url),
  listAll: () => fetchAllPaginated<Culture>('/cultures/'),
  get: (id: number) => http.get<Culture>(`/cultures/${id}/`),
  duplicateCheck: (params: { name: string; variety: string; exclude_id?: number }, signal?: AbortSignal) =>
    http.get<CultureDuplicateCheckResponse>('/cultures/duplicate-check/', { params, signal }),
  create: (data: Culture) => http.post<Culture>('/cultures/', withActiveProject(data)),
  update: (id: number, data: Culture) => http.put<Culture>(`/cultures/${id}/`, withActiveProject(data)),
  delete: (id: number) => http.delete(`/cultures/${id}/`),
  history: (id: number) => http.get<CultureHistoryEntry[]>(`/cultures/${id}/history/`),
  restore: (id: number, history_id: number) => http.post<Culture>(`/cultures/${id}/restore/`, { history_id }),
  undelete: (id: number) => http.post<Culture>(`/cultures/${id}/undelete/`, {}),
  globalHistory: () => http.get<CultureHistoryEntry[]>('/history/global/'),
  globalRestore: (history_id: number) => http.post<Culture>('/history/global/restore/', { history_id }),
  projectHistory: () => http.get<CultureHistoryEntry[]>('/history/project/'),
  projectRestore: (history_id: number) => http.post<{ detail: string }>('/history/project/restore/', { history_id }),
  // Legacy import flow split into preview/apply endpoints.
  importPreview: (data: Record<string, unknown>[]) => http.post<{
    results: Array<{
      index: number;
      status: 'create' | 'update_candidate';
      matched_culture_id?: number;
      diff?: Array<{ field: string; current: unknown; new: unknown }>;
      import_data: Record<string, unknown>;
      error?: string;
    }>;
  }>('/cultures/import/preview/', data),
  importApply: (data: {
    items: Record<string, unknown>[];
    confirm_updates: boolean;
  }) => http.post<{
    created_count: number;
    updated_count: number;
    skipped_count: number;
    errors: Array<{ index: number; error: unknown }>;
  }>('/cultures/import/apply/', data),
  publishPreview: (id: number, params: { crop_species_id?: number | null; original_language_code?: string }) =>
    http.get<PublishPublicCulturePreview>(`/cultures/${id}/publish-public/preview/`, { params }),
  publishPublic: (id: number, data: { accepted_public_library_terms: boolean; crop_species_id?: number | null; original_language_code?: string }) =>
    http.post<PublishPublicCultureResponse>(`/cultures/${id}/publish-public/`, data),
};

export const cropSpeciesAPI = {
  list: (params?: { q?: string; include_proposed?: boolean }) =>
    http.get<PaginatedResponse<CropSpecies>>('/crop-species/', { params }),
  propose: (name: string) => http.post<CropSpecies>('/crop-species/', { name }),
};


export const publicCultureAPI = {
  list: (params?: { q?: string; name?: string; variety?: string }) => http.get<PaginatedResponse<PublicCulture>>('/public-cultures/', { params }),
  get: (id: number) => http.get<PublicCulture>(`/public-cultures/${id}/`),
  update: (id: number, data: Partial<PublicCulture> & { base_version?: number }) =>
    http.patch<PublicCulture>(`/public-cultures/${id}/`, data),
  match: (params: { name: string; variety: string }, signal?: AbortSignal) =>
    http.get<PublicCultureMatchResponse>('/public-cultures/match/', { params, signal }),
  importToProject: (id: number) => http.post<Culture>(`/public-cultures/${id}/import/`, {}),
  withdraw: (id: number) => http.post<PublicCulture>(`/public-cultures/${id}/withdraw/`, {}),
  remove: (id: number, reason: PublicCultureRemovalReason) =>
    http.post<PublicCulture>(`/public-cultures/${id}/remove/`, { reason }),
  hardDelete: (id: number) => http.post<void>(`/public-cultures/${id}/hard-delete/`, {}),
  comments: (id: number) => http.get<PublicCultureDiscussionComment[]>(`/public-cultures/${id}/comments/`),
  createComment: (id: number, body: string) =>
    http.post<PublicCultureDiscussionComment>(`/public-cultures/${id}/comments/`, { body }),
  versions: (id: number) => http.get<PublicCultureRevision[]>(`/public-cultures/${id}/versions/`),
  revert: (id: number, data: { version: number; base_version?: number }) =>
    http.post<PublicCulture>(`/public-cultures/${id}/revert/`, data),
  changeProposals: (id: number) => http.get<PublicCultureChangeProposal[]>(`/public-cultures/${id}/change-proposals/`),
  createChangeProposal: (id: number, data: { summary: string; proposed_data: Partial<PublicCulture> }) =>
    http.post<PublicCultureChangeProposal>(`/public-cultures/${id}/change-proposals/`, data),
  approveChangeProposal: (id: number, proposalId: number, reviewNote = '') =>
    http.post<PublicCultureChangeProposal>(`/public-cultures/${id}/change-proposals/${proposalId}/approve/`, { review_note: reviewNote }),
  rejectChangeProposal: (id: number, proposalId: number, reviewNote = '') =>
    http.post<PublicCultureChangeProposal>(`/public-cultures/${id}/change-proposals/${proposalId}/reject/`, { review_note: reviewNote }),
};

export const supplierAPI = {
  list: (query?: string) => {
    const params = query ? { q: query } : {};
    return http.get<PaginatedResponse<Supplier>>('/suppliers/', { params });
  },
  get: (id: number) => http.get<Supplier>(`/suppliers/${id}/`),
  create: (name: string, homepage_url: string, allowed_domains: string[] = []) => http.post<Supplier>('/suppliers/', { name, homepage_url, allowed_domains }),
  update: (id: number, data: Partial<Supplier>) => http.put<Supplier>(`/suppliers/${id}/`, data),
  deleteUsage: (id: number) => http.get<SupplierDeleteUsage>(`/suppliers/${id}/delete-usage/`),
  unlinkAndDelete: (id: number) => http.post<SupplierUnlinkDeleteResponse>(`/suppliers/${id}/unlink-and-delete/`, {}),
  restoreUnlinkedDelete: (undoPayload: SupplierDeleteUndoPayload) =>
    http.post<SupplierRestoreUnlinkedDeleteResponse>('/suppliers/restore-unlinked-delete/', undoPayload),
  delete: (id: number) => http.delete(`/suppliers/${id}/`),
};

export const cultureSupplierDataAPI = {
  list: () => http.get<PaginatedResponse<CultureSupplierData>>('/culture-supplier-data/'),
  create: (data: CultureSupplierData) => http.post<CultureSupplierData>('/culture-supplier-data/', withActiveProject(data)),
  update: (id: number, data: CultureSupplierData) => http.put<CultureSupplierData>(`/culture-supplier-data/${id}/`, withActiveProject(data)),
  delete: (id: number) => http.delete(`/culture-supplier-data/${id}/`),
};

export const bedAPI = {
  list: () => http.get<PaginatedResponse<Bed>>('/beds/'),
  listAll: () => fetchAllPaginated<Bed>('/beds/'),
  get: (id: number) => http.get<Bed>(`/beds/${id}/`),
  create: (data: Bed) => http.post<Bed>('/beds/', withActiveProject(data)),
  update: (id: number, data: Bed) => http.put<Bed>(`/beds/${id}/`, withActiveProject(data)),
  delete: (id: number) => http.delete(`/beds/${id}/`),
};

export const plantingPlanAPI = {
  list: () => http.get<PaginatedResponse<PlantingPlan>>('/planting-plans/'),
  listAll: () => fetchAllPaginated<PlantingPlan>('/planting-plans/'),
  get: (id: number) => http.get<PlantingPlan>(`/planting-plans/${id}/`),
  create: (data: PlantingPlan) => http.post<PlantingPlan>('/planting-plans/', withActiveProject(data)),
  update: (id: number, data: PlantingPlan) => http.put<PlantingPlan>(`/planting-plans/${id}/`, withActiveProject(data)),
  patch: (id: number, data: Partial<PlantingPlan>) => http.patch<PlantingPlan>(`/planting-plans/${id}/`, withActiveProject(data)),
  delete: (id: number) => http.delete(`/planting-plans/${id}/`),
  remainingArea: (params: { bed_id: number; start_date: string; end_date: string; exclude_plan_id?: number }) =>
    http.get<RemainingAreaResponse>('/planting-plans/remaining-area/', { params }),
};



export const layoutAPI = {
  listByLocation: (locationId: number) => http.get<LocationLayoutsResponse>(`/locations/${locationId}/layouts/`),
  saveByLocation: (locationId: number, payload: { bed_layouts: BedLayoutEntry[]; field_layouts: FieldLayoutEntry[] }) =>
    http.put<LocationLayoutsResponse>(`/locations/${locationId}/layouts/`, payload),
};


export const mediaFileAPI = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file, file.name || 'culture-media');
    return http.post<MediaFileRef>('/media-files/upload/', formData);
  },
};

export const noteAttachmentAPI = {
  list: (noteId: number) => http.get<NoteAttachment[]>(`/notes/${noteId}/attachments/`),
  upload: (noteId: number, file: File, caption = '', onUploadProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('image', file, file.name || 'note-attachment');
    formData.append('caption', caption);
    return http.post<NoteAttachment>(`/notes/${noteId}/attachments/`, formData, {
      onUploadProgress: (event) => {
        if (!onUploadProgress || !event.total) return;
        onUploadProgress(Math.round((event.loaded / event.total) * 100));
      },
    });
  },
  delete: (attachmentId: number) => http.delete(`/attachments/${attachmentId}/`),
};

export const seedDemandAPI = {
  list: (supplierSelection?: string) => http.get<PaginatedResponse<SeedDemand>>('/seed-demand/', {
    params: supplierSelection ? { supplier_selection: supplierSelection } : {},
  }),
  saveSupplierSelection: (cultureId: number, supplierId: number | null) =>
    http.post<{ culture_id: number; selected_supplier_id: number | null }>('/seed-demand/', {
      culture_id: cultureId,
      supplier_id: supplierId,
    }),
};

export const yieldCalendarAPI = {
  list: (year: number) => http.get<YieldCalendarWeek[]>('/yield-calendar/', { params: { year } }),
};

export const fieldAPI = {
  list: () => http.get<PaginatedResponse<Field>>('/fields/'),
  listAll: () => fetchAllPaginated<Field>('/fields/'),
  get: (id: number) => http.get<Field>(`/fields/${id}/`),
  create: (data: Field) => http.post<Field>('/fields/', withActiveProject(data)),
  update: (id: number, data: Field) => http.put<Field>(`/fields/${id}/`, withActiveProject(data)),
  delete: (id: number) => http.delete(`/fields/${id}/`),
};

export const locationAPI = {
  list: () => http.get<PaginatedResponse<Location>>('/locations/'),
  listAll: () => fetchAllPaginated<Location>('/locations/'),
  get: (id: number) => http.get<Location>(`/locations/${id}/`),
  create: (data: Location) => http.post<Location>('/locations/', withActiveProject(data)),
  update: (id: number, data: Location) => http.put<Location>(`/locations/${id}/`, withActiveProject(data)),
  delete: (id: number) => http.delete(`/locations/${id}/`),
};

export interface ProjectPayload {
  id: number;
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectInvitationPayload {
  id: number;
  email: string;
  role: 'admin' | 'member';
  token: string;
  status: 'pending' | 'accepted' | 'revoked';
  resolved_status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface ProjectMemberPayload {
  id: number;
  user: number;
  user_email: string;
  user_display_name: string;
  project: number;
  role: 'admin' | 'member';
  created_at: string;
}

export interface InvitationPublicStatus {
  code: string;
  token?: string;
  project_name?: string;
  email_masked?: string;
  requires_auth: boolean;
  expires_at?: string;
}

export interface InvitationAcceptResponse {
  code: string;
  detail: string;
  project_id?: number;
  project?: {
    id: number;
    name: string;
    slug: string;
  };
}

export interface VersionResponse {
  version: string;
}

export const projectAPI = {
  create: (data: { name: string; description?: string }) =>
    http.post<ProjectPayload>('/projects/', data),
  createDemo: () =>
    http.post<ProjectPayload>('/projects/create-demo/', {}),
  update: (projectId: number, data: { name: string }) =>
    http.patch<ProjectPayload>(`/projects/${projectId}/`, data),
  delete: (projectId: number) =>
    http.delete(`/projects/${projectId}/`),
  listDeleted: () =>
    http.get<PaginatedResponse<ProjectPayload> | ProjectPayload[]>('/projects/', { params: { deleted: true } }),
  restore: (projectId: number) =>
    http.post<ProjectPayload>(`/projects/${projectId}/restore/`),
  permanentDelete: (projectId: number) =>
    http.delete(`/projects/${projectId}/permanent/`),
  invite: (projectId: number, data: { email: string; role: 'admin' | 'member' }) =>
    http.post(`/projects/${projectId}/invitations/`, data),
  listMembers: (projectId: number) =>
    http.get<ProjectMemberPayload[]>(`/projects/${projectId}/members/`),
  updateMember: (projectId: number, membershipId: number, role: 'admin' | 'member') =>
    http.patch<ProjectMemberPayload>(`/projects/${projectId}/members/`, { membership_id: membershipId, role }),
  removeMember: (projectId: number, membershipId: number) =>
    http.delete(`/projects/${projectId}/members/`, { data: { membership_id: membershipId } }),
  listInvitations: (projectId: number) =>
    http.get<ProjectInvitationPayload[]>(`/projects/${projectId}/invitations/`),
  revokeInvitation: (projectId: number, invitationId: number) =>
    http.post(`/projects/${projectId}/invitations/${invitationId}/revoke/`),
  getInvitationStatus: (token: string) =>
    http.get<InvitationPublicStatus>(`/project-invitations/${token}/`),
  getPendingInvitation: () =>
    http.get<InvitationPublicStatus>('/project-invitations/pending/'),
  clearPendingInvitation: () =>
    http.delete('/project-invitations/pending/'),
  acceptPendingInvitation: () =>
    http.post<InvitationAcceptResponse>('/project-invitations/pending/accept/'),
  acceptInvitationByToken: (token: string) =>
    http.post<InvitationAcceptResponse>(`/project-invitations/${token}/accept/`),
  acceptInvitation: (token: string) =>
    http.post<InvitationAcceptResponse>('/invitations/accept/', { token }),
};

export const versionAPI = {
  get: () => http.get<VersionResponse>('/version/'),
};

export type {
  Culture,
  Location,
  Field,
  Bed,
  PlantingPlan,
  PaginatedResponse,
  Supplier,
  SeedDemand,
  YieldCalendarWeek,
  NoteAttachment,
  CultureHistoryEntry,
  MediaFileRef,
  PublicCulture,
  PublicCultureChangeProposal,
  PublicCultureDiscussionComment,
  PublicCultureRemovalReason,
  PublicCultureRevision,
  PublicCultureDuplicateCandidate,
  CropSpecies,
  PublishPublicCulturePreview,
  RemainingAreaResponse,
  BedLayoutEntry,
  FieldLayoutEntry,
  LocationLayoutsResponse,
  CultureSupplierData,
};

export default {
  cultures: cultureAPI,
  cropSpecies: cropSpeciesAPI,
  publicCultures: publicCultureAPI,
  suppliers: supplierAPI,
  cultureSupplierData: cultureSupplierDataAPI,
  beds: bedAPI,
  plantingPlans: plantingPlanAPI,
  fields: fieldAPI,
  locations: locationAPI,
  seedDemand: seedDemandAPI,
  yieldCalendar: yieldCalendarAPI,
  noteAttachments: noteAttachmentAPI,
  mediaFiles: mediaFileAPI,
  layouts: layoutAPI,
  projects: projectAPI,
};
