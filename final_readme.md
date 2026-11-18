# Smart Campus Access Control — Final Project (Kubernetes)

Microservices for smart-campus door access, deployed on Kubernetes. Every
request enters through the **API Gateway**, which verifies the JWT, enforces
role-based access control and load-balances door swipes across the Access Log pods.

## Architecture

| Component | Kubernetes object | Port | Purpose |
|---|---|---:|---|
| API Gateway | Deployment + `LoadBalancer` Service | 4000 | Only entry point, JWT + RBAC, round-robin LB, dashboard UI |
| Registration | Deployment + `ClusterIP` | 5001 | Sign-up, admin user management, bootstrap admin |
| Authentication | Deployment + `ClusterIP` | 5002 | Login, JWT issuing |
| Room | Deployment + `ClusterIP` | 5003 | Rooms, locks, classroom enrollment |
| Permission | Deployment + `ClusterIP` | 5004 | Time/day-based access grants (admin) |
| Access Log | Deployment (**2–5 replicas, HPA**) + `ClusterIP` + headless Service | 5005 | Door swipe decisions + audit log |
| Emergency | Deployment + `ClusterIP` | 5006 | Lockdowns and incident reports |
| Student | Deployment + `ClusterIP` | 5007 | Student profile & schedule |
| Teacher | Deployment + `ClusterIP` | 5008 | Teacher profile & schedule |
| MongoDB | StatefulSet + PersistentVolume | 27017 | Database (inside the cluster) |

Code shared by the services lives in [`shared/`](shared/) (DB connection, health
probes, identity/role checks, shared models, permission time-window rules, and
the Student/Teacher portal routes), so the same logic is not copy-pasted into
each service.

Kubernetes manifests are in [`k8s/`](k8s/):

| File | What it creates |
|---|---|
| `00-namespace.yaml` | `smart-campus` namespace |
| `01-config.yaml` | ConfigMap with service URLs |
| `02-secret.example.yaml` | Example only — the deploy script creates the real Secret |
| `03-storage.yaml` | PVC shared by the gateway and its log-reader sidecar |
| `04-mongodb.yaml` | MongoDB StatefulSet with persistent storage |
| `10-services.yaml` | Internal Services + headless Service for the Access Log pods |
| `20-deployments.yaml` | The 8 backend Deployments (probes, resource limits, non-root) |
| `21-gateway.yaml` | API Gateway Deployment, sidecar, `LoadBalancer` Service |
| `25-autoscaling.yaml` | HorizontalPodAutoscaler + PodDisruptionBudget for Access Log |
| `30-network-policy.yaml` | NetworkPolicies: only the gateway can reach the services, only services can reach MongoDB |
| `optional/ingress.yaml` | Ingress for `smartcampus.local` (only if an ingress controller is installed) |
| `dashboard/dashboard-admin.yaml` | Login account for the Kubernetes Dashboard |

## Deploy on the demo laptop (Windows + Docker Desktop)

1. **Docker Desktop → Settings → Kubernetes → Enable Kubernetes → Apply & Restart.**
   Wait until the Kubernetes indicator is green.
2. Open PowerShell in the project folder and check the cluster:

   ```powershell
   kubectl config use-context docker-desktop
   kubectl get nodes
   ```

3. Build all images, load them into the cluster and deploy everything:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -InstallMetricsServer
   ```

   This script:
   - builds all 9 images from the repository root (so `shared/` is included);
   - **loads every image into the cluster**, including `mongo` and `busybox`.
     Docker Desktop's newer kind-based Kubernetes can't see images built with
     `docker build`, so without this step every pod fails with `ErrImageNeverPull`/`ErrImagePull`;
   - creates the `campus-secrets` Secret with a random JWT key and the admin account;
   - applies all manifests and waits until every pod is ready.

4. Open **http://localhost:4000**. The script tells you which way works on that laptop:
   - Docker Desktop in *kubeadm* mode publishes the gateway on localhost:4000 directly.
   - Docker Desktop in *kind* mode (node name `desktop-control-plane`) and minikube don't.
     Run this and keep the window open:
     ```powershell
     powershell -ExecutionPolicy Bypass -File scripts\open-app.ps1
     ```

   Log in with the **Admin** quick button (`admin@campus.edu` / `Password123!`, set by `-AdminPassword`).

> If port 4000 is already in use (e.g. an old `docker compose` stack of the midterm),
> stop it with `docker compose down`, or run `scripts\open-app.ps1 -Port 8080` and open http://localhost:8080.

After a code change, just run `scripts\deploy.ps1` again. Each build gets a unique
image tag (e.g. `build-20261118-0130`), so Kubernetes always rolls out the code you
just built. With a plain `:local` tag, a node that already has that tag would keep
running the old image. If you used `scripts\open-app.ps1`, restart it after a redeploy
(a port-forward is tied to the pod that existed when it started).

### minikube instead of Docker Desktop

```powershell
minikube start
kubectl config use-context minikube
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -InstallMetricsServer
kubectl -n smart-campus port-forward svc/api-gateway 4000:4000
```

## Kubernetes Dashboard (web UI)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dashboard.ps1
```

