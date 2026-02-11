// Runtime extracted from app.js for call/queue/agent/disposition/debug domains.
// This file is loaded as a classic script before app.js.

// End Call Session
async function endCallSession(forcedByCustomer = false) {
    if (!callSession.active) return;

    const callDuration = Math.floor((Date.now() - callSession.startTime) / 1000);
    agentStatus.callsHandled += 1;
    updateAgentWorkSummary();

    // Voeg contact moment toe als beller geïdentificeerd was.
    // Bij API-mode doet de backend dit.
    if (callSession.customerId && !window.kiwiApi) {
        const endReason = forcedByCustomer ? 'call_ended_by_customer' : 'call_ended_by_agent';
        addContactMoment(
            callSession.customerId,
            endReason,
            `${callSession.serviceNumber} call beëindigd (duur: ${formatTime(callDuration)}, wacht: ${formatTime(callSession.waitTime)})`
        );
    }

    if (window.kiwiApi) {
        try {
            const payload = await window.kiwiApi.post('/api/v1/call-session/end', { forcedByCustomer });
            if (payload && typeof payload === 'object') {
                lastCallSession = payload.last_call_session || lastCallSession;
                const serverSession = payload.call_session;
                if (serverSession && typeof serverSession === 'object') {
                    callSession = {
                        ...callSession,
                        ...serverSession
                    };
                }
            }
        } catch (error) {
            console.warn('Kon beëindigde call niet naar backend syncen', error);
        }
    } else {
        lastCallSession = {
            customerId: callSession.customerId,
            customerName: callSession.customerName,
            serviceNumber: callSession.serviceNumber,
            waitTime: callSession.waitTime,
            startTime: callSession.startTime,
            callDuration: callDuration,
            totalHoldTime: callSession.totalHoldTime
        };
        callSession = {
            active: false,
            callerType: 'anonymous',
            customerId: null,
            customerName: null,
            serviceNumber: null,
            waitTime: 0,
            startTime: null,
            pendingIdentification: null,
            durationInterval: null,
            recordingActive: false,
            totalHoldTime: 0,
            holdStartTime: null,
            onHold: false
        };
    }

    // Stop timer
    if (callSession.durationInterval) {
        clearInterval(callSession.durationInterval);
    }
    callSession.durationInterval = null;

    // Verberg UI elementen
    document.getElementById('sessionInfo').style.display = 'none';
    const holdBtn = document.getElementById('holdCallBtn');
    if (holdBtn) holdBtn.style.display = 'none';
    const recordingIndicator = document.getElementById('recordingIndicator');
    if (recordingIndicator) recordingIndicator.style.display = 'none';
    const debugEndBtn = document.getElementById('debugEndCallBtn');
    if (debugEndBtn) {
        debugEndBtn.style.display = 'none';
    }
    updateIdentifyCallerButtons();

    // Update agent status naar ACW (will be implemented in Phase 5)
    autoSetAgentStatus('call_ended');

    // Na gesprek: check of er meer bellers zijn in queue
    if (callQueue.enabled && callQueue.queue.length > 0 && callQueue.autoAdvance) {
        setTimeout(() => {
            updateQueueDisplay();
        }, 1000);
    }

    if (!forcedByCustomer) {
        showToast(translate('calls.ended', {}, 'Gesprek beëindigd'), 'success');
    }
}

// Identify Caller as Customer
async function identifyCallerAsCustomer(customerId) {
    if (!callSession.active || callSession.callerType !== 'anonymous') {
        return;
    }
    
    const customer = customers.find(c => c.id === customerId);
    if (!customer) {
        showToast(translate('customer.notFound', {}, 'Klant niet gevonden'), 'error');
        return;
    }
    
    if (window.kiwiApi) {
        try {
            const payload = await window.kiwiApi.post(`${callSessionApiUrl}/identify-caller`, { customerId });
            if (payload && typeof payload === 'object') {
                callSession = {
                    ...callSession,
                    ...payload
                };
            }
        } catch (error) {
            showToast(error.message || translate('calls.identifyFailed', {}, 'Identificatie via backend mislukt'), 'error');
            return;
        }
    } else {
        callSession.callerType = 'identified';
        callSession.customerId = customerId;
        callSession.customerName = `${customer.initials || customer.firstName} ${customer.middleName ? customer.middleName + ' ' : ''}${customer.lastName}`;
    }

    if (!callSession.customerName) {
        callSession.customerName = `${customer.initials || customer.firstName} ${customer.middleName ? customer.middleName + ' ' : ''}${customer.lastName}`;
    }
    
    // Update UI
    document.getElementById('sessionCallerName').textContent = callSession.customerName;
    
    // Verberg alle "Dit is de beller" knoppen
    updateIdentifyCallerButtons();
    
    // Voeg contact moment toe (backend regelt dit in API-mode)
    if (!window.kiwiApi) {
        addContactMoment(customerId, 'call_identified',
            `Beller geïdentificeerd tijdens ${callSession.serviceNumber} call`);
        saveCallSession();
    }
    
    showToast(translate('calls.identifiedAs', { name: callSession.customerName }, `Beller geïdentificeerd als ${callSession.customerName}`), 'success');
}

// Update "Dit is de Beller" Button Visibility
function updateIdentifyCallerButtons() {
    const shouldShow = callSession.active && callSession.callerType === 'anonymous';
    
    // Update in search results
    document.querySelectorAll('.btn-identify-caller').forEach(btn => {
        btn.style.display = shouldShow ? 'inline-block' : 'none';
    });
    
    // Update in customer detail
    const identifyBtn = document.getElementById('identifyCallerBtn');
    if (identifyBtn) {
        identifyBtn.style.display = shouldShow ? 'inline-block' : 'none';
    }
}

// ============================================================================
// PHASE 4B: HOLD/RESUME FUNCTIONALITY
// ============================================================================

