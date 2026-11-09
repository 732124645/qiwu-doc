---
description: 'Qiwu employee chat: direct and group messages, staff directory, files, stickers, voice messages and foreground audio/video calls; configuration, local caching, native app requirements and outstanding device and redistribution checks.'
---

# Employee chat and calls

Employees can use direct and group chat on desktop and in the mobile app, sending text, pictures, files, stickers and voice messages. Foreground one-to-one and small-group audio/video calls use LiveKit, with at most 8 participants including the caller. H5 is a debugging and automated-test target. Chat has no WeChat mini program entry and does not admit external members or customers.

::: warning Source release and on-site readiness
This release provides source and configuration instructions. It does not include signed Android/iOS application packages or a ready-to-use LiveKit service.

Both native plugins have real SDK compilation, UTS linking and platform simulator test evidence. Host-app signing/install, a real LiveKit/TURN service and Android/iPhone hardware media still require acceptance. A transitive Android SDK dependency also has an unresolved redistribution-license clarification. These engineering results do not establish clearance to distribute a finished application. See [App requirements and acceptance](#app-requirements-and-acceptance).
:::

## Enable chat

1. Update the source and run migrations and seeds as described in [Upgrading the template](/guide/upgrade) (Chinese). Do not reset an existing database.
2. Set `APP_IM=true` on the server and restart all application instances. It is off by default.
3. With [multi-tenancy](/en/features/multi-tenancy) enabled, include the Chat group in the employee tenant's package. Seeds add it to existing packages when the group is first created; they do not undo an administrator's later removal.

Employees need no separate chat administration permission. The server checks the current tenant, employee identity, room membership and sign-in session for messages, private files and calls. Super administrator status does not bypass membership boundaries.

On desktop, open the chat icon in the top bar. In the app, switch between Chat and Notifications at the top of Messages. The entry is hidden when chat is disabled, the package excludes it or the identity is not an employee. Demo mode makes chat read-only.

Realtime calls additionally require `im.call.enabled` and a configured media service; see [LiveKit integration](/en/core/livekit). **Voice messages do not require a LiveKit service.**

## Direct chat, groups and messages

- **Directory:** active employees and departments within the current tenant; search locally by name or department and start a direct chat. Phone numbers, email addresses and usernames are not exposed.
- **Direct chat:** one room for each employee pair, with no friend-request step.
- **Groups:** owner, administrators and members have different management scopes; ownership can be transferred. New members cannot read messages from before joining; rejoining does not reveal the interval spent outside the group.
- **Messages:** plain text, Unicode emoji, pictures, files, 24 built-in stickers and personal custom stickers. Pictures load a thumbnail before the full image.
- **Edit and recall:** edit only your own text within the configured window. Group roles control recalling other members' messages. Recall clears the content and its message attachments.
- **Read positions:** advance only when messages are displayed, and synchronize between your devices. There is no per-message list of readers.

Attachments are private and can be fetched only through chat's current-member checks. General file-management endpoints do not bypass this rule. With S3, an already-issued short-lived download URL remains usable during its lifetime; leaving a room or recalling a message cannot retract downloaded copies.

## Local cache and outgoing messages

Desktop and H5 use IndexedDB. The app uses SQLite and local files. Cache is separated by service address, tenant, account and synchronization epoch. The UI renders local data first and fetches required changes; directory search is local, with ETag revalidation.

Retry a failed send using its original message identifier. Voice files persist with the outbox: Blob data in Web/H5 and app-owned files on native platforms. Success, expiration or an explicit discard cleans them up.

- Explicit sign-out, being kicked, changing accounts or changing the synchronization epoch clears chat data and attachments.
- Session expiration locks the cache; signing back into the same account can reuse it. Temporary network and service errors do not erase history.
- One browser tab owns synchronization and media operations. Calls require Web Locks and are disabled when unavailable; voice messages do not have that requirement.
- Sign out after using a shared device. Local caching is not an encrypted vault.

## Voice messages

Start recording, then confirm sending or cancel. Web/H5 uses recorder-core; the app uses the system RecorderManager. Microphone access is enabled only after an explicit recording or call action. Recording and calls share exclusive ownership of the local microphone.

Uploads are WAV: signed 16-bit little-endian PCM, 1/2 channels and 8000/16000/44100Hz. The server reads the actual file and validates format, duration and size. A client-supplied duration cannot override this result. Defaults are 60 seconds and 5 MiB; administrators can adjust the parameters below.

Only one voice message plays at a time. Leaving the room, locking, signing out, switching accounts or clearing data stops playback and recording. A delayed native permission result cannot start recording after its page has been retired.

## Foreground audio/video calls

Call the other participant in a direct chat or select group participants, up to 8 including yourself. The microphone and camera stay off before acceptance. Controls include mute, camera on/off, front/rear camera switch, built-in speaker preference and hang up. Speaker preference does not promise to override the OS route to wired or Bluetooth devices.

- First acceptance binds the current sign-in session; another device cannot take over.
- A chat room has at most one call that has not finished cleanup. There is no employee-wide busy lock covering every device and room.
- A non-caller who leaves a group call normally can explicitly rejoin while the call and the original session/membership remain valid.
- The caller leaving, either side leaving a direct call, or a participant session/eligibility ending terminates the entire call.
- Connection status comes from the media SDK. Receiving a grant is not proof of live audio/video. A single system summary is saved in chat; call audio and video are not recorded.
- A media-service outage may leave the UI in Ending while background cleanup continues. Do not manually mark its database row ended.

**Calls are foreground-only:** moving to the background, signing out or losing the current page's ownership stops media. Returning does not automatically open the microphone or answer. There is no background/lock-screen answering, CallKit, offline push, screen sharing or call recording.

## Administrator parameters

Change these in System → Parameters:

| Parameter | Default | Purpose |
| --- | --- | --- |
| `im.history.retention_days` | `180` | History retention; `0` means permanent; super administrator only |
| `im.sync.epoch` | Initial random value | Change after restoring/resetting a database so clients rebuild caches; do not rotate routinely |
| `im.group.max_members` | `200` | Group limit, including the owner |
| `im.message.edit_minutes` | `5` | Window for editing your own text |
| `im.message.recall_minutes` | `2` | Window for recalling your own message |
| `im.file.max_mb` | `20` | Picture/file limit, also bounded by storage configuration |
| `im.voice.max_seconds` | `60` | Voice duration limit, `1–300` |
| `im.voice.max_mb` | `5` | Voice size limit, `1–20`, also bounded by storage configuration |
| `im.call.enabled` | `false` | Allow new calls; LiveKit configuration is also required; disabling does not stop cleanup |

Back up before restoring a database and follow the [source retention/recovery guide](https://github.com/732124645/qiwu-vue-admin/blob/v1.16.0/docs/im.md#保留与恢复) (Chinese) for the synchronization epoch. Do not use `db:reset` to upgrade a production database.

## App requirements and acceptance

- Rebuild a native application package or custom debugging base containing `SQLite`, `Record` and `qw-livekit`. A wgt-only update cannot add these native capabilities to an old app.
- Supply your DCloud AppID, package name or Bundle ID, signing credentials and an HTTPS API URL reachable from the phone.
- The plugin config targets iOS 15 minimum and Android API 21 minimum. Simulator engineering checks do not establish compatibility with every old OS version, device or hardware model.
- Native compilation, UTS linking, platform tests, final host signing/install, a real service and hardware media are separate checks. The recorded HBuilderX/Xcode combination has linking adaptations; an unmodified GUI build/install is not promised.
- Android uses LiveKit SDK 2.30.0. The version-specific redistribution grant for transitive `android-jain-sip-ri:1.3.0-91` is awaiting clarification in the [upstream issue](https://github.com/livekit/client-sdk-android/issues/1048). Preserve and inspect all upstream licenses/notices in final iOS and Android packages. Publishing source does not close application-package redistribution acceptance.

After deployment, use Android and iPhone devices to check voice-message exchange, denied permissions, speaker/headset routes, camera switching, interruptions, sign-out/background cleanup, Wi-Fi, cellular and TURN with UDP blocked. Also prove that old credentials cannot reconnect after a room is deleted. There are no recorded on-site passes for these checks yet.

Further reading: [Mobile development](/core/mobile) (Chinese) · [LiveKit deployment](/en/core/livekit) · [Native plugin source and guide](https://github.com/732124645/qiwu-vue-admin/tree/v1.16.0/mobile/src/uni_modules/qw-livekit).
