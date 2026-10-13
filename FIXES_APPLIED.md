# Fixes Applied for Local Docker and EC2

## Configuration and reliability
- Changed the default database URI from the hard-coded MongoDB Atlas connection to the Compose service name: `mongodb://mongodb:27017/smart_campus_access_db`.
- Removed the exposed Atlas credential and the hard-coded JWT secret from tracked source/configuration text. The original Atlas credential must still be rotated in Atlas because it was present in the uploaded archive.
- Sanitized per-service `.env` files and updated each service `.dockerignore` to exclude `.env` files from image build contexts.
- Added root `.env.example` for optional configuration; no AWS credentials are required by the application itself.
- Added MongoDB connection retry logic and removed database URI logging from all database connection modules.
- Fixed the Student Compose health check to use port `5007` and the second Access Log replica health check to use port `5015`.
- Made services wait for a healthy MongoDB container; made the API Gateway wait for healthy upstream services.
- Bound MongoDB and backend host ports to loopback by default. Only the API Gateway is published publicly on port `4000`.
- Replaced the hard-coded JWT fallback in the gateway and authentication service with an explicitly development-only fallback. Configure `JWT_SECRET` to a strong random value before public deployment.
- Updated the README for the actual 11-container architecture and added EC2 deployment notes.

## Validation performed
- Parsed `docker-compose.yml` as YAML and verified that it defines 11 services.
- Checked the Student and Access Log replica health-check ports.
- Parsed all `package.json` files as JSON.
- Ran `node --check` on all JavaScript files successfully.

## Not yet verified
Docker Engine was not available in the editing environment, so image builds and the full runtime/API test suite could not be executed here. Run `docker compose up -d --build`, `docker compose ps`, `docker compose logs --tail=100`, and `node run_tests.js` on a machine with Docker installed.
