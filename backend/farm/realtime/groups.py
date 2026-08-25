def public_culture_discussion_group(public_culture_id: int) -> str:
    """Return a stable, Channels-compatible group name for one library entry."""
    return f'public-culture.{public_culture_id}.discussions'
