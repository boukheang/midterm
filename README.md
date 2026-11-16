# Smart Campus Access Control System & Distributed Microservices

Midterm project implementing a containerized microservices architecture with an API Gateway, Round-Robin Load Balancing, Role-Based Access Control (RBAC), and database persistence using Docker Compose and MongoDB.

---

## 1. Architecture & Port Mapping

| Service                           |   Port   | Description                                                         | Responsibility |
| --------------------------------- | :-------: | ------------------------------------------------------------------- | -------------- |
| **MongoDB**                 | `27017` | Persistent Database Layer                                           | Shared Storage |
| **API Gateway**             | `4000` | Gateway & Reverse Proxy, Round-Robin Load Balancer, Live UI Console | Common Layer   |
| **Registration Service**    | `5001` | User Account Registration & Card Provisioning                       | Common Layer   |
| **Authentication Service**  | `5002` | JWT Token Issuance & Credential Verification                        | Common Layer   |
| **Room Service**            | `5003` | Room Inventory, Capacities, & Lock State Management                 | Team Member 1  |
| **Permission Service**      | `5004` | Time-Bound & Day-Based Access Policy Grants                         | Team Member 1  |
| **Access Log - Instance 1** | `5005` | High-Concurrency Door Swipe & Audit Logging (Replica 1)             | Team Member 2  |
| **Access Log - Instance 2** | `5015` | High-Concurrency Door Swipe & Audit Logging (Replica 2)             | Team Member 2  |
| **Emergency Alert Service** | `5006` | Campus-Wide Lockdown Enforcement & Security Incident Reporting      | Team Member 2  |

---

## 2. Quick Start Guide for Group Members

### Step 1: Start All Services

From the project root directory, run:

```powershell
$env:MONGO_URI = "mongodb+srv://<user>:<password>@<cluster>.mongodb.net/UserData"
docker compose up -d
```

*(On Windows, if your terminal prompts to pick an app for Docker, run `docker.exe compose up -d`)*.

### Step 2: Verify All 9 Containers are Healthy

```bash
docker compose ps
```

All 9 containers should show `Up` and `(healthy)`.

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

### Method C: Manual Postman Testing (For Screenshots)

Refer to **[`test.md`](./test.md)** for the complete list of endpoints, JSON payloads, expected status codes, and headers required for assignment submission:

1. `POST /reg` (Registration)
2. `POST /login` (Login & JWT issuance)
3. `POST /api/rooms` (Room creation with Bearer token)
4. Negative Cases (Wrong password, missing token, tampered token, unauthorized student role)
5. `POST /api/logs/swipe` (Door swipe & round-robin load balancing verification)

---

## 4. Useful Docker Commands

- **Stop all services**:
  ```bash
  docker compose down
  ```
- **View live logs of a specific service**:
  ```bash
  docker compose logs -f api_gateway
  docker compose logs -f accesslog_service_1 accesslog_service_2
  ```
- **Rebuild after making code changes**:
  ```bash
  docker compose up -d --build
  ```

## 5. Kubernetes / Minikube Deployment

The Kubernetes manifests are in [`k8s/`](./k8s/). They deploy all application
containers, keep the microservices private as `ClusterIP` Services, and expose
only the API Gateway. MongoDB is not deployed in Kubernetes; use a MongoDB
Atlas connection string in [`k8s/02-secret.yaml`](./k8s/02-secret.yaml).

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

Before applying, replace the two placeholder values in
[`k8s/02-secret.yaml`](./k8s/02-secret.yaml) with a MongoDB Atlas URI and a
long random JWT secret. The Ingress is configured for `aupp.com` for Fanout
DNS. For a local demonstration, point `aupp.com` to the Minikube ingress IP in
your DNS provider or hosts file, then open `http://aupp.com/`.

The gateway pod mounts the `campus-shared-logs` PVC at
`/var/log/campus`. Its `gateway` container writes request logs and the
`log-reader` sidecar reads the same file, demonstrating shared access to a
Kubernetes volume:

```powershell
kubectl -n smart-campus logs deploy/api-gateway -c log-reader
```
