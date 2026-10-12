# Smart Campus Access Control System & Distributed Microservices

Midterm project implementing a containerized microservices architecture with an API Gateway, Round-Robin Load Balancing, Role-Based Access Control (RBAC), and database persistence using Docker Compose and MongoDB.

---

## 1. Architecture & Port Mapping

| Service                           |   Port   | Description                                                         | Responsibility |
| --------------------------------- | :-------: | ------------------------------------------------------------------- | -------------- |
| **MongoDB**                 | `27017` (loopback only) | Persistent Database Layer                                           | Shared Storage |
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

## 2. Quick Start Guide for Group Members

### Step 1: Configure and Start All Services

Docker Compose uses the bundled MongoDB container by default. You do not need MongoDB Atlas credentials or AWS Academy access keys just to run the application.

Optional: copy `.env.example` to `.env` and replace `JWT_SECRET` with a long random value before sharing or deploying publicly. The built-in default is for development only.

From the project root directory, run:

```bash
docker compose up -d --build
```

### Step 2: Verify All 11 Containers

```bash
docker compose ps
docker compose logs --tail=100
```

Wait for the API Gateway and upstream services to become healthy. If a service is restarting or unhealthy, inspect it with `docker compose logs <service_name>`.
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


## 5. EC2 Deployment Notes

- Install Docker Engine and the Docker Compose plugin on the EC2 instance, then copy/clone this project.
- Run `docker compose up -d --build` from the directory containing `docker-compose.yml`.
- In the EC2 security group, allow inbound TCP `4000` only from the IPs that need the demo (or use a reverse proxy on `80/443`). Allow SSH `22` only from your trusted IP. Do not open ports `27017` or `5001`–`5015` publicly.
- Only the gateway is published on all host interfaces. MongoDB and service ports are bound to `127.0.0.1` for local diagnostics; internal service-to-service traffic uses Docker DNS names.
- Browse to `http://<EC2-PUBLIC-IP>:4000/`, not `http://localhost:4000/` on your own computer. Ensure the EC2 security group and host firewall allow the chosen gateway port.
- An AWS Academy access key is not required by this Compose application. AWS Academy temporary credentials may be needed to create/manage AWS resources via the console, CLI, or SDK. SSH access uses the EC2 key pair or another configured SSH method, not the AWS API access key.
- The default MongoDB data is stored in the named Docker volume `mongodb_data`. Back it up before deleting volumes.

## 6. Known Limits

This package can be statically checked here, but it was not possible to run a real Docker build or end-to-end container test in this environment because Docker Engine is unavailable. Verify on your machine with the commands above before submitting.