// Toggle Call Hold
async function toggleCallHold() {
    if (!callSession.active) return;

    const willHold = !callSession.onHold;
    const previousHoldStart = callSession.holdStartTime;

    if (window.kiwiApi) {
        try {
            const endpoint = willHold ? `${callSessionApiUrl}/hold` : `${callSessionApiUrl}/resume`;
            const payload = await window.kiwiApi.post(endpoint, {});
            if (payload && typeof payload === 'object') {
                callSession = {
                    ...callSession,
                    ...payload
                };
            }
        } catch (error) {
            showToast(error.message || translate('calls.holdResumeFailed', {}, 'Call hold/resume via backend mislukt'), 'error');
            return;
        }
    } else {
        callSession.onHold = willHold;
    }
    
    const holdBtn = document.getElementById('holdCallBtn');
    const sessionInfo = document.getElementById('sessionInfo');
    
    if (callSession.onHold) {
        // Put call on hold
        holdBtn.innerHTML = translate('calls.resumeButtonLabel', {}, '▶️ Hervatten');
        holdBtn.classList.add('on-hold');
        
        // Show hold indicator
        sessionInfo.classList.add('call-on-hold');
        
        // Add hold music indicator
        const holdIndicator = document.createElement('div');
        holdIndicator.id = 'holdIndicator';
        holdIndicator.className = 'hold-indicator';
        holdIndicator.innerHTML = translate('calls.holdIndicator', {}, '🎵 Klant in wacht');
        sessionInfo.appendChild(holdIndicator);
        
        if (!window.kiwiApi) {
            callSession.holdStartTime = Date.now();
        }
        
        showToast(translate('calls.onHold', {}, 'Gesprek in wacht gezet'), 'info');
        
        // Log hold
        if (callSession.customerId) {
            addContactMoment(
                callSession.customerId,
                'call_hold',
                'Gesprek in wacht gezet'
            );
        }
    } else {
        // Resume call
        holdBtn.innerHTML = translate('calls.holdButtonLabel', {}, '⏸️ In Wacht Zetten');
        holdBtn.classList.remove('on-hold');
        
        sessionInfo.classList.remove('call-on-hold');
        
        // Remove hold indicator
        const holdIndicator = document.getElementById('holdIndicator');
        if (holdIndicator) holdIndicator.remove();
        
        // Calculate hold duration
        const startedAt = previousHoldStart || callSession.holdStartTime;
        const holdDuration = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
        if (!window.kiwiApi) {
            callSession.totalHoldTime = (callSession.totalHoldTime || 0) + holdDuration;
        }
        
        showToast(
            translate('calls.resumed', { duration: formatTime(holdDuration) }, `Gesprek hervat (wacht: ${formatTime(holdDuration)})`),
            'success'
        );
        
        // Log resume
        if (callSession.customerId) {
            addContactMoment(
                callSession.customerId,
                'call_resumed',
                `Gesprek hervat na ${formatTime(holdDuration)} wachttijd`
            );
        }
    }

    if (!window.kiwiApi) {
        saveCallSession();
    }
}

// Identify Current Customer as Caller (from customer detail view)
function identifyCurrentCustomerAsCaller() {
    if (currentCustomer) {
        identifyCallerAsCustomer(currentCustomer.id);
    }
}

// PHASE 4: Show Success Identification Prompt after creating new customer
function showSuccessIdentificationPrompt(customerId, customerName) {
    if (callSession.active && callSession.callerType === 'anonymous') {
        // Use a timeout to show the prompt after the success toast
        setTimeout(() => {
            const confirmationMessage = translate(
                'calls.identificationPromptAfterCreate',
                { customerName },
                `✅ ${customerName} is succesvol aangemaakt.\n\nIs dit de persoon die belt?`
            );
            if (confirm(confirmationMessage)) {
                identifyCallerAsCustomer(customerId);
            }
        }, 800);
    }
}

// ============================================================================
// PHASE 1B: AGENT STATUS MANAGEMENT
// ============================================================================

function formatElapsedSessionTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updateStatusMenuSelection() {
    const statusButtons = document.querySelectorAll('[data-status-option]');
    statusButtons.forEach((button) => {
        const isCurrentStatus = button.dataset.statusOption === agentStatus.current;
        button.classList.toggle('is-active', isCurrentStatus);
    });
}

function updateAgentWorkSummary() {
    const activeSessionTimeElement = document.getElementById('agentWorkSessionTime');
    const callsHandledElement = document.getElementById('agentCallsHandled');

    if (activeSessionTimeElement) {
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - agentStatus.sessionStartTime) / 1000));
        activeSessionTimeElement.textContent = formatElapsedSessionTime(elapsedSeconds);
    }

    if (callsHandledElement) {
        callsHandledElement.textContent = String(agentStatus.callsHandled);
    }
}

function startAgentWorkSessionTimer() {
    updateAgentWorkSummary();

    if (agentStatus.sessionTimerInterval) {
        clearInterval(agentStatus.sessionTimerInterval);
    }

    agentStatus.sessionTimerInterval = setInterval(() => {
        updateAgentWorkSummary();
    }, 1000);
}

function setStatusMenuOpen(shouldOpen) {
    const menu = document.getElementById('agentStatusMenu');
    const trigger = document.getElementById('agentProfileTrigger');
    if (!menu || !trigger) {
        return;
    }

    menu.hidden = !shouldOpen;
    trigger.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
}

function closeStatusMenu() {
    setStatusMenuOpen(false);
}

function normalizeAgentStatus(status) {
    if (typeof status !== 'string') {
        return null;
    }
    const normalized = status.trim().toLowerCase();
    if (!normalized) {
        return null;
    }
    const canonical = agentStatusAliases[normalized] || normalized;
    if (!agentStatuses[canonical]) {
        return null;
    }
    return canonical;
}

function resolveTeamsSyncLabel(syncResult) {
    const capability = syncResult && syncResult.capability ? syncResult.capability : null;
    if (capability && capability.can_write) {
        return translate('agent.teamsSyncActive', {}, 'Teams sync actief');
    }

    const reason = (syncResult && syncResult.reason) || (capability && capability.reason) || null;
    if (reason === 'missing_presence_scope' || reason === 'missing_presence_write_scope' || reason === 'write_scope_unavailable') {
        return translate(
            'agent.teamsSyncMissingScope',
            {},
            'Teams sync vereist Graph scope Presence.ReadWrite. Log opnieuw in na consent.'
        );
    }
    if (reason === 'unsupported_identity_provider') {
        return translate(
            'agent.teamsSyncUnsupportedProvider',
            {},
            'Teams sync is niet beschikbaar voor deze OIDC provider.'
        );
    }
    if (reason === 'missing_access_token') {
        return translate(
            'agent.teamsSyncMissingToken',
            {},
            'Teams sync is niet beschikbaar: ontbrekende toegangstoken.'
        );
    }
    if (reason === 'missing_presence_session_id') {
        return translate(
            'agent.teamsSyncMissingSession',
            {},
            'Teams call sync is niet beschikbaar: ontbrekende presence session-id.'
        );
    }

    return translate('agent.teamsSyncTemporarilyUnavailable', {}, 'Teams sync is tijdelijk niet beschikbaar.');
}

