# Release Notes — 2025-12-18

## Highlights
- Improved admin IP monitoring with CloudFront/proxy header inspection and clearer public vs internal IP stats.
- Added best-effort access log persistence across page/API requests and enabled user-scoped IP lookup in admin tools.
- Fixed profile/user image field mapping (`users.image`) while keeping backward-compatible `image_url` responses.
- Stabilized Amplify builds by hardening server-only env loading and removing unsupported `NextRequest.ip` usage.

## Changes
### Admin / Security
- Log and display resolved client IP using CDN/proxy headers (e.g. `x-forwarded-for`, `cloudfront-viewer-address`).
- Persist access logs for admin pages and non-API page navigations.
- Store `userId` alongside access log rows (when available via session) to support user IP lookup.
- Add user IP stats and recent access logs to the admin IP monitor user search flow.

### Build / Infrastructure
- Prevent bundler issues with Node built-ins (`fs`, `path`) and avoid `node:` scheme imports during builds.
- Enforce required environment variables loaded from SSM and fail fast when missing.

### API / Data
- Fix Prisma selects to use `users.image` (mapped DB column), and normalize API responses to include `image_url` for compatibility.
- Align API request/response typing (e.g. `complete-profile` includes `name`).

## Notes
- Access logging is best-effort. Internal server-side fetches may still appear as loopback/private IPs depending on runtime behavior.
