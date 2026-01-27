# GitOps with Flux v2 and Blue/Green Deployments

This repository contains the kiwi app manifests. Cluster GitOps (Flux sync, add-ons, and app pointers) lives in the config repo `bink8s-cluster-management` on GitLab.

## Repository layout (this repo)

- `infra/k8s/overlays/<env>/` contains the Kustomize overlays Flux applies.

Cluster definitions (Flux sync and add-ons) live in the config repo. The config repo points back to this repo when reconciling the kiwi app.

## Deploy to local docker-desktop

These steps assume the cluster is already bootstrapped from the config repo and the config repo includes the kiwi app pointer.

Make sure Docker Desktop Kubernetes is enabled and your context is set to `docker-desktop` (or export `KUBE_CONTEXT`).

### GitOps (Flux)

1. Commit changes under `infra/k8s/overlays/local/` (for example, update `deploy-config.yaml`).
2. Let Flux reconcile automatically or run:

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

Ensure your context points at `bink8s` (or export `KUBE_CONTEXT`). Add-ons are managed in the config repo.

### GitOps (Flux)

1. Commit changes under `infra/k8s/overlays/prod/` (for example, update `deploy-config.yaml`).
2. Let Flux reconcile automatically or run:

```bash
flux reconcile kustomization kiwi --with-source
```

### Manual (scripts)

Use these only for emergencies; production add-ons should be managed in the config repo.

```bash
make addons prod
make build prod
make deploy prod
```

`make addons prod` will prompt for confirmation; for non-interactive runs use `scripts/deploy-addons.sh prod --confirm-prod`.

## Blue/green workflow

### Mental model (keep this in your head)

- There are **two Deployments**: `kiwi-blue` and `kiwi-green`.
- There are **two Services**:
  - `kiwi` → **live traffic** (points at `ACTIVE_TRACK`)
  - `kiwi-preview` → **preview traffic** (points at `PREVIEW_TRACK`)
- Switching live traffic is just **editing a config file** and letting Flux reconcile.

### Where you change things

Edit `infra/k8s/overlays/<env>/deploy-config.yaml`:

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