function updateTeamsSyncState(syncResult) {
    const syncElement = document.getElementById('agentTeamsSyncState');
    if (!syncElement) {
        return;
    }

    const label = resolveTeamsSyncLabel(syncResult);
    syncElement.textContent = label;
}

function maybeNotifyTeamsSyncIssue(syncResult) {
    if (teamsSyncNoticeShown) {
        return;
    }

    const capability = syncResult && syncResult.capability ? syncResult.capability : null;
    if (capability && capability.can_write) {
        return;
    }

    const reason = (syncResult && syncResult.reason) || (capability && capability.reason) || null;
    if (!reason) {
        return;
    }

    const message = resolveTeamsSyncLabel(syncResult);
    showToast(message, 'warning');
    teamsSyncNoticeShown = true;
}

function applyAgentStatusLocally(newStatus, options = {}) {
    const statusConfig = agentStatuses[newStatus];
    if (!statusConfig) {
        return false;
    }

    const shouldUpdateQueue = options.updateQueue !== false;
    const shouldCloseMenu = options.closeMenu === true;
    const shouldShowToast = options.showToast === true;
    const shouldLogChange = options.logChange !== false;
    const shouldPersistPreferred = options.persistPreferred !== false;

    const oldStatus = agentStatus.current;
    agentStatus.current = newStatus;

    if (shouldPersistPreferred && !transientAgentStatuses.has(newStatus)) {
        agentStatus.preferred = newStatus;
    }

    // Update UI
    updateAgentStatusDisplay();

    // Update availability
    agentStatus.canReceiveCalls = (newStatus === 'ready');

    if (shouldUpdateQueue) {
        updateQueueDisplay();
    }

    // Log status change
    if (shouldLogChange) {
        console.log(`Agent status: ${oldStatus} → ${newStatus}`);
    }

    if (shouldCloseMenu) {
        closeStatusMenu();
    }

    if (shouldShowToast) {
        showToast(
            translate('agent.statusChanged', { status: statusConfig.label }, `Status gewijzigd naar: ${statusConfig.label}`),
            'success'
        );
    }

    return true;
}

async function syncAgentStatusWithBackend(newStatus) {
    try {
        if (!window.kiwiApi) {
            return null;
        }

        const payload = await window.kiwiApi.post(agentStatusApiUrl, { status: newStatus });
        const serverStatus = normalizeAgentStatus(payload && payload.status);
        const teamsSyncResult = payload && payload.teams_sync ? payload.teams_sync : null;

        if (teamsSyncResult) {
            updateTeamsSyncState(teamsSyncResult);
        }

        if (serverStatus && serverStatus !== agentStatus.current) {
            applyAgentStatusLocally(serverStatus, {
                showToast: false,
                closeMenu: false
            });
        }

        if (teamsSyncResult) {
            maybeNotifyTeamsSyncIssue(teamsSyncResult);
        }

        return payload;
    } catch (error) {
        console.warn('Agent status sync request failed', error);
        return null;
    }
}

async function initializeAgentStatusFromBackend() {
    try {
        if (!window.kiwiApi) {
            return;
        }

        const payload = await window.kiwiApi.get(agentStatusApiUrl);
        const serverStatus = normalizeAgentStatus(payload && payload.status);
        const teamsSyncResult = payload && payload.teams_sync ? payload.teams_sync : null;

        if (teamsSyncResult) {
            updateTeamsSyncState(teamsSyncResult);
        }

        if (serverStatus && serverStatus !== agentStatus.current) {
            applyAgentStatusLocally(serverStatus, {
                showToast: false,
                closeMenu: false
            });
        }
    } catch (error) {
        console.warn('Agent status initialization from backend failed', error);
    }
}

// Set Agent Status
function setAgentStatus(newStatus) {
    const normalizedStatus = normalizeAgentStatus(newStatus);
    if (!normalizedStatus) {
        return;
    }

    // Validatie
    if (callSession.active && normalizedStatus !== 'in_call') {
        showToast(
            translate('agent.cannotSetStatusDuringCall', {}, 'Kan status niet wijzigen tijdens actief gesprek'),
            'error'
        );
        return;
    }

    if (normalizedStatus === agentStatus.current) {
        closeStatusMenu();
        return;
    }

    applyAgentStatusLocally(normalizedStatus, {
        showToast: false,
        closeMenu: true
    });
    syncAgentStatusWithBackend(normalizedStatus);
}

// Update Agent Status Display
function updateAgentStatusDisplay() {
    const statusConfig = agentStatuses[agentStatus.current];
    const statusDot = document.getElementById('agentStatusDot');
    const profileTrigger = document.getElementById('agentProfileTrigger');
    if (!statusConfig || !statusDot) {
        return;
    }
    
    statusDot.textContent = statusConfig.badge;
    statusDot.style.backgroundColor = statusConfig.color;
    statusDot.style.color = statusConfig.textColor;

    const statusTooltip = `Status: ${statusConfig.label}`;
    statusDot.title = statusTooltip;
    if (profileTrigger) {
        profileTrigger.title = statusTooltip;
    }

    updateStatusMenuSelection();
    updateAgentWorkSummary();
}

// Toggle Status Menu
function toggleStatusMenu(event) {
    if (event) {
        event.stopPropagation();
    }

    const menu = document.getElementById('agentStatusMenu');
    if (!menu) {
        return;
    }

    setStatusMenuOpen(menu.hidden);
}

