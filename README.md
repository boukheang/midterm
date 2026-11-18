# Smart Campus Access Control System

Kubernetes microservices project: API Gateway with JWT authentication and
role-based access control, round-robin load balancing across autoscaled Access
Log pods, classroom-based door access, emergency lockdown, and MongoDB persistence.

**Deployment and demo guide: [`final_readme.md`](final_readme.md)**

Quick start (Windows, Docker Desktop with Kubernetes enabled):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -InstallMetricsServer
```

Then open http://localhost (served through the Kubernetes Ingress). For the Kubernetes Dashboard:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dashboard.ps1
```

## Services

| Service | Port | Responsibility |
|---|:---:|---|
| API Gateway | 4000 | Entry point, JWT + RBAC, round-robin load balancer, web console |
| Registration | 5001 | Sign-up, admin user management |
| Authentication | 5002 | Login, JWT issuing |
| Room | 5003 | Rooms, locks, classroom enrollment |
| Permission | 5004 | Time/day-based room access grants |
| Access Log | 5005 | Door swipe decisions and audit log (2–5 pods) |
| Emergency Alert | 5006 | Lockdowns and incident reports |
| Student | 5007 | Student profile and room schedule |
| Teacher | 5008 | Teacher profile and room schedule |
| MongoDB | 27017 | Database (StatefulSet in the cluster) |

## Repository layout

```text
APIGateway_Microservice/   gateway, load balancer, web console (public/index.html)
*_Microservice/            one folder per backend service
shared/                    code shared by the services (DB, health, auth, models, rules)
k8s/                       Kubernetes manifests
scripts/                   build-images.ps1, deploy.ps1, dashboard.ps1
run_tests.js               automated end-to-end checks (node run_tests.js)
test.md                    manual test cases
```

Images are built from the **repository root** so they can include `shared/`:

```powershell
docker build -f Room_Microservice/Dockerfile -t smart-campus/room:local .
```
