---
description: 'Manage one or more WeChat Official Accounts from the admin console: the APP_WXOA switch, connecting accounts and the push callback, messages and conversations, auto replies, custom menus, fans and tags, materials, template messages, channel QR codes, plus article drafts, publishing, mass messages, statistics, comments and subscription notices; off by default.'
---

# WeChat Official Accounts

A **WeChat Official Account** is an official account that a company or person runs inside WeChat. People who follow it receive its messages, tap its menu and chat with it. Followers of an account are called **fans**. Qiwu's Official Accounts module lets you manage one or more of these accounts from your own admin console: connect accounts, receive and answer fans' messages, set up auto replies and menus, manage fans and materials, and publish articles, send mass messages and read statistics.

A few common terms:

- **Service account**, **subscription account**: the two kinds of Official Account. A service account can use more APIs; the WeChat platform now calls a subscription account "公众号（原订阅号）".
- **Verification**: submitting documents to WeChat to confirm who runs the account. An unverified account lacks permission for many APIs.
- **Test account**: a free account WeChat gives developers by scanning a QR code, for trying features before going live.
- **AppID**, **AppSecret**: the ID and secret WeChat gives each Official Account, shown in the developer settings of the WeChat platform.

::: tip Off by default
The module is off by default; projects that don't need it can skip this page. It manages Official Accounts only, and has nothing to do with the WeChat mini program sign-in in [Sign-in and accounts](/features/login#微信小程序登录) (Chinese) or the WeChat subscribe messages in the [Message center](/features/messaging) (Chinese); their settings are not shared.
:::

## Turning it on

The switch is the server environment variable `APP_WXOA`, `false` by default. It is read at startup only, so after changing it restart **every** server instance.

| Where | Off (default) | On |
| --- | --- | --- |
| API | Every `/api/wxoa/*` route returns 404, including the callback that receives WeChat's pushes | Works normally |
| Menus | The **Official Accounts** group is hidden from the sidebar and the role grant tree (Menus still lists it) | Shown by permission |
| WeChat | Nothing calls WeChat, and the module's scheduled tasks do not run | Called as needed |
| Tables | Created by the database migrations as usual, and stay empty | Written normally |

Once on, use it from the **Official Accounts** group in the sidebar. For the full description of the switch, see the repository's [Official Account management · Enabling](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/wxoa.md#启用) (Chinese); for deployment notes, see [Deployment · Official Account module](/guide/deploy#公众号模块) (Chinese).

## Access and interaction

These features have been verified on real phones with a WeChat test account.

### Connecting accounts

In **Official Accounts → Accounts**, add an account with its AppID, AppSecret, Token (a string you choose, matching the one entered on the WeChat side) and so on. One console can connect several Official Accounts; switch the current account at the top of the page.

- **Write-only secrets**: the AppSecret, Token and EncodingAESKey (the encryption key) are stored encrypted; the details only show "set", and leaving a field empty when editing keeps it unchanged;
- **The AppID cannot be changed**: fans, materials and menus only belong to the original account, so to switch to another Official Account, add a new account;
- **Test connection**: checks that the token for calling WeChat APIs can be fetched; for a production account it also checks the IP allowlist (WeChat only accepts API calls from servers on it);
- **API quota**: shows today's call counts of the commonly used APIs.

For the steps to connect a test account or a production account, see the repository's [Settings](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/wxoa.md#配置项), [Test account](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/wxoa.md#测试号), [Production account](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/wxoa.md#正式号) and [IP allowlist](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/wxoa.md#ip-白名单) (all Chinese).

### Receiving WeChat pushes

When a fan sends a message, follows or taps a menu, WeChat **pushes** the event to the server URL you entered (the **callback URL**). After the account is saved, the page shows this URL; copy it into the WeChat platform.

- Three message encryption modes are supported: **plaintext** (no encryption, recommended for test accounts only), **compatible** and **secure**;
- Every push has its signature checked, and expired or replayed requests are refused;
- WeChat waits only about 5 seconds, so a push is answered first and the rest of the work happens after the reply; a repeated push is handled only once.

See the repository's [Callback URL](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/wxoa.md#回调地址), [Encryption modes](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/wxoa.md#加密方式) (including the order for switching modes) and [5 seconds, retries and de-duplication](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/wxoa.md#5-秒重试与排重) (all Chinese).

### Messages and conversations

- **Official Accounts → Message log**: the messages and events fans sent;
- **Official Accounts → Conversations**: view the chat with each fan and reply (**customer service messages**). WeChat only allows replies for a while after the fan's latest interaction; outside that time the page tells you;
- Images, voice messages and video thumbnails from fans are copied to local storage by default, because WeChat keeps them for only 3 days;
- Messages are kept for 180 days by default; a scheduled task deletes older ones.

See the repository's [Messages and conversations](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/wxoa.md#消息与会话) (Chinese).