// Auto Set Agent Status (during call flow)
function autoSetAgentStatus(callState) {
    if (callState === 'call_started') {
        const fallbackPreferredStatus = normalizeAgentStatus(agentStatus.preferred) || 'ready';
        const currentStatus = normalizeAgentStatus(agentStatus.current);
        const statusToRestore = (currentStatus && !transientAgentStatuses.has(currentStatus))
            ? currentStatus
            : fallbackPreferredStatus;
        agentStatus.statusBeforeCall = statusToRestore;

        applyAgentStatusLocally('in_call', {
            showToast: false,
            closeMenu: false,
            persistPreferred: false
        });
        syncAgentStatusWithBackend('in_call');
    } else if (callState === 'call_ended') {
        const statusAfterCall = normalizeAgentStatus(agentStatus.statusBeforeCall)
            || normalizeAgentStatus(agentStatus.preferred)
            || 'ready';
        agentStatus.statusBeforeCall = null;

        applyAgentStatusLocally(statusAfterCall, {
            showToast: false,
            closeMenu: false
        });
        syncAgentStatusWithBackend(statusAfterCall);

        // Phase 5A: Start ACW after call ends (status remains restored manual/external value)
        startACW();
    }
}

// ============================================================================
// PHASE 5A: AFTER CALL WORK (ACW) & DISPOSITION
// ============================================================================

// Start ACW (After Call Work)
function startACW() {
    agentStatus.acwStartTime = Date.now();
    
    // Show ACW bar
    const acwBar = document.getElementById('acwBar');
    if (acwBar) {
        acwBar.style.display = 'block';
    }
    
    // Show disposition modal
    showDispositionModal();
    
    // Start ACW timer
    startACWTimer();
}

// Start ACW Timer
function startACWTimer() {
    const acwEndTime = agentStatus.acwStartTime + (ACW_DEFAULT_DURATION * 1000);
    
    agentStatus.acwInterval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((acwEndTime - Date.now()) / 1000));
        
        // Update timer display in ACW bar
        const acwTimerEl = document.getElementById('acwTimer');
        if (acwTimerEl) {
            acwTimerEl.textContent = formatTime(remaining);
        }
        
        if (remaining === 0) {
            endACW();
        }
    }, 1000);
}

// End ACW
function endACW(manual = false) {
    if (agentStatus.acwInterval) {
        clearInterval(agentStatus.acwInterval);
        agentStatus.acwInterval = null;
    }
    
    // Hide ACW bar
    const acwBar = document.getElementById('acwBar');
    if (acwBar) {
        acwBar.style.display = 'none';
    }
    
    if (manual) {
        showToast(translate('acw.readyForNext', {}, 'Klaar voor volgende gesprek'), 'success');
    } else {
        showToast(translate('acw.expired', {}, 'ACW tijd verlopen'), 'info');
    }
}

// Manual Finish ACW (triggered by "Klaar" button)
function manualFinishACW() {
    // Check if disposition has been filled
    const dispositionModal = document.getElementById('dispositionModal');
    const isModalOpen = dispositionModal && dispositionModal.style.display === 'flex';
    
    if (isModalOpen) {
        showToast(
            translate('acw.completeForm', {}, 'Vul eerst het nabewerkingsscherm in voordat je ACW afrondt'),
            'warning'
        );
        return;
    }
    
    endACW(true);
}

// Show Disposition Modal
function showDispositionModal() {
    const modal = document.getElementById('dispositionModal');
    if (!modal) return;
    
    // Use lastCallSession data (saved when call ended)
    const sessionData = lastCallSession || {};
    
    // Pre-fill information
    const customerNameEl = document.getElementById('dispCustomerName');
    if (customerNameEl) {
        customerNameEl.textContent = sessionData.customerName || translate('calls.anonymousCaller', {}, 'Anonieme Beller');
    }
    
    const durationEl = document.getElementById('dispCallDuration');
    if (durationEl && sessionData.callDuration !== undefined) {
        durationEl.textContent = formatTime(sessionData.callDuration);
    }
    
    const serviceEl = document.getElementById('dispServiceNumber');
    if (serviceEl) {
        const serviceName = serviceNumbers[sessionData.serviceNumber]?.label || sessionData.serviceNumber || '-';
        serviceEl.textContent = serviceName;
    }
    
    // Automatically determine category and outcome based on contact history
    const autoDisposition = determineAutoDisposition();
    
    if (autoDisposition.category) {
        document.getElementById('dispCategory').value = autoDisposition.category;
        updateDispositionOutcomes();
        
        if (autoDisposition.outcome) {
            document.getElementById('dispOutcome').value = autoDisposition.outcome;
        }
        
        if (autoDisposition.notes) {
            document.getElementById('dispNotes').value = autoDisposition.notes;
        }
    } else {
        // Reset form if no auto-fill
        document.getElementById('dispCategory').value = '';
        document.getElementById('dispOutcome').value = '';
        document.getElementById('dispOutcome').disabled = true;
        document.getElementById('dispNotes').value = '';
    }
    
    document.getElementById('dispFollowUpRequired').checked = false;
    document.getElementById('followUpSection').style.display = 'none';
    
    modal.style.display = 'flex';
}

