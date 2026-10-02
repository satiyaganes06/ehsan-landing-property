# Project and news sharing

Each published detail page has Share and Copy link controls. They share the public, server-rendered URL `/api/public/share/project/{reference}` or `/api/public/share/news/{id}`, not the JavaScript-only static detail URL. This endpoint includes Open Graph and X large-image-card metadata in the initial HTML and sends visitors to the corresponding detail page. Unpublished, archived, future news and unknown records return 404.

Previews use the dedicated thumbnail, with the first project hero/gallery image or news image as fallback. The server returns current published copy and absolute image URLs. Browser-generated tags alone are not relied upon for crawlers.

For deployment:

- Set the admin's `NEXT_PUBLIC_LANDING_URL` to the public website root (including any base path).
- Set `window.EHSAN_CMS_ORIGIN` before page scripts run on the static site to the public admin/CMS origin. This also configures the Share and Copy link URLs.
- Both the share endpoints and images must be publicly reachable over HTTPS without authentication.
- Verify the deployed links using the social platforms' preview tools. Localhost is inaccessible to external crawlers, and each platform controls its crop, caching and presentation.

No social post is sent automatically; the visitor chooses a destination through the device share sheet or the platform links.
