# Real-time updates (Part A)

## Architecture

The Django ASGI application serves normal HTTP through Django and WebSockets
through Channels. Session cookies are resolved by `AuthMiddlewareStack`, and
`AllowedHostsOriginValidator` rejects unexpected browser origins. A consumer
authorizes its resource before joining a resource-specific channel group.

The first producer is the Public Crop Library discussion. Django model signals
publish only after the database transaction commits. The notification is an
invalidation, not a serialized model: the React client refetches authoritative
topics/comments from the existing REST API. This keeps permissions and
serialization centralized in REST and gives later domains the same pattern:
an authorized consumer, a narrowly scoped group, and a typed invalidation.

## Endpoint and event

The endpoint is:

```text
/<URL_PREFIX>/ws/public-cultures/<public_culture_id>/discussions/
```

`URL_PREFIX` is omitted when empty. The browser derives `ws://` or `wss://`
from the page protocol and uses Vite's base path, so subpath deployments such
as `/openfarmplanner/` work without a separate endpoint setting.

Discussion changes produce:

```json
{
  "type": "discussion.updated",
  "public_culture_id": 123,
  "discussion_id": 456
}
```

Clients may send `{"type":"ping"}` and receive `{"type":"pong"}`. The
frontend sends this heartbeat every 30 seconds while connected.

## Authorization and isolation

WebSocket access requires an authenticated Django session. The consumer also
verifies that the requested Public Crop Library entry is published and visible
under the same species visibility rule as REST before accepting. It joins only
that entry's group, so updates for another entry cannot be delivered through
the connection. Future project-scoped consumers must additionally resolve the
requested project/resource and verify `ProjectMembership` before joining; a
client-supplied project ID alone is never authorization.

## Frontend resilience and REST fallback

The reusable `useWebSocket` hook maintains at most one socket per mounted
subscription. It reconnects after close with exponential backoff from 1 to 30
seconds, ignores malformed messages, sends a conservative heartbeat, and
cleans up sockets and timers on path changes/unmount. While disconnected it
polls discussion state every 60 seconds; healthy sockets disable that poll.
Consequently a missing WebSocket service never blocks normal REST use.

## Local development

No Redis installation is needed. With `CHANNEL_REDIS_URL` unset, Channels uses
its in-memory layer. This supports a single application process and automated
tests only. Run the backend through an ASGI-capable server when manually
testing sockets; Daphne is included as an application dependency. Vite proxies
`/ws` with WebSocket upgrades as well as proxying `/api`.

## Redis-backed channel layer

Multi-process environments must set:

```text
CHANNEL_REDIS_URL=redis://[username:password@]host:port/database
```

The URL is passed to `channels_redis`; no host, port, socket path, or credential
is committed. Use `rediss://` when the Redis service requires TLS.

## Part B: not implemented

**This task does not configure or deploy Uberspace infrastructure.** Before
staging can exercise WebSockets, Part B must:

1. provision and secure Redis and set `CHANNEL_REDIS_URL` in staging;
2. run `config.asgi:application` under Daphne (or another supported ASGI
   server) using the staging virtual environment;
3. add/update the Uberspace process supervisor for that ASGI process;
4. configure the staging web backend/reverse proxy to forward the prefixed
   `/openfarmplanner/ws/` path with WebSocket upgrade headers and suitable
   idle timeouts;
5. confirm HTTPS produces `wss://`, session cookies reach ASGI, allowed hosts
   are correct, and cross-user isolation works on staging;
6. monitor reconnects, Redis availability, and ASGI logs before repeating the
   equivalent configuration for production.

No Redis service, supervisor, Uberspace web-backend rule, DNS change, or
staging/production deployment is part of Part A.