// Determine Auto Disposition based on contact history
function determineAutoDisposition() {
    const result = { category: '', outcome: '', notes: '' };
    
    // Use lastCallSession data
    const sessionData = lastCallSession || {};
    
    // If no customer identified, return empty
    if (!sessionData.customerId) {
        return result;
    }
    
    const customer = customers.find(c => c.id === sessionData.customerId);
    if (!customer || !customer.contactHistory || customer.contactHistory.length === 0) {
        return result;
    }
    
    // Get recent contact moments from this call (after call started)
    const callStartTime = sessionData.startTime;
    const recentMoments = customer.contactHistory.filter(m => {
        const momentTime = new Date(m.timestamp).getTime();
        return momentTime >= callStartTime;
    });
    
    // Analyze actions to determine category and outcome
    const notesParts = [];
    
    // Check for subscription actions
    const hasNewSubscription = recentMoments.some(m => 
        m.type === 'subscription_created' || m.description?.includes('Nieuw abonnement'));
    const hasSubscriptionChange = recentMoments.some(m => 
        m.type === 'subscription_changed' || m.description?.includes('gewijzigd'));
    const hasSubscriptionCancelled = recentMoments.some(m => 
        m.type === 'subscription_cancelled' || m.description?.includes('opgezegd'));
    
    // Check for delivery actions
    const hasMagazineResent = recentMoments.some(m => 
        m.type === 'magazine_resent' || m.description?.includes('opnieuw verzonden'));
    const hasDeliveryUpdate = recentMoments.some(m => 
        m.type === 'delivery_updated' || m.description?.includes('bezorg'));
    
    // Check for article sale
    const hasArticleSale = recentMoments.some(m => 
        m.type === 'article_sold' || m.description?.includes('Artikel verkocht'));
    
    // Check for payment actions
    const hasPaymentUpdate = recentMoments.some(m => 
        m.type === 'payment_updated' || m.description?.includes('betaling') || m.description?.includes('IBAN'));
    
    // Determine category and outcome
    if (hasNewSubscription) {
        result.category = 'subscription';
        result.outcome = 'new_subscription';
        notesParts.push('Nieuw abonnement afgesloten');
    } else if (hasSubscriptionCancelled) {
        result.category = 'subscription';
        result.outcome = 'subscription_cancelled';
        notesParts.push('Abonnement opgezegd');
    } else if (hasSubscriptionChange) {
        result.category = 'subscription';
        result.outcome = 'subscription_changed';
        notesParts.push('Abonnement gewijzigd');
    } else if (hasArticleSale) {
        result.category = 'article_sale';
        result.outcome = 'article_sold';
        notesParts.push('Artikel verkocht');
    } else if (hasMagazineResent) {
        result.category = 'delivery';
        result.outcome = 'magazine_resent';
        notesParts.push('Editie opnieuw verzonden');
    } else if (hasDeliveryUpdate) {
        result.category = 'delivery';
        result.outcome = 'delivery_prefs_updated';
        notesParts.push('Bezorgvoorkeuren aangepast');
    } else if (hasPaymentUpdate) {
        result.category = 'payment';
        result.outcome = 'iban_updated';
        notesParts.push('Betalingsgegevens bijgewerkt');
    } else {
        // Default to general info provided
        result.category = 'general';
        result.outcome = 'info_provided';
        notesParts.push('Informatie verstrekt');
    }
    
    // Add all relevant action descriptions
    recentMoments.forEach(m => {
        if (m.description && !notesParts.includes(m.description)) {
            notesParts.push(m.description);
        }
    });
    
    result.notes = notesParts.join('. ');
    
    return result;
}

// Update Disposition Outcomes based on selected category
function updateDispositionOutcomes() {
    const category = document.getElementById('dispCategory').value;
    const outcomeSelect = document.getElementById('dispOutcome');
    const dispositionCategories = getDispositionCategories();
    
    if (!category) {
        outcomeSelect.disabled = true;
        outcomeSelect.innerHTML = `<option value="">${translate('disposition.selectCategoryFirst', {}, 'Selecteer eerst een categorie')}</option>`;
        return;
    }
    
    const outcomes = dispositionCategories[category]?.outcomes || [];
    outcomeSelect.disabled = false;
    outcomeSelect.innerHTML = `<option value="">${translate('disposition.selectOutcomePlaceholder', {}, 'Selecteer uitkomst...')}</option>`;
    
    outcomes.forEach(outcome => {
        const option = document.createElement('option');
        option.value = outcome.code;
        option.textContent = outcome.label;
        outcomeSelect.appendChild(option);
    });
}

// Toggle Follow-up Section
function toggleFollowUpSection() {
    const checkbox = document.getElementById('dispFollowUpRequired');
    const section = document.getElementById('followUpSection');
    section.style.display = checkbox.checked ? 'block' : 'none';
}

// Get Outcome Label
function getOutcomeLabel(category, outcomeCode) {
    const dispositionCategories = getDispositionCategories();
    const categoryData = dispositionCategories[category];
    if (!categoryData) return outcomeCode;
    
    const outcome = categoryData.outcomes.find(o => o.code === outcomeCode);
    return outcome ? outcome.label : outcomeCode;
}

// Save Disposition
function saveDisposition() {
    const category = document.getElementById('dispCategory').value;
    const outcome = document.getElementById('dispOutcome').value;
    const notes = document.getElementById('dispNotes').value;
    const followUpRequired = document.getElementById('dispFollowUpRequired').checked;
    
    if (!category || !outcome) {
        showToast(translate('disposition.selectCategory', {}, 'Selecteer categorie en uitkomst'), 'error');
        return;
    }
    
    // Use lastCallSession data
    const sessionData = lastCallSession || {};
    
    const disposition = {
        category,
        outcome,
        notes,
        followUpRequired,
        callDuration: sessionData.callDuration || 0,
        timestamp: new Date().toISOString()
    };
    
    // Save to customer history if identified
    if (sessionData.customerId) {
        const dispositionCategories = getDispositionCategories();
        const outcomeLabel = getOutcomeLabel(category, outcome);
        const categoryLabel = dispositionCategories[category]?.label || category;
        addContactMoment(
            sessionData.customerId,
            'call_disposition',
            `${categoryLabel}: ${outcomeLabel}${notes ? ' - ' + notes : ''}`
        );
        
        // Save follow-up if needed
        if (followUpRequired) {
            const followUpDate = document.getElementById('dispFollowUpDate').value;
            const followUpNotes = document.getElementById('dispFollowUpNotes').value;
            
            if (followUpDate) {
                addContactMoment(
                    sessionData.customerId,
                    'follow_up_scheduled',
                    `Follow-up gepland voor ${followUpDate}: ${followUpNotes || 'Geen notities'}`
                );
            }
        }
    }
    
    // Close modal
    document.getElementById('dispositionModal').style.display = 'none';
    
    showToast(translate('calls.completed', {}, 'Gesprek succesvol afgerond'), 'success');
    
    // Manual end ACW (since disposition is complete)
    endACW(true);
}

// Cancel Disposition
function cancelDisposition() {
    // Just close modal, ACW timer continues
    document.getElementById('dispositionModal').style.display = 'none';
    showToast(translate('disposition.cancelled', {}, 'Disposition geannuleerd - ACW loopt door'), 'warning');
}

// ============================================================================
// Phase 6: Call Queue Management Functions
// ============================================================================

/**
 * Initialize queue from API-backed session state
 */
function initializeQueue() {
    if (!window.kiwiApi) {
        updateQueueDisplay();
        updateDebugQueuePreview();
        return;
    }

    window.kiwiApi.get(callQueueApiUrl).then((payload) => {
        if (payload && typeof payload === 'object') {
            callQueue = {
                ...callQueue,
                ...payload
            };
            updateQueueDisplay();
            updateDebugQueuePreview();
        }
    }).catch((error) => {
        console.error('Error loading queue from API:', error);
        updateQueueDisplay();
        updateDebugQueuePreview();
    });
}

