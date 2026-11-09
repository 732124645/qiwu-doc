---
description: 'Deploy LiveKit for Qiwu employee foreground calls: HTTPS/WSS, TURN, firewall ports, server-only keys, browser CSP, disabled automatic room creation, cleanup and real-service acceptance.'
---

# LiveKit integration and deployment

Qiwu owns employee identity, tenant/membership checks, invitations, acceptance, hang-up and call history. LiveKit carries media. Web/H5 uses its official JavaScript SDK; the app bridges the official Swift/Android SDKs through a uni-app native module. Voice messages use chat attachments and do not depend on LiveKit.

This release supports foreground one-to-one and small-group calls, up to 8 participants including the caller. It does not provide background answering, offline push, screen sharing or recording. Eight participants is a business limit, not a server-capacity guarantee. No GPU or speech model service is needed.

::: warning Deployment acceptance remains required
No ready-to-use media service is included, and there are no recorded real LiveKit/TURN or Android/iPhone hardware call passes. Source builds, simulator tests and plugin linking do not establish on-site connectivity. Complete [Acceptance](#acceptance) before going live, together with the app's [native-package and licensing conditions](/en/features/im#app-requirements-and-acceptance).
:::

## Service and network

The supported self-hosted server is pinned to **v1.13.11**. Install its official Linux binary and run it through a system service manager as a non-root service user:

```sh
livekit-server --config /etc/livekit/livekit.yaml
```

Limit configuration and certificate access to that service account. The following is a single-node configuration structure. Replace every example domain and angle-bracket placeholder with your own values; never commit real keys.

```yaml
port: 7880
rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: true
room:
  auto_create: false
keys:
  <generated-api-key>: <generated-random-secret>
turn:
  enabled: true
  domain: turn.example.com
  tls_port: 443
  udp_port: 3478
  cert_file: /etc/livekit/tls/fullchain.pem
  key_file: /etc/livekit/tls/privkey.pem
```

**Keep `room.auto_create: false`.** The business server explicitly creates rooms after authorization. Ordinary clients cannot automatically create one. Recheck this configuration and old-grant behavior before upgrading the media server.

- Give `media.example.com` a trusted HTTPS/WSS certificate, proxy port 7880 behind TLS and do not expose the plaintext control API publicly.
- This example uses UDP mux 7882 and TCP 7881 for media, and TCP 443 / UDP 3478 for TURN. If using a UDP range instead, open the actual configured range.
- The TURN/TLS example uses a separate public IP for `turn.example.com:443`, avoiding a conflicting HTTPS listener on the same IP. A non-root Linux service binding 443 needs only the required `CAP_NET_BIND_SERVICE`; alternatively use a higher port behind a separate layer-4 load balancer.
- Public addresses advertised by NATed nodes and the corresponding ports must be reachable. TCP/TURN is a fallback for restricted networks, and still requires tests in the intended networks.

Measure bandwidth and CPU against upload bitrate, subscriptions and video quality. Official references: [Self-hosted deployment](https://docs.livekit.io/transport/self-hosting/deployment/) · [Ports and firewall](https://docs.livekit.io/transport/self-hosting/ports-firewall/).

## Application configuration

Put non-secret settings in the application server environment:

```dotenv
APP_IM=true
IM_LIVEKIT_URL=wss://media.example.com
IM_LIVEKIT_API_URL=https://media.example.com
```

| Setting | Purpose |
| --- | --- |
| `IM_LIVEKIT_URL` | WSS origin reached by employee clients |
| `IM_LIVEKIT_API_URL` | HTTPS control origin reached by the application server |
| `IM_LIVEKIT_API_KEY` / `IM_LIVEKIT_API_SECRET` | Match the media server's keys; store only in server `.env.local` or protected environment variables |
| `OUTBOUND_LIVEKIT_PORTS` | Explicitly register a required nonstandard public control port; 443 is allowed by default |
| `im.call.enabled` | Runtime system parameter, `false` by default; permits new calls once media configuration is complete |

Both URLs must be bare origins, without user information, paths, queries or fragments. Use HTTPS/WSS in production; loopback HTTP/WS is for local development only. Control requests retain the public-target and DNS-rebinding protections. Do not globally enable `ALLOW_PRIVATE_ENDPOINTS` in production to make calls work.

**Never put the server API key/secret in `VITE_*`, an app manifest, page parameters, frontend bundles or logs.** Employees receive only a temporary grant for an authorized room. Incomplete configuration issues no grant; `GET /api/im/options` reports configuration availability.

## Reverse proxy and CSP

Forward WebSocket upgrades and disable request-URL logging for `/rtc`. The SDK's signaling handshake can carry a temporary grant in its query string. TLS endpoints, proxies and error capture must not persist the complete URL, Authorization header or response body.

```nginx
location /rtc {
    access_log off;
    proxy_pass http://127.0.0.1:7880;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;
}
```

Proxy control APIs to LiveKit as well; application-server management authorization protects them. You may additionally restrict `/twirp/` to trusted application-node IPs.

Build desktop Web with `CSP_CONNECT_SRC=https://media.example.com,wss://media.example.com`, retaining required S3 origins, and synchronize the complete CSP as described in [Deployment](/guide/deploy) (Chinese). Keep `script-src 'self'` and `media-src 'self' blob:`; do not allow wildcard script sources. Web/H5 capture also needs a secure context and user permission. Build the app with a phone-reachable `VITE_API_BASE=https://api.example.com/api`.

## Hang-up and outages

Temporary client grants allow only the specified room, microphone/camera publication and subscription, with 60 seconds to enter. Expiration does not immediately disconnect existing media; a local disconnect is not proof of completed remote cleanup.

Background maintenance remains installed in `all`, `api` and `worker` roles. Disabling `APP_IM` or `im.call.enabled` does not remove cleanup for existing calls. A control outage preserves pending cleanup. Unknown room-creation outcomes must not be blindly retried or treated as ended merely because one lookup reports not found. Query/delete reconciliation resumes after connectivity returns.

Before changing a control origin, moving clusters or rotating/removing control credentials, disable new calls and drain all existing and unknown creates. Do not manually change Ending rows to Ended, and do not reuse old media room names. Startup fails explicitly when pending cleanup exists but control credentials are missing.

## Acceptance

Complete these checks in your environment and retain the outcomes:

- [ ] HTTPS/WSS, certificate chain, DNS and access from the application server and each client work.
- [ ] Web, Android and iPhone exchange two-way audio and camera video; denied microphone/camera permission can recover.
- [ ] Voice-message exchange, speaker/headset routes, front/rear cameras, system interruptions and video-view recreation work.
- [ ] Test Wi-Fi, cellular and UDP-blocked networks separately; prove TURN actually transports the restricted-network media, and test disconnect/reconnect.
- [ ] Hang-up, sign-out, being kicked, membership removal and backgrounding stop capture; record retry/cleanup results during media-service failure.
- [ ] Retain `room.auto_create: false` and no room-create grant. After successful DeleteRoom, an unexpired old grant must fail to reconnect to the same media room name, with no late create outstanding.
- [ ] Clarify Android native dependency redistribution, preserve licenses/notices in both final app packages, and complete signed-host installation and real-device checks.

These on-site results remain unaccepted. Instant remote-media revocation is not promised during a network outage. Unit tests and database state do not replace real-service checks.

Further reading: [Employee chat and calls](/en/features/im) · [Mobile development](/core/mobile) (Chinese) · [Source configuration guide](https://github.com/732124645/qiwu-vue-admin/blob/v1.16.0/docs/livekit.md) (Chinese).
