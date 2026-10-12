# Merged UI + Microservices notes

This build combines the newer dashboard UI from `midterm-main (2).zip` with the Student and Teacher microservices and Docker Compose configuration from `midterm-main.zip`.

## Added UI integration
- Student accounts can view/update their own profile and see active room permissions via `/api/students/user_info`, `/api/students/update_info`, and `/api/students/room_schedule`.
- Faculty accounts can view/update their own profile and see active room permissions via `/api/teachers/user_info`, `/api/teachers/update_info`, and `/api/teachers/room_schedule`.
- Profile controls are role-gated in the UI and the API Gateway/service still enforce authorization.

## Important
- No `.env` files or `.git` directory from the newer ZIP are included, to avoid shipping local credentials/history. Configure secrets in your local `.env` file using `.env.example` as a template.
- Test all routes and account roles locally before deploying. This merge has static validation but has not been executed in a live browser session here.
