# Smart Campus Access Control System & Distributed Microservices

Kubernetes microservices project implementing an API Gateway, round-robin load
balancing, role-based access control, and MongoDB Atlas persistence.

---

## 1. Architecture & Port Mapping

| Service                           |   Port   | Description                                                         | Responsibility |
| --------------------------------- | :-------: | ------------------------------------------------------------------- | -------------- |
| **MongoDB Atlas**           | Cloud   | Persistent Database Layer                                           | Cloud Storage |
| **API Gateway**             | `4000` | Gateway & Reverse Proxy, Round-Robin Load Balancer, Live UI Console | Common Layer   |
| **Registration Service**    | `5001` | User Account Registration & Card Provisioning                       | Common Layer   |
| **Authentication Service**  | `5002` | JWT Token Issuance & Credential Verification                        | Common Layer   |
| **Room Service**            | `5003` | Room Inventory, Capacities, & Lock State Management                 | Team Member 1  |
| **Permission Service**      | `5004` | Time-Bound & Day-Based Access Policy Grants                         | Team Member 1  |
| **Access Log - Instance 1** | `5005` | High-Concurrency Door Swipe & Audit Logging (Replica 1)             | Team Member 2  |
| **Access Log - Instance 2** | `5015` | High-Concurrency Door Swipe & Audit Logging (Replica 2)             | Team Member 2  |
| **Emergency Alert Service** | `5006` | Campus-Wide Lockdown Enforcement & Security Incident Reporting      | Team Member 2  |
| **Student Service** | `5007` | Student management | Common Layer |
| **Teacher Service** | `5008` | Teacher management | Common Layer |

---

## 2. Quick Start Guide

Follow [`final_readme.md`](./final_readme.md) for Docker Desktop Kubernetes
deployment, MongoDB Atlas configuration, and the presentation demonstration.
---

## 3. How to Test the Project

You can test the system in three different ways:

### Method A: Live Web Demonstration Console (Recommended for Demo)

Open your browser to:

```text
http://localhost:4000/
```

1. **Load Balancer Test**: Under **Door Badge Swipe & Round-Robin Load Balancer**, click **"Swipe Badge (Single)"** or **"Simulate 4x Swipes"**. Watch the requests alternate between `Instance 1` (Port 5005) and `Instance 2` (Port 5015) in real time with live header inspection (`X-Load-Balanced-By` & `X-Served-By-Instance`).
2. **Room Lock Test**: In the Room Management table, click **"Lock"** on any room. Then attempt to swipe for that room — the reader flashes red with `DOOR DEADBOLTED • Denied (ROOM_PHYSICALLY_LOCKED)`.
3. **Emergency Lockdown Test**: Click **"Activate Campus Lockdown"** in the top banner. All room doors across campus are immediately locked, and badge access is restricted.
4. **Automated Verification**: Click **"Run test.md Verification"** in the top session bar to execute all 5 test suites live with pass/fail indicators.

---

### Method B: One-Command Automated CLI Test

Run the automated test runner in your terminal:

```bash
node run_tests.js
```

This tests all 19 assertions defined in `test.md` and outputs a complete pass/fail summary in 2 seconds.

---

## 4. Kubernetes Deployment

The Kubernetes manifests are in [`k8s/`](./k8s/). They deploy all application
containers, keep the microservices private as `ClusterIP` Services, and expose
only the API Gateway. MongoDB is not deployed in Kubernetes; use the ignored
root `.env` file to create the Kubernetes Secret. The safe template is
[`k8s/02-secret.example.yaml`](./k8s/02-secret.example.yaml).

### Build and deploy locally with Minikube

```powershell
minikube start
minikube addons enable ingress
minikube docker-env | Invoke-Expression
docker build -t smart-campus/api-gateway:local ./APIGateway_Microservice
docker build -t smart-campus/registration:local ./Registration_Microservice
docker build -t smart-campus/authentication:local ./Authentication_Microservice
docker build -t smart-campus/room:local ./Room_Microservice
docker build -t smart-campus/permission:local ./Permission_Microservice
docker build -t smart-campus/access-log:local ./AccessLog_Microservice
docker build -t smart-campus/emergency:local ./EmergencyAlert_Microservice
docker build -t smart-campus/student:local ./Student_Microservice
docker build -t smart-campus/teacher:local ./Teacher_Microservice
kubectl apply -f k8s/
kubectl -n smart-campus get pods,services,ingress
```

Before applying, load the MongoDB Atlas URI from `.env` into a Kubernetes
Secret and set a long random JWT secret. The Ingress is configured for
`aupp.com` for Fanout
DNS. For a local demonstration, point `aupp.com` to the Minikube ingress IP in
your DNS provider or hosts file, then open `http://aupp.com/`.

The gateway pod mounts the `campus-shared-logs` PVC at
`/var/log/campus`. Its `gateway` container writes request logs and the
`log-reader` sidecar reads the same file, demonstrating shared access to a
Kubernetes volume:

```powershell
kubectl -n smart-campus logs deploy/api-gateway -c log-reader
```

For the complete presentation and verification sequence, see
[`final_readme.md`](./final_readme.md).
