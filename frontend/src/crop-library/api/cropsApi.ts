/**
 * Crop Library API client — talks to the new, additive `/api/crop-library` surface
 * (see docs/crop-library-architecture.md) rather than the legacy
 * `/api/public-crops` one `api/api.ts`'s `publicCropAPI` still uses.
 *
 * Not wired into any page yet. `Crops.tsx`/`PublicCropLibraryDialog`
 * keep using `publicCropAPI` unchanged — switching them over is a
 * separate, deliberately deferred step (see the architecture doc) once
 * `/api/crop-library` has been exercised in production for a while.
 *
 * Known limitation: this reuses the shared `httpClient`, which attaches an
 * `X-Project-Id` header to every request whenever a project happens to be
 * active in local storage. The crop library ignores that header today, but
 * a genuinely standalone crop-library client should eventually get its own
 * instance instead of inheriting app-wide, project-scoped plumbing.
 */
import http from '../../api/httpClient';
import type { PaginatedResponse, PublicCrop, PublicCropMatchResponse } from '../../api/types';

/** Alias so new crop-library code can talk about "Crop" rather than the
 * backend/historical "Crop" naming — see docs/crop-library-architecture.md
 * section 7. The shape is identical to `PublicCrop`; this is a type
 * alias, not a copy, so it can never drift. */
export type Crop = PublicCrop;
export type CropMatchResponse = PublicCropMatchResponse;

export const cropsApi = {
  list: (params?: { q?: string; name?: string; variety?: string }) =>
    http.get<PaginatedResponse<Crop>>('/crop-library/', { params }),
  get: (id: number) => http.get<Crop>(`/crop-library/${id}/`),
  match: (params: { name: string; variety: string }, signal?: AbortSignal) =>
    http.get<CropMatchResponse>('/crop-library/match/', { params, signal }),
};
