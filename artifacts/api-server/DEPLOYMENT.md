# Deployment

Vercel project root is `artifacts/api-server`.

The frontend build is generated from `artifacts/lab-booking`, but Vercel's
affected-project detection may only trigger when files inside this project root
change.

Frontend account-management changes should include a small project-root change
when the Vercel project is configured with this directory as its root.

Frontend infortunistica changes also need this root marker updated for Vercel's
affected-project detection.

Latest infortunistica editability changes are reflected here so Vercel rebuilds
the API-root project when the frontend admin bundle changes.

Latest infortunistica certificate export and menu placement changes are also
reflected here for Vercel affected-project detection.

Latest doctor price-list searchable dropdown changes are reflected here so the
API-root Vercel project rebuilds with the updated frontend bundle.

Latest Supabase Storage certificate upload routes and frontend integration are
reflected here for the same Vercel affected-project detection.

Latest lawyer-only infortunistica account access changes are reflected here so
the API-root deployment rebuilds the admin frontend.

Latest active-only infortunistica practice filtering and delete-practice actions
are reflected here for Vercel affected-project detection.

Latest patient registry cache invalidation fixes are reflected here so new
patients appear immediately after saving in the admin frontend.

Latest infortunistica printable procura alle liti PDF generation is reflected
here for Vercel affected-project detection.

Latest API JSON body limit update prevents admin settings saves from failing
when doctor price lists grow beyond the default Express payload size.

Latest CSV import compatibility and admin-settings error-detail changes are
reflected here for Vercel affected-project detection.

Latest patient bulk import diagnostics and chunked upload changes are reflected
here for Vercel affected-project detection.
