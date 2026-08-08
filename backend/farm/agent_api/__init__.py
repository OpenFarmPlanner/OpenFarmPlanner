"""Agent-facing API surface: bearer-token auth, scope enforcement, OpenAPI.

This package deliberately contains no domain endpoints of its own. External
agents call the same viewsets the browser calls; the modules here only add the
credential type (:mod:`.authentication`), the access rules that apply to it
(:mod:`.permissions`), token self-service (:mod:`.views`), and a machine
readable description of the resulting surface (:mod:`.openapi`).
"""