/**
 * Persist queue to authenticated API state
 */
function saveQueue() {
    if (!window.kiwiApi) {
        return;
    }

    const queuePayload = {
        enabled: Boolean(callQueue.enabled),
        queue: Array.isArray(callQueue.queue) ? callQueue.queue : [],
        currentPosition: Number(callQueue.currentPosition || 0),
        autoAdvance: callQueue.autoAdvance !== false
    };

    window.kiwiApi.put(callQueueApiUrl, queuePayload).catch((error) => {
        console.error('Error saving queue to API:', error);
    });
}

function saveCallSession() {
    if (!window.kiwiApi) {
        return;
    }

    const payload = {
        ...callSession
    };
    delete payload.durationInterval;

    window.kiwiApi.put(callSessionApiUrl, payload).catch((error) => {
        console.error('Error saving call session to API:', error);
    });
}

/**
 * Generate queue with specified size and mix
 * Called from debug menu
 */
async function debugGenerateQueue() {
    const queueSize = parseInt(document.getElementById('debugQueueSize')?.value) || 5;
    const queueMix = document.getElementById('debugQueueMix')?.value || 'balanced';

    if (!window.kiwiApi) {
        showToast(translate('queue.generateUnavailable', {}, 'Queue genereren via backend is niet beschikbaar'), 'error');
        return;
    }

    try {
        const payload = await window.kiwiApi.post('/api/v1/call-queue/debug-generate', {
            queueSize,
            queueMix
        });
        callQueue = {
            ...callQueue,
            ...(payload || {})
        };
    } catch (error) {
        showToast(error.message || translate('queue.generateFailed', {}, 'Queue genereren via backend mislukt'), 'error');
        return;
    }

    saveQueue();
    updateQueueDisplay();
    updateDebugQueuePreview();
    
    showToast(
        translate('queue.generated', { count: queueSize }, `✅ Wachtrij gegenereerd met ${queueSize} bellers`),
        'success'
    );
    
    // Update debug status
    const debugStatus = document.getElementById('debugQueueStatus');
    if (debugStatus) {
        debugStatus.textContent = translate(
            'queue.debugStatusActive',
            { count: callQueue.queue.length },
            `Actief - ${callQueue.queue.length} wachtenden`
        );
    }
}

/**
 * Update queue display in header
 * Only shows when:
 * - Queue is enabled
 * - There are waiting callers
 * - No active call
 */
function updateQueueDisplay() {
    const queueInfoBar = document.getElementById('queueInfo');
    
    if (!queueInfoBar) {
        return; // Element not yet in DOM
    }
    
    // Alleen tonen als:
    // - Queue is enabled
    // - Er zijn wachtenden
    // - Geen actief gesprek
    const shouldShow = callQueue.enabled && 
                       callQueue.queue.length > 0 && 
                       !callSession.active;
    
    if (!shouldShow) {
        queueInfoBar.style.display = 'none';
        stopQueueWaitTimeUpdate();
        return;
    }
    
    // Toon queue info
    queueInfoBar.style.display = 'block';
    
    // Start wait time update interval als nog niet gestart
    startQueueWaitTimeUpdate();
    
    // Huidige (eerste) entry in queue
    const nextCaller = callQueue.queue[0];
    
    if (nextCaller) {
        const nextCallerName = document.getElementById('queueNextCallerName');
        const nextService = document.getElementById('queueNextService');
        const nextWaitTime = document.getElementById('queueNextWaitTime');
        const queueLength = document.getElementById('queueLength');
        
        if (nextCallerName) nextCallerName.textContent = nextCaller.customerName;
        if (nextService) {
            const serviceConfig = serviceNumbers[nextCaller.serviceNumber];
            nextService.textContent = serviceConfig?.label || nextCaller.serviceNumber;
        }
        if (nextWaitTime) nextWaitTime.textContent = formatTime(nextCaller.waitTime);
        if (queueLength) queueLength.textContent = callQueue.queue.length - 1; // Aantal achter de huidige
    }
}

/**
 * Start real-time wait time update for queue
 */
function startQueueWaitTimeUpdate() {
    // Stop any existing interval
    if (callQueue.waitTimeInterval) {
        return; // Already running
    }
    
    // Update wait times every second
    callQueue.waitTimeInterval = setInterval(() => {
        if (!callQueue.enabled || callQueue.queue.length === 0 || callSession.active) {
            stopQueueWaitTimeUpdate();
            return;
        }
        
        // Increment wait time for all callers in queue
        callQueue.queue.forEach(entry => {
            entry.waitTime += 1;
        });
        
        // Update display with new wait time
        const nextCaller = callQueue.queue[0];
        if (nextCaller) {
            const nextWaitTime = document.getElementById('queueNextWaitTime');
            if (nextWaitTime) {
                nextWaitTime.textContent = formatTime(nextCaller.waitTime);
            }
        }
        
        // Update debug preview if visible
        updateDebugQueuePreview();
        
        // Persist queue state periodically (every 5 seconds to reduce writes)
        if (nextCaller && nextCaller.waitTime % 5 === 0) {
            saveQueue();
        }
    }, 1000); // Every 1 second
}

/**
 * Stop wait time update interval
 */
function stopQueueWaitTimeUpdate() {
    if (callQueue.waitTimeInterval) {
        clearInterval(callQueue.waitTimeInterval);
        callQueue.waitTimeInterval = null;
    }
}

/**
 * Clear queue (debug function)
 */
async function debugClearQueue() {
    if (confirm(translate('queue.clearConfirm', {}, '🗑️ Wachtrij volledig wissen?'))) {
        // Stop wait time updates
        stopQueueWaitTimeUpdate();

        if (window.kiwiApi) {
            try {
                const payload = await window.kiwiApi.delete('/api/v1/call-queue');
                callQueue = {
                    ...callQueue,
                    ...(payload || {}),
                    waitTimeInterval: null
                };
            } catch (error) {
                showToast(error.message || translate('queue.clearFailed', {}, 'Queue wissen via backend mislukt'), 'error');
                return;
            }
        } else {
            callQueue = {
                enabled: false,
                queue: [],
                currentPosition: 0,
                autoAdvance: true,
                waitTimeInterval: null
            };
        }
        
        saveQueue();
        updateQueueDisplay();
        updateDebugQueuePreview();
        
        const debugStatus = document.getElementById('debugQueueStatus');
        if (debugStatus) {
            debugStatus.textContent = translate('queue.debugStatusDisabled', {}, 'Uitgeschakeld');
        }
        showToast(translate('queue.cleared', {}, '✅ Wachtrij gewist'), 'info');
    }
}

