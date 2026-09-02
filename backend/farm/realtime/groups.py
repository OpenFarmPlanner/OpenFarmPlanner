def public_crop_discussion_group(public_crop_id: int) -> str:
    """Return a stable, Channels-compatible group name for one library entry."""
    return f'public-crop.{public_crop_id}.discussions'
