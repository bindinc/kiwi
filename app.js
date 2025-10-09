// Sample Data Storage
let customers = [];
let currentCustomer = null;
let selectedOffer = null;

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

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeData();
    updateTime();
    setInterval(updateTime, 1000);
    updateCustomerActionButtons();
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
                subscriptions: [
                    {
                        id: 1,
                        magazine: 'Avrobode',
                        duration: '1-jaar',
                        startDate: '2023-01-15',
                        status: 'active',
                        lastEdition: '2024-10-01'
                    }
                ],
                contactHistory: [
                    {
                        id: 1,
                        type: 'Telefoongesprek',
                        date: '2024-10-05 14:30',
                        description: 'Klant belt over niet ontvangen editie. Magazine opnieuw verzonden.'
                    },
                    {
                        id: 2,
                        type: 'Adreswijziging',
                        date: '2024-09-12 10:15',
                        description: 'Adres gewijzigd van Kerkstraat 10 naar Damstraat 42.'
                    },
                    {
                        id: 3,
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
                        status: 'active',
                        lastEdition: '2024-09-28'
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
                contactHistory: [
                    {
                        id: 1,
                        type: 'Telefoongesprek',
                        date: '2024-09-20 11:20',
                        description: 'Vraag over facturatie. Uitleg gegeven over automatische incasso.'
                    },
                    {
                        id: 2,
                        type: 'Extra abonnement',
                        date: '2023-03-10 15:30',
                        description: 'Tweede abonnement (Ncrvgids) toegevoegd.'
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
                contactHistory: [
                    {
                        id: 1,
                        type: 'Nieuw abonnement',
                        date: '2024-02-01 13:15',
                        description: 'Abonnement Avrobode aangemaakt via telefonische bestelling.'
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
        resendBtn.style.display = hasCustomer ? 'block' : 'none';
    }
    if (winbackBtn) {
        winbackBtn.style.display = hasCustomer ? 'block' : 'none';
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
function searchCustomer() {
    const name = document.getElementById('searchName').value.toLowerCase().trim();
    const postalCode = document.getElementById('searchPostalCode').value.toUpperCase().trim();
    const houseNumber = document.getElementById('searchHouseNumber').value.trim();

    let results = customers.filter(customer => {
        const matchName = !name || 
            customer.firstName.toLowerCase().includes(name) || 
            customer.lastName.toLowerCase().includes(name) ||
            `${customer.firstName} ${customer.lastName}`.toLowerCase().includes(name);
        
        const matchPostal = !postalCode || customer.postalCode === postalCode;
        const matchHouse = !houseNumber || customer.houseNumber === houseNumber;
        
        return matchName && matchPostal && matchHouse;
    });

    displaySearchResults(results);
}

// Handle Enter key press in search fields
function handleSearchKeyPress(event) {
    if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault();
        searchCustomer();
    }
}

// Display Search Results
function displaySearchResults(results) {
    const resultsContainer = document.getElementById('resultsContainer');
    const searchResults = document.getElementById('searchResults');
    
    if (results.length === 0) {
        resultsContainer.innerHTML = '<p class="empty-state-small">Geen klanten gevonden</p>';
        searchResults.style.display = 'block';
        return;
    }

    resultsContainer.innerHTML = results.map(customer => {
        const fullName = customer.middleName 
            ? `${customer.firstName} ${customer.middleName} ${customer.lastName}`
            : `${customer.firstName} ${customer.lastName}`;
        
        return `
            <div class="result-item" onclick="selectCustomer(${customer.id})">
                <div class="result-name">${fullName}</div>
                <div class="result-details">
                    ${customer.address}, ${customer.postalCode} ${customer.city}<br>
                    ${customer.subscriptions.length} actief abonnement(en)
                </div>
            </div>
        `;
    }).join('');
    
    searchResults.style.display = 'block';
}

// Select Customer
function selectCustomer(customerId) {
    currentCustomer = customers.find(c => c.id === customerId);
    if (!currentCustomer) return;

    // Hide welcome message
    document.getElementById('welcomeMessage').style.display = 'none';
    
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

    // Display subscriptions
    displaySubscriptions();

    // Display contact history
    displayContactHistory();

    // Update action buttons visibility
    updateCustomerActionButtons();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Display Subscriptions
function displaySubscriptions() {
    const subscriptionsList = document.getElementById('subscriptionsList');
    
    if (currentCustomer.subscriptions.length === 0) {
        subscriptionsList.innerHTML = '<p class="empty-state-small">Geen actieve abonnementen</p>';
        return;
    }

    subscriptionsList.innerHTML = currentCustomer.subscriptions.map(sub => {
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

    historyContainer.innerHTML = sortedHistory.map((item, index) => `
        <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-header" onclick="toggleTimelineItem(${index})">
                <span class="timeline-type">${item.type}</span>
                <span class="timeline-expand" id="expand-${index}">▼</span>
                <span class="timeline-date">${formatDateTime(item.date)}</span>
            </div>
            <div class="timeline-content" id="content-${index}">
                ${item.description}
            </div>
        </div>
    `).join('');
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
        document.getElementById('subFirstName').value = currentCustomer.firstName;
        document.getElementById('subLastName').value = currentCustomer.lastName;
        document.getElementById('subPostalCode').value = currentCustomer.postalCode;
        document.getElementById('subHouseNumber').value = currentCustomer.houseNumber;
        
        // Extract street name from address (remove house number)
        const streetName = currentCustomer.address.replace(/\s+\d+.*$/, '');
        document.getElementById('subAddress').value = streetName;
        
        document.getElementById('subCity').value = currentCustomer.city;
        document.getElementById('subEmail').value = currentCustomer.email;
        document.getElementById('subPhone').value = currentCustomer.phone;
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

// Show Winback Flow
function showWinbackFlow() {
    if (!currentCustomer) {
        showToast('Selecteer eerst een klant', 'error');
        return;
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
    winbackNextStep(stepNumber);
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

// Close Form
function closeForm(formId) {
    document.getElementById(formId).style.display = 'none';
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

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Escape to close forms
    if (e.key === 'Escape') {
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