The script installs the official Kubernetes Dashboard, copies a login token to the
clipboard and opens **https://localhost:8443**. Accept the certificate warning,
choose **Token**, paste with Ctrl+V and sign in, then select the **smart-campus**
namespace. Keep that PowerShell window open during the demo.

What to show in the Dashboard:
- **Workloads → Deployments**: all services green; scale `access-log-service` live.
- **Pods**: click a pod → logs (e.g. MongoDB connection, swipe decisions).
- **Services**: only `api-gateway` is `LoadBalancer`, everything else is internal.
- **Config and Storage**: ConfigMap, Secret (values hidden), PVCs.
- With `-InstallMetricsServer`, CPU/memory graphs and the HPA status appear.

The Dashboard and metrics-server images are downloaded from the internet on first
use, so run `scripts\dashboard.ps1` once **before** the presentation while online.

## Demo script

1. **Cluster overview**
   ```powershell
   kubectl -n smart-campus get pods,svc,hpa,pvc
   ```
   Only `api-gateway` is exposed; all other Services are `ClusterIP`.
2. **Login & RBAC**: log in as admin, faculty, student (quick buttons). Each role sees
   different panels. Public sign-up only offers Student/Faculty. Admins come from the Secret.
3. **Round-robin load balancing**: click *Swipe 4 times*. The panel shows each
   Access Log **pod name** taking turns (`X-Served-By-Instance` header).
4. **Scale live**: `kubectl -n smart-campus scale deploy access-log-service --replicas=3`
   (or use the Dashboard). Within ~5 seconds the gateway discovers the new pod
   through the headless Service and it appears in the panel. No restart needed.
5. **Self-healing**: `kubectl -n smart-campus delete pod -l app=access-log-service --wait=false`
   and watch Kubernetes recreate the pods while swipes keep working.
6. **Classroom access**: admin assigns a teacher and enrolls a student. The enrolled
   student's swipe is GRANTED, while a non-enrolled student gets `STUDENT_NOT_ENROLLED_IN_CLASS`.
7. **Emergency lockdown**: admin activates lockdown → every swipe DENIED → lift it.
8. **Shared volume (sidecar)**:
   ```powershell
   kubectl -n smart-campus logs deploy/api-gateway -c log-reader
   ```
9. **Automated checks**: *Run system checks* in the UI, or
   ```powershell
   node run_tests.js
   ```

## Testing with Postman

Import both files from [`postman/`](postman/) into Postman:
`SmartCampus-Final.postman_collection.json` and `SmartCampus-Kubernetes.postman_environment.json`.
Select the **Smart Campus - Kubernetes (localhost)** environment, then run the folders
**in order** (or use *Run collection*). The first request creates fresh test users and a
room, tokens are saved automatically, and folder 9 deletes everything again.

| Folder | Owner |
|---|---|
| 1. Registration · 2. Authentication · 5. Access Log | Boukheang |
| 3. Room & Enrollment · 4. Student & Teacher portals | Panhavan |
| 6. API Gateway · 7. Permission · 8. Emergency Alert | Sokhadom |

Every request has tests, so the **Test Results** tab shows PASS for each check.
If the app runs on another port, change `baseUrl` in the environment.

## Security model

- The gateway **removes any `X-User-*` headers sent by clients** and sets them only
  from a verified JWT, so callers can't impersonate an admin with a header.
- Every service re-checks the role itself (defence in depth).
- NetworkPolicies block pod-to-pod traffic except gateway → services → MongoDB, so even a
  pod inside the cluster can't call a service directly with forged headers.
- Public registration can create only `student`/`faculty`. Admin accounts are created
  by an existing admin or bootstrapped from the Secret.
- Students/faculty always swipe as themselves; only admins can simulate another user's swipe.
- Students can read only their own access history.
- The gateway and authentication service refuse to start without a 32+ character `JWT_SECRET`.
- User input used in database searches is escaped (no regex injection).
- Containers run as non-root with CPU/memory limits.

## Useful commands

```powershell
kubectl -n smart-campus get pods -w                              # watch pods
kubectl -n smart-campus logs deploy/api-gateway -c gateway       # gateway logs
kubectl -n smart-campus logs -l app=access-log-service --prefix  # all Access Log pods
kubectl -n smart-campus describe hpa access-log-service          # autoscaler status
kubectl delete namespace smart-campus                            # remove everything
```
