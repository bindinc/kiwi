# GitOps with Flux v2 and Blue/Green Deployments

This repository contains the kiwi app manifests. Cluster GitOps (Flux sync, add-ons, and app pointers) lives in the config repo `bink8s-cluster-management` on GitLab.

## Repository layout (this repo)

- `infra/k8s/base/` contains the shared Kustomize base (used by cluster GitOps).
- `infra/k8s/overlays/local/` is a dev-only overlay for manual local testing.

Cluster definitions (Flux sync and add-ons) live in the config repo. The config repo points back to this repo when reconciling the kiwi app.

## Deploy to local docker-desktop

These steps assume the cluster is already bootstrapped from the config repo and the config repo includes the kiwi app pointer.

Make sure Docker Desktop Kubernetes is enabled and your context is set to `docker-desktop` (or export `KUBE_CONTEXT`).

### GitOps (Flux)

Local GitOps is owned by the config repo. Update `bink8s-cluster-management/clusters/local/apps/kiwi/patch-kiwi-local.yaml`, then reconcile.
The HTTPS routes (`https://bdc.rtvmedia.org.local/kiwi`) are also defined in that config repo.

```bash
flux reconcile kustomization kiwi --with-source
```

### Manual (scripts)

Use these only for local experiments; production add-ons should be managed in the config repo.

```bash
make addons local
make build local
make deploy local
```

Access locally:

```bash
kubectl -n kiwi port-forward service/kiwi 8080:80
```

## Deploy to production

Production deploys are managed in the config repo (`bink8s-cluster-management`).
Update the prod patch there, then reconcile Flux. Do not deploy to prod from this repo.

## Blue/green workflow

### Mental model (keep this in your head)

- There are **two Deployments**: `kiwi-blue` and `kiwi-green`.
- There are **two Services**:
  - `kiwi` → **live traffic** (points at `ACTIVE_TRACK`)
  - `kiwi-preview` → **preview traffic** (points at `PREVIEW_TRACK`)
- Switching live traffic is just **editing a config file** and letting Flux reconcile.

### Where you change things

For GitOps, edit the environment patch in the config repo:

- Local: `bink8s-cluster-management/clusters/local/apps/kiwi/patch-kiwi-local.yaml`
- Prod: `bink8s-cluster-management/clusters/prod/apps/kiwi/patch-kiwi-prod.yaml`

For manual local testing only, edit `infra/k8s/overlays/local/deploy-config.yaml`:

```yaml
data:
  APP_IMAGE_BLUE: registry.kiwi.svc.cluster.local/kiwi/portal:1.2.3
  APP_IMAGE_GREEN: registry.kiwi.svc.cluster.local/kiwi/portal:1.2.4
  ACTIVE_TRACK: blue
  PREVIEW_TRACK: green
```

### Typical rollout (safe + low stress)

1. **Pick the preview track** (usually `green`) and set its image.
   - Update `APP_IMAGE_GREEN` to the new tag.
2. **Commit and reconcile** (Flux applies it).
   - `flux reconcile kustomization kiwi --with-source`
3. **Verify the preview** service:

```bash
kubectl -n kiwi port-forward service/kiwi-preview 8081:80
```

4. **Promote** by swapping the tracks:
   - `ACTIVE_TRACK: green`
   - `PREVIEW_TRACK: blue`
5. **Optional cleanup**: set the now-preview track image to match live, or keep it ready for the next release.

### Rollback (fast)

Swap `ACTIVE_TRACK` and `PREVIEW_TRACK` back to their previous values and let Flux reconcile.

The `kiwi` Service always points at `ACTIVE_TRACK`, while `kiwi-preview` always points at `PREVIEW_TRACK`.