### Auto replies

In **Official Accounts → Auto replies**, set up rules: a reply on follow, keyword replies, replies to menu taps, a default reply when nothing matches, and replies when a fan **scans a channel QR code**. Changes take effect immediately. See the repository's [Auto replies](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/wxoa.md#自动回复) (Chinese).

### Custom menus

In **Official Accounts → Custom menus**, edit the menu at the bottom of the account's chat. The editor is a phone preview, so what you see is what fans get; publish to WeChat when done. Besides the default menu everyone sees, you can add **conditional menus** that show a different menu by fan tag or phone platform.

::: info After enabling the server configuration
By WeChat's rules, once a production account enables the server configuration on the WeChat platform, the auto replies and custom menu set up in the WeChat platform's own console stop working, and this system manages them instead.
:::

### Fans, tags and blacklist

**Official Accounts → Fans** lists the people who have followed the account. You can sync them from WeChat, give them **tags** (groups), block or unblock them, and export to Excel. Since 27 December 2021 WeChat no longer returns fans' nicknames and avatars. See the repository's [Sync and multiple instances](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/wxoa.md#同步与多实例) (Chinese).

### Materials, template messages and channel QR codes

- **Official Accounts → Materials**: upload and sync **permanent materials** (images, voice and video stored on WeChat for good), used by replies and mass messages;
- **Official Accounts → Template messages**: send notices to fans with the account's message templates;
- **Official Accounts → Channel QR codes**: create one QR code per channel (a store, a poster, …) and count the scans; fans who follow through one can be tagged automatically.

## Content and operations

By WeChat's rules these features need a **verified service account**. So far they have only been verified against a simulated WeChat API in tests, not yet on a real verified service account. See the repository's [Verification status](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/wxoa.md#验证情况) (Chinese).

- **Official Accounts → Article drafts**: write article drafts (1–8 articles each) in the rich text editor, sync them to the WeChat draft box or pull them from WeChat; only images from this site's storage are uploaded with the body. See the repository's [Article drafts and publishing](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/wxoa.md#图文草稿与发表) (Chinese);
- **Official Accounts → Published articles**: publish a synced draft and see its status and article link;
- **Official Accounts → Mass messages**: send text, an image, voice, a video or articles to all fans, a tag or chosen fans, with a preview to one fan first. When the result of a send is unknown (a network timeout, for example), you can "resend" within WeChat's 24-hour de-duplication window without fans receiving it twice; after that window, resending is no longer offered. Article mass messages also lead to the articles' **comments**. See the repository's [Mass messages](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/wxoa.md#群发) (Chinese);
- **Official Accounts → Statistics**: charts of fan growth, messages, API calls and articles, up to 90 days per query;
- **Official Accounts → Subscription notices**: manage subscription notice templates and send them to fans who have authorized them.

For details on statistics, comments and subscription notices, see the repository's [Statistics, comments and subscription notices](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/wxoa.md#数据统计留言与订阅通知) (Chinese).

## Permissions

Each page has its own button permissions, with permission codes starting with `wxoa.`. Permissions are by feature only: whoever holds one can use it on every account. For the full table, see the repository's [Permissions](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/wxoa.md#权限) (Chinese).

## Multi-tenancy

With [multi-tenancy](/en/features/multi-tenancy) on:

- Each tenant manages its own Official Accounts and cannot see other tenants' accounts or data;
- One AppID can be connected to one tenant only;
- Adding an account first checks the entered AppSecret with WeChat, proving the person adding it really holds the account; if the check fails, no account is created;
- Platform staff can look up which tenant holds an AppID in **System → Tenants**;
- A tenant can use the module only when its package includes the **Official Accounts** group.

See the repository's [Security and tenant boundaries](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/wxoa.md#安全与多租户边界) and [Releasing globally unique values](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/multi-tenancy.md#全局唯一值的释放) (both Chinese).

## Try it on the demo

The [live demo](/en/guide/introduction#live-demo) has the module on, in demo mode: writes such as saving, and every call to WeChat, are refused. The demo has a made-up sample service account with sample fans, tags, messages, a menu, reply rules and a QR code to browse. See the repository's [Demo mode](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/wxoa.md#演示模式) (Chinese).

## Known limits

- No WeChat Pay, cards and coupons, third-party platform authorization, customer service agent assignment, web authorization or JS-SDK;
- Subscription notices can only go to fans who have authorized them by other means;
- Deleting a channel QR code only deletes this system's record; a permanent QR code stays valid on the WeChat side.

For the full list, see the repository's [Other limits](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/wxoa.md#其它限制) (Chinese).

Related features:

- [Multi-tenancy](/en/features/multi-tenancy)
- [Permissions and data scope](/en/features/permission)
- [Scheduled tasks](/features/job) (Chinese)
- [File management](/features/storage) (Chinese)
