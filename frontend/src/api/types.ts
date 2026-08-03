export interface SeedPackage {
  id?: number;
  culture?: number;
  size_value: number;
  size_unit: 'g' | 'seeds';
  evidence_text?: string;
  last_seen_at?: string | null;
}

export interface Supplier {
  id?: number;
  name: string;
  homepage_url?: string;
  slug?: string;
  allowed_domains: string[];
  created_at?: string;
  updated_at?: string;
  created?: boolean;
}

export interface SupplierDeleteUsage {
  can_delete: boolean;
  culture_count: number;
  seed_demand_culture_count: number;
  supplier_data_culture_count: number;
  supplier_data_count: number;
  total_culture_count: number;
  culture_ids: number[];
}

export interface SupplierDeleteUndoPayload {
  supplier: {
    id: number;
    name: string;
    homepage_url: string;
    slug: string;
    allowed_domains: string[];
  };
  culture_ids: number[];
  seed_demand_culture_ids: number[];
  supplier_data: Array<{
    id: number;
    culture_id: number;
    supplier_name: string;
    supplier_url: string;
    supplier_product_name: string;
    supplier_product_url: string;
    packaging_sizes: SeedPackage[];
    thousand_kernel_weight_g: string | null;
    germination_rate: number | null;
    price: string | null;
    notes: string;
    source_url: string;
  }>;
}

export interface SupplierUnlinkDeleteResponse {
  affected_culture_count: number;
  undo_payload: SupplierDeleteUndoPayload;
}

export interface SupplierDeleteResponse {
  undo_payload: SupplierDeleteUndoPayload;
}

export interface SupplierRestoreUnlinkedDeleteResponse {
  supplier: Supplier;
  restored_culture_count: number;
  restored_supplier_data_count: number;
}

export type SeedRateUnit = 'g_per_m2' | 'g_per_lfm' | 'seeds_per_m2' | 'seeds_per_lfm' | 'seeds_per_plant';
export type CultivationType = 'pre_cultivation' | 'direct_sowing';

export interface SeedRateByCultivationEntry {
  value: number;
  unit: SeedRateUnit;
}

export type SeedRateByCultivation = Partial<Record<CultivationType, SeedRateByCultivationEntry>>;

export interface Culture {
  source_public_culture?: number | null;
  source_public_version?: number | null;
  origin_type?: 'manual' | 'imported';
  owned_public_culture_id?: number | null;
  owned_public_culture_role?: PublicCultureOwnershipRole | null;
  is_modified_from_source?: boolean;
  crop_species?: number | null;
  thousand_kernel_weight_g?: number;
  package_size_g?: number; // deprecated, replaced by seed_packages
  seeding_requirement?: number;
  seeding_requirement_type?: 'per_sqm' | 'per_plant' | '';
  seed_packages?: SeedPackage[];
  seed_rate_value?: number | null;
  seed_rate_unit?: SeedRateUnit | null;
  seed_rate_by_cultivation?: SeedRateByCultivation | null;
  seed_rate_direct_value?: number | null;
  seed_rate_direct_unit?: SeedRateUnit | null;
  sowing_calculation_safety_percent_direct?: number | null;
  seed_rate_pre_cultivation_value?: number | null;
  seed_rate_pre_cultivation_unit?: SeedRateUnit | null;
  sowing_calculation_safety_percent_pre_cultivation?: number | null;
  id?: number;
  name: string;
  /** Species name in the request language, after the fallback chain. */
  culture_display_name?: string | null;
  /** Language `culture_display_name` actually came from; '' when no translation exists. */
  culture_display_language_code?: string | null;
  /** Every stored linked species name, keyed by language code. */
  crop_species_translations?: Record<string, string>;
  variety?: string;
  seed_supplier?: string;
  supplier?: Supplier | null;
  selected_seed_demand_supplier?: number | null;
  supplier_product_url?: string | null;
  supplier_data?: CultureSupplierData[];
  supplier_data_input?: CultureSupplierDataInput[];
  image_file?: MediaFileRef | null;
  image_file_id?: number | null;
  notes?: string;
  
  crop_family?: string;
  nutrient_demand?: 'low' | 'medium' | 'high' | '';
  cultivation_type?: CultivationType | '';
  cultivation_types?: CultivationType[];
  
  growth_duration_days?: number;
  harvest_duration_days?: number;
  propagation_duration_days?: number;
  