/**
 * Update debug queue preview
 */
function updateDebugQueuePreview() {
    const previewContainer = document.getElementById('debugQueuePreview');
    const listContainer = document.getElementById('debugQueueList');
    
    if (!previewContainer || !listContainer) {
        return; // Elements not yet in DOM
    }
    
    if (!callQueue.enabled || callQueue.queue.length === 0) {
        previewContainer.style.display = 'none';
        return;
    }
    
    previewContainer.style.display = 'block';
    listContainer.innerHTML = '';
    
    callQueue.queue.forEach((entry, index) => {
        const item = document.createElement('div');
        item.className = 'debug-queue-item';
        if (index === 0) item.classList.add('current');
        const callerTypeLabel = entry.callerType === 'known'
            ? translate('queue.callerTypeKnown', {}, '👤 Bekend')
            : translate('queue.callerTypeAnonymous', {}, '❓ Anoniem');
        
        item.innerHTML = `
            <div class="debug-queue-item-info">
                <div class="debug-queue-item-name">
                    ${index + 1}. ${entry.customerName}
                </div>
                <div class="debug-queue-item-details">
                    ${entry.serviceNumber} • 
                    ${callerTypeLabel}
                </div>
            </div>
            <div class="debug-queue-item-wait">
                ⏳ ${formatTime(entry.waitTime)}
            </div>
        `;
        
        listContainer.appendChild(item);
    });
}

/**
 * Format time in MM:SS format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Accept next call from queue
 */
async function acceptNextCall() {
    if (!callQueue.enabled || callQueue.queue.length === 0) {
        showToast(translate('queue.empty', {}, '⚠️ Geen bellers in wachtrij'), 'error');
        return;
    }
    
    if (callSession.active) {
        showToast(translate('queue.activeCallExists', {}, '⚠️ Er is al een actief gesprek'), 'error');
        return;
    }
    
    // Check agent status
    if (agentStatus.current !== 'ready') {
        showToast(
            translate('queue.mustBeReady', {}, '⚠️ Agent status moet "Beschikbaar" zijn om gesprek te accepteren'),
            'error'
        );
        return;
    }
    
    if (!window.kiwiApi) {
        showToast(translate('queue.acceptNextUnavailable', {}, 'Volgende call ophalen via backend is niet beschikbaar'), 'error');
        return;
    }

    let nextEntry = null;
    try {
        const payload = await window.kiwiApi.post('/api/v1/call-queue/accept-next', {});
        nextEntry = payload && payload.accepted ? payload.accepted : null;
        if (payload && payload.call_queue) {
            callQueue = {
                ...callQueue,
                ...payload.call_queue
            };
        }
    } catch (error) {
        showToast(error.message || translate('queue.acceptNextFailed', {}, 'Volgende call ophalen via backend mislukt'), 'error');
        return;
    }
    if (!nextEntry) {
        showToast(translate('queue.empty', {}, '⚠️ Geen bellers in wachtrij'), 'error');
        return;
    }
    
    // Start call session met queue entry data
    startCallFromQueue(nextEntry);
    
    // Update queue display (will stop timer if no more visible callers)
    saveQueue();
    updateQueueDisplay();
    updateDebugQueuePreview();
}

/**
 * Start call from queue entry
 * @param {object} queueEntry - Queue entry object
 */
function startCallFromQueue(queueEntry) {
    // Initialize call session met queue data
    callSession = {
        active: true,
        callerType: queueEntry.callerType,
        serviceNumber: queueEntry.serviceNumber,
        waitTime: queueEntry.waitTime,
        startTime: Date.now(),
        customerId: queueEntry.customerId,
        customerName: queueEntry.customerName,
        pendingIdentification: null,
        durationInterval: null,
        recordingActive: false,
        totalHoldTime: 0,
        holdStartTime: null,
        onHold: false
    };
    
    // Als het een bekende klant is, open automatisch het klantrecord
    if (queueEntry.callerType === 'known' && queueEntry.customerId) {
        setTimeout(() => {
            selectCustomer(queueEntry.customerId);
        }, 500);
    }
    
    // Start normale call session flow
    startCallSession();
    
    showToast(
        translate('calls.startedFromQueue', { name: queueEntry.customerName }, `📞 Gesprek gestart met ${queueEntry.customerName}`),
        'success'
    );
}

// ============================================================================
// PHASE 3: DEBUG MODAL - CALL SIMULATION
// ============================================================================

// Toggle Known Caller Select
function toggleKnownCallerSelect() {
    const callerType = document.getElementById('debugCallerType').value;
    const knownCallerSelect = document.getElementById('debugKnownCallerSelect');
    
    if (callerType === 'known') {
        knownCallerSelect.style.display = 'flex';
        populateDebugKnownCustomers();
    } else {
        knownCallerSelect.style.display = 'none';
    }
}

// Populate Known Customers Dropdown
function populateDebugKnownCustomers() {
    const select = document.getElementById('debugKnownCustomer');
    
    if (customers.length === 0) {
        select.innerHTML = `<option value="">${translate('customer.noneAvailable', {}, 'Geen klanten beschikbaar')}</option>`;
        return;
    }
    
    select.innerHTML = customers.map(customer => {
        const fullName = customer.middleName 
            ? `${customer.initials || customer.firstName} ${customer.middleName} ${customer.lastName}`
            : `${customer.initials || customer.firstName} ${customer.lastName}`;
        return `<option value="${customer.id}">${fullName}</option>`;
    }).join('');
}

