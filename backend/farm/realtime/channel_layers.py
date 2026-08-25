from channels_redis.core import RedisChannelLayer
from redis.exceptions import TimeoutError as RedisTimeoutError


class IdleTolerantRedisChannelLayer(RedisChannelLayer):
    """Treat idle Redis blocking-pop timeouts as an empty receive attempt."""

    async def _brpop_with_clean(self, index: int, channel: str, timeout: int) -> bytes | None:
        try:
            return await super()._brpop_with_clean(index, channel, timeout)
        except RedisTimeoutError:
            return None