  harvest_method?: 'per_plant' | 'per_sqm' | '';
  expected_yield?: number;
  allow_deviation_delivery_weeks?: boolean;
  
  distance_within_row_cm?: number;
  row_spacing_cm?: number;
  sowing_depth_cm?: number;

  sowing_calculation_safety_percent?: number;
  
  display_color?: string;
  
  // Computed, read-only.
  plants_per_m2?: number | null;
  
  created_at?: string;
  updated_at?: string;
}

export interface CultureSupplierData {
  id?: number;
  culture?: number;
  project?: number;
  supplier?: Supplier | null;
  supplier_id?: number | null;
  supplier_name?: string;
  supplier_name_input?: string;
  supplier_url?: string;
  supplier_product_name?: string;
  supplier_product_url?: string;
  packaging_sizes?: SeedPackage[];
  germination_rate?: number | null;
  price?: number | null;
  notes?: string;
  source_url?: string;
}

export interface CultureSupplierDataInput {
  id?: number;
  supplier_id?: number | null;
  supplier_name_input?: string;
  supplier_name?: string;
  supplier_url?: string;
  supplier_product_name?: string;
  supplier_product_url?: string;
  packaging_sizes?: SeedPackage[];
  germination_rate?: number | null;
  price?: number | null;
  notes?: string;
  source_url?: string;
}




export interface PublicCulture {
  id: number;
  status: 'draft' | 'published' | 'withdrawn' | 'removed';
  removal_reason?: PublicCultureRemovalReason | '';
  name: string;
  variety?: string;
  notes?: string;
  seed_supplier?: string;
  supplier_name?: string;
  crop_species?: number | null;
  /** Species common name already resolved into the request language. */
  crop_species_name?: string;
  /** Canonical, language-independent species label (editorial use). */
  crop_species_canonical_name?: string;
  /** Every stored species name, keyed by language code. */
  crop_species_translations?: Record<string, string>;
  /** Species name in the request language, after the fallback chain. */
  display_name?: string;
  /** Language `display_name` actually came from; '' when no translation exists. */
  display_language_code?: string;
  /** Public description in the request language, after the fallback chain. */
  description?: string;
  /** Language `description` actually came from; '' when none exists. */
  description_language_code?: string;
  /** Every stored public description, keyed by language code. */
  translations?: Record<string, string>;
  original_language_code?: string;
  crop_family?: string;
  nutrient_demand?: 'low' | 'medium' | 'high' | '';
  cultivation_type?: CultivationType | '';
  cultivation_types?: CultivationType[];
  growth_duration_days?: number | null;
  harvest_duration_days?: number | null;
  propagation_duration_days?: number | null;
  harvest_method?: 'per_plant' | 'per_sqm' | '';
  expected_yield?: number | null;
  allow_deviation_delivery_weeks?: boolean;
  distance_within_row_m?: number | null;
  row_spacing_m?: number | null;
  sowing_depth_m?: number | null;
  seed_rate_value?: number | null;
  seed_rate_unit?: SeedRateUnit | null;
  seed_rate_by_cultivation?: SeedRateByCultivation | null;
  seed_rate_direct_value?: number | null;
  seed_rate_direct_unit?: SeedRateUnit | null;
  sowing_calculation_safety_percent_direct?: number | null;
  seed_rate_pre_cultivation_value?: number | null;
  seed_rate_pre_cultivation_unit?: SeedRateUnit | null;
  sowing_calculation_safety_percent_pre_cultivation?: number | null;
  sowing_calculation_safety_percent?: number | null;
  thousand_kernel_weight_g?: number | null;
  seeding_requirement?: number | null;
  seeding_requirement_type?: 'per_sqm' | 'per_plant' | '';
  display_color?: string;
  seed_packages?: SeedPackage[];
  version: number;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by_label?: string;
  source_project_culture?: number | null;
  source_project?: number | null;
}

export interface PublicCultureTranslations {
  original_language_code: string;
  translations: Record<string, string>;
  crop_species_translations?: Record<string, string>;
}

export type PublicCultureChangeProposalStatus = 'pending' | 'approved' | 'rejected';

