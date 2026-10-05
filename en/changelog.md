# Changelog

This page records the changes in each Qiwu release. For the current features and the status of each one, see [Introduction · Features at a glance](/en/guide/introduction#features-at-a-glance).

## 1.0.0 · 2026-10-05

The first release, open source under the MIT license. Highlights:

- **Accounts and permissions**: password sign-in, SMS sign-in and password reset, sign-up (off by default), image and slider captchas, WeChat mini program sign-in (mini programs are apps that run inside WeChat); management of users, roles, menus, departments and positions; five data scopes; online users and force sign-out.
- **UI and languages**: Chinese and English UI; three layouts (side, top and mixed), dark mode, light / dark sidebar, tabs, lock screen, username watermark; consistent tables and forms, with column settings saved per user; a dashboard home page (**Home**).
- **System settings, auditing and monitoring**: dictionaries, parameters, bulletins; action log, sign-in log, API access log and API error log; server, MySQL and Redis monitoring and cache management; regions and IP geolocation; API docs; scheduled tasks.
- **Files, Excel and messaging**: local and S3-compatible storage, direct browser upload, authenticated download of private files; Excel import and export; inbox messages, email, SMS; realtime push over Socket.IO.
- **Code generation**: three templates (single table, tree, master-detail), usable from the web UI or the command line, optionally with mobile pages; a script to initialize a new project.
- **Workflow and forms**: tree designer and BPMN designer; approval actions such as all-must-approve (countersign), any-one approval, conditional branches, send back, transfer, add signers and withdraw; approval center; form designer, dynamic form approvals, no-code approvals; automatic timeout handling.
- **OAuth2 and single sign-on**: authorization code + PKCE, refresh tokens, client credentials; OAuth2 client management and a consent page.
- **Mobile app (optional)**: a uni-app employee app for WeChat mini programs, Android and iOS, with sign-in, Workbench, approvals, messages, realtime push and light / dark themes; testing on real devices and pre-release checks for the app stores are still in progress.
- **Security**: enabled by default — permission and data scope checks, duplicate-submit guards, rate limits, rich text sanitizing, upload file checks, SSRF protection and Excel formula injection protection; production refuses test secrets; demo mode rejects most write operations (except a few, such as signing in, switching languages and marking as read) and masks visitors' IP and browser information.
- **Deployment**: build output + nginx reverse proxy, PM2 optional; multi-instance deployment supported (cross-instance push and shared rate limits).
- **Windows**: Windows 11 with the built-in PowerShell 5.1 covers all development and checks.

Known limitations:

- No multi-tenancy yet; instant messaging and offline push for the app are planned for later releases;
- OAuth2 supports confidential clients only; public clients and OIDC are not supported yet;
- The BPMN designer supports a subset of the standard elements and converts the diagram into a tree process on publish;
- The admin console targets desktop browsers (1280 to 1920 pixels wide);
- No Docker image or docker-compose setup yet.

Changes and upgrade steps for every future release will be recorded here.
