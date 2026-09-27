# Landing page editing

Open **Website > Page builder** (`/landing`). Choose a section in the section
list, edit grouped fields, check the desktop or mobile live preview, then select
**Save changes**. Refresh the public homepage to see saved changes. Drag sections
to reorder them, or use the up/down buttons for keyboard and touch access. Hero
and Contact stay fixed at the page boundaries. Changes remain drafts until saved;
Discard restores the last saved configuration.

Page wording uses Quill rich text controls: bold, italic, underline, strike,
relative text size, foreground/background colours, alignment and clear formatting.
Values retain their existing field key; an adjacent `:format` key marks HTML.
Unchanged plain text stays plain text. The website rebuilds an allowlisted inline
formatting tree from inert HTML; scripts, event handlers, links, arbitrary CSS and
embedded media never enter the live DOM. URLs, image descriptions, statistics and
SEO metadata remain plain inputs because those fields cannot contain rich HTML.

The About statistics row uses repeatable cards, not individual fragmented text
fields. Each card has a free text value and one rich title; the title names the
card in the editor. Existing units are merged into values and existing subtitles
into titles. Add or remove up to 30 cards; removing all cards hides the row.
The website balances column counts against available width and card count, while
keeping the existing typography and responsive layout. Cards are stored together
as JSON in `about:statistics`. Existing individual statistic overrides seed the
initial cards and are retained for backwards compatibility, but hidden from the
editor once grouped cards are available. Changes are saved with the normal
Save changes action; Discard restores the previous card list.

Every homepage section has a Remove control with confirmation. Removal marks the
section as deleted in the layout, removes it from the active section list and
hides it and its related navigation links in the website preview/public page.
It does not delete underlying content records. Removed sections can be restored
from the Removed sections list. Save changes commits removals; Discard undoes
draft removals.

Section headers are grouped into one editor with an optional section label, one
rich title and one rich introduction. Add/Remove controls for each part avoid
fragmented title fields. Previous text overrides seed these grouped headings;
new edits use `<section>:heading` JSON and the existing safe rich text renderer.

Gallery uses one repeatable image list (`gallery:images`), pairing each image with
its plain description rather than separate URL and alt fields. Add images through
the media library, replace or remove individual images, and reorder with arrow
controls. Up to 30 images are distributed over the existing two carousel rows,
with presentation-only clones recreated for continuous scrolling. Empty rows and
an empty gallery are hidden. Removing an image from the gallery does not delete
the media library asset. Image paths are validated when saving. Existing image
overrides seed the initial list.

Navigation, footer, chat assistant, colours, motion and SEO belong in
**Website settings** (`/website`), not the page content editor. Projects, Events,
Awards and Testimonials each have a **Homepage section** shortcut for their
section heading and visibility. Their cards remain editable in the respective
content menu. The legacy `/content` page redirects to the page builder.

Available controls include text, links, image URLs, media library selection and
uploads, image alternative text, animated statistics, section visibility and
section position. Theme controls cover brand and readable text colours and
animation enablement. The SEO tab edits the browser title and search description.

Projects, events, awards and testimonials load published records from their
existing admin screens. Draft records are not displayed. Collection card fields
are excluded from the page builder to avoid competing editing locations. Existing
legacy overrides are preserved; new collection edits belong in their own screens.
Use **Restore original** on page fields to remove a customization.

Local preview defaults to `http://localhost:8899`. Set
`NEXT_PUBLIC_LANDING_URL` for a different website URL. The website defaults to
`http://localhost:3001` for its CMS; set `SITE.adminOrigin` in the shared registry
configuration before the homepage editor script runs when using another origin.
The preview message channel validates both origin and sending iframe.

Customizations are stored in the database as the `landing.customization` text
block. Writes require `block:update`; reads in the editor require `block:read`.
Changes are audited and prior values are retained by the existing revision
system. The public endpoint is read only. It contains only published records.
No deployment or repository push is performed by saving locally.

The original static homepage remains available if the CMS cannot be reached.
Field identities incorporate project and collection references, so reordering
records does not transfer overrides onto unrelated cards. Static fields are
scoped to their section and markup path; update their mappings when materially
restructuring that section's HTML.

## Visitor analytics

The dashboard reads real page views from `/api/analytics`, with 7, 30 and 90 day
filters, Malaysia timezone daily totals, anonymous session counts, popular pages,
referrer sources, devices and enquiries. Publishing tasks and content counts are
in **Operations > Content overview**. Tracking starts when this feature is
installed; previous traffic is unknown, not reconstructed.

`js/analytics.js` tracks website pages through the shared component mount. It
uses a sessionStorage UUID, no tracking cookies, names, IP addresses or query
strings. Do Not Track, Global Privacy Control, editor previews and known bots are
excluded. Local website visits are included during testing. Session counts are
not unique identified people. The public POST endpoint validates input, restricts
origins and limits repeated events per session.

Apply Prisma migration `20260927000100_visitor_analytics`, generate the client and
restart the admin server. Set `ANALYTICS_ALLOWED_ORIGINS` to comma separated website
origins outside localhost; by default localhost:8899 and 127.0.0.1:8899 are allowed
(or the origin configured by `NEXT_PUBLIC_LANDING_URL`). Never expose an admin
session or database credential to the public tracking script.
