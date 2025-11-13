// Sample Data Storage
let customers = [];
let currentCustomer = null;
let selectedOffer = null;

// Search State Management (for pagination)
let searchState = {
    results: [],
    currentPage: 1,
    itemsPerPage: 20,
    sortBy: 'name',
    sortOrder: 'asc'
};

// Phase 1A: Call Session State Management
let callSession = {
    active: false,              // Is er momenteel een actieve call?
    callerType: 'anonymous',    // 'anonymous' of 'identified'
    customerId: null,           // ID van geïdentificeerde klant
    customerName: null,         // Naam van geïdentificeerde klant
    serviceNumber: null,        // Welk service nummer werd gebeld
    waitTime: 0,                // Wachttijd in seconden
    startTime: null,            // Timestamp wanneer call startte
    pendingIdentification: null, // Tijdelijke opslag voor klant die nog niet gekoppeld is
    durationInterval: null,     // Timer interval voor gespreksduur
    recordingActive: false,     // Is recording actief
    totalHoldTime: 0,           // Totale hold tijd
    holdStartTime: null,        // Wanneer hold startte
    onHold: false               // Is call momenteel on hold
};

// Last completed call session data (for ACW/disposition)
let lastCallSession = null;

// Phase 1B: Agent Status State Management
let agentStatus = {
    current: 'ready',           // offline, ready, busy, acw, break - Agent starts as ready
    canReceiveCalls: true,      // Can receive calls on page load
    acwStartTime: null,
    breakStartTime: null,
    acwInterval: null
};

// Agent Status Definitions
const agentStatuses = {
    'offline': { label: 'Offline', color: '#6b7280', icon: '⚫' },
    'ready': { label: 'Beschikbaar', color: '#10b981', icon: '🟢' },
    'busy': { label: 'In Gesprek', color: '#ef4444', icon: '🔴' },
    'acw': { label: 'Nabewerkingstijd', color: '#f59e0b', icon: '🟡' },
    'break': { label: 'Pauze', color: '#3b82f6', icon: '🔵' }
};

// Phase 1A: Service Number Configuration
const serviceNumbers = {
    'AVROBODE': {
        label: 'AVROBODE SERVICE',
        phone: '088-0123456',
        color: '#2563eb',
        icon: '📘'
    },
    'MIKROGIDS': {
        label: 'MIKROGIDS SERVICE',
        phone: '088-0123457',
        color: '#dc2626',
        icon: '📕'
    },
    'NCRVGIDS': {
        label: 'NCRVGIDS SERVICE',
        phone: '088-0123458',
        color: '#16a34a',
        icon: '📗'
    },
    'ALGEMEEN': {
        label: 'ALGEMEEN SERVICE',
        phone: '088-0123459',
        color: '#9333ea',
        icon: '📞'
    }
};

// Phase 5A: ACW Configuration
const ACW_DEFAULT_DURATION = 120; // 120 seconds

const MIN_SUB_NUMBER = 8099098;
const MAX_SUB_NUMBER = 12199098;
const NAME_INSERTION_PREFIXES = [
    'van der',
    'van den',
    'van de',
    'von der',
    'ten',
    'ter',
    'op de',
    'op den',
    'op',
    'aan de',
    'aan den',
    'aan',
    'bij',
    'uit de',
    'uit den',
    'uit',
    'de',
    'den',
    'der',
    'van',
    'von',
    'te'
];

function normalizeNameFragment(value) {
    return (value || '').replace(/[\s.]/g, '').toLowerCase();
}

function generateSubscriptionNumber(customerId, subscriptionId) {
    const range = MAX_SUB_NUMBER - MIN_SUB_NUMBER + 1;
    const seed = Math.abs((customerId * 73856093) ^ (subscriptionId * 193939));
    const offset = seed % range;
    return String(MIN_SUB_NUMBER + offset);
}

// Phase 6: Call Queue State Management
let callQueue = {
    enabled: false,           // Is queue mode geactiveerd
    queue: [],                // Array van wachtende bellers
    currentPosition: 0,       // Huidige positie in queue
    autoAdvance: true,        // Automatisch volgende nemen na gesprek
    waitTimeInterval: null    // Interval voor real-time wait time updates
};

// Phase 5A: Disposition Codes Configuration
const dispositionCategories = {
    'subscription': {
        label: 'Abonnement',
        outcomes: [
            { code: 'new_subscription', label: 'Nieuw abonnement afgesloten' },
            { code: 'subscription_changed', label: 'Abonnement gewijzigd' },
            { code: 'subscription_cancelled', label: 'Abonnement opgezegd' },
            { code: 'subscription_paused', label: 'Abonnement gepauzeerd' },
            { code: 'info_provided', label: 'Informatie verstrekt' }
        ]
    },
    'delivery': {
        label: 'Bezorging',
        outcomes: [
            { code: 'delivery_issue_resolved', label: 'Bezorgprobleem opgelost' },
            { code: 'magazine_resent', label: 'Editie opnieuw verzonden' },
            { code: 'delivery_prefs_updated', label: 'Bezorgvoorkeuren aangepast' },
            { code: 'escalated_delivery', label: 'Geëscaleerd naar bezorging' }
        ]
    },
    'payment': {
        label: 'Betaling',
        outcomes: [
            { code: 'payment_resolved', label: 'Betaling afgehandeld' },
            { code: 'payment_plan_arranged', label: 'Betalingsregeling getroffen' },
            { code: 'iban_updated', label: 'IBAN gegevens bijgewerkt' },
            { code: 'escalated_finance', label: 'Geëscaleerd naar financiën' }
        ]
    },
    'article_sale': {
        label: 'Artikel Verkoop',
        outcomes: [
            { code: 'article_sold', label: 'Artikel verkocht' },
            { code: 'quote_provided', label: 'Offerte verstrekt' },
            { code: 'no_sale', label: 'Geen verkoop' }
        ]
    },
    'complaint': {
        label: 'Klacht',
        outcomes: [
            { code: 'complaint_resolved', label: 'Klacht opgelost' },
            { code: 'complaint_escalated', label: 'Klacht geëscaleerd' },
            { code: 'callback_scheduled', label: 'Terugbelafspraak gemaakt' }
        ]
    },
    'general': {
        label: 'Algemeen',
        outcomes: [
            { code: 'info_provided', label: 'Informatie verstrekt' },
            { code: 'transferred', label: 'Doorverbonden' },
            { code: 'customer_hung_up', label: 'Klant opgehangen' },
            { code: 'wrong_number', label: 'Verkeerd verbonden' },
            { code: 'no_answer_needed', label: 'Geen actie vereist' }
        ]
    }
};

// Phase 2B: Recording Configuration
const recordingConfig = {
    enabled: true,
    requireConsent: true,
    autoStart: true
};

// End Session - Close current customer and return to clean slate
function endSession() {
    // End call if active (using new system)
    if (callSession.active) {
        endCallSession();
    }
    
    // Clear current customer
    currentCustomer = null;
    selectedOffer = null;
    
    // Hide customer detail
    document.getElementById('customerDetail').style.display = 'none';
    
    // Show welcome message
    document.getElementById('welcomeMessage').style.display = 'block';
    
    // Hide end call button
    const endCallBtn = document.getElementById('endCallBtn');
    if (endCallBtn) endCallBtn.style.display = 'none';
    
    // Clear search form
    document.getElementById('searchName').value = '';
    document.getElementById('searchPostalCode').value = '';
    document.getElementById('searchHouseNumber').value = '';
    const phoneInput = document.getElementById('searchPhone');
    if (phoneInput) phoneInput.value = '';
    const emailInput = document.getElementById('searchEmail');
    if (emailInput) emailInput.value = '';
    setAdditionalFiltersOpen(false);
    
    // Hide search results
    const searchResults = document.getElementById('searchResults');
    searchResults.style.display = 'none';
    document.getElementById('resultsContainer').innerHTML = '';
    
    // Close any open forms
    closeForm('newSubscriptionForm');
    closeForm('articleSaleForm');
    closeForm('editCustomerForm');
    closeForm('editSubscriptionForm');
    closeForm('resendMagazineForm');
    closeForm('winbackFlowForm');
    
    // Update action buttons
    updateCustomerActionButtons();
    
    // Scroll to top for clean start
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Optional: Show a brief confirmation
    console.log('Session ended - Ready for next customer');
}

// ============================================================================
// DRY: Reusable Customer Data Form Component
// ============================================================================

/**
 * Renders a unified customer data form into a container
 * @param {string} containerId - ID of the container element
 * @param {string} prefix - Prefix for all form field IDs (e.g., 'sub', 'article', 'transfer')
 * @param {object} config - Configuration options
 * @param {boolean} config.includePhone - Include phone field (default: true)
 * @param {boolean} config.includeEmail - Include email field (default: true)
 * @param {boolean} config.phoneRequired - Make phone required (default: false)
 * @param {boolean} config.emailRequired - Make email required (default: true)
 * @param {boolean} config.showSameAddressCheckbox - Show "same address" checkbox (default: false)
 */
function renderCustomerForm(containerId, prefix, config = {}) {
    const defaults = {
        includePhone: true,
        includeEmail: true,
        phoneRequired: false,
        emailRequired: true,
        showSameAddressCheckbox: false
    };
    const cfg = { ...defaults, ...config };

    const html = `
        <h3 class="form-subtitle">Aanhef *</h3>
        <div class="aanhef-row">
            <label><input type="radio" name="${prefix}Salutation" value="Dhr." required checked> Dhr.</label>
            <label><input type="radio" name="${prefix}Salutation" value="Mevr."> Mevr.</label>
            <label><input type="radio" name="${prefix}Salutation" value="Anders"> Anders</label>
        </div>
        
        <div class="form-row">
            <input type="text" id="${prefix}Initials" placeholder="Voorletters*" required>
            <input type="text" id="${prefix}MiddleName" placeholder="Tussenvoegsel">
            <input type="text" id="${prefix}LastName" placeholder="Achternaam*" required>
        </div>
        
        <div class="form-row">
            <input type="text" id="${prefix}PostalCode" placeholder="Postcode*" pattern="^[1-9][0-9]{3}[a-zA-Z]{2}$" title="Voer een geldige postcode in (bijv. 1234AB)" required>
            <input type="text" id="${prefix}HouseNumber" placeholder="Huisnr. (en letter)*" maxlength="7" pattern="^[1-9][0-9]{0,5}[A-Z]?$" title="Voer een geldig huisnummer in (bijv. 123 of 123A)" required>
            <input type="text" id="${prefix}HouseExt" placeholder="Toevoeging" maxlength="10">
        </div>
        
        <div class="form-row">
            <input type="text" id="${prefix}Address" placeholder="Straat*" required>
            <input type="text" id="${prefix}City" placeholder="Plaats*" required>
        </div>
        
        ${cfg.includePhone || cfg.includeEmail ? `
        <div class="form-row">
            ${cfg.includePhone ? `<input type="tel" id="${prefix}Phone" placeholder="Telefoonnummer${cfg.phoneRequired ? '*' : ''}" ${cfg.phoneRequired ? 'required' : ''}>` : ''}
            ${cfg.includeEmail ? `<input type="email" id="${prefix}Email" placeholder="E-mailadres${cfg.emailRequired ? '*' : ''}" ${cfg.emailRequired ? 'required' : ''}>` : ''}
        </div>
        ` : ''}
        
        ${cfg.showSameAddressCheckbox ? `
        <div class="form-group">
            <label>
                <input type="checkbox" id="${prefix}SameAddress" onchange="toggleCustomerFormAddress('${prefix}')">
                Zelfde adres als originele abonnee
            </label>
        </div>
        ` : ''}
    `;

    document.getElementById(containerId).innerHTML = html;
}

/**
 * Gets customer data from a rendered customer form
 * @param {string} prefix - Prefix used when rendering the form
 * @returns {object} Customer data object
 */
function getCustomerFormData(prefix) {
    return {
        salutation: document.querySelector(`input[name="${prefix}Salutation"]:checked`)?.value || '',
        initials: document.getElementById(`${prefix}Initials`)?.value || '',
        middleName: document.getElementById(`${prefix}MiddleName`)?.value || '',
        lastName: document.getElementById(`${prefix}LastName`)?.value || '',
        postalCode: document.getElementById(`${prefix}PostalCode`)?.value || '',
        houseNumber: document.getElementById(`${prefix}HouseNumber`)?.value || '',
        houseExt: document.getElementById(`${prefix}HouseExt`)?.value || '',
        address: document.getElementById(`${prefix}Address`)?.value || '',
        city: document.getElementById(`${prefix}City`)?.value || '',
        phone: document.getElementById(`${prefix}Phone`)?.value || '',
        email: document.getElementById(`${prefix}Email`)?.value || ''
    };
}

/**
 * Sets customer data in a rendered customer form
 * @param {string} prefix - Prefix used when rendering the form
 * @param {object} data - Customer data object
 */
function setCustomerFormData(prefix, data) {
    if (data.salutation) {
        const salutationRadio = document.querySelector(`input[name="${prefix}Salutation"][value="${data.salutation}"]`);
        if (salutationRadio) salutationRadio.checked = true;
    }
    if (data.initials) document.getElementById(`${prefix}Initials`).value = data.initials;
    if (data.middleName) document.getElementById(`${prefix}MiddleName`).value = data.middleName;
    if (data.lastName) document.getElementById(`${prefix}LastName`).value = data.lastName;
    if (data.postalCode) document.getElementById(`${prefix}PostalCode`).value = data.postalCode;
    if (data.houseNumber) document.getElementById(`${prefix}HouseNumber`).value = data.houseNumber;
    if (data.houseExt) document.getElementById(`${prefix}HouseExt`).value = data.houseExt;
    if (data.address) document.getElementById(`${prefix}Address`).value = data.address;
    if (data.city) document.getElementById(`${prefix}City`).value = data.city;
    if (data.phone && document.getElementById(`${prefix}Phone`)) document.getElementById(`${prefix}Phone`).value = data.phone;
    if (data.email && document.getElementById(`${prefix}Email`)) document.getElementById(`${prefix}Email`).value = data.email;
}

/**
 * Toggles address fields visibility (for "same address" checkbox)
 * @param {string} prefix - Prefix used when rendering the form
 */
function toggleCustomerFormAddress(prefix) {
    const checkbox = document.getElementById(`${prefix}SameAddress`);
    const addressFields = ['PostalCode', 'HouseNumber', 'HouseExt', 'Address', 'City'];
    
    addressFields.forEach(field => {
        const element = document.getElementById(`${prefix}${field}`);
        if (element) {
            if (checkbox.checked) {
                element.disabled = true;
                element.removeAttribute('required');
                element.style.opacity = '0.5';
            } else {
                element.disabled = false;
                if (!field.includes('HouseExt') && !field.includes('MiddleName')) {
                    element.setAttribute('required', '');
                }
                element.style.opacity = '1';
            }
        }
    });
}

// ============================================================================
// End of DRY Component
// ============================================================================

// Subscription Pricing Information
const subscriptionPricing = {
    '1-jaar': { price: 52.00, perMonth: 4.33, description: '1 jaar - Jaarlijks betaald' },
    '2-jaar': { price: 98.00, perMonth: 4.08, description: '2 jaar - Jaarlijks betaald (5% korting)' },
    '3-jaar': { price: 140.00, perMonth: 3.89, description: '3 jaar - Jaarlijks betaald (10% korting)' },
    '1-jaar-maandelijks': { price: 54.00, perMonth: 4.50, description: '1 jaar - Maandelijks betaald' },
    '2-jaar-maandelijks': { price: 104.40, perMonth: 4.35, description: '2 jaar - Maandelijks betaald' },
    '3-jaar-maandelijks': { price: 151.20, perMonth: 4.20, description: '3 jaar - Maandelijks betaald' }
};

// Helper function to get pricing display
function getPricingDisplay(duration) {
    const pricing = subscriptionPricing[duration];
    if (!pricing) return '';
    return `€${pricing.perMonth.toFixed(2)}/maand (${pricing.description})`;
}

// ============================================================================
// PHASE 1: CALL SESSION MANAGEMENT
// ============================================================================

// Helper function to format time (seconds to HH:MM:SS or MM:SS)
function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Helper function to add contact moment to customer history
function addContactMoment(customerId, type, description) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    
    customer.contactHistory.unshift({
        id: Date.now(),
        type: type,
        date: new Date().toISOString(),
        description: description
    });
    
    saveCustomers();
    
    // Update display if this is the current customer
    if (currentCustomer && currentCustomer.id === customerId) {
        displayContactHistory();
    }
}

