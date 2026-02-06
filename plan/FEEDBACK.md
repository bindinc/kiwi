# Feedback

## Status indicator

- [ ] Change the look of the current status_indicator '/plan/user_status_indicator/status_indicator_commit_bd7b7068592bef5a2e7e18297993770b892a7d17.png' into '/plan/user_status_indicator/desired_status_indicator.png'
- [ ] when a user clicks on the use _status indicator  status can be changed and the user can logout. 
- [ ]  when a user clicks on the use _status indicator it should also show below the status/logout options some relevant callcenter worker info like the actively worked session time and calls handled.


## New subscription 
- [x] 1 First input field (top): Acquisition key search/selection field (only show sales code and description + price per acquisition key)
  - [x] 1.1 Type barcode; system validates (exists/active). Document sample barcodes in the /docs folder.
  - [x] 1.2 Channel choice in UI (clear icons are fine instead of text if mouseover shows the channel spelled out in a tooltip): 
            OL/IS/** = online internal sites. 
            EM/OU/** = email outbound.
            TM/IB/** = telemarketing inbound.
            PR/ET/** = print own titles.

- [x] 2 After pressing Enter on the acquisition key (or the 'confirm' button to the right of the acquisition key input) show the read-only overview modal and button below to finalize: displayed title, term, offer; user confirms.
- [ ] 3 Payment method is step 2 (before the personal data fields): choose Direct debit (IBAN) or Invoice (address).
  - [ ] 3.1 Optional "second payer" (e.g. administrator) after choosing payment method: search/create customer number; not required. The second payer also gets a separate customer number
- [ ] 4 Marketing consent: section with opt-ins empty by default if no existing profile is loaded.
- [x] 5 Enrich personal data: include date of birth field on new subscription; phone/email, address and other data can be updated here.
- [ ] 6 Start date calendar: only allowed start dates clickable (e.g. every two weeks; no dates too soon); clear visual distinction.

## Confirmation & process logic
- [ ] 8 Confirmation panel expanded by default after "Create", with a clear "success" message.
- [x] 9 Contact history/active subscriptions: new change at the top and clearly highlighted (temporary highlight).
- [ ] 10 Flow exception at the source: during creation you can check "do not start process/confirmation" (exception).
- [ ] 11 5-minute grace period: after confirming, 5 minutes to change/cancel without database commit; after that final (later changes via standard Abel route remain possible).

## Cancel (cancellation flow)
- [ ] 12 Search & select: same search screen as during creation.
- [ ] 13 Step 1 - Reason: list sorted by popularity; "Other" expands for clarification. "Deceased" present.
- [ ] 14 Step 2 - Memo: memo field required, visible after reason (for context such as switch),
  - [ ] 15 Exception: for Deceased (and possibly Nursing home) do not show memo; also no winback.
- [ ] 16 Subscriptions to show: all active paid memberships + guide subscriptions; free memberships stop automatically.
- [ ] 17 Deceased logic: refund automatically determined by system based on payments; do not show user choice.
- [ ] 18 Transfer to another person (separate stop reason):
  - [ ] 18.1 Term continues when transferred,
  - [ ] 18.2 Record date of birth of new recipient,
  - [ ] 18.3 Payment method/IBAN can be changed (e.g. daughter will pay herself).
- [ ] 19 Confirmation email when refunding: enter separate email for confirmation (stored as extra email; do not overwrite existing email).

UI/feedback & order
- [ ] 20 New/changed items get temporary highlight;
- [ ] 21 Process rules visible; no unnecessary buttons—simple base design, refinable later.

Scope & planning
- [ ] 22 First iteration focuses on processing email and receipts (no telephony/winback/complaint route now).
- [ ] 23 Next steps: align every two weeks with supplier (HUP) and show updated mock-ups for visual check.
