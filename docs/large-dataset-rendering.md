# Large-dataset rendering

## Reproduction

The Large Scale Performance Test project contains more than the Django REST
Framework default page size of 100 planting plans and enough occupied beds to
stress the calendar renderer.

The local fixture used during verification contained 2,400 beds and 5,000
planting plans.

Small projects did not expose either failure because their complete data fit in
the first API response and the Gantt DOM remained small.

## Root causes

### Planting plans

The backend correctly paginates list endpoints at 100 records. The shared
editable grid called only the first planting-plan URL and therefore never
received later API pages. Its `autoHeight` layout then made the first 100 rows
look like a rendering cutoff rather than an API truncation.

### Field planning

The calendar had two compounding limits:

1. Locations, fields, beds, crops, and planting plans were loaded from only
   the first API page.
2. `react-modern-gantt` does not virtualize rows. It performs collision
   detection several times per group and mounts every row and task item. Large
   complete datasets can therefore leave the timeline header visible while the
   body is still overwhelmed by synchronous React, layout, and paint work.

The chart uses DOM elements, so browser canvas-size limits were not involved.
No client-side filter or performance guard intentionally returned an empty
result.

## Fix

- Analysis pages use `fetchAllPaginated` (`frontend/src/api/api.ts`) to follow
  every backend `next` link.
- Bulk reads request up to 1,000 records per response through a bounded DRF
  page-size override; normal API lists still default to 100. Both numbers live
  in `backend/config/pagination.py`
  (`OpenFarmPlannerPageNumberPagination`: `page_size_query_param = "page_size"`,
  `max_page_size = 1000`) and `PAGE_SIZE` in `backend/config/settings.py`.
- The planting-plan grid loads the complete paginated API result up front, then
  uses the same scroll-driven internal DataGrid row window as the field/bed
  hierarchy. No pager UI is shown; persistent sorting and filtering remain
  active over the complete loaded dataset, not just the currently mounted
  internal row window.
- Adding or deep-linking to a plan moves the internal row window to the row
  containing the new or targeted record so it is visible and editable.
- Field planning uses a continuous scroll-driven render window. Only visible
  rows plus overscan, capped by timeline-item count, are passed to
  `react-modern-gantt`. The complete dataset remains in React state.
- Occupancy task construction indexes planting plans by bed once instead of
  scanning every planting plan again for every bed.
- The virtual viewport always renders at least one group when data exists and
  retains the existing error boundary if the dependency throws.

Development-only diagnostics report total planting plans, total beds, total
Gantt rows, visible Gantt rows, and rendered timeline items. Production builds
do not emit these diagnostics.