// Start Call Session
function startCallSession() {
    // Toon sessie info in bovenbalk
    document.getElementById('sessionInfo').style.display = 'flex';
    
    // Update service nummer
    const serviceLabels = {
        'AVROBODE': 'AVROBODE SERVICE',
        'MIKROGIDS': 'MIKROGIDS SERVICE',
        'NCRVGIDS': 'NCRVGIDS SERVICE',
        'ALGEMEEN': 'ALGEMEEN SERVICE'
    };
    document.getElementById('sessionServiceNumber').textContent = 
        serviceLabels[callSession.serviceNumber] || callSession.serviceNumber;
    
    // Update wachttijd
    document.getElementById('sessionWaitTime').textContent = 
        formatTime(callSession.waitTime);
    
    // Update beller naam
    document.getElementById('sessionCallerName').textContent = 
        callSession.customerName || 'Anonieme Beller';
    
    // Toon gesprek beëindigen knop
    document.getElementById('endCallBtn').style.display = 'inline-block';
    
    // Update agent status naar Busy
    autoSetAgentStatus('call_started');
    
    // Toon hold button
    const holdBtn = document.getElementById('holdCallBtn');
    if (holdBtn) {
        holdBtn.style.display = 'inline-block';
        holdBtn.innerHTML = '⏸️ In Wacht Zetten';
        holdBtn.classList.remove('on-hold');
    }
    
    // Toon debug end call button
    const debugEndBtn = document.getElementById('debugEndCallBtn');
    if (debugEndBtn) {
        debugEndBtn.style.display = 'block';
    }
    
    // Toon recording indicator (Phase 2B)
    if (recordingConfig.enabled) {
        const recordingIndicator = document.getElementById('recordingIndicator');
        if (recordingIndicator) {
            recordingIndicator.style.display = 'flex';
            callSession.recordingActive = true;
        }
    }
    
    // Start gespreksduur timer
    updateCallDuration();
    callSession.durationInterval = setInterval(updateCallDuration, 1000);
    
    // Update "Dit is de beller" knoppen zichtbaarheid
    updateIdentifyCallerButtons();
}

// Update Call Duration Timer
function updateCallDuration() {
    if (!callSession.active) return;
    
    const elapsed = Math.floor((Date.now() - callSession.startTime) / 1000);
    document.getElementById('sessionDuration').textContent = formatTime(elapsed);
}

// End Call Session
function endCallSession(forcedByCustomer = false) {
    if (!callSession.active) return;
    
    const callDuration = Math.floor((Date.now() - callSession.startTime) / 1000);
    
    // Voeg contact moment toe als beller geïdentificeerd was
    if (callSession.customerId) {
        const endReason = forcedByCustomer ? 'call_ended_by_customer' : 'call_ended_by_agent';
        addContactMoment(
            callSession.customerId,
            endReason,
            `${callSession.serviceNumber} call beëindigd (duur: ${formatTime(callDuration)}, wacht: ${formatTime(callSession.waitTime)})`
        );
    }
    
    // Stop timer
    if (callSession.durationInterval) {
        clearInterval(callSession.durationInterval);
    }
    
    // Save call session data for ACW/disposition
    lastCallSession = {
        customerId: callSession.customerId,
        customerName: callSession.customerName,
        serviceNumber: callSession.serviceNumber,
        waitTime: callSession.waitTime,
        startTime: callSession.startTime,
        callDuration: callDuration,
        totalHoldTime: callSession.totalHoldTime
    };
    
    // Reset session state
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
        // Update queue display zodat volgende beller zichtbaar wordt
        setTimeout(() => {
            updateQueueDisplay();
        }, 1000);
    }
    
    if (!forcedByCustomer) {
        showToast('Gesprek beëindigd', 'success');
    }
}

// Identify Caller as Customer
function identifyCallerAsCustomer(customerId) {
    if (!callSession.active || callSession.callerType !== 'anonymous') {
        return;
    }
    
    const customer = customers.find(c => c.id === customerId);
    if (!customer) {
        showToast('Klant niet gevonden', 'error');
        return;
    }
    
    // Update sessie state
    callSession.callerType = 'identified';
    callSession.customerId = customerId;
    callSession.customerName = `${customer.initials || customer.firstName} ${customer.middleName ? customer.middleName + ' ' : ''}${customer.lastName}`;
    
    // Update UI
    document.getElementById('sessionCallerName').textContent = callSession.customerName;
    
    // Verberg alle "Dit is de beller" knoppen
    updateIdentifyCallerButtons();
    
    // Voeg contact moment toe
    addContactMoment(customerId, 'call_identified', 
        `Beller geïdentificeerd tijdens ${callSession.serviceNumber} call`);
    
    showToast(`Beller geïdentificeerd als ${callSession.customerName}`, 'success');
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
function toggleCallHold() {
    if (!callSession.active) return;
    
    callSession.onHold = !callSession.onHold;
    
    const holdBtn = document.getElementById('holdCallBtn');
    const sessionInfo = document.getElementById('sessionInfo');
    
    if (callSession.onHold) {
        // Put call on hold
        holdBtn.innerHTML = '▶️ Hervatten';
        holdBtn.classList.add('on-hold');
        
        // Show hold indicator
        sessionInfo.classList.add('call-on-hold');
        
        // Add hold music indicator
        const holdIndicator = document.createElement('div');
        holdIndicator.id = 'holdIndicator';
        holdIndicator.className = 'hold-indicator';
        holdIndicator.innerHTML = '🎵 Klant in wacht';
        sessionInfo.appendChild(holdIndicator);
        
        // Track hold time
        callSession.holdStartTime = Date.now();
        
        showToast('Gesprek in wacht gezet', 'info');
        
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
        holdBtn.innerHTML = '⏸️ In Wacht Zetten';
        holdBtn.classList.remove('on-hold');
        
        sessionInfo.classList.remove('call-on-hold');
        
        // Remove hold indicator
        const holdIndicator = document.getElementById('holdIndicator');
        if (holdIndicator) holdIndicator.remove();
        
        // Calculate hold duration
        const holdDuration = Math.floor((Date.now() - callSession.holdStartTime) / 1000);
        callSession.totalHoldTime = (callSession.totalHoldTime || 0) + holdDuration;
        
        showToast(`Gesprek hervat (wacht: ${formatTime(holdDuration)})`, 'success');
        
        // Log resume
        if (callSession.customerId) {
            addContactMoment(
                callSession.customerId,
                'call_resumed',
                `Gesprek hervat na ${formatTime(holdDuration)} wachttijd`
            );
        }
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
            if (confirm(`✅ ${customerName} is succesvol aangemaakt.\n\nIs dit de persoon die belt?`)) {
                identifyCallerAsCustomer(customerId);
            }
        }, 800);
    }
}

// ============================================================================
// PHASE 1B: AGENT STATUS MANAGEMENT
// ============================================================================

// Set Agent Status
function setAgentStatus(newStatus) {
    // Validatie
    if (callSession.active && newStatus === 'ready') {
        showToast('Kan niet naar Beschikbaar tijdens actief gesprek', 'error');
        return;
    }
    
    const oldStatus = agentStatus.current;
    agentStatus.current = newStatus;
    
    // Update UI
    updateAgentStatusDisplay();
    
    // Update availability
    agentStatus.canReceiveCalls = (newStatus === 'ready');
    
    // Update queue display wanneer status wijzigt
    updateQueueDisplay();
    
    // Log status change
    console.log(`Agent status: ${oldStatus} → ${newStatus}`);
    
    // Close menu if open
    const menu = document.getElementById('agentStatusMenu');
    if (menu) {
        menu.style.display = 'none';
    }
    
    showToast(`Status gewijzigd naar: ${agentStatuses[newStatus].label}`, 'success');
}

// Update Agent Status Display
function updateAgentStatusDisplay() {
    const statusConfig = agentStatuses[agentStatus.current];
    const statusDot = document.getElementById('agentStatusDot');
    
    if (statusDot) {
        statusDot.textContent = statusConfig.icon;
    }
}

// Toggle Status Menu
function toggleStatusMenu() {
    const menu = document.getElementById('agentStatusMenu');
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
}

// Auto Set Agent Status (during call flow)
function autoSetAgentStatus(callState) {
    if (callState === 'call_started') {
        agentStatus.current = 'busy';
        agentStatus.canReceiveCalls = false;
        updateAgentStatusDisplay();
    } else if (callState === 'call_ended') {
        // Phase 5A: Start ACW after call ends
        startACW();
    }
}

// ============================================================================
// PHASE 5A: AFTER CALL WORK (ACW) & DISPOSITION
// ============================================================================

