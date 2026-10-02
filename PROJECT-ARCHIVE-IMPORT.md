# Project archive import — 2 October 2026

Imported the supplied text and images into the local CMS and static fallback for:
Madrasah / Jalan Reko, Apartment Dimensi, Hotel Ehsan / Ampang, Taman Pinggiran
Markisa, Taman Salam Nadiah, Ehsan Residence, Taman Sri Ehsan, Taman Mawar Ehsan,
Taman Universiti Bestari, Residensi Mutiara Austin and Kampar / Perak.

12 archives map to 11 records. Both Austin archives describe a 650-unit Mount
Austin development; the current Mutiara Austin copy is used, with images from
both archives. The hotel archive's heading says Seaview, but its body describes
the existing Ampang hotel; the Ampang identity is retained. The Madrasah archive
matches the existing Jalan Reko record. Kampar replaces the unsupported Taman
Seri Emas public label while keeping the existing project reference.

187 images are linked. Three lower-resolution Mawar duplicates are excluded
from display. No original archives, old media records or old image files were
deleted. Unsupported old facts, sample photos, maps, plans, certificates and
sales sections are removed from the imported project pages. No new factual
claims were added. Distances, prices and phase updates are supplied information,
not independently verified current offers.

Ehsan Widuri (`proj-15`) is excluded from the import. Its database record,
translations, media links, configuration and literal fallback record were
verified unchanged. The four records without a matching archive are unchanged.
New admin projects receive the Widuri section order without its actual content;
empty sections stay hidden. Section content and image categories are editable
in each project's Content and Images tabs.

## Recovery and repeatability

Original local database and fallback snapshots:
`/private/tmp/ehsan-project-import-2v2hK2/`.
Project snapshots are also stored as `project_archive_import` revisions in the
local database. Keep the backup folder if long-term recovery is needed; macOS
may clean temporary folders. Original supplied ZIPs remain untouched.

The import manifest is `ehsan-property-admin/scripts/project-archive-manifest.cjs`.
The importer defaults to a dry run and requires `--apply` for database changes.
Do not reapply over later admin edits without reviewing and backing them up.

Verified: all 11 public pages, admin content and draft preview, mobile preview
at 373 CSS pixels without horizontal overflow, TypeScript checks and eight
renderer/data-loading tests. No remote deployment, commit or push performed.
