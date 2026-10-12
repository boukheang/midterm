# Classroom workflow and admin directory updates

- Added an admin-only registered-user directory with role filter and search.
- Fixed API Gateway admin path rewriting so `/api/admin/users` reaches Registration service `/users`.
- Student enrollment request identity now comes from API Gateway verified JWT headers; body-supplied email is no longer trusted.
- Enrollment approval/rejection requires admin or assigned faculty identity.
- Direct admin enrollment now checks classroom capacity.
- Permission service health check uses IPv4 loopback.

## Important validation note

This project was syntax-checked and statically inspected in the build environment, but it was not run against the user's local MongoDB data or browser. Run Docker Compose and exercise the student, faculty, and admin workflows with separate accounts before deployment. Existing role naming uses `faculty` for teachers.