// Start ACW (After Call Work)
function startACW() {
    agentStatus.current = 'acw';
    agentStatus.acwStartTime = Date.now();
    agentStatus.canReceiveCalls = false;
    
    // Update UI
    updateAgentStatusDisplay();
    
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
        if (acwTimerEl && agentStatus.current === 'acw') {
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
    
    // Automatically set to Ready after ACW
    setAgentStatus('ready');
    
    if (manual) {
        showToast('Klaar voor volgende gesprek', 'success');
    } else {
        showToast('ACW tijd verlopen - Status: Beschikbaar', 'info');
    }
}

// Manual Finish ACW (triggered by "Klaar" button)
function manualFinishACW() {
    // Check if disposition has been filled
    const dispositionModal = document.getElementById('dispositionModal');
    const isModalOpen = dispositionModal && dispositionModal.style.display === 'flex';
    
    if (isModalOpen) {
        showToast('Vul eerst het nabewerkingsscherm in voordat je ACW afrondt', 'warning');
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
        customerNameEl.textContent = sessionData.customerName || 'Anonieme Beller';
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
    
    if (!category) {
        outcomeSelect.disabled = true;
        outcomeSelect.innerHTML = '<option value="">Selecteer eerst een categorie</option>';
        return;
    }
    
    const outcomes = dispositionCategories[category].outcomes;
    outcomeSelect.disabled = false;
    outcomeSelect.innerHTML = '<option value="">Selecteer uitkomst...</option>';
    
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
        showToast('Selecteer categorie en uitkomst', 'error');
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
        const outcomeLabel = getOutcomeLabel(category, outcome);
        addContactMoment(
            sessionData.customerId,
            'call_disposition',
            `${dispositionCategories[category].label}: ${outcomeLabel}${notes ? ' - ' + notes : ''}`
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
    
    showToast('Gesprek succesvol afgerond', 'success');
    
    // Manual end ACW (since disposition is complete)
    endACW(true);
}

// Cancel Disposition
function cancelDisposition() {
    // Just close modal, ACW timer continues
    document.getElementById('dispositionModal').style.display = 'none';
    showToast('Disposition geannuleerd - ACW loopt door', 'warning');
}

// ============================================================================
// Phase 6: Call Queue Management Functions
// ============================================================================

/**
 * Initialize queue from localStorage
 */
function initializeQueue() {
    const savedQueue = localStorage.getItem('callQueue');
    if (savedQueue) {
        try {
            callQueue = JSON.parse(savedQueue);
            updateQueueDisplay();
            updateDebugQueuePreview();
        } catch (e) {
            console.error('Error loading queue from localStorage:', e);
            callQueue = {
                enabled: false,
                queue: [],
                currentPosition: 0,
                autoAdvance: true
            };
        }
    }
}

/**
 * Save queue to localStorage
 */
function saveQueue() {
    try {
        localStorage.setItem('callQueue', JSON.stringify(callQueue));
    } catch (e) {
        console.error('Error saving queue to localStorage:', e);
    }
}

/**
 * Generate a single queue entry
 * @param {number|null} customerId - ID of customer (null for anonymous)
 * @param {string} callerType - 'known' or 'anonymous'
 * @returns {object} Queue entry object
 */
function generateQueueEntry(customerId = null, callerType = 'anonymous') {
    const serviceNumbers = ['AVROBODE', 'MIKROGIDS', 'NCRVGIDS', 'ALGEMEEN'];
    const randomService = serviceNumbers[Math.floor(Math.random() * serviceNumbers.length)];
    
    let entry = {
        id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        callerType: callerType,
        customerId: customerId,
        customerName: 'Anonieme Beller',
        serviceNumber: randomService,
        waitTime: Math.floor(Math.random() * (300 - 30 + 1)) + 30, // 30-300 sec
        queuedAt: Date.now(),
        priority: Math.floor(Math.random() * 5) + 1
    };
    
    // Voor bekende klant
    if (customerId && callerType === 'known') {
        const customer = customers.find(c => c.id === customerId);
        if (customer) {
            entry.customerName = `${customer.firstName || customer.initials || ''} ${customer.middleName ? customer.middleName + ' ' : ''}${customer.lastName}`.trim();
            if (!entry.customerName) {
                entry.customerName = 'Klant #' + customerId;
            }
        }
    }
    
    return entry;
}

/**
 * Generate queue with specified size and mix
 * Called from debug menu
 */
function debugGenerateQueue() {
    const queueSize = parseInt(document.getElementById('debugQueueSize')?.value) || 5;
    const queueMix = document.getElementById('debugQueueMix')?.value || 'balanced';
    
    // Clear bestaande queue
    callQueue.queue = [];
    callQueue.currentPosition = 0;
    
    // Bepaal verdeling
    let knownPercentage = 0.5;
    switch(queueMix) {
        case 'mostly_known': knownPercentage = 0.8; break;
        case 'mostly_anonymous': knownPercentage = 0.2; break;
        case 'all_known': knownPercentage = 1.0; break;
        case 'all_anonymous': knownPercentage = 0.0; break;
    }
    
    // Genereer queue entries
    for (let i = 0; i < queueSize; i++) {
        const isKnown = Math.random() < knownPercentage && customers.length > 0;
        
        if (isKnown) {
            const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
            callQueue.queue.push(generateQueueEntry(randomCustomer.id, 'known'));
        } else {
            callQueue.queue.push(generateQueueEntry(null, 'anonymous'));
        }
    }
    
    callQueue.enabled = true;
    saveQueue();
    updateQueueDisplay();
    updateDebugQueuePreview();
    
    showToast(`✅ Wachtrij gegenereerd met ${queueSize} bellers`, 'success');
    
    // Update debug status
    const debugStatus = document.getElementById('debugQueueStatus');
    if (debugStatus) {
        debugStatus.textContent = `Actief - ${callQueue.queue.length} wachtenden`;
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
        
        // Save to localStorage periodically (every 5 seconds to reduce writes)
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
function debugClearQueue() {
    if (confirm('🗑️ Wachtrij volledig wissen?')) {
        // Stop wait time updates
        stopQueueWaitTimeUpdate();
        
        callQueue = {
            enabled: false,
            queue: [],
            currentPosition: 0,
            autoAdvance: true,
            waitTimeInterval: null
        };
        
        saveQueue();
        updateQueueDisplay();
        updateDebugQueuePreview();
        
        const debugStatus = document.getElementById('debugQueueStatus');
        if (debugStatus) {
            debugStatus.textContent = 'Uitgeschakeld';
        }
        showToast('✅ Wachtrij gewist', 'info');
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
        
        item.innerHTML = `
            <div class="debug-queue-item-info">
                <div class="debug-queue-item-name">
                    ${index + 1}. ${entry.customerName}
                </div>
                <div class="debug-queue-item-details">
                    ${entry.serviceNumber} • 
                    ${entry.callerType === 'known' ? '👤 Bekend' : '❓ Anoniem'}
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
function acceptNextCall() {
    if (!callQueue.enabled || callQueue.queue.length === 0) {
        showToast('⚠️ Geen bellers in wachtrij', 'error');
        return;
    }
    
    if (callSession.active) {
        showToast('⚠️ Er is al een actief gesprek', 'error');
        return;
    }
    
    // Check agent status
    if (agentStatus.current !== 'ready') {
        showToast('⚠️ Agent status moet "Beschikbaar" zijn om gesprek te accepteren', 'error');
        return;
    }
    
    // Haal eerste entry uit queue
    const nextEntry = callQueue.queue.shift();
    
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
        `📞 Gesprek gestart met ${queueEntry.customerName}`,
        'success'
    );
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeData();
    initializeQueue();
    updateTime();
    setInterval(updateTime, 1000);
    updateCustomerActionButtons();
    // Initialize Phase 3 components
    initDeliveryDatePicker();
    initArticleSearch();
    // Initialize agent status display (agent starts as ready)
    updateAgentStatusDisplay();

    const advancedFilterIds = ['searchName', 'searchPhone', 'searchEmail'];
    const hasAdvancedValues = advancedFilterIds.some(id => {
        const input = document.getElementById(id);
        return input && input.value.trim().length > 0;
    });
    setAdditionalFiltersOpen(hasAdvancedValues);
});

// Initialize Demo Data
function initializeData() {
    const savedCustomers = localStorage.getItem('customers');
    if (savedCustomers) {
        customers = JSON.parse(savedCustomers);
    } else {
        customers = [
            {
                id: 1,
                salutation: 'Dhr.',
                firstName: 'J.',
                middleName: 'de',
                lastName: 'Vries',
                postalCode: '1012AB',
                houseNumber: '42',
                address: 'Damstraat 42',
                city: 'Amsterdam',
                email: 'jan.devries@email.nl',
                phone: '06-12345678',
                optinEmail: 'yes',
                optinPhone: 'yes',
                optinPost: 'no',
                deliveryRemarks: {
                    default: 'Bezorgen bij de buren indien niet thuis',
                    lastUpdated: '2024-09-10T10:30:00.000Z',
                    history: [
                        {
                            date: '2024-09-10T10:30:00.000Z',
                            remark: 'Bezorgen bij de buren indien niet thuis',
                            updatedBy: 'Agent Jan Vos'
                        }
                    ]
                },
                subscriptions: [
                    {
                        id: 1,
                        magazine: 'Avrobode',
                        duration: '1-jaar',
                        startDate: '2023-01-15',
                        endDate: '2024-01-15',
                        status: 'ended',
                        lastEdition: '2024-01-01'
                    },
                    {
                        id: 5,
                        magazine: 'Mikrogids',
                        duration: '2-jaar',
                        startDate: '2024-03-01',
                        status: 'active',
                        lastEdition: '2024-10-01'
                    }
                ],
                articles: [
                    {
                        id: 1,
                        articleName: 'Jaargang bundel 2023',
                        quantity: 1,
                        price: 29.95,
                        orderDate: '2024-09-15',
                        desiredDeliveryDate: '2024-09-25',
                        deliveryStatus: 'delivered',
                        trackingNumber: '3SABCD1234567890NL',
                        paymentStatus: 'paid',
                        paymentMethod: 'iDEAL',
                        paymentDate: '2024-09-15',
                        actualDeliveryDate: '2024-09-24',
                        returnDeadline: '2024-10-08',
                        notes: ''
                    },
                    {
                        id: 2,
                        articleName: 'Extra TV gids week editie',
                        quantity: 2,
                        price: 7.90,
                        orderDate: '2024-10-01',
                        desiredDeliveryDate: '2024-10-12',
                        deliveryStatus: 'in_transit',
                        trackingNumber: '3SABCD9876543210NL',
                        paymentStatus: 'paid',
                        paymentMethod: 'iDEAL',
                        paymentDate: '2024-10-01',
                        actualDeliveryDate: null,
                        returnDeadline: null,
                        notes: 'Bezorgen bij buren indien niet thuis'
                    }
                ],
                contactHistory: [
                    {
                        id: 1,
                        type: 'Nieuw abonnement',
                        date: '2024-03-01 10:30',
                        description: 'Abonnement Mikrogids aangemaakt. Start per direct.'
                    },
                    {
                        id: 2,
                        type: 'Abonnement beëindigd',
                        date: '2024-01-15 14:20',
                        description: 'Abonnement Avrobode beëindigd na reguliere looptijd van 1 jaar.'
                    },
                    {
                        id: 3,
                        type: 'Adreswijziging',
                        date: '2023-09-12 10:15',
                        description: 'Adres gewijzigd van Kerkstraat 10 naar Damstraat 42.'
                    },
                    {
                        id: 4,
                        type: 'Nieuw abonnement',
                        date: '2023-01-15 09:45',
                        description: 'Abonnement Avrobode aangemaakt. Start per direct.'
                    }
                ]
            },
            {
                id: 2,
                salutation: 'Mevr.',
                firstName: 'M.',
                middleName: '',
                lastName: 'Jansen',
                postalCode: '3011BD',
                houseNumber: '15',
                address: 'Wijnhaven 15',
                city: 'Rotterdam',
                email: 'maria.jansen@email.nl',
                phone: '06-87654321',
                optinEmail: 'yes',
                optinPhone: 'no',
                optinPost: 'yes',
                subscriptions: [
                    {
                        id: 2,
                        magazine: 'Mikrogids',
                        duration: '2-jaar',
                        startDate: '2022-06-01',
                        endDate: '2024-06-01',
                        status: 'ended',
                        lastEdition: '2024-05-28'
                    },
                    {
                        id: 3,
                        magazine: 'Ncrvgids',
                        duration: '1-jaar-maandelijks',
                        startDate: '2023-03-10',
                        status: 'active',
                        lastEdition: '2024-09-28'
                    }
                ],
                articles: [],
                contactHistory: [
                    {
                        id: 1,
                        type: 'Telefoongesprek',
                        date: '2024-09-20 11:20',
                        description: 'Vraag over facturatie. Uitleg gegeven over automatische incasso.'
                    },
                    {
                        id: 2,
                        type: 'Abonnement beëindigd',
                        date: '2024-06-01 09:15',
                        description: 'Abonnement Mikrogids beëindigd na reguliere looptijd van 2 jaar.'
                    },
                    {
                        id: 3,
                        type: 'Extra abonnement',
                        date: '2023-03-10 15:30',
                        description: 'Tweede abonnement (Ncrvgids) toegevoegd.'
                    },
                    {
                        id: 4,
                        type: 'Nieuw abonnement',
                        date: '2022-06-01 14:45',
                        description: 'Abonnement Mikrogids aangemaakt voor 2 jaar.'
                    }
                ]
            },
            {
                id: 3,
                firstName: 'Pieter',
                lastName: 'Bakker',
                postalCode: '2511VA',
                houseNumber: '88',
                address: 'Lange Voorhout 88',
                city: 'Den Haag',
                email: 'p.bakker@email.nl',
                phone: '06-11223344',
                subscriptions: [
                    {
                        id: 4,
                        magazine: 'Avrobode',
                        duration: '3-jaar',
                        startDate: '2024-02-01',
                        status: 'active',
                        lastEdition: '2024-10-01'
                    }
                ],
                articles: [],
                contactHistory: [
                    {
                        id: 1,
                        type: 'Nieuw abonnement',
                        date: '2024-02-01 13:15',
                        description: 'Abonnement Avrobode aangemaakt via telefonische bestelling.'
                    }
                ]
            },
            {
                id: 4,
                salutation: 'Dhr.',
                firstName: 'H.',
                middleName: 'van',
                lastName: 'Dijk',
                postalCode: '3512JE',
                houseNumber: '23',
                address: 'Oudegracht 23',
                city: 'Utrecht',
                email: 'h.vandijk@email.nl',
                phone: '06-98765432',
                optinEmail: 'yes',
                optinPhone: 'yes',
                optinPost: 'yes',
                subscriptions: [
                    {
                        id: 6,
                        magazine: 'Avrobode',
                        duration: '1-jaar-maandelijks',
                        startDate: '2023-11-01',
                        status: 'active',
                        lastEdition: '2024-10-01'
                    },
                    {
                        id: 7,
                        magazine: 'Mikrogids',
                        duration: '2-jaar',
                        startDate: '2023-05-15',
                        status: 'active',
                        lastEdition: '2024-10-01'
                    }
                ],
                articles: [],
                contactHistory: [
                    {
                        id: 1,
                        type: 'Extra abonnement',
                        date: '2023-11-01 14:45',
                        description: 'Tweede abonnement (Avrobode) toegevoegd.'
                    },
                    {
                        id: 2,
                        type: 'Nieuw abonnement',
                        date: '2023-05-15 16:20',
                        description: 'Abonnement Mikrogids aangemaakt voor 2 jaar.'
                    }
                ]
            }
        ];
        saveCustomers();
    }
}

// Save Customers to LocalStorage
function saveCustomers() {
    localStorage.setItem('customers', JSON.stringify(customers));
}

// Update Customer Action Buttons visibility
function updateCustomerActionButtons() {
    const hasCustomer = currentCustomer !== null;
    const resendBtn = document.getElementById('resendMagazineBtn');
    const winbackBtn = document.getElementById('winbackFlowBtn');
    
    if (resendBtn) {
        resendBtn.style.display = hasCustomer ? 'inline-flex' : 'none';
    }
    if (winbackBtn) {
        winbackBtn.style.display = hasCustomer ? 'inline-flex' : 'none';
    }
}

// Update Time Display
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('nl-NL', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    const dateString = now.toLocaleDateString('nl-NL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('currentTime').textContent = `${dateString} - ${timeString}`;
}

// Search Customer
function normalizePhone(value = '') {
    return value.replace(/\D/g, '');
}

function getSearchFilters() {
    const postalCode = document.getElementById('searchPostalCode').value.toUpperCase().trim();
    const houseNumber = document.getElementById('searchHouseNumber').value.trim();
    const nameInput = document.getElementById('searchName');
    const phoneInput = document.getElementById('searchPhone');
    const emailInput = document.getElementById('searchEmail');

    const name = nameInput ? nameInput.value.toLowerCase().trim() : '';
    const phone = normalizePhone(phoneInput ? phoneInput.value : '');
    const email = emailInput ? emailInput.value.toLowerCase().trim() : '';

    return { postalCode, houseNumber, name, phone, email };
}

function matchesCustomerName(customer, nameQuery) {
    if (!nameQuery) return true;

    const nameCandidates = [
        customer.firstName,
        customer.lastName,
        `${customer.firstName} ${customer.lastName}`,
        customer.middleName ? `${customer.firstName} ${customer.middleName} ${customer.lastName}` : null
    ]
        .filter(Boolean)
        .map(value => value.toLowerCase());

    return nameCandidates.some(value => value.includes(nameQuery));
}

function matchesCustomerPhone(customer, phoneQuery) {
    if (!phoneQuery) return true;

    const customerPhone = normalizePhone(customer.phone || '');
    return customerPhone.includes(phoneQuery);
}

function matchesCustomerEmail(customer, emailQuery) {
    if (!emailQuery) return true;

    const customerEmail = (customer.email || '').toLowerCase();
    return customerEmail.includes(emailQuery);
}

function buildSearchQueryLabel() {
    const postalCode = document.getElementById('searchPostalCode').value.trim();
    const houseNumber = document.getElementById('searchHouseNumber').value.trim();
    const nameInput = document.getElementById('searchName');
    const name = nameInput ? nameInput.value.trim() : '';

    const labelParts = [];
    
    if (postalCode || houseNumber) {
        const addressLabel = [postalCode, houseNumber].filter(Boolean).join(' ');
        labelParts.push(addressLabel);
    }
    if (name) labelParts.push(`Naam: ${name}`);

    return labelParts.length ? labelParts.join(' • ') : 'alle klanten';
}

function setAdditionalFiltersOpen(isOpen) {
    const panel = document.getElementById('additionalFiltersPanel');
    const toggle = document.getElementById('additionalFiltersToggle');

    if (!panel || !toggle) return;

    if (isOpen) {
        panel.classList.add('is-open');
        panel.style.display = 'grid';
    } else {
        panel.classList.remove('is-open');
        panel.style.display = 'none';
    }
    toggle.setAttribute('aria-expanded', String(isOpen));
}

function toggleAdditionalFilters() {
    const panel = document.getElementById('additionalFiltersPanel');
    if (!panel) return;

    const willOpen = !panel.classList.contains('is-open');
    setAdditionalFiltersOpen(willOpen);
}

function searchCustomer() {
    const filters = getSearchFilters();

    const results = customers.filter(customer => {
        const matchPostal = !filters.postalCode || customer.postalCode === filters.postalCode;
        const matchHouse = !filters.houseNumber || customer.houseNumber === filters.houseNumber;
        const matchName = matchesCustomerName(customer, filters.name);
        const matchPhone = matchesCustomerPhone(customer, filters.phone);
        const matchEmail = matchesCustomerEmail(customer, filters.email);
        
        return matchPostal && matchHouse && matchName && matchPhone && matchEmail;
    });

    // Update search state
    searchState.results = results;
    searchState.currentPage = 1;
    searchState.sortBy = 'name';
    
    // Sort results
    sortResultsData();
    
    // Display results
    displayPaginatedResults();
}

// Handle Enter key press in search fields
function handleSearchKeyPress(event) {
    if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault();
        searchCustomer();
    }
}

// Display Paginated Results
function displayPaginatedResults() {
    const { results, currentPage, itemsPerPage } = searchState;
    
    // Update summary in left panel
    const searchSummary = document.getElementById('searchSummary');
    const resultCount = document.getElementById('resultCount');
    resultCount.textContent = results.length;
    searchSummary.style.display = results.length > 0 ? 'block' : 'none';
    
    // Show/hide views
    const searchResultsView = document.getElementById('searchResultsView');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const customerDetail = document.getElementById('customerDetail');
    
    if (results.length === 0) {
        // Show empty state in center panel
        searchResultsView.style.display = 'none';
        customerDetail.style.display = 'none';
        welcomeMessage.style.display = 'flex';
        welcomeMessage.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🔍</span>
                <h2>Geen klanten gevonden</h2>
                <p>Pas je zoekcriteria aan en probeer opnieuw</p>
            </div>
        `;
        return;
    }
    
    // Hide welcome and customer detail, show results view
    welcomeMessage.style.display = 'none';
    customerDetail.style.display = 'none';
    searchResultsView.style.display = 'block';
    
    // Calculate pagination
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const pageResults = results.slice(startIdx, endIdx);
    
    // Update results title and range
    const searchQuery = buildSearchQueryLabel();
    document.getElementById('resultsTitle').textContent = `🔍 Zoekresultaten: "${searchQuery}"`;
    document.getElementById('resultsRange').textContent = 
        `Toont ${startIdx + 1}-${Math.min(endIdx, results.length)} van ${results.length}`;
    
    // Render results
    const container = document.getElementById('paginatedResults');
    container.innerHTML = pageResults.map(customer => renderCustomerRow(customer)).join('');
    
    // Render pagination
    renderPagination();
    
    // Scroll to top of results
    searchResultsView.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Render a single customer row
function getCustomerInitials(customer) {
    const providedInitials = customer.initials?.trim();
    if (providedInitials) return providedInitials;

    const firstName = (customer.firstName || '').replace(/\./g, ' ').trim();
    if (!firstName) return '';

    const initials = firstName
        .split(/[\s-]+/)
        .filter(Boolean)
        .map(part => part[0].toUpperCase())
        .join('.');

    return initials ? `${initials}.` : '';
}

function splitLastNameComponents(customer) {
    let lastName = (customer.lastName || '').trim();
    let insertion = (customer.middleName || '').trim();

    if (!insertion && lastName.includes(' ')) {
        const lower = lastName.toLowerCase();
        const matchedPrefix = NAME_INSERTION_PREFIXES.find(prefix => lower.startsWith(`${prefix} `));
        if (matchedPrefix) {
            insertion = lastName.substring(0, matchedPrefix.length);
            const remainder = lastName.substring(matchedPrefix.length).trim();
            if (remainder) {
                lastName = remainder;
            } else {
                // If no remainder, fallback to original lastName
                insertion = (customer.middleName || '').trim();
            }
        }
    }

    return { lastName, insertion };
}

function buildNameRest(customer) {
    const restParts = [];
    if (customer.salutation) restParts.push(customer.salutation.trim());
    if (customer.firstName) restParts.push(customer.firstName.trim());
    return restParts.join(' ').trim();
}

function getInitialsDisplay(customer) {
    const initials = getCustomerInitials(customer) || '-';
    const rest = buildNameRest(customer);
    const showRest = rest && normalizeNameFragment(rest) !== normalizeNameFragment(initials);
    return {
        initials,
        rest: showRest ? rest : ''
    };
}

function formatLastNameSection(customer) {
    const { lastName, insertion } = splitLastNameComponents(customer);

    if (!lastName && !insertion) return '';
    if (!lastName) return insertion;

    return insertion
        ? `<span class="last-name">${lastName}</span>, ${insertion}`
        : `<span class="last-name">${lastName}</span>`;
}

function renderCustomerRow(customer) {
    const lastNameSection = formatLastNameSection(customer) || '-';
    const { initials, rest } = getInitialsDisplay(customer);
    
    const activeSubscriptions = customer.subscriptions.filter(s => s.status === 'active');
    const inactiveSubscriptions = customer.subscriptions.filter(s => s.status !== 'active');
    
    // Build subscription badges with subscription numbers
    let subscriptionBadges = '';
    if (activeSubscriptions.length > 0) {
        subscriptionBadges = activeSubscriptions.map(s => 
            `<span class="subscription-badge active">${s.magazine}</span>`
        ).join('');
    }
    if (inactiveSubscriptions.length > 0 && activeSubscriptions.length === 0) {
        subscriptionBadges = `<span class="subscription-badge inactive">${inactiveSubscriptions[0].magazine} (beëindigd)</span>`;
    }
    if (!subscriptionBadges) {
        subscriptionBadges = '<span style="color: var(--text-secondary); font-size: 0.875rem;">Geen actief</span>';
    }
    
    // Get primary active subscription number (or first subscription if no active)
    let subscriberNumber = '-';
    const primarySubscription = activeSubscriptions.length > 0 
        ? activeSubscriptions[0] 
        : customer.subscriptions[0];
    
    if (primarySubscription) {
        subscriberNumber = generateSubscriptionNumber(customer.id, primarySubscription.id);
    }
    
    // Show identify button only during anonymous call
    const showIdentifyBtn = callSession.active && callSession.callerType === 'anonymous';
    
    return `
        <tr class="result-row" onclick="selectCustomer(${customer.id})">
            <td class="result-row-lastname">${lastNameSection}</td>
            <td class="result-row-initials">
                <span class="initials-value">${initials}</span>
            </td>
            <td class="result-row-address">
                <span>${customer.address}</span><br>
                <span>${customer.postalCode} ${customer.city}</span>
            </td>
            <td class="result-row-subscriptions">${subscriptionBadges}</td>
            <td class="result-row-subscriber-number">${subscriberNumber}</td>
            <td class="result-row-actions">
                <button class="btn btn-small" onclick="event.stopPropagation(); selectCustomer(${customer.id})">
                    Bekijken
                </button>
                ${showIdentifyBtn ? `
                    <button class="btn btn-small btn-primary btn-identify-caller" 
                            onclick="event.stopPropagation(); identifyCallerAsCustomer(${customer.id})">
                        👤 Identificeer
                    </button>
                ` : ''}
            </td>
        </tr>
    `;
}

// Render Pagination Controls
function renderPagination() {
    const { results, currentPage, itemsPerPage } = searchState;
    const totalPages = Math.ceil(results.length / itemsPerPage);
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Previous button
    html += `<button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
        ← Vorige
    </button>`;
    
    // Page numbers (with smart ellipsis)
    const pageNumbers = getPageNumbers(currentPage, totalPages);
    pageNumbers.forEach(page => {
        if (page === '...') {
            html += `<span class="page-ellipsis">...</span>`;
        } else {
            const activeClass = page === currentPage ? 'active' : '';
            html += `<button class="page-btn ${activeClass}" onclick="goToPage(${page})">${page}</button>`;
        }
    });
    
    // Next button
    html += `<button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
        Volgende →
    </button>`;
    
    pagination.innerHTML = html;
}

// Get page numbers with smart ellipsis
function getPageNumbers(currentPage, totalPages) {
    const pages = [];
    const maxVisible = 7; // Maximum number of page buttons to show
    
    if (totalPages <= maxVisible) {
        // Show all pages
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }
    } else {
        // Always show first page
        pages.push(1);
        
        // Calculate range around current page
        let rangeStart = Math.max(2, currentPage - 1);
        let rangeEnd = Math.min(totalPages - 1, currentPage + 1);
        
        // Adjust range if near start or end
        if (currentPage <= 3) {
            rangeEnd = Math.min(5, totalPages - 1);
        }
        if (currentPage >= totalPages - 2) {
            rangeStart = Math.max(2, totalPages - 4);
        }
        
        // Add ellipsis before range if needed
        if (rangeStart > 2) {
            pages.push('...');
        }
        
        // Add range
        for (let i = rangeStart; i <= rangeEnd; i++) {
            pages.push(i);
        }
        
        // Add ellipsis after range if needed
        if (rangeEnd < totalPages - 1) {
            pages.push('...');
        }
        
        // Always show last page
        pages.push(totalPages);
    }
    
    return pages;
}

// Go to specific page
function goToPage(page) {
    const totalPages = Math.ceil(searchState.results.length / searchState.itemsPerPage);
    
    if (page < 1 || page > totalPages) return;
    
    searchState.currentPage = page;
    displayPaginatedResults();
}

// Scroll to results (from left panel button)
function scrollToResults() {
    // Hide customer detail and welcome message
    document.getElementById('customerDetail').style.display = 'none';
    document.getElementById('welcomeMessage').style.display = 'none';
    
    // Show search results view
    const searchResultsView = document.getElementById('searchResultsView');
    searchResultsView.style.display = 'block';
    
    // Scroll to results
    searchResultsView.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Clear search results and return to previous state
function clearSearchResults() {
    // Clear search state
    searchState.results = [];
    searchState.currentPage = 1;
    
    // Hide search results view and summary
    document.getElementById('searchResultsView').style.display = 'none';
    document.getElementById('searchSummary').style.display = 'none';
    
    // Clear search input fields
    document.getElementById('searchName').value = '';
    document.getElementById('searchPostalCode').value = '';
    document.getElementById('searchHouseNumber').value = '';
    const phoneInput = document.getElementById('searchPhone');
    if (phoneInput) phoneInput.value = '';
    const emailInput = document.getElementById('searchEmail');
    if (emailInput) emailInput.value = '';
    setAdditionalFiltersOpen(false);
    
    // Always restore welcome message HTML (in case it was overwritten by empty search)
    const welcomeMessage = document.getElementById('welcomeMessage');
    welcomeMessage.innerHTML = `
        <div class="empty-state">
            <span class="empty-icon">👤</span>
            <h2>Welkom bij Klantenservice</h2>
            <p>Zoek een klant of start een nieuwe actie</p>
        </div>
    `;
    
    // Check if there was a customer loaded before the search
    if (currentCustomer) {
        // Show the previously loaded customer detail
        document.getElementById('customerDetail').style.display = 'block';
        welcomeMessage.style.display = 'none';
    } else {
        // No customer was loaded, show welcome message
        document.getElementById('customerDetail').style.display = 'none';
        welcomeMessage.style.display = 'flex';
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Close customer detail and return to welcome screen
function closeCustomerDetail() {
    // Clear current customer
    currentCustomer = null;
    
    // Hide customer detail
    document.getElementById('customerDetail').style.display = 'none';
    
    // Restore and show welcome message
    const welcomeMessage = document.getElementById('welcomeMessage');
    welcomeMessage.innerHTML = `
        <div class="empty-state">
            <span class="empty-icon">👤</span>
            <h2>Welkom bij Klantenservice</h2>
            <p>Zoek een klant of start een nieuwe actie</p>
        </div>
    `;
    welcomeMessage.style.display = 'flex';
    
    // Hide search results if visible
    document.getElementById('searchResultsView').style.display = 'none';
    document.getElementById('searchSummary').style.display = 'none';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Sort results
function sortResults(sortBy) {
    searchState.sortBy = sortBy;
    searchState.currentPage = 1; // Reset to first page when sorting
    sortResultsData();
    displayPaginatedResults();
}

// Sort results data
function sortResultsData() {
    const { sortBy } = searchState;
    
    searchState.results.sort((a, b) => {
        switch(sortBy) {
            case 'name':
                // Sort by last name, then first name
                const lastNameCompare = a.lastName.localeCompare(b.lastName);
                if (lastNameCompare !== 0) return lastNameCompare;
                return a.firstName.localeCompare(b.firstName);
            
            case 'postal':
                return a.postalCode.localeCompare(b.postalCode);
            
            case 'subscriptions':
                // Sort by number of active subscriptions (descending)
                const aActive = a.subscriptions.filter(s => s.status === 'active').length;
                const bActive = b.subscriptions.filter(s => s.status === 'active').length;
                return bActive - aActive;
            
            default:
                return 0;
        }
    });
}

// Legacy Display Search Results (keep for backward compatibility but not used)
function displaySearchResults(results) {
    // This function is now replaced by displayPaginatedResults
    // Keeping it for backward compatibility
    searchState.results = results;
    searchState.currentPage = 1;
    displayPaginatedResults();
}

// Select Customer
function selectCustomer(customerId) {
    currentCustomer = customers.find(c => c.id === customerId);
    if (!currentCustomer) return;

    // Hide welcome message and search results view
    document.getElementById('welcomeMessage').style.display = 'none';
    document.getElementById('searchResultsView').style.display = 'none';
    
    // Show customer detail
    const customerDetail = document.getElementById('customerDetail');
    customerDetail.style.display = 'block';

    // Populate customer info
    const fullName = currentCustomer.middleName 
        ? `${currentCustomer.salutation || ''} ${currentCustomer.firstName} ${currentCustomer.middleName} ${currentCustomer.lastName}`.trim()
        : `${currentCustomer.salutation || ''} ${currentCustomer.firstName} ${currentCustomer.lastName}`.trim();
    
    document.getElementById('customerName').textContent = fullName;
    document.getElementById('customerAddress').textContent = 
        `${currentCustomer.address}, ${currentCustomer.postalCode} ${currentCustomer.city}`;
    document.getElementById('customerEmail').textContent = currentCustomer.email;
    document.getElementById('customerPhone').textContent = currentCustomer.phone;

    // Show deceased status banner if applicable
    displayDeceasedStatusBanner();

    // Display subscriptions
    displaySubscriptions();

    // Display articles
    displayArticles();

    // Display contact history
    displayContactHistory();

    // Update action buttons visibility
    updateCustomerActionButtons();
    
    // Update identify caller button visibility
    updateIdentifyCallerButtons();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Display Deceased Status Banner
function displayDeceasedStatusBanner() {
    // Remove any existing banner first
    const existingBanner = document.querySelector('.deceased-status-banner');
    if (existingBanner) {
        existingBanner.remove();
    }

    // Check if customer is deceased by looking at contact history
    if (!currentCustomer || !currentCustomer.contactHistory) return;
    
    const hasDeceasedEntry = currentCustomer.contactHistory.some(entry => 
        entry.type.toLowerCase().includes('overlijden') || 
        entry.description.toLowerCase().includes('overlijden')
    );

    if (hasDeceasedEntry) {
        // Create and insert the banner
        const banner = document.createElement('div');
        banner.className = 'deceased-status-banner';
        banner.innerHTML = `
            <div class="deceased-banner-icon">⚠️</div>
            <div class="deceased-banner-content">
                <strong>Deze klant is overleden</strong>
                <p>Let op bij het verwerken van abonnementen en bestellingen</p>
            </div>
        `;
        
        // Insert after customer header
        const customerDetail = document.getElementById('customerDetail');
        const customerHeader = customerDetail.querySelector('.customer-header');
        if (customerHeader && customerHeader.parentNode) {
            // Insert after the customer-header div
            customerHeader.parentNode.insertBefore(banner, customerHeader.nextSibling);
        }
    }
}

// Display Subscriptions
function displaySubscriptions() {
    const subscriptionsList = document.getElementById('subscriptionsList');
    
    if (currentCustomer.subscriptions.length === 0) {
        subscriptionsList.innerHTML = '<p class="empty-state-small">Geen abonnementen</p>';
        return;
    }

    // Separate active, ended, restituted, and transferred subscriptions
    const activeSubscriptions = currentCustomer.subscriptions.filter(sub => sub.status === 'active');
    const endedSubscriptions = currentCustomer.subscriptions.filter(sub => sub.status === 'ended' || sub.status === 'cancelled');
    const restitutedSubscriptions = currentCustomer.subscriptions.filter(sub => sub.status === 'restituted');
    const transferredSubscriptions = currentCustomer.subscriptions.filter(sub => sub.status === 'transferred');

    let html = '';

    // Display active subscriptions
    if (activeSubscriptions.length > 0) {
        html += '<div class="subscription-group"><h4 class="subscription-group-title">Actieve Abonnementen</h4>';
        html += activeSubscriptions.map(sub => {
            const pricingInfo = sub.duration ? getPricingDisplay(sub.duration) : 'Oude prijsstructuur';
            
            return `
                <div class="subscription-item">
                    <div class="subscription-info">
                        <div class="subscription-name">📰 ${sub.magazine}</div>
                        <div class="subscription-details">
                            Start: ${formatDate(sub.startDate)} • 
                            Laatste editie: ${formatDate(sub.lastEdition)}<br>
                            ${pricingInfo}
                        </div>
                    </div>
                    <div class="subscription-actions">
                        <span class="subscription-status status-active">Actief</span>
                        <button class="icon-btn" onclick="editSubscription(${sub.id})" title="Bewerken">✏️</button>
                        <button class="icon-btn" onclick="cancelSubscription(${sub.id})" title="Opzeggen">🚫</button>
                    </div>
                </div>
            `;
        }).join('');
        html += '</div>';
    }

    // Display ended subscriptions
    if (endedSubscriptions.length > 0) {
        html += '<div class="subscription-group"><h4 class="subscription-group-title">Beëindigde Abonnementen</h4>';
        html += endedSubscriptions.map(sub => {
            const pricingInfo = sub.duration ? getPricingDisplay(sub.duration) : 'Oude prijsstructuur';
            const statusClass = sub.status === 'cancelled' ? 'status-cancelled' : 'status-ended';
            const statusText = sub.status === 'cancelled' ? 'Opgezegd' : 'Beëindigd';
            
            return `
                <div class="subscription-item subscription-ended">
                    <div class="subscription-info">
                        <div class="subscription-name">📰 ${sub.magazine}</div>
                        <div class="subscription-details">
                            Start: ${formatDate(sub.startDate)} • 
                            ${sub.endDate ? `Einde: ${formatDate(sub.endDate)} • ` : ''}
                            Laatste editie: ${formatDate(sub.lastEdition)}<br>
                            ${pricingInfo}
                        </div>
                    </div>
                    <div class="subscription-actions">
                        <span class="subscription-status ${statusClass}">${statusText}</span>
                        <button class="btn btn-small btn-winback" onclick="startWinbackForSubscription(${sub.id})" title="Winback/Opzegging">
                            🎯 Winback/Opzegging
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        html += '</div>';
    }

    // Display restituted subscriptions (cancelled with refund due to deceased)
    if (restitutedSubscriptions.length > 0) {
        html += '<div class="subscription-group"><h4 class="subscription-group-title">Gerestitueerde Abonnementen</h4>';
        html += restitutedSubscriptions.map(sub => {
            const pricingInfo = sub.duration ? getPricingDisplay(sub.duration) : 'Oude prijsstructuur';
            const refundInfo = sub.refundInfo ? `<br>Restitutie naar: ${sub.refundInfo.email}` : '';
            
            return `
                <div class="subscription-item subscription-restituted">
                    <div class="subscription-info">
                        <div class="subscription-name">📰 ${sub.magazine}</div>
                        <div class="subscription-details">
                            Start: ${formatDate(sub.startDate)} • 
                            ${sub.endDate ? `Einde: ${formatDate(sub.endDate)} • ` : ''}
                            Laatste editie: ${formatDate(sub.lastEdition)}<br>
                            ${pricingInfo}${refundInfo}
                        </div>
                    </div>
                    <div class="subscription-actions">
                        <span class="subscription-status status-restituted">Gerestitueerd</span>
                        <button class="btn btn-small btn-secondary" onclick="revertRestitution(${sub.id})" title="Overzetten naar andere persoon">
                            🔄 Overzetten
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        html += '</div>';
    }

    // Display transferred subscriptions (transferred to another person due to deceased)
    if (transferredSubscriptions.length > 0) {
        html += '<div class="subscription-group"><h4 class="subscription-group-title">Overgezette Abonnementen</h4>';
        html += transferredSubscriptions.map(sub => {
            const pricingInfo = sub.duration ? getPricingDisplay(sub.duration) : 'Oude prijsstructuur';
            let transferInfo = '';
            if (sub.transferredTo) {
                const transferName = sub.transferredTo.middleName 
                    ? `${sub.transferredTo.firstName} ${sub.transferredTo.middleName} ${sub.transferredTo.lastName}`
                    : `${sub.transferredTo.firstName} ${sub.transferredTo.lastName}`;
                transferInfo = `<br>Overgezet naar: ${transferName} (${sub.transferredTo.email})`;
            }
            
            return `
                <div class="subscription-item subscription-transferred">
                    <div class="subscription-info">
                        <div class="subscription-name">� ${sub.magazine}</div>
                        <div class="subscription-details">
                            Start: ${formatDate(sub.startDate)} • 
                            Laatste editie: ${formatDate(sub.lastEdition)}<br>
                            ${pricingInfo}${transferInfo}
                        </div>
                    </div>
                    <div class="subscription-actions">
                        <span class="subscription-status status-transferred">Overgezet</span>
                    </div>
                </div>
            `;
        }).join('');
        html += '</div>';
    }

    subscriptionsList.innerHTML = html;
}

// Phase 5B: Extended Contact Types for Better Display
const contactTypeLabels = {
    // Call-related
    'call_started_anonymous': { label: 'Anonieme call gestart', icon: '📞', color: '#fbbf24' },
    'call_started_identified': { label: 'Call gestart', icon: '📞', color: '#3b82f6' },
    'call_identified': { label: 'Beller geïdentificeerd', icon: '👤', color: '#10b981' },
    'call_ended_by_agent': { label: 'Call beëindigd (agent)', icon: '📞', color: '#6b7280' },
    'call_ended_by_customer': { label: 'Call beëindigd (klant)', icon: '📞', color: '#ef4444' },
    'call_disposition': { label: 'Gesprek afgerond', icon: '📋', color: '#3b82f6' },
    'call_hold': { label: 'Gesprek in wacht', icon: '⏸️', color: '#f59e0b' },
    'call_resumed': { label: 'Gesprek hervat', icon: '▶️', color: '#10b981' },
    'recording_started': { label: 'Opname gestart', icon: '🔴', color: '#dc2626' },
    
    // ACW and follow-up
    'acw_completed': { label: 'Nabewerking voltooid', icon: '✅', color: '#10b981' },
    'follow_up_scheduled': { label: 'Follow-up gepland', icon: '📅', color: '#8b5cf6' },
    
    // Agent status
    'agent_status_change': { label: 'Agent status gewijzigd', icon: '🔄', color: '#6b7280' },
    
    // Subscription-related
    'subscription_created': { label: 'Abonnement aangemaakt', icon: '➕', color: '#10b981' },
    'subscription_changed': { label: 'Abonnement gewijzigd', icon: '✏️', color: '#3b82f6' },
    'subscription_cancelled': { label: 'Abonnement opgezegd', icon: '❌', color: '#ef4444' },
    
    // Article sales
    'article_sold': { label: 'Artikel verkocht', icon: '🛒', color: '#10b981' },
    
    // Delivery
    'magazine_resent': { label: 'Editie opnieuw verzonden', icon: '📬', color: '#3b82f6' },
    
    // Default
    'default': { label: 'Contact', icon: '📝', color: '#6b7280' }
};

// Get Contact Type Display Info
function getContactTypeInfo(type) {
    return contactTypeLabels[type] || contactTypeLabels['default'];
}

// Display Contact History
function displayContactHistory() {
    const historyContainer = document.getElementById('contactHistory');
    
    if (!currentCustomer || currentCustomer.contactHistory.length === 0) {
        historyContainer.innerHTML = '<div class="empty-state-small"><p>Geen contactgeschiedenis beschikbaar</p></div>';
        return;
    }

    // Sort by date descending
    const sortedHistory = [...currentCustomer.contactHistory].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );

    historyContainer.innerHTML = sortedHistory.map((item, index) => {
        const typeInfo = getContactTypeInfo(item.type);
        return `
        <div class="timeline-item">
            <div class="timeline-dot" style="background-color: ${typeInfo.color}"></div>
            <div class="timeline-header" onclick="toggleTimelineItem(${index})">
                <span class="timeline-type" style="color: ${typeInfo.color}">
                    ${typeInfo.icon} ${typeInfo.label}
                </span>
                <span class="timeline-expand" id="expand-${index}">▼</span>
                <span class="timeline-date">${formatDateTime(item.date)}</span>
            </div>
            <div class="timeline-content" id="content-${index}">
                ${item.description}
            </div>
        </div>
        `;
    }).join('');
}

// Toggle Timeline Item (Accordion)
function toggleTimelineItem(index) {
    const content = document.getElementById(`content-${index}`);
    const expand = document.getElementById(`expand-${index}`);
    
    content.classList.toggle('expanded');
    expand.classList.toggle('expanded');
}

// Format Date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('nl-NL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Format DateTime
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('nl-NL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Show New Subscription Form
function showNewSubscription() {
    // Set today's date as default start date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('subStartDate').value = today;
    
    // Prefill customer data if a customer is currently selected
    if (currentCustomer) {
        const initialsEl = document.getElementById('subInitials');
        const lastNameEl = document.getElementById('subLastName');
        const postalCodeEl = document.getElementById('subPostalCode');
        const houseNumberEl = document.getElementById('subHouseNumber');
        const addressEl = document.getElementById('subAddress');
        const cityEl = document.getElementById('subCity');
        const emailEl = document.getElementById('subEmail');
        const phoneEl = document.getElementById('subPhone');
        
        if (initialsEl) initialsEl.value = currentCustomer.firstName;
        if (lastNameEl) lastNameEl.value = currentCustomer.lastName;
        if (postalCodeEl) postalCodeEl.value = currentCustomer.postalCode;
        if (houseNumberEl) houseNumberEl.value = currentCustomer.houseNumber;
        
        // Extract street name from address (remove house number)
        const streetName = currentCustomer.address.replace(/\s+\d+.*$/, '');
        if (addressEl) addressEl.value = streetName;
        
        if (cityEl) cityEl.value = currentCustomer.city;
        if (emailEl) emailEl.value = currentCustomer.email;
        if (phoneEl) phoneEl.value = currentCustomer.phone;
    } else {
        // Clear form if no customer selected (new customer)
        document.getElementById('subscriptionForm').reset();
        document.getElementById('subStartDate').value = today;
    }
    
    document.getElementById('newSubscriptionForm').style.display = 'flex';
}

// Create Subscription
function createSubscription(event) {
    event.preventDefault();

    const salutation = document.querySelector('input[name="subSalutation"]:checked').value;
    const initials = document.getElementById('subInitials').value;
    const middleName = document.getElementById('subMiddleName').value;
    const lastName = document.getElementById('subLastName').value;
    const houseNumber = document.getElementById('subHouseNumber').value;
    const houseExt = document.getElementById('subHouseExt').value;
    
    // Construct full name
    const firstName = initials;
    const fullLastName = middleName ? `${middleName} ${lastName}` : lastName;
    
    const formData = {
        salutation: salutation,
        firstName: firstName,
        middleName: middleName,
        lastName: fullLastName,
        postalCode: document.getElementById('subPostalCode').value.toUpperCase(),
        houseNumber: houseExt ? `${houseNumber}${houseExt}` : houseNumber,
        address: `${document.getElementById('subAddress').value} ${houseNumber}${houseExt}`,
        city: document.getElementById('subCity').value,
        email: document.getElementById('subEmail').value,
        phone: document.getElementById('subPhone').value,
        magazine: document.getElementById('subMagazine').value,
        duration: document.getElementById('subDuration').value,
        startDate: document.getElementById('subStartDate').value,
        paymentMethod: document.querySelector('input[name="subPayment"]:checked').value,
        iban: document.getElementById('subIBAN')?.value || '',
        optinEmail: document.querySelector('input[name="subOptinEmail"]:checked').value,
        optinPhone: document.querySelector('input[name="subOptinPhone"]:checked').value,
        optinPost: document.querySelector('input[name="subOptinPost"]:checked').value
    };

    // Check if this is for an existing customer
    if (currentCustomer) {
        // Add subscription to existing customer
        const newSubscription = {
            id: Date.now(),
            magazine: formData.magazine,
            duration: formData.duration,
            startDate: formData.startDate,
            status: 'active',
            lastEdition: new Date().toISOString().split('T')[0]
        };
        
        currentCustomer.subscriptions.push(newSubscription);
        
        currentCustomer.contactHistory.unshift({
            id: currentCustomer.contactHistory.length + 1,
            type: 'Extra abonnement',
            date: new Date().toISOString(),
            description: `Extra abonnement ${formData.magazine} (${subscriptionPricing[formData.duration]?.description || formData.duration}) toegevoegd.`
        });
        
        saveCustomers();
        closeForm('newSubscriptionForm');
        showToast('Extra abonnement succesvol toegevoegd!', 'success');
        
        // Refresh display
        selectCustomer(currentCustomer.id);
    } else {
        // Create new customer with subscription
        const newCustomer = {
            id: customers.length > 0 ? Math.max(...customers.map(c => c.id)) + 1 : 1,
            firstName: formData.firstName,
            lastName: formData.lastName,
            postalCode: formData.postalCode,
            houseNumber: formData.houseNumber,
            address: formData.address,
            city: formData.city,
            email: formData.email,
            phone: formData.phone,
            subscriptions: [
                {
                    id: Date.now(),
                    magazine: formData.magazine,
                    duration: formData.duration,
                    startDate: formData.startDate,
                    status: 'active',
                    lastEdition: new Date().toISOString().split('T')[0]
                }
            ],
            contactHistory: [
                {
                    id: 1,
                    type: 'Nieuw abonnement',
                    date: new Date().toISOString(),
                    description: `Abonnement ${formData.magazine} (${subscriptionPricing[formData.duration]?.description || formData.duration}) aangemaakt via telefonische bestelling.`
                }
            ]
        };

        customers.push(newCustomer);
        saveCustomers();
        closeForm('newSubscriptionForm');
        showToast('Nieuw abonnement succesvol aangemaakt!', 'success');
        
        // Select the new customer
        selectCustomer(newCustomer.id);
        
        // PHASE 4: Show identification prompt if anonymous call active
        showSuccessIdentificationPrompt(newCustomer.id, `${formData.firstName} ${formData.lastName}`);
    }
    
    // Reset form
    document.getElementById('subscriptionForm').reset();
}

// Edit Customer
function editCustomer() {
    if (!currentCustomer) return;

    document.getElementById('editCustomerId').value = currentCustomer.id;
    
    // Set salutation
    const salutation = currentCustomer.salutation || 'Dhr.';
    document.querySelector(`input[name="editSalutation"][value="${salutation}"]`).checked = true;
    
    // Handle name fields
    document.getElementById('editInitials').value = currentCustomer.firstName;
    document.getElementById('editMiddleName').value = currentCustomer.middleName || '';
    document.getElementById('editLastName').value = currentCustomer.lastName;
    
    // Handle address fields
    document.getElementById('editPostalCode').value = currentCustomer.postalCode;
    const houseNumberMatch = currentCustomer.houseNumber?.match(/^(\d+)(.*)$/);
    document.getElementById('editHouseNumber').value = houseNumberMatch ? houseNumberMatch[1] : currentCustomer.houseNumber;
    document.getElementById('editHouseExt').value = houseNumberMatch && houseNumberMatch[2] ? houseNumberMatch[2] : '';
    document.getElementById('editAddress').value = currentCustomer.address.replace(/ \d+.*$/, '');
    document.getElementById('editCity').value = currentCustomer.city;
    
    // Contact info
    document.getElementById('editEmail').value = currentCustomer.email;
    document.getElementById('editPhone').value = currentCustomer.phone;
    
    // Set optin preferences (default to 'yes' if not set)
    const optinEmail = currentCustomer.optinEmail || 'yes';
    const optinPhone = currentCustomer.optinPhone || 'yes';
    const optinPost = currentCustomer.optinPost || 'yes';
    
    document.querySelector(`input[name="editOptinEmail"][value="${optinEmail}"]`).checked = true;
    document.querySelector(`input[name="editOptinPhone"][value="${optinPhone}"]`).checked = true;
    document.querySelector(`input[name="editOptinPost"][value="${optinPost}"]`).checked = true;

    document.getElementById('editCustomerForm').style.display = 'flex';
}

// Save Customer Edit
function saveCustomerEdit(event) {
    event.preventDefault();

    const customerId = parseInt(document.getElementById('editCustomerId').value);
    const customer = customers.find(c => c.id === customerId);
    
    if (!customer) return;

    // Get form values
    customer.salutation = document.querySelector('input[name="editSalutation"]:checked').value;
    customer.firstName = document.getElementById('editInitials').value;
    customer.middleName = document.getElementById('editMiddleName').value;
    customer.lastName = document.getElementById('editLastName').value;
    customer.postalCode = document.getElementById('editPostalCode').value.toUpperCase();
    
    const houseNumber = document.getElementById('editHouseNumber').value;
    const houseExt = document.getElementById('editHouseExt').value;
    customer.houseNumber = houseExt ? `${houseNumber}${houseExt}` : houseNumber;
    customer.address = `${document.getElementById('editAddress').value} ${customer.houseNumber}`;
    customer.city = document.getElementById('editCity').value;
    customer.email = document.getElementById('editEmail').value;
    customer.phone = document.getElementById('editPhone').value;
    
    // Save optin preferences
    customer.optinEmail = document.querySelector('input[name="editOptinEmail"]:checked').value;
    customer.optinPhone = document.querySelector('input[name="editOptinPhone"]:checked').value;
    customer.optinPost = document.querySelector('input[name="editOptinPost"]:checked').value;

    // Add to contact history
    customer.contactHistory.unshift({
        id: customer.contactHistory.length + 1,
        type: 'Gegevens gewijzigd',
        date: new Date().toISOString(),
        description: 'Klantgegevens bijgewerkt.'
    });

    saveCustomers();
    closeForm('editCustomerForm');
    showToast('Klantgegevens succesvol bijgewerkt!', 'success');
    
    // Refresh display
    selectCustomer(customerId);
}

// Show Resend Magazine Form
function showResendMagazine() {
    if (!currentCustomer) {
        showToast('Selecteer eerst een klant', 'error');
        return;
    }

    const select = document.getElementById('resendSubscription');
    select.innerHTML = '<option value="">Selecteer abonnement...</option>' +
        currentCustomer.subscriptions.map(sub => 
            `<option value="${sub.id}">${sub.magazine} - Laatste editie: ${formatDate(sub.lastEdition)}</option>`
        ).join('');

    document.getElementById('resendMagazineForm').style.display = 'flex';
}

// Resend Magazine
function resendMagazine() {
    const subId = parseInt(document.getElementById('resendSubscription').value);
    const reason = document.getElementById('resendReason').value;
    
    if (!subId) {
        showToast('Selecteer een abonnement', 'error');
        return;
    }

    const subscription = currentCustomer.subscriptions.find(s => s.id === subId);
    if (!subscription) return;

    // Add to contact history
    const reasonText = {
        'not_received': 'niet ontvangen',
        'damaged': 'beschadigd',
        'lost': 'kwijt',
        'other': 'anders'
    }[reason];

    currentCustomer.contactHistory.unshift({
        id: currentCustomer.contactHistory.length + 1,
        type: 'Editie verzonden',
        date: new Date().toISOString(),
        description: `Laatste editie van ${subscription.magazine} opnieuw verzonden. Reden: ${reasonText}.`
    });

    saveCustomers();
    closeForm('resendMagazineForm');
    showToast(`Editie van ${subscription.magazine} wordt opnieuw verzonden!`, 'success');
    
    // Refresh display
    displayContactHistory();
}

// Show Editorial Complaint Form
function showEditorialComplaintForm() {
    if (!currentCustomer) {
        showToast('Selecteer eerst een klant', 'error');
        return;
    }

    // Populate magazine dropdown with customer's subscriptions
    const select = document.getElementById('editorialComplaintMagazine');
    const uniqueMagazines = [...new Set(currentCustomer.subscriptions.map(sub => sub.magazine))];
    
    if (uniqueMagazines.length === 0) {
        select.innerHTML = '<option value="">Geen abonnementen beschikbaar</option>';
    } else {
        select.innerHTML = '<option value="">Selecteer magazine...</option>' +
            uniqueMagazines.map(mag => `<option value="${mag}">${mag}</option>`).join('');
    }

    // Reset form fields
    document.getElementById('editorialComplaintType').value = 'klacht';
    document.getElementById('editorialComplaintCategory').value = 'inhoud';
    document.getElementById('editorialComplaintDescription').value = '';
    document.getElementById('editorialComplaintEdition').value = '';
    document.getElementById('editorialComplaintFollowup').checked = false;

    document.getElementById('editorialComplaintForm').style.display = 'flex';
}

// Submit Editorial Complaint
function submitEditorialComplaint() {
    const magazine = document.getElementById('editorialComplaintMagazine').value;
    const type = document.getElementById('editorialComplaintType').value;
    const category = document.getElementById('editorialComplaintCategory').value;
    const description = document.getElementById('editorialComplaintDescription').value.trim();
    const edition = document.getElementById('editorialComplaintEdition').value.trim();
    const followup = document.getElementById('editorialComplaintFollowup').checked;

    // Validation
    if (!magazine) {
        showToast('Selecteer een magazine', 'error');
        return;
    }

    if (!description) {
        showToast('Voer een beschrijving in', 'error');
        return;
    }

    // Build contact history description
    const typeLabels = {
        'klacht': 'Klacht',
        'opmerking': 'Opmerking',
        'suggestie': 'Suggestie',
        'compliment': 'Compliment'
    };

    const categoryLabels = {
        'inhoud': 'Inhoud artikel',
        'foto': 'Foto/afbeelding',
        'fout': 'Fout in tekst',
        'programma': 'TV/Radio programma',
        'puzzel': 'Puzzel',
        'advertentie': 'Advertentie',
        'overig': 'Overig'
    };

    let historyDescription = `${typeLabels[type]} voor redactie ${magazine} - ${categoryLabels[category]}. ${description}`;
    
    if (edition) {
        historyDescription += ` Editie: ${edition}.`;
    }
    
    if (followup) {
        historyDescription += ' Klant verwacht terugkoppeling.';
    }

    // Add to contact history
    currentCustomer.contactHistory.unshift({
        id: Date.now(),
        type: `Redactie ${typeLabels[type]}`,
        date: new Date().toISOString(),
        description: historyDescription
    });

    saveCustomers();
    closeForm('editorialComplaintForm');
    showToast(`${typeLabels[type]} voor redactie geregistreerd!`, 'success');
    
    // Refresh display
    displayContactHistory();
}

// Edit Subscription
// Edit Subscription
function editSubscription(subId) {
    if (!currentCustomer) return;
    
    const subscription = currentCustomer.subscriptions.find(s => s.id === subId);
    if (!subscription) {
        showToast('Abonnement niet gevonden', 'error');
        return;
    }
    
    // Populate form with current subscription data
    document.getElementById('editSubId').value = subId;
    document.getElementById('editSubMagazine').value = subscription.magazine;
    document.getElementById('editSubDuration').value = subscription.duration || '1-jaar';
    document.getElementById('editSubStartDate').value = subscription.startDate;
    document.getElementById('editSubStatus').value = subscription.status || 'active';
    
    // Show form
    document.getElementById('editSubscriptionForm').style.display = 'flex';
}

// Save Subscription Edit
function saveSubscriptionEdit(event) {
    event.preventDefault();
    
    if (!currentCustomer) return;
    
    const subId = parseInt(document.getElementById('editSubId').value);
    const subscription = currentCustomer.subscriptions.find(s => s.id === subId);
    
    if (!subscription) {
        showToast('Abonnement niet gevonden', 'error');
        return;
    }
    
    // Store old values for history
    const oldMagazine = subscription.magazine;
    const oldDuration = subscription.duration;
    const oldStatus = subscription.status;
    
    // Update subscription
    subscription.magazine = document.getElementById('editSubMagazine').value;
    subscription.duration = document.getElementById('editSubDuration').value;
    subscription.startDate = document.getElementById('editSubStartDate').value;
    subscription.status = document.getElementById('editSubStatus').value;
    
    // Build change description
    let changes = [];
    if (oldMagazine !== subscription.magazine) {
        changes.push(`Magazine gewijzigd van ${oldMagazine} naar ${subscription.magazine}`);
    }
    if (oldDuration !== subscription.duration) {
        const oldPricing = subscriptionPricing[oldDuration]?.description || 'onbekend';
        const newPricing = subscriptionPricing[subscription.duration]?.description || 'onbekend';
        changes.push(`Duur gewijzigd van ${oldPricing} naar ${newPricing}`);
    }
    if (oldStatus !== subscription.status) {
        const statusNames = {
            'active': 'Actief',
            'paused': 'Gepauzeerd',
            'cancelled': 'Opgezegd'
        };
        changes.push(`Status gewijzigd van ${statusNames[oldStatus]} naar ${statusNames[subscription.status]}`);
    }
    
    // Add to contact history
    currentCustomer.contactHistory.unshift({
        id: currentCustomer.contactHistory.length + 1,
        type: 'Abonnement gewijzigd',
        date: new Date().toISOString(),
        description: `Abonnement bewerkt. ${changes.join('. ')}.`
    });
    
    saveCustomers();
    closeForm('editSubscriptionForm');
    showToast('Abonnement succesvol bijgewerkt!', 'success');
    
    // Refresh display
    selectCustomer(currentCustomer.id);
}

// Cancel Subscription (triggers winback flow)
function cancelSubscription(subId) {
    const subscription = currentCustomer.subscriptions.find(s => s.id === subId);
    if (!subscription) return;
    
    // Store subscription ID for winback flow
    window.cancellingSubscriptionId = subId;
    showWinbackFlow();
}

// Start Winback Flow for an Ended Subscription
function startWinbackForSubscription(subId) {
    if (!currentCustomer) return;
    
    const subscription = currentCustomer.subscriptions.find(s => s.id === subId);
    if (!subscription) return;
    
    // Store subscription ID for winback flow
    window.cancellingSubscriptionId = subId;
    window.isWinbackForEndedSub = true;
    showWinbackFlow();
}

// Show Winback Flow
function showWinbackFlow() {
    if (!currentCustomer) {
        showToast('Selecteer eerst een klant', 'error');
        return;
    }

    // If no subscription is selected yet, use the first active subscription
    if (!window.cancellingSubscriptionId && currentCustomer.subscriptions.length > 0) {
        const activeSubscription = currentCustomer.subscriptions.find(s => s.status === 'Actief');
        if (activeSubscription) {
            window.cancellingSubscriptionId = activeSubscription.id;
        } else if (currentCustomer.subscriptions.length > 0) {
            window.cancellingSubscriptionId = currentCustomer.subscriptions[0].id;
        }
    }

    // Reset winback flow
    document.querySelectorAll('.winback-step').forEach(step => step.style.display = 'none');
    document.getElementById('winbackStep1').style.display = 'block';
    
    document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
    document.querySelector('[data-step="1"]').classList.add('active');

    document.getElementById('winbackFlow').style.display = 'flex';
}

// Winback Next Step
function winbackNextStep(stepNumber) {
    // Validation
    if (stepNumber === 2) {
        const selectedReason = document.querySelector('input[name="cancelReason"]:checked');
        if (!selectedReason) {
            showToast('Selecteer een reden', 'error');
            return;
        }
        
        // Special handling for deceased
        if (selectedReason.value === 'deceased') {
            winbackHandleDeceased();
            return;
        }
        
        // Generate offers based on reason
        generateWinbackOffers(selectedReason.value);
    }
    
    if (stepNumber === 3) {
        if (!selectedOffer) {
            showToast('Selecteer een aanbod', 'error');
            return;
        }
        
        // Generate script for step 3
        generateWinbackScript();
    }

    // Hide all steps
    document.querySelectorAll('.winback-step').forEach(step => step.style.display = 'none');
    
    // Show selected step
    document.getElementById(`winbackStep${stepNumber}`).style.display = 'block';
    
    // Update step indicator
    document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
    document.querySelector(`[data-step="${stepNumber}"]`).classList.add('active');
}

// Winback Previous Step
function winbackPrevStep(stepNumber) {
    if (stepNumber === '1b') {
        document.querySelectorAll('.winback-step').forEach(step => step.style.display = 'none');
        document.getElementById('winbackStep1b').style.display = 'block';
    } else if (typeof stepNumber === 'string') {
        document.querySelectorAll('.winback-step').forEach(step => step.style.display = 'none');
        document.getElementById(`winbackStep${stepNumber}`).style.display = 'block';
    } else {
        winbackNextStep(stepNumber);
    }
}

// Generate Winback Offers
function generateWinbackOffers(reason) {
    const offers = {
        price: [
            {
                id: 1,
                title: '3 Maanden 50% Korting',
                description: 'Profiteer van 50% korting op de komende 3 maanden',
                discount: '50% korting'
            },
            {
                id: 2,
                title: '6 Maanden 25% Korting',
                description: 'Krijg 25% korting gedurende 6 maanden',
                discount: '25% korting'
            }
        ],
        content: [
            {
                id: 3,
                title: 'Gratis Upgrade',
                description: 'Upgrade naar premium editie zonder extra kosten',
                discount: 'Gratis upgrade'
            },
            {
                id: 4,
                title: 'Extra Content Pakket',
                description: 'Ontvang toegang tot online extra content',
                discount: 'Gratis extra\'s'
            }
        ],
        delivery: [
            {
                id: 5,
                title: 'Prioriteit Levering',
                description: 'Gegarandeerde levering voor 12:00 op vrijdag',
                discount: 'Premium service'
            },
            {
                id: 6,
                title: '1 Maand Gratis',
                description: 'Als excuus: volgende maand gratis',
                discount: '1 maand gratis'
            }
        ],
        other: [
            {
                id: 7,
                title: '2 Maanden Gratis',
                description: 'Blijf nog 1 jaar en krijg 2 maanden cadeau',
                discount: '2 maanden gratis'
            },
            {
                id: 8,
                title: 'Flexibel Abonnement',
                description: 'Pas op ieder moment zonder kosten aan of stop',
                discount: 'Flexibele voorwaarden'
            }
        ]
    };

    const relevantOffers = offers[reason] || offers.other;
    const offersContainer = document.getElementById('winbackOffers');
    
    offersContainer.innerHTML = relevantOffers.map(offer => `
        <div class="offer-card" onclick="selectOffer(${offer.id}, '${offer.title}', '${offer.description}')">
            <div class="offer-title">${offer.title}</div>
            <div class="offer-description">${offer.description}</div>
            <div class="offer-discount">${offer.discount}</div>
        </div>
    `).join('');
}

// Select Offer
function selectOffer(offerId, title, description) {
    selectedOffer = { id: offerId, title, description };
    
    // Update UI
    document.querySelectorAll('.offer-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
}

// Generate Winback Script
function generateWinbackScript() {
    if (!selectedOffer) return;
    
    const scriptElement = document.getElementById('winbackScript');
    scriptElement.innerHTML = `
        <strong>Script voor aanbod presentatie:</strong><br><br>
        "Ik begrijp dat u het abonnement wilt opzeggen. We waarderen u als klant enorm en willen graag dat u blijft. 
        Daarom wil ik u een speciaal aanbod doen:<br><br>
        <strong>${selectedOffer.title}</strong><br>
        ${selectedOffer.description}<br><br>
        Zou dit u helpen om het abonnement aan te houden?"
    `;
}

// Handle Deceased Options - Show all subscriptions
function winbackHandleDeceased() {
    const activeSubscriptions = currentCustomer.subscriptions.filter(s => s.status === 'active');
    
    if (activeSubscriptions.length === 0) {
        showToast('Geen actieve abonnementen gevonden', 'error');
        return;
    }
    
    // Update count
    document.getElementById('deceasedSubCount').textContent = activeSubscriptions.length;
    
    // Generate subscription cards
    const container = document.getElementById('deceasedSubscriptionsList');
    container.innerHTML = activeSubscriptions.map(sub => `
        <div class="deceased-subscription-card" data-sub-id="${sub.id}">
            <div class="deceased-sub-header">
                <h4>📰 ${sub.magazine}</h4>
                <span class="sub-start-date">Start: ${formatDate(sub.startDate)}</span>
            </div>
            <div class="form-group">
                <label>Actie voor dit abonnement:</label>
                <div class="radio-group">
                    <label class="radio-option">
                        <input type="radio" name="action_${sub.id}" value="cancel_refund" required>
                        <span>Opzeggen met restitutie</span>
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="action_${sub.id}" value="transfer" required>
                        <span>Overzetten op andere persoon</span>
                    </label>
                </div>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.winback-step').forEach(step => step.style.display = 'none');
    document.getElementById('winbackStep1b').style.display = 'block';
}

// Process Deceased Subscriptions
function processDeceasedSubscriptions() {
    const activeSubscriptions = currentCustomer.subscriptions.filter(s => s.status === 'active');
    const subscriptionActions = [];
    
    // Collect all actions
    for (const sub of activeSubscriptions) {
        const selectedAction = document.querySelector(`input[name="action_${sub.id}"]:checked`);
        if (!selectedAction) {
            showToast(`Selecteer een actie voor ${sub.magazine}`, 'error');
            return;
        }
        subscriptionActions.push({
            subscription: sub,
            action: selectedAction.value
        });
    }
    
    // Store for later processing
    window.deceasedSubscriptionActions = subscriptionActions;
    
    // Check if we need transfer form (if any subscription needs transfer)
    const needsTransfer = subscriptionActions.some(sa => sa.action === 'transfer');
    const needsRefund = subscriptionActions.some(sa => sa.action === 'cancel_refund');
    
    if (needsTransfer && needsRefund) {
        // Both actions needed, show combined form
        showDeceasedCombinedForm();
    } else if (needsTransfer) {
        // Only transfer
        showDeceasedTransferForm();
    } else {
        // Only refund
        showDeceasedRefundForm();
    }
}

// Show Deceased Refund Form
function showDeceasedRefundForm() {
    const refundSubs = window.deceasedSubscriptionActions.filter(sa => sa.action === 'cancel_refund');
    
    const listHtml = `
        <p><strong>Op te zeggen abonnementen:</strong></p>
        <ul>
            ${refundSubs.map(sa => `<li>📰 ${sa.subscription.magazine}</li>`).join('')}
        </ul>
    `;
    document.getElementById('refundSubscriptionsList').innerHTML = listHtml;
    
    document.querySelectorAll('.winback-step').forEach(step => step.style.display = 'none');
    document.getElementById('winbackStep1c').style.display = 'block';
    
    // Pre-fill email placeholder
    const refundEmailInput = document.getElementById('refundEmail');
    if (currentCustomer.email) {
        refundEmailInput.placeholder = `Bijv. ${currentCustomer.email} of ander e-mailadres`;
    }
}

// Show Deceased Transfer Form
function showDeceasedTransferForm() {
    const transferSubs = window.deceasedSubscriptionActions.filter(sa => sa.action === 'transfer');
    
    const listHtml = `
        <p><strong>Over te zetten abonnementen:</strong></p>
        <ul>
            ${transferSubs.map(sa => `<li>📰 ${sa.subscription.magazine}</li>`).join('')}
        </ul>
    `;
    document.getElementById('transferSubscriptionsList').innerHTML = listHtml;
    
    document.querySelectorAll('.winback-step').forEach(step => step.style.display = 'none');
    document.getElementById('winbackStep1d').style.display = 'block';
    
    // Render unified customer form
    renderCustomerForm('transferCustomerForm', 'transfer', {
        phoneRequired: true,
        emailRequired: true,
        showSameAddressCheckbox: true
    });
    
    // Setup same address functionality
    const checkbox = document.getElementById('transferSameAddress');
    checkbox.addEventListener('change', function() {
        if (this.checked && currentCustomer) {
            setCustomerFormData('transfer', {
                postalCode: currentCustomer.postalCode,
                houseNumber: currentCustomer.houseNumber,
                address: currentCustomer.address,
                city: currentCustomer.city
            });
        }
    });
}

// Show Deceased Combined Form
function showDeceasedCombinedForm() {
    const transferSubs = window.deceasedSubscriptionActions.filter(sa => sa.action === 'transfer');
    const refundSubs = window.deceasedSubscriptionActions.filter(sa => sa.action === 'cancel_refund');
    
    const transferListHtml = `
        <p><strong>Over te zetten abonnementen:</strong></p>
        <ul>
            ${transferSubs.map(sa => `<li>📰 ${sa.subscription.magazine}</li>`).join('')}
        </ul>
    `;
    document.getElementById('combinedTransferList').innerHTML = transferListHtml;
    
    const refundListHtml = `
        <p><strong>Op te zeggen abonnementen:</strong></p>
        <ul>
            ${refundSubs.map(sa => `<li>📰 ${sa.subscription.magazine}</li>`).join('')}
        </ul>
    `;
    document.getElementById('combinedRefundList').innerHTML = refundListHtml;
    
    document.querySelectorAll('.winback-step').forEach(step => step.style.display = 'none');
    document.getElementById('winbackStep1e').style.display = 'block';
    
    // Render unified customer form
    renderCustomerForm('transfer2CustomerForm', 'transfer2', {
        phoneRequired: true,
        emailRequired: true,
        showSameAddressCheckbox: true
    });
    
    // Setup same address functionality
    const checkbox = document.getElementById('transfer2SameAddress');
    checkbox.addEventListener('change', function() {
        if (this.checked && currentCustomer) {
            setCustomerFormData('transfer2', {
                postalCode: currentCustomer.postalCode,
                houseNumber: currentCustomer.houseNumber,
                address: currentCustomer.address,
                city: currentCustomer.city
            });
        }
    });
}

// Legacy functions removed - now using renderCustomerForm() with unified component

// Revert Restitution - Transfer subscription to another person (deceased cannot have active subscriptions)
function revertRestitution(subscriptionId) {
    const subscription = currentCustomer.subscriptions.find(s => s.id === subscriptionId);
    if (!subscription || subscription.status !== 'restituted') {
        showToast('Abonnement niet gevonden of niet gerestitueerd', 'error');
        return;
    }
    
    // Store the subscription ID for the transfer form
    window.restitutionRevertSubId = subscriptionId;
    
    // Open transfer form
    showRestitutionTransferForm(subscription);
}

// Show Transfer Form for Restitution Revert
function showRestitutionTransferForm(subscription) {
    // Open the transfer form modal
    document.getElementById('restitutionTransferForm').style.display = 'flex';
    
    // Update form title
    document.getElementById('restitutionTransferTitle').textContent = `${subscription.magazine} Overzetten`;
    
    // Pre-fill same address checkbox as checked by default
    document.getElementById('restitutionTransferSameAddress').checked = true;
    toggleRestitutionTransferAddress();
}

// Toggle Address Fields for Restitution Transfer
function toggleRestitutionTransferAddress() {
    const sameAddress = document.getElementById('restitutionTransferSameAddress').checked;
    const addressFields = document.getElementById('restitutionTransferAddressFields');
    
    if (sameAddress) {
        addressFields.style.display = 'none';
        // Remove required attribute
        document.getElementById('restitutionTransferPostalCode').removeAttribute('required');
        document.getElementById('restitutionTransferHouseNumber').removeAttribute('required');
        document.getElementById('restitutionTransferAddress').removeAttribute('required');
        document.getElementById('restitutionTransferCity').removeAttribute('required');
    } else {
        addressFields.style.display = 'block';
        // Add required attribute
        document.getElementById('restitutionTransferPostalCode').setAttribute('required', 'required');
        document.getElementById('restitutionTransferHouseNumber').setAttribute('required', 'required');
        document.getElementById('restitutionTransferAddress').setAttribute('required', 'required');
        document.getElementById('restitutionTransferCity').setAttribute('required', 'required');
    }
}

// Complete Restitution Transfer
function completeRestitutionTransfer(event) {
    event.preventDefault();
    
    const subscriptionId = window.restitutionRevertSubId;
    const subscription = currentCustomer.subscriptions.find(s => s.id === subscriptionId);
    
    if (!subscription) {
        showToast('Abonnement niet gevonden', 'error');
        return;
    }
    
    // Get form data
    const sameAddress = document.getElementById('restitutionTransferSameAddress').checked;
    const transferData = {
        salutation: document.getElementById('restitutionTransferSalutation').value,
        firstName: document.getElementById('restitutionTransferFirstName').value.trim(),
        middleName: document.getElementById('restitutionTransferMiddleName').value.trim(),
        lastName: document.getElementById('restitutionTransferLastName').value.trim(),
        email: document.getElementById('restitutionTransferEmail').value.trim(),
        phone: document.getElementById('restitutionTransferPhone').value.trim(),
        postalCode: sameAddress ? currentCustomer.postalCode : document.getElementById('restitutionTransferPostalCode').value.trim(),
        houseNumber: sameAddress ? currentCustomer.houseNumber : document.getElementById('restitutionTransferHouseNumber').value.trim(),
        address: sameAddress ? currentCustomer.address : document.getElementById('restitutionTransferAddress').value.trim(),
        city: sameAddress ? currentCustomer.city : document.getElementById('restitutionTransferCity').value.trim()
    };
    
    // Validate
    if (!transferData.firstName || !transferData.lastName || !transferData.email || !transferData.phone) {
        showToast('Vul alle verplichte velden in', 'error');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(transferData.email)) {
        showToast('Voer een geldig e-mailadres in', 'error');
        return;
    }
    
    // Update subscription with transfer info
    subscription.status = 'transferred';
    subscription.transferredTo = {
        ...transferData,
        transferDate: new Date().toISOString()
    };
    delete subscription.refundInfo;
    
    // Add contact history entry
    const newCustomerName = transferData.middleName 
        ? `${transferData.salutation} ${transferData.firstName} ${transferData.middleName} ${transferData.lastName}`
        : `${transferData.salutation} ${transferData.firstName} ${transferData.lastName}`;
    
    currentCustomer.contactHistory.unshift({
        id: currentCustomer.contactHistory.length + 1,
        type: 'Restitutie Ongedaan - Abonnement Overgezet',
        date: new Date().toISOString(),
        description: `Restitutie van ${subscription.magazine} ongedaan gemaakt. Abonnement overgezet naar ${newCustomerName} (${transferData.email}) op ${transferData.address}, ${transferData.postalCode} ${transferData.city}.`
    });
    
    saveCustomers();
    
    // Close form
    closeForm('restitutionTransferForm');
    
    // Refresh display
    selectCustomer(currentCustomer.id);
    
    showToast(`${subscription.magazine} overgezet naar ${newCustomerName}`, 'success');
    
    // Clear stored subscription ID
    window.restitutionRevertSubId = null;
}

// Complete All Deceased Actions
function completeAllDeceasedActions() {
    // Determine which form is active
    const step1c = document.getElementById('winbackStep1c');
    const step1d = document.getElementById('winbackStep1d');
    const step1e = document.getElementById('winbackStep1e');
    
    let transferData = null;
    let refundData = null;
    
    // Get the active form and extract data
    if (step1e.style.display !== 'none') {
        // Combined form
        transferData = getTransferDataFromForm(2);
        refundData = getRefundDataFromForm(2);
    } else if (step1d.style.display !== 'none') {
        // Only transfer
        transferData = getTransferDataFromForm(1);
    } else if (step1c.style.display !== 'none') {
        // Only refund
        refundData = getRefundDataFromForm(1);
    }
    
    // Validate transfer data if needed
    const transferActions = window.deceasedSubscriptionActions.filter(sa => sa.action === 'transfer');
    if (transferActions.length > 0 && transferData) {
        if (!validateTransferData(transferData)) {
            return; // Validation error already shown
        }
    }
    
    // Validate refund data if needed
    const refundActions = window.deceasedSubscriptionActions.filter(sa => sa.action === 'cancel_refund');
    if (refundActions.length > 0 && refundData) {
        if (!validateRefundData(refundData)) {
            return; // Validation error already shown
        }
    }
    
    // Process all actions
    const processedMagazines = [];
    
    // Process transfers
    for (const action of transferActions) {
        action.subscription.transferredTo = {
            ...transferData,
            transferDate: new Date().toISOString()
        };
        action.subscription.status = 'transferred';
        processedMagazines.push(`${action.subscription.magazine} (overgezet)`);
    }
    
    // Process refunds (mark as restituted instead of removing)
    for (const action of refundActions) {
        action.subscription.status = 'restituted';
        action.subscription.endDate = new Date().toISOString();
        action.subscription.refundInfo = {
            email: refundData.email,
            notes: refundData.notes,
            refundDate: new Date().toISOString()
        };
        processedMagazines.push(`${action.subscription.magazine} (gerestitueerd)`);
    }
    
    // Create contact history entry
    let historyDescription = `Abonnementen verwerkt i.v.m. overlijden:\n`;
    
    if (transferActions.length > 0) {
        const newCustomerName = transferData.middleName 
            ? `${transferData.salutation} ${transferData.firstName} ${transferData.middleName} ${transferData.lastName}`
            : `${transferData.salutation} ${transferData.firstName} ${transferData.lastName}`;
        historyDescription += `\nOvergezet naar ${newCustomerName} (${transferData.email}):\n`;
        historyDescription += transferActions.map(a => `- ${a.subscription.magazine}`).join('\n');
    }
    
    if (refundActions.length > 0) {
        historyDescription += `\n\nOpgezegd met restitutie naar ${refundData.email}:\n`;
        historyDescription += refundActions.map(a => `- ${a.subscription.magazine}`).join('\n');
        if (refundData.notes) {
            historyDescription += `\nNotities: ${refundData.notes}`;
        }
    }
    
    currentCustomer.contactHistory.unshift({
        id: currentCustomer.contactHistory.length + 1,
        type: 'Overlijden - Meerdere Abonnementen',
        date: new Date().toISOString(),
        description: historyDescription
    });
    
    saveCustomers();
    closeForm('winbackFlow');
    
    // Refresh display
    selectCustomer(currentCustomer.id);
    
    showToast(`${processedMagazines.length} abonnement(en) verwerkt. Bevestigingen worden verstuurd.`, 'success');
    
    // Reset
    window.deceasedSubscriptionActions = null;
}

// Get Transfer Data from Form (using unified customer form component)
function getTransferDataFromForm(formVersion) {
    const prefix = formVersion === 2 ? 'transfer2' : 'transfer';
    const data = getCustomerFormData(prefix);
    const sameAddress = document.getElementById(`${prefix}SameAddress`)?.checked || false;
    
    // If same address is checked, override with current customer address
    if (sameAddress && currentCustomer) {
        data.postalCode = currentCustomer.postalCode;
        data.houseNumber = currentCustomer.houseNumber;
        data.address = currentCustomer.address;
        data.city = currentCustomer.city;
    }
    
    // Convert initials to firstName for compatibility
    return {
        salutation: data.salutation,
        firstName: data.initials,
        middleName: data.middleName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        postalCode: data.postalCode,
        houseNumber: data.houseNumber,
        address: data.address,
        city: data.city
    };
}

// Get Refund Data from Form
function getRefundDataFromForm(formVersion) {
    const suffix = formVersion === 2 ? '2' : '';
    return {
        email: document.getElementById(`refundEmail${suffix}`).value.trim(),
        notes: document.getElementById(`refundNotes${suffix}`).value.trim()
    };
}

// Validate Transfer Data
function validateTransferData(data) {
    if (!data.firstName || !data.lastName || !data.email || !data.phone) {
        showToast('Vul alle verplichte velden in voor de nieuwe abonnee', 'error');
        return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
        showToast('Voer een geldig e-mailadres in voor de nieuwe abonnee', 'error');
        return false;
    }
    
    if (!data.postalCode || !data.houseNumber || !data.address || !data.city) {
        showToast('Vul alle adresvelden in voor de nieuwe abonnee', 'error');
        return false;
    }
    
    return true;
}

// Validate Refund Data
function validateRefundData(data) {
    if (!data.email) {
        showToast('Voer een e-mailadres in voor de restitutiebevestiging', 'error');
        return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
        showToast('Voer een geldig e-mailadres in voor de restitutie', 'error');
        return false;
    }
    
    return true;
}



// Complete Winback
function completeWinback() {
    const result = document.querySelector('input[name="winbackResult"]:checked');
    
    if (!result) {
        showToast('Selecteer een resultaat', 'error');
        return;
    }

    const subId = window.cancellingSubscriptionId;
    const subscription = currentCustomer.subscriptions.find(s => s.id === subId);
    
    if (result.value === 'accepted') {
        // Customer accepted offer
        currentCustomer.contactHistory.unshift({
            id: currentCustomer.contactHistory.length + 1,
            type: 'Winback succesvol',
            date: new Date().toISOString(),
            description: `Klant accepteerde winback aanbod: ${selectedOffer.title}. Abonnement ${subscription.magazine} blijft actief.`
        });
        
        showToast('Winback succesvol! Klant blijft abonnee.', 'success');
    } else {
        // Customer declined, cancel subscription
        currentCustomer.subscriptions = currentCustomer.subscriptions.filter(s => s.id !== subId);
        
        currentCustomer.contactHistory.unshift({
            id: currentCustomer.contactHistory.length + 1,
            type: 'Abonnement opgezegd',
            date: new Date().toISOString(),
            description: `Klant heeft abonnement ${subscription.magazine} opgezegd na winback poging.`
        });
        
        showToast('Abonnement opgezegd', 'error');
    }

    saveCustomers();
    closeForm('winbackFlow');
    
    // Refresh display
    selectCustomer(currentCustomer.id);
    
    // Reset
    selectedOffer = null;
    window.cancellingSubscriptionId = null;
}

// ========== ARTICLE SALES FUNCTIONS ==========

// Display Articles
function displayArticles() {
    const articlesList = document.getElementById('articlesList');
    
    if (!currentCustomer || !currentCustomer.articles || currentCustomer.articles.length === 0) {
        articlesList.innerHTML = '<p class="empty-state-small">Geen artikelen</p>';
        return;
    }

    // Sort articles by order date (newest first)
    const sortedArticles = [...currentCustomer.articles].sort((a, b) => 
        new Date(b.orderDate) - new Date(a.orderDate)
    );

    let html = '<div class="articles-group">';
    html += sortedArticles.map(order => {
        const deliveryStatusClass = {
            'ordered': 'status-ordered',
            'in_transit': 'status-transit',
            'delivered': 'status-delivered',
            'returned': 'status-returned'
        }[order.deliveryStatus] || 'status-ordered';
        
        const deliveryStatusText = {
            'ordered': 'Besteld',
            'in_transit': 'Onderweg',
            'delivered': 'Afgeleverd',
            'returned': 'Geretourneerd'
        }[order.deliveryStatus] || 'Besteld';
        
        const paymentStatusClass = {
            'pending': 'status-pending',
            'paid': 'status-paid',
            'refunded': 'status-refunded'
        }[order.paymentStatus] || 'status-pending';
        
        const paymentStatusText = {
            'pending': 'In behandeling',
            'paid': 'Betaald',
            'refunded': 'Terugbetaald'
        }[order.paymentStatus] || 'In behandeling';
        
        // Calculate if return is still possible
        const returnPossible = order.returnDeadline && new Date(order.returnDeadline) > new Date();
        
        // Check if this is a multi-item order (new format) or single item (old format)
        const isMultiItemOrder = order.items && Array.isArray(order.items);
        
        let itemsDisplay = '';
        let priceDisplay = '';
        
        if (isMultiItemOrder) {
            // New format: multiple items with discounts
            itemsDisplay = order.items.map(item => 
                `${item.name} (${item.quantity}x à €${item.unitPrice.toFixed(2)})`
            ).join('<br>');
            
            priceDisplay = `
                <strong>Subtotaal:</strong> €${order.subtotal.toFixed(2)}<br>
                ${order.totalDiscount > 0 ? `<strong>Korting:</strong> <span style="color: #059669;">-€${order.totalDiscount.toFixed(2)}</span> 
                (${order.discounts.map(d => d.type).join(', ')})<br>` : ''}
                <strong>Totaal:</strong> €${order.total.toFixed(2)}
            `;
        } else {
            // Old format: single item (backward compatibility)
            itemsDisplay = `${order.articleName || 'Artikel'} (${order.quantity}x)`;
            priceDisplay = `<strong>Prijs:</strong> €${order.price.toFixed(2)}`;
        }
        
        return `
            <div class="article-item">
                <div class="article-info">
                    <div class="article-name">🛒 Bestelling #${order.id}</div>
                    <div class="article-details">
                        <strong>Artikelen:</strong><br>${itemsDisplay}<br>
                        ${priceDisplay}<br>
                        <strong>Besteld:</strong> ${formatDate(order.orderDate)} • 
                        <strong>Gewenste levering:</strong> ${formatDate(order.desiredDeliveryDate)}
                        ${order.actualDeliveryDate ? `<br><strong>Geleverd:</strong> ${formatDate(order.actualDeliveryDate)}` : ''}
                        ${order.trackingNumber ? `<br><strong>Track & Trace:</strong> ${order.trackingNumber}` : ''}
                        ${order.notes ? `<br><strong>Opmerking:</strong> ${order.notes}` : ''}
                        ${returnPossible ? `<br><strong>Retour mogelijk tot:</strong> ${formatDate(order.returnDeadline)}` : ''}
                    </div>
                </div>
                <div class="article-actions">
                    <span class="article-status ${deliveryStatusClass}">${deliveryStatusText}</span>
                    <span class="article-status ${paymentStatusClass}">${paymentStatusText}</span>
                </div>
            </div>
        `;
    }).join('');
    html += '</div>';

    articlesList.innerHTML = html;
}

// Show Article Sale Form
function showArticleSale() {
    // Prefill customer data if a customer is currently selected
    if (currentCustomer) {
        const salutation = currentCustomer.salutation || 'Dhr.';
        document.querySelector(`input[name="articleSalutation"][value="${salutation}"]`).checked = true;
        
        document.getElementById('articleInitials').value = currentCustomer.firstName;
        document.getElementById('articleMiddleName').value = currentCustomer.middleName || '';
        document.getElementById('articleLastName').value = currentCustomer.lastName;
        document.getElementById('articlePostalCode').value = currentCustomer.postalCode;
        
        // Handle house number
        const houseNumberMatch = currentCustomer.houseNumber?.match(/^(\d+)(.*)$/);
        if (houseNumberMatch) {
            document.getElementById('articleHouseNumber').value = houseNumberMatch[1];
            document.getElementById('articleHouseExt').value = houseNumberMatch[2] || '';
        } else {
            document.getElementById('articleHouseNumber').value = currentCustomer.houseNumber;
        }
        
        // Extract street name from address (remove house number)
        const streetName = currentCustomer.address.replace(/\s+\d+.*$/, '');
        document.getElementById('articleAddress').value = streetName;
        
        document.getElementById('articleCity').value = currentCustomer.city;
        document.getElementById('articleEmail').value = currentCustomer.email;
        document.getElementById('articlePhone').value = currentCustomer.phone;
        
        // Prefill delivery remarks from customer profile if available
        if (currentCustomer.deliveryRemarks && currentCustomer.deliveryRemarks.default) {
            document.getElementById('articleNotes').value = currentCustomer.deliveryRemarks.default;
        }
    } else {
        // Clear form if no customer selected
        document.getElementById('articleForm').reset();
    }
    
    // Initialize delivery date picker with recommended date
    initDeliveryDatePicker();
    
    // Clear article search and order items
    document.getElementById('articleSearch').value = '';
    document.getElementById('articleName').value = '';
    document.getElementById('articlePrice').value = '€0,00';
    orderItems = [];
    renderOrderItems();
    
    document.getElementById('articleSaleForm').style.display = 'flex';
}

// Add Delivery Remark
function addDeliveryRemark(remark) {
    const notesField = document.getElementById('articleNotes');
    const currentValue = notesField.value.trim();
    
    if (currentValue) {
        // Append to existing notes
        notesField.value = currentValue + '\n' + remark;
    } else {
        // Set as first note
        notesField.value = remark;
    }
    
    // Visual feedback
    notesField.focus();
    notesField.scrollTop = notesField.scrollHeight;
}

// Update Article Price - handled by article-search.js

// Create Article Sale
function createArticleSale(event) {
    event.preventDefault();

    // Check if there are items in the order
    if (!orderItems || orderItems.length === 0) {
        showToast('Voeg minimaal één artikel toe aan de bestelling', 'error');
        return;
    }

    const salutation = document.querySelector('input[name="articleSalutation"]:checked').value;
    const initials = document.getElementById('articleInitials').value;
    const middleName = document.getElementById('articleMiddleName').value;
    const lastName = document.getElementById('articleLastName').value;
    const houseNumber = document.getElementById('articleHouseNumber').value;
    const houseExt = document.getElementById('articleHouseExt').value;
    
    // Get order data
    const orderData = getOrderData();
    
    const formData = {
        salutation: salutation,
        firstName: initials,
        middleName: middleName,
        lastName: lastName,
        postalCode: document.getElementById('articlePostalCode').value.toUpperCase(),
        houseNumber: houseExt ? `${houseNumber}${houseExt}` : houseNumber,
        address: `${document.getElementById('articleAddress').value} ${houseNumber}${houseExt}`,
        city: document.getElementById('articleCity').value,
        email: document.getElementById('articleEmail').value,
        phone: document.getElementById('articlePhone').value,
        desiredDeliveryDate: document.getElementById('articleDesiredDelivery').value,
        paymentMethod: document.querySelector('input[name="articlePayment"]:checked').value,
        notes: document.getElementById('articleNotes').value
    };

    // Generate tracking number
    const trackingNumber = '3SABCD' + Math.random().toString().substr(2, 10) + 'NL';
    
    // Calculate return deadline (14 days after desired delivery)
    const returnDeadline = new Date(formData.desiredDeliveryDate);
    returnDeadline.setDate(returnDeadline.getDate() + 14);
    const returnDeadlineStr = returnDeadline.toISOString().split('T')[0];

    // Create order object with all items
    const newOrder = {
        id: Date.now(),
        orderDate: new Date().toISOString().split('T')[0],
        desiredDeliveryDate: formData.desiredDeliveryDate,
        deliveryStatus: 'ordered',
        trackingNumber: trackingNumber,
        paymentStatus: 'paid', // Assume immediate payment via iDEAL/card
        paymentMethod: formData.paymentMethod,
        paymentDate: new Date().toISOString().split('T')[0],
        actualDeliveryDate: null,
        returnDeadline: returnDeadlineStr,
        notes: formData.notes,
        items: orderData.items,
        subtotal: orderData.subtotal,
        discounts: orderData.discounts,
        totalDiscount: orderData.totalDiscount,
        total: orderData.total,
        couponCode: orderData.couponCode
    };

    // Build order description for contact history
    const itemsDescription = orderData.items.map(item => 
        `${item.name} (${item.quantity}x à €${item.unitPrice.toFixed(2)})`
    ).join(', ');
    
    let discountDescription = '';
    if (orderData.discounts.length > 0) {
        const discountDetails = orderData.discounts.map(d => {
            if (d.isCoupon) {
                return `${d.type} "${d.description}" -€${d.amount.toFixed(2)}`;
            }
            return `${d.type} -€${d.amount.toFixed(2)}`;
        }).join(', ');
        discountDescription = ` Kortingen: ${discountDetails}.`;
    }
    
    const couponNote = orderData.couponCode ? ` Kortingscode: ${orderData.couponCode}.` : '';
    
    // Check if this is for an existing customer
    if (currentCustomer) {
        // Add order to existing customer
        if (!currentCustomer.articles) {
            currentCustomer.articles = [];
        }
        currentCustomer.articles.push(newOrder);
        
        currentCustomer.contactHistory.unshift({
            id: currentCustomer.contactHistory.length + 1,
            type: 'Artikel bestelling',
            date: new Date().toISOString(),
            description: `Artikel bestelling: ${itemsDescription}. Subtotaal: €${orderData.subtotal.toFixed(2)}.${discountDescription}${couponNote} Totaal: €${orderData.total.toFixed(2)}. Gewenste levering: ${formatDate(formData.desiredDeliveryDate)}. Betaling: ${formData.paymentMethod}.${formData.notes ? ' Opmerkingen: ' + formData.notes : ''}`
        });
        
        saveCustomers();
        
        // Clear order items
        orderItems = [];
        renderOrderItems();
        
        closeForm('articleSaleForm');
        showToast('Artikel bestelling succesvol aangemaakt!', 'success');
        
        // Refresh display
        selectCustomer(currentCustomer.id);
    } else {
        // Create new customer with order
        const fullLastName = middleName ? `${middleName} ${lastName}` : lastName;
        
        const newCustomer = {
            id: customers.length > 0 ? Math.max(...customers.map(c => c.id)) + 1 : 1,
            salutation: formData.salutation,
            firstName: formData.firstName,
            middleName: formData.middleName,
            lastName: fullLastName,
            postalCode: formData.postalCode,
            houseNumber: formData.houseNumber,
            address: formData.address,
            city: formData.city,
            email: formData.email,
            phone: formData.phone,
            subscriptions: [],
            articles: [newOrder],
            contactHistory: [
                {
                    id: 1,
                    type: 'Artikel bestelling',
                    date: new Date().toISOString(),
                    description: `Artikel bestelling: ${itemsDescription}. Subtotaal: €${orderData.subtotal.toFixed(2)}.${discountDescription}${couponNote} Totaal: €${orderData.total.toFixed(2)}. Gewenste levering: ${formatDate(formData.desiredDeliveryDate)}. Betaling: ${formData.paymentMethod}.${formData.notes ? ' Opmerkingen: ' + formData.notes : ''}`
                }
            ]
        };

        customers.push(newCustomer);
        saveCustomers();
        
        // Clear order items
        orderItems = [];
        renderOrderItems();
        
        closeForm('articleSaleForm');
        showToast('Nieuwe klant en artikel bestelling succesvol aangemaakt!', 'success');
        
        // Select the new customer
        selectCustomer(newCustomer.id);
        
        // PHASE 4: Show identification prompt if anonymous call active
        showSuccessIdentificationPrompt(newCustomer.id, `${formData.firstName} ${fullLastName}`);
    }
    
    // Reset form
    document.getElementById('articleForm').reset();
}

// Edit Delivery Remarks
function editDeliveryRemarks() {
    if (!currentCustomer) return;
    
    const modal = document.getElementById('editDeliveryRemarksModal');
    const customerName = document.getElementById('editRemarksCustomerName');
    const remarksTextarea = document.getElementById('editCustomerDeliveryRemarks');
    
    // Set customer name
    const fullName = currentCustomer.middleName 
        ? `${currentCustomer.firstName} ${currentCustomer.middleName} ${currentCustomer.lastName}`
        : `${currentCustomer.firstName} ${currentCustomer.lastName}`;
    customerName.textContent = fullName;
    
    // Set current remarks
    remarksTextarea.value = currentCustomer.deliveryRemarks?.default || '';
    
    // Show modal
    modal.style.display = 'flex';
}

// Add Delivery Remark to Modal
function addDeliveryRemarkToModal(remark) {
    const notesField = document.getElementById('editCustomerDeliveryRemarks');
    const currentValue = notesField.value.trim();
    
    if (currentValue) {
        // Append to existing notes
        notesField.value = currentValue + '\n' + remark;
    } else {
        // Set as first note
        notesField.value = remark;
    }
    
    // Visual feedback
    notesField.focus();
    notesField.scrollTop = notesField.scrollHeight;
}

// Save Delivery Remarks
function saveDeliveryRemarks() {
    if (!currentCustomer) return;
    
    const newRemarks = document.getElementById('editCustomerDeliveryRemarks').value.trim();
    
    // Initialize deliveryRemarks object if it doesn't exist
    if (!currentCustomer.deliveryRemarks) {
        currentCustomer.deliveryRemarks = {
            default: '',
            lastUpdated: null,
            history: []
        };
    }
    
    // Save to history
    if (currentCustomer.deliveryRemarks.default !== newRemarks) {
        currentCustomer.deliveryRemarks.history.unshift({
            date: new Date().toISOString(),
            remark: newRemarks,
            updatedBy: document.getElementById('agentName').textContent
        });
        
        // Add to contact history
        currentCustomer.contactHistory.unshift({
            id: currentCustomer.contactHistory.length + 1,
            type: 'Bezorgvoorkeuren gewijzigd',
            date: new Date().toISOString(),
            description: `Bezorgvoorkeuren bijgewerkt: "${newRemarks || '(leeg)'}"`
        });
    }
    
    // Update current remarks
    currentCustomer.deliveryRemarks.default = newRemarks;
    currentCustomer.deliveryRemarks.lastUpdated = new Date().toISOString();
    
    // Save to storage
    saveCustomers();
    
    // Update display
    displayContactHistory();
    
    // Close modal
    closeEditRemarksModal();
    
    showToast('Bezorgvoorkeuren opgeslagen!', 'success');
}

// Close Edit Remarks Modal
function closeEditRemarksModal() {
    const modal = document.getElementById('editDeliveryRemarksModal');
    modal.style.display = 'none';
}

// Close Form
function closeForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.style.display = 'none';
    }
}

// Show Toast Notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Debug Mode - Secret Key Sequence
let debugKeySequence = [];
const DEBUG_KEY = ']';
const DEBUG_KEY_COUNT = 4;

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Debug mode activation - press ']' 4 times
    if (e.key === DEBUG_KEY) {
        debugKeySequence.push(Date.now());
        
        // Keep only recent keypresses (within 10 seconds)
        debugKeySequence = debugKeySequence.filter(time => Date.now() - time < 10000);
        
        // Check if we have 4 presses
        if (debugKeySequence.length >= DEBUG_KEY_COUNT) {
            openDebugModal();
            debugKeySequence = []; // Reset sequence
        }
    } else {
        // Reset sequence on any other key
        debugKeySequence = [];
    }
    
    // Escape to close forms and modals
    if (e.key === 'Escape') {
        // Close debug modal if open
        const debugModal = document.getElementById('debugModal');
        if (debugModal.classList.contains('show')) {
            closeDebugModal();
            return;
        }
        
        // Close forms
        document.querySelectorAll('.form-container').forEach(form => {
            if (form.style.display === 'flex') {
                form.style.display = 'none';
            }
        });
    }
    
    // Ctrl/Cmd + K for search focus
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('searchName').focus();
    }
});

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
        select.innerHTML = '<option value="">Geen klanten beschikbaar</option>';
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
function debugStartCall() {
    // Check if there's already an active call
    if (callSession.active) {
        if (confirm('⚠️ Er is al een actieve call. Wil je deze beëindigen en een nieuwe starten?')) {
            endCallSession();
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
        totalHoldTime: 0
    };
    
    // Voor bekende beller, koppel direct
    if (callerType === 'known') {
        const customerId = document.getElementById('debugKnownCustomer').value;
        if (customerId) {
            const customer = customers.find(c => c.id === parseInt(customerId));
            if (customer) {
                callSession.customerId = parseInt(customerId);
                callSession.customerName = `${customer.initials || customer.firstName} ${customer.middleName ? customer.middleName + ' ' : ''}${customer.lastName}`;
                callSession.callerType = 'identified';
                
                // Automatically open customer record
                setTimeout(() => {
                    selectCustomer(parseInt(customerId));
                }, 500);
            }
        }
    }
    
    // Start UI updates
    startCallSession();
    
    closeDebugModal();
    
    showToast(
        `Call simulatie gestart: ${serviceNumber} (wachttijd: ${formatTime(waitTime)})`,
        'success'
    );
}

// Debug: End Call Simulation
function debugEndCall() {
    if (!callSession.active) return;
    
    const callDuration = Math.floor((Date.now() - callSession.startTime) / 1000);
    
    if (confirm(`📞 Het telefoongesprek beëindigen?\n\nGespreksduur: ${formatTime(callDuration)}`)) {
        endCallSession(true);
        document.getElementById('debugEndCallBtn').style.display = 'none';
    }
}

// Debug Modal Functions
function openDebugModal() {
    const modal = document.getElementById('debugModal');
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

// Full Reset - Clear all local storage and reload
function fullReset() {
    if (confirm('⚠️ Dit zal alle lokale data wissen en de pagina herladen. Weet je het zeker?')) {
        // Clear local storage
        localStorage.clear();
        
        // Show toast
        showToast('Lokale opslag gewist. Pagina wordt herladen...', 'info');
        
        // Reload after short delay
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('debugModal');
    if (e.target === modal) {
        closeDebugModal();
    }
});

// Handle payment method selection - show/hide IBAN field
document.addEventListener('change', (e) => {
    if (e.target.name === 'subPayment' || e.target.name === 'editPayment') {
        const additionalInput = e.target.closest('.payment-option').querySelector('.additional-input');
        if (additionalInput) {
            // Payment selected, IBAN field is shown via CSS
            const ibanInput = additionalInput.querySelector('input[type="text"]');
            if (ibanInput && e.target.value === 'automatisch') {
                ibanInput.setAttribute('required', 'required');
            } else if (ibanInput) {
                ibanInput.removeAttribute('required');
            }
        }
    }
});
