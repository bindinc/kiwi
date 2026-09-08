# Display the deployed release version

Kiwi displays the version embedded in its container image. The header uses the
Twig `app_version` global, which reads `APP_VERSION`; it has no translation key.
Changing the interface language therefore leaves the version unchanged.

Pushing a `v*` tag triggers `.github/workflows/build-image.yaml`. That workflow
passes the exact tag name as the `APP_VERSION` Docker build argument. The shared
runtime stage stores it as an environment variable inherited by both build and
final runtime stages. No Git checkout or GitHub request is needed at runtime.
Each image keeps its own version through preview promotion and rollback.

Build a local production image with an explicit version:

```bash
docker build --target prod --build-arg APP_VERSION=v9.8.7-local \
  -t kiwi-version-check:local -f infra/docker/app/Dockerfile .
```

Builds without that argument and local checkouts without `APP_VERSION` display
`dev`. Do not override `APP_VERSION` in deployment manifests: the image supplies
the release identity automatically.

Existing release images retain their original behavior. This automation takes
effect in the next release containing the change; existing Git tags and published
images do not need to be replaced. Changelog release notes remain a separate
release-maintenance task.
