# qiwu-docs — agent rules (Claude Code & Codex)

This is the public VitePress documentation repository for 栖梧 / Qiwu. `AGENTS.md` is the single rule source; `CLAUDE.md` only imports it with `@AGENTS.md`.

## Repository boundary

- This repository contains public documentation, examples, navigation, theme code, and the documentation site configuration. Application code belongs in the public `qiwu-vue-admin` repository.
- Link to `https://github.com/732124645/qiwu-vue-admin` and `https://qiwuadmin.com`. Never publish private repository URLs, local filesystem paths, internal plans, review records, secrets, or unpublished implementation notes.
- The application repository and this documentation repository have separate histories and release flows. Do not copy private planning files, internal agent instructions, review records, or deployment notes into a public page.

## Session protocol

- `AGENTS.md` is the only editable rule body. Keep `CLAUDE.md` exactly `@AGENTS.md`; do not create a second GPT/Codex rule file.

1. Read this file, then the target page, its navigation entry, and the relevant VitePress config or theme component before editing.
2. Make the smallest content or configuration change that fixes the requested page. Keep Chinese pages under the root and translated pages under `en/`.
3. Check every version, feature, command, screenshot, and source link against the current public release and public repository. Do not turn an unverified report into a product claim.
4. Run `pnpm rules:check`, `pnpm build`, and `git diff --check` after edits. Use `pnpm dev` or `pnpm preview` only as an interactive, user-stopped process; never leave a server running from a shell call.

## Content rules

- Keep the public value proposition factual: explain what the template does, who it is for, and how to try it.
- Product versions come from the public repository tag and `CHANGELOG.md`. Keep `changelog.md`, release links, code snippets, and upgrade instructions aligned; the docs repository itself has no product release tags.
- Preserve the existing VitePress conventions: frontmatter, clean URLs, sidebar ownership, language alternates, heading anchors, Mermaid, code-group syntax, and lazy-loaded public assets.
- Keep `AGENTS.md` and `CLAUDE.md` excluded in `.vitepress/config.mts`; they guide contributors but are not site content or LLM documentation.
- Use accessible headings, link text, image alt text, and code blocks. Do not put credentials or real personal data in examples or screenshots.
- When a page describes security, deployment, tenancy, or a limitation, state the boundary and the version it applies to. Do not promise capacity, uptime, or external-service validation without current evidence.

## Commands and files

- `pnpm i --frozen-lockfile` installs the exact documentation dependencies.
- `pnpm rules:check` confirms that Claude Code and GPT/Codex use the same rule body.
- `pnpm build` is the required documentation check; its output is `.vitepress/dist` and is ignored by Git.
- `pnpm dev` starts the local VitePress editor and `pnpm preview` serves a built site for manual review.
- Content lives in `guide/`, `beginner/`, `backend/`, `core/`, `features/`, `reference/`, `java/`, and `en/`; site navigation and metadata live in `.vitepress/`.

## Commits

Use a short Conventional Commit such as `docs(guide): clarify first run`. Do not commit `.vitepress/dist`, local credentials, screenshots containing personal data, or generated cache files.

## Definition of done

The requested page or configuration is correct in both affected languages, links and anchors resolve, public/private boundaries remain intact, `pnpm build` passes, and `git diff --check` is clean.