export interface PublicCultureChangeProposal {
  id: number;
  public_culture: number;
  summary: string;
  proposed_data: Partial<PublicCulture>;
  status: PublicCultureChangeProposalStatus;
  proposed_by_label?: string;
  reviewed_by_label?: string;
  review_note?: string;
  reviewed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PublicCultureRevisionChange {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

export interface PublicCultureRevision {
  id: number;
  public_culture: number;
  version: number;
  action: 'created' | 'updated' | 'restored';
  snapshot: Partial<PublicCulture>;
  changed_fields: PublicCultureRevisionChange[];
  restored_from_version?: number | null;
  created_by_label?: string;
  created_at?: string;
}

export interface PublicCultureDiscussionComment {
  id: number;
  topic: number;
  parent?: number | null;
  body: string;
  created_by_label?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  deletion_kind?: 'author' | 'moderator' | 'unknown' | null;
  delete_blocked_reason?: 'visible_replies' | null;
  is_edited: boolean;
  can_edit: boolean;
  can_delete?: boolean;
}

export interface PublicCultureDiscussionTopic {
  id: number;
  public_culture: number;
  title: string;
  created_by_label?: string;
  created_at?: string;
  revision?: number | null;
  version?: number | null;
  comment_count: number;
  last_activity_at?: string | null;
  last_comment_preview?: string | null;
}

/**
 * How the current user relates to the public-library entry linked to a project
 * culture. Contributors remove their own entry without a reason, moderators
 * remove somebody else's entry and must pick a moderation reason.
 */
export type PublicCultureOwnershipRole = 'contributor' | 'moderator';

export type PublicCultureRemovalReason =
  | 'accidental_publication'
  | 'test_data'
  | 'duplicate'
  | 'wrong_mapping'
  | 'unlawful_content'
  | 'other';

export interface PublicCultureDuplicateCandidate {
  id: number;
  name: string;
  variety?: string;
  version: number;
  published_at?: string | null;
  created_by_label?: string;
}

export interface CultureDuplicateCheckResponse {
  exists: boolean;
}

export interface PublicCultureMatchResponse {
  exists: boolean;
  culture: Pick<PublicCulture, 'id' | 'name' | 'variety'> | null;
}

export interface PublishPublicCultureDuplicateError {
  code: 'duplicate_public_culture';
  detail: string;
  duplicates: PublicCultureDuplicateCandidate[];
  normalized_identity?: {
    name: string;
    variety: string;
    seed_supplier: string;
  };
}

export interface CropSpecies {
  id: number;
  name: string;
  display_name?: string;
  display_language_code?: string;
  translations?: Array<{ language_code: string; common_name: string }>;
  status: 'published' | 'proposed' | 'rejected';
  proposed_by_label?: string;
  reviewed_by_label?: string;
  review_note?: string;
  reviewed_at?: string | null;
  similar_species?: Array<{
    id: number;
    name: string;
    match_type: 'exact' | 'similar';
  }>;
}

export type PublicLibraryModeratorRequestStatus = 'pending' | 'approved' | 'rejected';

export interface PublicLibraryModeratorRequest {
  id: number;
  user: number;
  user_label: string;
  motivation: string;
  status: PublicLibraryModeratorRequestStatus;
  reviewed_by_label?: string;
  review_note?: string;
  reviewed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PublicLibraryModeratorRequestMine {
  is_moderator: boolean;
  request: PublicLibraryModeratorRequest | null;
}

export interface PublishPublicCulturePreview {
  crop_species: Pick<CropSpecies, 'id' | 'name'> | null;
  original_language_code: string;
  available_language_codes: string[];
  missing_required_fields: Array<{ field: string; label_key: string }>;
  duplicates: PublicCultureDuplicateCandidate[];
  can_publish: boolean;
}

export interface PublishPublicCultureResponse {
  operation: 'created' | 'updated';
  public_culture: PublicCulture;
  duplicates: PublicCultureDuplicateCandidate[];
}

export interface SeedDemand {
  culture_id: number;
  culture_name: string;
  culture_display_name?: string | null;
  culture_display_language_code?: string | null;
  variety?: string | null;
  supplier?: string | null;
  selected_supplier_id?: number | null;
  supplier_options?: Array<{ supplier_id: number; supplier_name: string }>;
  total_grams: number | null;
  required_amount_value: number | null;
  required_amount_unit: 'g' | 'seeds' | null;
  required_amount_warning?: 'missing_tkg' | string | null;
  calculation_blockers?: Array<
    | 'missing_seed_rate'
    | 'missing_area'
    | 'missing_row_spacing'
    | 'missing_plant_quantity'
    | 'missing_tkg'
    | 'unsupported_seed_rate_unit'
    | string
  >;
  seed_packages?: Array<{ size_value: number; size_unit: 'g' | 'seeds' }>;
  package_suggestion?: {
    selection: Array<{ size_value: number; size_unit: 'g' | 'seeds'; count: number }>;
    total_amount: number;
    overage: number;
    pack_count: number;
    unit?: 'g' | 'seeds';
  } | null;
  package_blocker?:
    | 'required_amount_unavailable'
    | 'supplier_data_missing'
    | 'supplier_not_selected'
    | 'package_sizes_missing'
    | 'unit_conversion_unavailable'
    | 'no_matching_package_sizes'
    | string
    | null;
  warning: string | null;
}

export interface Location {
  id?: number;
  name: string;
  address?: string;
  description?: string;
  soil_type?: 'sand' | 'loam' | 'clay' | null;
  exposure?: 'north' | 'south' | 'east' | 'west' | 'flat' | null;
  latitude?: number;
  longitude?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Field {
  id?: number;
  name: string;
  location: number;
  location_name?: string;
  area_sqm?: number;
  length_m?: number | null;
  width_m?: number | null;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Bed {
  id?: number;
  name: string;
  field: number;
  field_name?: string;
  area_sqm?: number;
  length_m?: number | null;
  width_m?: number | null;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}



export interface BedLayoutEntry {
  id?: number;
  bed: number;
  location: number;
  field_id?: number;
  x: number;
  y: number;
  version?: number;
  scale?: number | null;
  created_at?: string;
  updated_at?: string;
}


export interface FieldLayoutEntry {
  id?: number;
  field: number;
  location: number;
  x: number;
  y: number;
  version?: number;
  scale?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface LocationLayoutsResponse {
  bed_layouts: BedLayoutEntry[];
  field_layouts: FieldLayoutEntry[];
}
export interface PlantingPlan {
  id?: number;
  // Optional until the plan is fully filled in — a plan can be saved as a
  // draft as long as at least one of culture/bed is chosen.
  culture: number | null;
  cultivation_type?: CultivationType | '';
  culture_name?: string | null;
  culture_display_name?: string | null;
  culture_display_language_code?: string | null;
  culture_variety?: string | null;
  culture_display_color?: string | null;
  culture_propagation_duration_days?: number | null;
  culture_cultivation_type?: CultivationType | '' | null;
  culture_cultivation_types?: CultivationType[] | null;
  bed: number | null;
  bed_name?: string | null;
  planting_date: string | null;
  // Read-only, computed.
  harvest_date?: string | null;
  // Read-only, computed.
  harvest_end_date?: string | null;
  quantity?: number;
  plants_count?: number | null;
  area_usage_sqm?: number;
  // Write-only input used on create/update.
  area_input_value?: number;
  // Write-only input used on create/update.
  area_input_unit?: 'M2' | 'PLANTS';
  notes?: string;
  note_attachment_count?: number;
  created_at?: string;
  updated_at?: string;
}



export interface RemainingAreaResponse {
  bed_id: number;
  bed_area_sqm: number;
  overlapping_used_area_sqm: number;
  remaining_area_sqm: number;
  start_date: string;
  end_date: string;
}

export interface YieldCalendarCulture {
  culture_id: number;
  culture_name: string;
  culture_display_name?: string | null;
  culture_display_language_code?: string | null;
  color: string;
  yield: number;
}

export interface YieldCalendarWeek {
  iso_week: string;
  week_start: string;
  week_end: string;
  cultures: YieldCalendarCulture[];
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}


export interface NoteAttachment {
  id: number;
  planting_plan: number;
  image: string;
  image_url?: string;
  caption?: string;
  created_at: string;
  width?: number;
  height?: number;
  size_bytes?: number;
  mime_type?: string;
}


export interface MediaFileRef {
  id: number;
  storage_path: string;
  uploaded_at?: string;
}

export interface CultureHistoryEntry {
  history_id: number;
  culture_id?: number;
  history_date: string;
  history_type: string;
  history_user: string | null;
  summary: string;
  object_type?: string;
  object_display_name?: string | null;
  action?: string;
  actor_label?: string | null;
  is_current_version?: boolean;
  changes?: CultureHistoryChange[];
}

export interface CultureHistoryChange {
  field: string;
  old_value: unknown;
  new_value: unknown;
}
