# Smart Campus Access Control System

## Presentation Deployment Guide

This project is a Kubernetes-based microservices system for smart-campus
access control. All client requests pass through the API Gateway. The
microservices use MongoDB Atlas; no database container is deployed.

## Architecture

| Component | Kubernetes access | Port | Purpose |
|---|---|---:|---|
| API Gateway | `LoadBalancer` | 4000 | Only client entry point |
| Registration Service | `ClusterIP` | 5001 | User registration |
| Authentication Service | `ClusterIP` | 5002 | Login and JWT tokens |
| Room Service | `ClusterIP` | 5003 | Room and lock management |
| Permission Service | `ClusterIP` | 5004 | Access permissions |
| Access Log Service 1 | `ClusterIP` | 5005 | Door swipe logging |
| Access Log Service 2 | `ClusterIP` | 5015 | Load-balanced log replica |
| Emergency Service | `ClusterIP` | 5006 | Lockdown and incident reports |
| Student Service | `ClusterIP` | 5007 | Student management |
| Teacher Service | `ClusterIP` | 5008 | Teacher management |
| MongoDB Atlas | Cloud database | - | Persistent application data |

Kubernetes manifests are in [`k8s/`](D:/Agent/cld/midterm/k8s).

## Database Configuration

The local `.env` file contains the MongoDB Atlas connection string. It is
ignored by Git and must never be committed or shared.

For Kubernetes, create the cluster Secret from `.env` and add a JWT secret:

```powershell
kubectl -n smart-campus create secret generic campus-secrets `
  --from-env-file=.env `
  --from-literal=JWT_SECRET="replace-with-a-long-random-secret" `
  --dry-run=client -o yaml | kubectl apply -f -
```

[`k8s/02-secret.example.yaml`](D:/Agent/cld/midterm/k8s/02-secret.example.yaml)
documents the Secret shape, but should not be applied with placeholder values.

## Docker Desktop Kubernetes Deployment

Enable Kubernetes in **Docker Desktop → Settings → Kubernetes**, then click
**Apply & Restart**.

Verify the cluster:

```powershell
kubectl config use-context docker-desktop
kubectl get nodes
```

Build the local images:

```powershell
docker build -t smart-campus/api-gateway:local .\APIGateway_Microservice
docker build -t smart-campus/registration:local .\Registration_Microservice
docker build -t smart-campus/authentication:local .\Authentication_Microservice
docker build -t smart-campus/room:local .\Room_Microservice
docker build -t smart-campus/permission:local .\Permission_Microservice
docker build -t smart-campus/access-log:local .\AccessLog_Microservice
docker build -t smart-campus/emergency:local .\EmergencyAlert_Microservice
docker build -t smart-campus/student:local .\Student_Microservice
docker build -t smart-campus/teacher:local .\Teacher_Microservice
```

Apply the resources except the placeholder Secret:

```powershell
kubectl apply -f .\k8s\00-namespace.yaml
kubectl apply -f .\k8s\01-config.yaml
kubectl apply -f .\k8s\03-storage.yaml
kubectl apply -f .\k8s\10-services.yaml
kubectl apply -f .\k8s\20-deployments.yaml
kubectl apply -f .\k8s\21-gateway-deployment.yaml
kubectl apply -f .\k8s\30-ingress.yaml
```

Then create the Secret from `.env` using the command above. Check the
deployment:

```powershell
kubectl -n smart-campus get pods
kubectl -n smart-campus get services
kubectl -n smart-campus get pvc
kubectl -n smart-campus get ingress
```

All pods should be `Running`. The API Gateway should be `2/2` because it
contains the gateway container and a shared-volume log-reader sidecar.

## Local Presentation Access

For a reliable local demonstration, forward the gateway port:

```powershell
kubectl -n smart-campus port-forward service/api-gateway 4000:4000
```

Open:

```text
http://localhost:4000/
```

To demonstrate the domain name locally, open
`C:\Windows\System32\drivers\etc\hosts` as Administrator and add:

```text
127.0.0.1 aupp.com
```

Then browse to:

```text
http://aupp.com:4000/
```

This is local hosts-file DNS. Real Fanout DNS requires a publicly reachable
server or load balancer IP. The Ingress host is already configured as
`aupp.com` in [`k8s/30-ingress.yaml`](D:/Agent/cld/midterm/k8s/30-ingress.yaml).

## Recommended Demonstration Sequence

### 1. Show Kubernetes resources

```powershell
kubectl -n smart-campus get pods,services,pvc,ingress
```

Explain that only `api-gateway` is externally exposed. All other services are
`ClusterIP` services and can only be reached inside the cluster.

### 2. Show the API Gateway

Open the dashboard at `http://localhost:4000/` and show:

- Gateway health
- Service routing
- Room inventory
- Door swipe controls
- Emergency lockdown controls

The gateway implementation is in
[`APIGateway_Microservice/api-gateway.js`](D:/Agent/cld/midterm/APIGateway_Microservice/api-gateway.js).

### 3. Demonstrate registration and login

Register a user through `POST /reg`, then login through `POST /login`.
Explain that the gateway forwards both requests to internal services and that
login returns a JWT token.

### 4. Demonstrate authorization

Use the JWT to:

1. Create or view a room.
2. Lock a room.
3. Attempt a protected operation with a missing or invalid token.
4. Show the `401` or `403` response.

### 5. Demonstrate round-robin load balancing

Use `POST /api/logs/swipe` several times. Show that the response headers
alternate between:

```text
X-Served-By-Instance: AccessLog-Instance-1
X-Served-By-Instance: AccessLog-Instance-2
```

The gateway balances requests between the two access-log services.

### 6. Demonstrate emergency lockdown

Activate campus lockdown as an administrator, perform a door swipe, and show
that access is denied. Lift the lockdown and repeat the swipe.

### 7. Prove MongoDB Atlas connectivity

```powershell
kubectl -n smart-campus logs deployment/registration-service
kubectl -n smart-campus logs deployment/access-log-service-1
```

Show the successful MongoDB connection messages. Explain that MongoDB is
cloud-hosted rather than running in Docker.

### 8. Prove shared Kubernetes volume access

```powershell
kubectl -n smart-campus logs deployment/api-gateway -c log-reader
```

The gateway container writes request logs to `/var/log/campus/gateway.log`.
The `log-reader` sidecar reads the same file through the
`campus-shared-logs` PVC. This demonstrates shared data access by multiple
containers.

## Useful Commands

```powershell
# Gateway health
curl.exe http://localhost:4000/health

# Watch pods
kubectl -n smart-campus get pods -w

# Gateway logs
kubectl -n smart-campus logs deployment/api-gateway -c gateway

# Shared log-reader output
kubectl -n smart-campus logs deployment/api-gateway -c log-reader

# Stop the local port-forward
# Press Ctrl+C in the port-forward terminal
```

The detailed endpoint and expected-response checks are in
[`test.md`](D:/Agent/cld/midterm/test.md).
