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
