# Smart Campus: commands to copy and paste

Run every command in a **PowerShell** terminal (VS Code: *Terminal → New Terminal*,
and check the dropdown says **powershell**, not bash). Copy one box at a time,
paste it, press Enter, and wait for it to finish before the next one.

**Before you start:** Docker Desktop is open, Kubernetes is enabled, and its
indicator is green.

---

## A. First time only

**1. Download the code**

```powershell
git clone https://github.com/boukheang/midterm.git
```

**2. Go into the project folder**

```powershell
cd midterm
```

**3. Switch to the final-project branch**

```powershell
git checkout sokhadomfinal
```

> Already have the repo? Skip steps 1–3 and run these four instead, one at a time:
>
> ```powershell
> cd midterm
> ```
> ```powershell
> git fetch origin
> ```
> ```powershell
> git checkout sokhadomfinal
> ```
> ```powershell
> git pull
> ```

**4. Use Docker Desktop's Kubernetes**

```powershell
kubectl config use-context docker-desktop
```

**5. Check Kubernetes is running** (should show one node with `Ready`)

```powershell
kubectl get nodes
```

**6. Stop the old midterm app**, if it's running (it blocks port 4000).
Run this inside the old midterm folder. "no configuration file" means nothing to stop, which is fine.

```powershell
docker compose down
```

---

## B. Deploy and open the app

**7. Deploy everything.** Pick **one** of the two options and wait for
*"Smart Campus is running."*

**Option A (recommended): download the ready-made images from Docker Hub**
(`sokhadum/smart-campus-*`, public). No building; needs internet.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -UseDockerHub -InstallMetricsServer
```

**Option B: build the images on this laptop** (5–10 minutes the first time; works offline after that)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -InstallMetricsServer
```

**8. Open the app** at **http://localhost** (it goes through the Kubernetes Ingress).
If step 7 printed *"Open the app : http://localhost"*, just open that in the browser and skip
this command. If it said the cluster doesn't publish the Ingress, run this and **don't close
it**. Log in with the **Admin** demo button.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\open-app.ps1
```

> Port 80 busy? Use this instead and open http://localhost:8080:
> ```powershell
> powershell -ExecutionPolicy Bypass -File scripts\open-app.ps1 -Port 8080
> ```

---

## C. Test it (open a **second** terminal with the **+** button)

**9. Go to the project folder in the new terminal** (skip if it already opens there)

```powershell
cd midterm
```

**10. Run the automated checks** (expect `35 PASSED, 0 FAILED`; needs Node.js)

```powershell
node run_tests.js
```

> Used port 8080 in step 8? Run this first, then step 10 again:
> ```powershell
> $env:BASE_URL="http://localhost:8080"
> ```

**Postman (optional):** in Postman click **Import**, drag in both files from the
`postman` folder, choose the **Smart Campus - Kubernetes (localhost)** environment,
and run the folders in order (1 → 9).

---

## D. Kubernetes Dashboard (open a **third** terminal)

**11. Install and open the Dashboard.** This terminal stays busy too.
Run it once **while online** before the demo. In the browser: accept the
certificate warning → choose **Token** → press **Ctrl+V** → **Sign in** →
pick the **smart-campus** namespace.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dashboard.ps1
```

---

## E. Commands for the live demo

**Show everything that is running**

```powershell
kubectl -n smart-campus get pods,svc,hpa,pvc,ingress
```

**Show the Ingress and its controller**

```powershell
kubectl -n smart-campus describe ingress campus-gateway
```

```powershell
kubectl -n ingress-nginx get pods,svc
```

**Scale the door-swipe service to 3 pods** (a third card appears in the app)

```powershell
kubectl -n smart-campus scale deploy access-log-service --replicas=3
```

**Watch pods change live** (press **Ctrl+C** to stop watching)

```powershell
kubectl -n smart-campus get pods -w
```

**Delete the door-swipe pods** (Kubernetes recreates them automatically)

```powershell
kubectl -n smart-campus delete pod -l app=access-log-service --wait=false
```

**Show the gateway's request log, read by the sidecar container**

```powershell
kubectl -n smart-campus logs deploy/api-gateway -c log-reader
```

**Show the autoscaler** (CPU % appears about a minute after deploying)

```powershell
kubectl -n smart-campus get hpa
```

**Scale back to 2 pods**

```powershell
kubectl -n smart-campus scale deploy access-log-service --replicas=2
```

---

## F. When the code changes later

**1. Get the latest code**

```powershell
git pull
```

**2. Redeploy** with the option you used in step 7

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -UseDockerHub
```

or

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
```

> **Publishing new Docker Hub images (Sokhadom only)**, after changing code.
> Must be signed in to Docker Hub as `sokhadum`. Then commit and push the
> updated `k8s/*.yaml` so everyone pulls the new version:
> ```powershell
> powershell -ExecutionPolicy Bypass -File scripts\build-images.ps1 -Registry sokhadum -Push
> ```

**3. Restart the app window:** in the terminal running `open-app.ps1`, press
**Ctrl+C**, then run it again:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\open-app.ps1
```

---

## G. After the demo: remove everything (including its data)

```powershell
kubectl delete namespace smart-campus
```

---

### If something goes wrong

**See which pods are not running**

```powershell
kubectl -n smart-campus get pods
```

**See why a pod is stuck** (replace `POD-NAME` with the name from the list above)

```powershell
kubectl -n smart-campus describe pod POD-NAME
```

**Check the admin account was created** (look for "Bootstrap admin account created")

```powershell
kubectl -n smart-campus logs deploy/registration-service
```

**Redeploy the last local build without rebuilding** (faster)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -SkipBuild
```

More help: [`final_readme.md`](final_readme.md).
