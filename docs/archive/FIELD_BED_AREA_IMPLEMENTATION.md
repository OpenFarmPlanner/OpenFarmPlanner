# Field/Bed Area-Only Model Implementation (archived)

> **Archived implementation checklist.** This work is complete; the file is
> kept for the historical rationale behind storing only `area_sqm` and the
> intended future geometry extension path. The model/validation details below
> are still accurate (see `backend/farm/models/structure.py`), but the
> frontend section references `frontend/src/pages/Beds.tsx`, which no longer
> exists as a standalone page — field/bed management now lives in
> `FieldsBedsPage.tsx`/`FieldsBedsHierarchy.tsx`/`GraphicalFields.tsx`. For the
> current farm-structure model see
> [`docs/data-model.md`](../data-model.md#2-farm-structure-locations--fields--beds).

## Overview
This document summarizes the implementation of area-only storage for Field and Bed entities in v1, preparing for future polygon/geometry support.

## Issue Requirements
- ✅ Only the area (sqm) is stored in v1
- ✅ Prepare for later support of polygons/geometry
- ✅ CRUD for field/bed
- ✅ Validation for realistic size

## Implementation Details

### Backend Changes

#### Models (backend/farm/models/structure.py)
- **Field Model**: Already had `area_sqm` field (DecimalField, max_digits=10, decimal_places=2)
  - Added validation: MIN_AREA_SQM = 0.01 sqm, MAX_AREA_SQM = 1,000,000 sqm (100 hectares)
  - Implemented `clean()` method for custom validation
  - Uses Decimal types for constants to avoid float comparison issues

- **Bed Model**: Migrated from length_m/width_m to area_sqm (migration 0004)
  - Added validation: MIN_AREA_SQM = 0.01 sqm, MAX_AREA_SQM = 10,000 sqm (1 hectare)
  - Implemented `clean()` method for custom validation
  - Uses Decimal types for constants

#### Serializers (backend/farm/serializers.py)
- Added `validate_area_sqm()` method to FieldSerializer
- Added `validate_area_sqm()` method to BedSerializer
- Both enforce the same min/max constraints as models

#### Tests (backend/farm/tests.py)
- Added model validation tests:
  - `test_field_area_validation_too_small`
  - `test_field_area_validation_too_large`
  - `test_field_area_validation_valid_range`
  - `test_bed_area_validation_too_small`
  - `test_bed_area_validation_too_large`
  - `test_bed_area_validation_valid_range`

- Added API validation tests:
  - `test_field_create_with_valid_area`
  - `test_field_create_with_invalid_area_too_small`
  - `test_field_create_with_invalid_area_too_large`
  - `test_bed_create_with_valid_area`
  - `test_bed_create_with_invalid_area_too_small`
  - `test_bed_create_with_invalid_area_too_large`

All 53 backend tests pass.

### Frontend Changes

#### Beds Component (frontend/src/pages/Beds.tsx)
- Removed deprecated `length_m` and `width_m` fields
- Added `area_sqm` field to form with:
  - HTML5 validation: min="0.01", max="10000", step="0.01"
  - Label: "Fläche (m²)" (German for "Area (m²)")
- Updated table to display area_sqm instead of dimensions
- Updated form state to use area_sqm

#### API Client (frontend/src/api/client.ts)
- Bed interface already had `area_sqm` defined
- No changes needed

All 23 frontend tests pass.

## Validation Rules

### Field Validation
- **Minimum**: 0.01 m² (10cm x 10cm)
- **Maximum**: 1,000,000 m² (100 hectares)
- **Rationale**: Fields can be small garden plots to large agricultural fields

### Bed Validation
- **Minimum**: 0.01 m² (10cm x 10cm)
- **Maximum**: 10,000 m² (1 hectare)
- **Rationale**: Beds are typically smaller cultivation units within fields

## Technical Notes

### Why Decimal Constants?
The validation uses `Decimal('0.01')` instead of `0.01` because:
```python
# Float comparison with Decimal can give wrong results
from decimal import Decimal
Decimal('0.01') < 0.01  # Returns True (incorrect!)
Decimal('0.01') < Decimal('0.01')  # Returns False (correct)
```

### Why Not Override save()?
The models use `clean()` for validation but don't override `save()` to call `full_clean()` because:
1. `full_clean()` validates ALL fields, including foreign keys
2. This can cause issues with existing data and test fixtures
3. DRF serializers automatically call validation before saving
4. Model `clean()` can be called explicitly when needed

## Future Enhancements
The current implementation is designed to easily support future polygon/geometry features:

1. **Database**: The DecimalField for area_sqm can coexist with a future geometry field
2. **Models**: Add a `geometry` field (e.g., PostGIS PolygonField) while keeping area_sqm
3. **Calculation**: Auto-calculate area_sqm from geometry when available
4. **Backward Compatibility**: Existing records with only area_sqm will continue to work

## API Examples

### Create a Field
```bash
curl -X POST http://localhost:8000/api/fields/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "North Field",
    "location": 1,
    "area_sqm": 5000.50,
    "notes": "Main production field"
  }'
```

### Create a Bed
```bash
curl -X POST http://localhost:8000/api/beds/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bed A1",
    "field": 1,
    "area_sqm": 25.50,
    "notes": "Tomato bed"
  }'
```

### Validation Error Example
```bash
# Area too small
curl -X POST http://localhost:8000/api/beds/ \
  -H "Content-Type: application/json" \
  -d '{"name": "Tiny", "field": 1, "area_sqm": 0.00}'

# Response:
{
  "area_sqm": ["Area must be at least 0.01 sqm."]
}
```

## Testing Checklist
- [x] Backend unit tests (53 tests pass)
- [x] Frontend unit tests (23 tests pass)
- [x] API validation tests
- [x] Manual API testing
- [x] Code review
- [x] Security scan (CodeQL)

## Summary
The implementation successfully provides:
1. ✅ Area-only storage for v1
2. ✅ Realistic size validation
3. ✅ Full CRUD operations
4. ✅ Prepared for future geometry support
5. ✅ Comprehensive test coverage
6. ✅ No security vulnerabilities
