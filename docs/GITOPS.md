# GitOps with Flux v2 and Blue/Green Deployments

This repository is structured for OpenGitOps with Flux v2. Cluster definitions live under `clusters/`, while application manifests stay in `infra/k8s/` and are reconciled by Flux Kustomizations.

## Repository layout

- `clusters/local/` and `clusters/prod/` define Flux sync and app reconciliation per cluster.
- `infra/k8s/overlays/<env>/` contains the Kustomize overlays Flux applies.

If you are using a fork, update the repository URL in `clusters/<env>/flux-system/gotk-sync.yaml`.

## Bootstrap Flux

Make sure the Flux CLI is installed and your cluster is reachable:

```bash
flux check --pre
```

Bootstrap Flux for the cluster you want to manage. For GitHub organization repos, Flux can create the sync manifests automatically:

```bash
export GITHUB_TOKEN=<your-token>
flux bootstrap github \
  --owner=bindinc \
  --repository=kiwi \
  --branch=main \
  --path=clusters/prod \
  --token-auth

If you have permissions to create deploy keys for the org repo, you can omit `--token-auth` to use SSH deploy keys instead.
```

Use `clusters/local` instead of `clusters/prod` when targeting a local cluster. After bootstrap, verify Flux components:

```bash
flux check
```

## Deploy to local docker-desktop

Make sure Docker Desktop Kubernetes is enabled and your context is set to `docker-desktop` (or export `KUBE_CONTEXT`).

### GitOps (Flux)

1. Commit changes under `infra/k8s/overlays/local/` (for example, update `deploy-config.yaml`).
2. Let Flux reconcile automatically or run:

```bash
flux reconcile kustomization kiwi --with-source
```

### Manual (scripts)

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

Ensure your context points at `bink8s` (or export `KUBE_CONTEXT`). Install add-ons once per cluster before deploying.

### GitOps (Flux)

1. Commit changes under `infra/k8s/overlays/prod/` (for example, update `deploy-config.yaml`).
2. Let Flux reconcile automatically or run:

```bash
flux reconcile kustomization kiwi --with-source
```

### Manual (scripts)

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

## Glossary (blue/green)

- **Blue/green**: Run two identical versions (blue + green); switch traffic by flipping a selector.
- **Active track**: The deployment receiving live traffic via the `kiwi` Service.
- **Preview track**: The deployment receiving preview traffic via the `kiwi-preview` Service.
- **Promote**: Swap `ACTIVE_TRACK` and `PREVIEW_TRACK` to move live traffic.
- **Rollback**: Swap the tracks back to the previous values.
