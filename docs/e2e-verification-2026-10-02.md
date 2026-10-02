# End-to-end verification — 2 October 2026

Tested local public site at port 8899 and signed-in owner admin at port 3001.

## Fixed during this pass

- Homepage enquiries now submit to the real public endpoint, validate consent, show inline errors and appear in the admin inbox. Previously submission was a placeholder.
- Event registration requests now save into the same inbox, with consent and honest request-received wording. Previously they displayed success without saving.
- Event pages read the CMS instead of an older static-only feed; uploaded images resolve against the CMS origin. Event share controls have real destinations, and unavailable events cannot accept registrations.
- Admin project previews intercept the current CMS fetch, display unsaved edits and refresh after draft changes. Standalone preview tabs no longer wait indefinitely for a parent window. Preview forms are inert.
- Preview mapping includes saved project-section/enquiry settings and refreshes the project cache after settings are saved. Mobile previews cannot overflow their containing panel.
- Required name, email and message fields cannot be deleted, made optional or changed to incompatible types in the form editor. The server validates these invariants and rejects reserved field IDs.
- Footer property links now open their respective project pages. Unconfigured social/legal placeholder links were removed instead of inventing destinations.
- Project cards are keyboard accessible. Shared CMS origin resolution and asset version updates prevent stale scripts after these changes.

## Verification performed

- 130 read-only HTTP assertions passed: public feeds, archive/detail page responses, local content images, project/news social metadata, unauthenticated admin API rejection and invalid enquiry rejection.
- Browser-rendered all 16 project pages, 13 news details and 6 event pages; no loaded broken images were detected in the inspected project/news pages. About page also inspected.
- Admin smoke tests covered News, Events, Awards, Testimonials, Media, About, Page builder, Website settings, Enquiries, Content overview, Users and Activity log without displayed runtime/load failures.
- Three synthetic submissions (homepage, project, event) visibly appeared in the admin inbox. The project interest was locked to Ehsan Widuri. Verified the project record and consent in the inbox.
- Changed a project name only as an unsaved draft and verified it in preview, then restored it without saving.
- Saved a section OFF, confirmed it disappeared on the public project page, then restored the original setting.
- Mobile project preview measured 373px document width with no horizontal page overflow. Exercised the icon menu, Escape-close, Type E layout, gallery arrow/dot selection and full-size image dialog.
- Project pagination, state filtering and empty search worked. News pagination and empty search worked.
- Four contact-form schema assertions passed. Changed admin files passed targeted ESLint checks and TypeScript checks.
- Final production build passed with `npm run build -- --webpack` (57 generated pages). Default Turbopack build hit this execution environment's process/port-binding restriction; the first sandboxed attempt also could not fetch the Google font. No application build error remained in the alternate build.
- `git diff --check` passed.

## Cleanup and limits

Only the three synthetic QA enquiries were permanently removed after verification. No real enquiries or content records were deleted. Original project settings were restored. Existing workspace changes were preserved; nothing was committed, pushed or deployed.

This is not a certification that every admin mutation or production integration is correct. Destructive CRUD on real content, password changes, every permission/role combination, external social-network scrapers and a production deployment were not exercised.

Remaining launch work:

- Enquiries are saved, but transactional sales-email delivery is still a backend TODO and needs an agreed provider/recipient configuration.
- The chat assistant and some testimonial/event content are explicitly demo placeholders; they are not a live chat or verified real testimonials.
- Official social-account URLs and legal pages are not supplied. The dead footer links are hidden until real destinations exist.
- Full-repository lint still reports 33 errors and 35 warnings from pre-existing compiler/hook/type violations, including vendored animation components. Targeted changed-file lint passes; this pass did not broadly rewrite those unrelated components.
- Social preview metadata is served, but external scraper reachability and actual cards require a deployed public domain.

Repeat read-only integration checks with `node scripts/verify-public.mjs` while both servers are running. Override origins with `QA_SITE_ORIGIN` and `QA_CMS_ORIGIN` if needed.
