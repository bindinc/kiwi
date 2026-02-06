[![Release](https://img.shields.io/github/v/release/bindinc/kiwi?sort=semver)](https://github.com/bindinc/kiwi/releases)
[![Version](https://img.shields.io/github/v/tag/bindinc/kiwi?sort=semver)](https://github.com/bindinc/kiwi/tags)
[![Last commit](https://img.shields.io/github/last-commit/bindinc/kiwi?display_timestamp=committer)](https://github.com/bindinc/kiwi/commits)
[![Release date](https://img.shields.io/github/release-date/bindinc/kiwi?display_date=published_at)](https://github.com/bindinc/kiwi/releases)

# Customer Service Portal - Magazine Subscriptions

A modern, lightweight web interface for customer service agents to manage magazine subscriptions.

## Features

### Demo secret panel

- press ']' 4 times when running the demo in the browser to open the secret configuration panel to mimic call queues etc.

### Customer Search
- Search by first and last name
- Search by postal code and house number
- **Enter key** for quick search
- Direct access to customer data

### Create New Subscription
- Complete customer registration during a call
- **Automatic prefill** of customer data for existing customers
- Magazine choices: Avrobode, Mikrogids, Ncrvgids
- **Flexible subscription duration and payment options:**
  - Annual payments: 1, 2 (5% discount), or 3 years (10% discount)
  - Monthly payments: 1, 2, or 3 years
  - Transparent price display
- Add extra subscriptions for existing customers
- Immediate start date configuration

### Manage Data
- Edit customer details
- **Full subscription editing:**
  - Change magazine type
  - Adjust duration and payment frequency
  - Manage status (active/paused/cancelled)
  - Modify start date
- Process address changes
- Changes are logged automatically

### Contact History
- Vertical timeline with all contact moments
- Accordion view for detailed information
- Automatic logging of all actions

### Send Magazine
- Manually resend the latest issue
- Record the reason (not received, damaged, etc.)
- Automatic logging in contact history

### Winback Flow
- Structured cancellation flow with scripts
- Reason analysis for cancellation
- Personalized winback offers:
  - Price-related: discount offers
  - Content-related: upgrades and extra content
  - Delivery-related: premium service
  - General: flexible terms
- Result tracking (accepted/declined)

## Installation & Usage

- Renders `app/templates/base/index.html` through Flask (Jinja2) so `url_for('static', ...)` resolves.
- Static assets live under `app/static/assets`.

## Local OIDC dev (Docker Compose)

Use this flow when you only have access to this repo and need the HTTPS base URL
`https://bdc.rtvmedia.org.local/kiwi` for OIDC integration.

1. Ensure your hosts file includes `127.0.0.1 bdc.rtvmedia.org.local`. 

   On Windows 11, open Notepad as Administrator (right-click → Run as administrator), then open `C:\Windows\System32\drivers\etc\hosts` and add the line `127.0.0.1 bdc.rtvmedia.org.local`.

   On Linux/macOS, open a terminal and run:
   ```bash
   sudo nano /etc/hosts
   ```
   Add the line `127.0.0.1 bdc.rtvmedia.org.local`, then save with `Ctrl+O`, `Enter`, and exit with `Ctrl+X`.

2. Create your local OIDC secrets file:

   ```bash
   cp client_secrets.example.json client_secrets.json
   ```

   Update `client_secrets.json` with your Azure tenant ID, client ID, and client secret.
   Local Docker Compose reads this file from `/workspace/client_secrets.json` inside the container,
   so it is not baked into the image.

3. Start the local stack (it will generate local TLS certs on first run):

   ```bash
   make compose-up
   ```

   Startup now runs a preflight check and fails fast with clear instructions when
   `client_secrets.json` is missing, empty, or accidentally created as a directory.

4. Trust the generated cert in your OS/browser (located at `infra/docker/nginx/certs`).
5. Open:
   - https://bdc.rtvmedia.org.local/kiwi
   - https://bdc.rtvmedia.org.local/kiwi-preview

Stop the stack with:

```bash
make compose-down
```

## Repository Layout

- `app/` is the Flask app root (blueprints, services, templates, static assets).
- `infra/docker/` contains Dockerfiles for the base and app images.
- `scripts/` provides local dev helpers.

## Container Images

Versioned images are built by GitHub Actions on tag pushes (`v*`) and published to GHCR as
`ghcr.io/bindinc/kiwi:<tag>` (see `.github/workflows/build-image.yaml`).

Publish a new image:

```bash
git tag v1.0.2
git push origin v1.0.2
```

For local Kubernetes without a registry, build a local image and use `kiwi:dev` in your
local overlay in the cluster config repo:

```bash
make image-build
```

## Data Storage

- **LocalStorage**: All data is stored locally in the browser
- **Demo Data**: Demo data loads automatically on first use
- **Persistence**: Changes are preserved between sessions

### Demo Customers
1. **Jan de Vries** - Amsterdam (1012AB, nr. 42)
   - Avrobode subscription

2. **Maria Jansen** - Rotterdam (3011BD, nr. 15)
   - Mikrogids and Ncrvgids subscription

3. **Pieter Bakker** - The Hague (2511VA, nr. 88)
   - Avrobode subscription

## Interface Highlights

### Modern Design
- Clean, professional appearance
- Responsive across different screen sizes
- Clear visual hierarchy

### Three-Column Layout
- **Left**: Search function and quick actions
- **Middle**: Customer details and forms
- **Right**: Contact history timeline

### User Friendly
- Intuitive navigation
- Clear call-to-action buttons
- Toast notifications for feedback
- Keyboard shortcuts (Esc, Ctrl+K)

## Keyboard Shortcuts

- `Esc` - Close the current form
- `Ctrl/Cmd + K` - Focus the search field

## Technical Details

### Tech Stack
- **HTML5**: Semantic structure
- **CSS3**: Modern styling with CSS variables
- **Vanilla JavaScript**: No frameworks, pure JS
- **Flask**: Flask with OIDC-Flask plug-in enabled

### Browser Compatibility
- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)

### Responsive Breakpoints
- Desktop: > 1200px (3 columns)
- Tablet: 768px - 1200px (adjusted layout)
- Mobile: < 768px (single stacked column)

## Branching & Collaboration

- Keep `main` green; work in short-lived branches and merge through PRs.
- One branch per developer/agent, e.g. `dev/bob-orders`, `agent/cloud-auth`.
- Prefer vertical slices: a small, end-to-end change you can demo in 2-3 steps.
- Use feature flags to land partial work safely when needed.
- Optional: use `git worktree` for parallel local checkouts without switching branches.
- Details and examples live in `docs/BRANCHING.md`.

## Usage Scenarios

### Scenario 1: New Customer Calls
1. Click "New Subscription"
2. Fill in customer details during the call
3. Select the desired magazine
4. Set the start date
5. Confirm → customer is created with first contact

### Scenario 2: Magazine Not Received
1. Search for the customer by name/address
2. Select the customer from the results
3. Click "Send Issue"
4. Select the relevant subscription
5. Choose a reason
6. Confirm → action is logged

### Scenario 3: Customer Wants to Cancel
1. Open the customer profile
2. Click the cancel option for the relevant subscription
3. Winback flow starts automatically:
   - Ask for the reason
   - Present a suitable offer
   - Record the result
4. If accepted: subscription continues, offer is applied
5. If declined: subscription is terminated

### Scenario 4: Address Change
1. Open the customer profile
2. Click "Edit"
3. Update the details
4. Save → change is logged in history

## Improvements Compared to the Current Interface

### Problems in the Old Interface
- Unclear layout
- Too much information at once
- Confusing navigation
- Outdated design
- No clear workflow

### Improvements in the New Interface
- Clean, task-focused interface
- Clear information hierarchy
- Intuitive navigation and actions
- Modern, professional design
- Structured workflows with scripts
- Visual feedback on all actions
- Efficient three-panel layout
- Keyboard shortcuts for power users

## Future Enhancements

- [ ] Backend API integration
- [ ] Authentication and authorization
- [ ] Payment status and invoicing
- [ ] Email templates
- [ ] Reports and statistics
- [ ] Export functionality
- [ ] Advanced filters
- [ ] Notification system
- [ ] Multi-language support

## License

This is a Proof of Concept for internal use.

## Support

For questions or suggestions, contact the development team.

---

**Last updated**: januari 2026
**Version**: 0.0.0 (PoC)
