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

Bootstrap Flux for the cluster you want to manage. For GitHub repos, Flux can create the sync manifests automatically:

```bash
export GITHUB_TOKEN=<your-token>
flux bootstrap github \
  --owner=bindinc \
  --repository=kiwi \
  --branch=main \
  --path=clusters/prod \
  --personal
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

The active and preview tracks are defined in `infra/k8s/overlays/<env>/deploy-config.yaml`.

1. Update the preview image (default: green) by setting `APP_IMAGE_GREEN` to the new tag.
2. Commit and let Flux reconcile the change.
3. Validate the preview service:

```bash
kubectl -n kiwi port-forward service/kiwi-preview 8081:80
```

4. Promote by swapping `ACTIVE_TRACK` and `PREVIEW_TRACK`.
5. Optionally set `APP_IMAGE_BLUE` to the new tag once the cutover is complete.

The `kiwi` Service always points at `ACTIVE_TRACK`, while `kiwi-preview` points at `PREVIEW_TRACK`.