// Debug: Start Call Simulation
async function debugStartCall() {
    // Check if there's already an active call
    if (callSession.active) {
        if (confirm(translate('calls.activeCallReplaceConfirm', {}, '⚠️ Er is al een actieve call. Wil je deze beëindigen en een nieuwe starten?'))) {
            await endCallSession(true);
        } else {
            return;
        }
    }
    
    const serviceNumber = document.getElementById('debugServiceNumber').value;
    const callerType = document.getElementById('debugCallerType').value;
    const waitTimeOption = document.getElementById('debugWaitTime').value;
    
    // Bereken wachttijd
    let waitTime;
    if (waitTimeOption === 'random') {
        waitTime = Math.floor(Math.random() * (90 - 15 + 1)) + 15;
    } else {
        waitTime = parseInt(waitTimeOption);
    }
    
    const customerIdValue = document.getElementById('debugKnownCustomer').value;
    const knownCustomerId = customerIdValue ? parseInt(customerIdValue) : null;
    const knownCustomer = knownCustomerId ? customers.find(c => c.id === knownCustomerId) : null;

    if (window.kiwiApi) {
        const payload = {
            callerType,
            serviceNumber,
            waitTime
        };
        if (callerType === 'known' && knownCustomerId) {
            payload.customerId = knownCustomerId;
            payload.customerName = knownCustomer
                ? `${knownCustomer.initials || knownCustomer.firstName} ${knownCustomer.middleName ? `${knownCustomer.middleName} ` : ''}${knownCustomer.lastName}`.trim()
                : null;
        }

        try {
            const response = await window.kiwiApi.post(`${callSessionApiUrl}/start-debug`, payload);
            if (response && typeof response === 'object') {
                callSession = {
                    ...callSession,
                    ...response,
                    durationInterval: null
                };
            }
        } catch (error) {
            showToast(error.message || translate('calls.debugStartFailed', {}, 'Debug call starten via backend mislukt'), 'error');
            return;
        }
    } else {
        // Initialize call session
        callSession = {
            active: true,
            callerType: callerType,
            serviceNumber: serviceNumber,
            waitTime: waitTime,
            startTime: Date.now(),
            customerId: null,
            customerName: null,
            pendingIdentification: null,
            durationInterval: null,
            recordingActive: false,
            totalHoldTime: 0,
            holdStartTime: null,
            onHold: false
        };
    }
    
    // Voor bekende beller, koppel direct
    if (callerType === 'known') {
        if (knownCustomerId) {
            if (knownCustomer) {
                callSession.customerId = knownCustomerId;
                callSession.customerName = `${knownCustomer.initials || knownCustomer.firstName} ${knownCustomer.middleName ? knownCustomer.middleName + ' ' : ''}${knownCustomer.lastName}`;
                callSession.callerType = 'identified';
                
                // Automatically open customer record
                setTimeout(() => {
                    selectCustomer(knownCustomerId);
                }, 500);
            }
        }
    }
    
    // Start UI updates
    startCallSession();
    
    closeDebugModal();
    
    showToast(
        translate(
            'calls.simulationStarted',
            { serviceNumber, wait: formatTime(waitTime) },
            `Call simulatie gestart: ${serviceNumber} (wachttijd: ${formatTime(waitTime)})`
        ),
        'success'
    );
}

// Debug: End Call Simulation
function debugEndCall() {
    if (!callSession.active) return;
    
    const callDuration = Math.floor((Date.now() - callSession.startTime) / 1000);
    
    if (confirm(translate('calls.endConversationConfirm', { duration: formatTime(callDuration) }, `📞 Het telefoongesprek beëindigen?\n\nGespreksduur: ${formatTime(callDuration)}`))) {
        endCallSession(true);
        document.getElementById('debugEndCallBtn').style.display = 'none';
    }
}

// Debug Modal Functions
function openDebugModal() {
    if (!isDebugModalEnabled()) {
        return;
    }

    const modal = document.getElementById('debugModal');
    if (!modal) {
        return;
    }

    modal.classList.add('show');
    
    // Update debug end call button visibility
    const debugEndBtn = document.getElementById('debugEndCallBtn');
    if (debugEndBtn) {
        debugEndBtn.style.display = callSession.active ? 'block' : 'none';
    }
    
    console.log('🔧 Debug mode activated');
}

function closeDebugModal() {
    const modal = document.getElementById('debugModal');
    modal.classList.remove('show');
}

// Full Reset - Clear session-backed POC data and reload
function fullReset() {
    if (confirm(translate('storage.resetConfirm', {}, '⚠️ Dit zal alle sessiedata wissen en de pagina herladen. Weet je het zeker?'))) {
        if (window.kiwiApi) {
            window.kiwiApi.post(debugResetApiUrl, {}).then(() => {
                showToast(translate('storage.cleared', {}, 'Sessiestaat gewist. Pagina wordt herladen...'), 'info');
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }).catch((error) => {
                showToast(error.message || translate('storage.resetFailed', {}, 'Reset via backend mislukt'), 'error');
            });
            return;
        }

        showToast(translate('storage.cleared', {}, 'Pagina wordt herladen...'), 'info');
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }
}

if (typeof window !== 'undefined') {
    window.kiwiCallAgentRuntime = Object.assign(window.kiwiCallAgentRuntime || {}, {
        acceptNextCall,
        applyAgentStatusLocally,
        autoSetAgentStatus,
        cancelDisposition,
        closeDebugModal,
        closeStatusMenu,
        debugClearQueue,
        debugEndCall,
        debugGenerateQueue,
        debugStartCall,
        determineAutoDisposition,
        endACW,
        endCallSession,
        formatElapsedSessionTime,
        formatTime,
        fullReset,
        getOutcomeLabel,
        identifyCallerAsCustomer,
        identifyCurrentCustomerAsCaller,
        initializeAgentStatusFromBackend,
        initializeQueue,
        manualFinishACW,
        maybeNotifyTeamsSyncIssue,
        normalizeAgentStatus,
        openDebugModal,
        populateDebugKnownCustomers,
        resolveTeamsSyncLabel,
        saveCallSession,
        saveDisposition,
        saveQueue,
        setAgentStatus,
        setStatusMenuOpen,
        showDispositionModal,
        startAgentWorkSessionTimer,
        startCallFromQueue,
        startQueueWaitTimeUpdate,
        stopQueueWaitTimeUpdate,
        syncAgentStatusWithBackend,
        toggleCallHold,
        toggleFollowUpSection,
        toggleKnownCallerSelect,
        toggleStatusMenu,
        updateAgentStatusDisplay,
        updateAgentWorkSummary,
        updateDebugQueuePreview,
        updateDispositionOutcomes,
        updateQueueDisplay,
        updateStatusMenuSelection,
        updateTeamsSyncState
    });
}
