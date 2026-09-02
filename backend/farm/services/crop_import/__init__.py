"""Validating, two-step crop import used by the agent API.

The package is split so each concern stays independently testable:

* :mod:`.field_specs` — the single source of truth for which crop fields an
  import may touch, in which canonical unit, and within which bounds. The
  OpenAPI document is generated from the same specs, so the schema an agent
  reads and the rules the server enforces cannot drift apart.
* :mod:`.units` — parsing of source values into a canonical value plus unit,
  refusing to guess when the input is ambiguous.
* :mod:`.analysis` — turns a raw payload into a per-item, per-field preview
  without touching the database.
* :mod:`.apply` — writes a previously previewed draft transactionally.
"""

from .analysis import analyze_import_payload
from .apply import apply_import_draft

__all__ = ['analyze_import_payload', 'apply_import_draft']
