// Sample Data Storage
let customers = [];
let currentCustomer = null;
let selectedOffer = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeData();
    updateTime();
    setInterval(updateTime, 1000);
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
                firstName: 'Jan',
                lastName: 'de Vries',
                postalCode: '1012AB',
                houseNumber: '42',
                address: 'Damstraat 42',
                city: 'Amsterdam',
                email: 'jan.devries@email.nl',
                phone: '06-12345678',
                subscriptions: [
                    {
                        id: 1,
                        magazine: 'Avrobode',
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
                firstName: 'Maria',
                lastName: 'Jansen',
                postalCode: '3011BD',
                houseNumber: '15',
                address: 'Wijnhaven 15',
                city: 'Rotterdam',
                email: 'maria.jansen@email.nl',
                phone: '06-87654321',
                subscriptions: [
                    {
                        id: 2,
                        magazine: 'Mikrogids',
                        startDate: '2022-06-01',
                        status: 'active',
                        lastEdition: '2024-09-28'
                    },
                    {
                        id: 3,
                        magazine: 'Ncrvgids',
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

// Display Search Results
function displaySearchResults(results) {
    const resultsContainer = document.getElementById('resultsContainer');
    const searchResults = document.getElementById('searchResults');
    
    if (results.length === 0) {
        resultsContainer.innerHTML = '<p class="empty-state-small">Geen klanten gevonden</p>';
        searchResults.style.display = 'block';
        return;
    }

    resultsContainer.innerHTML = results.map(customer => `
        <div class="result-item" onclick="selectCustomer(${customer.id})">
            <div class="result-name">${customer.firstName} ${customer.lastName}</div>
            <div class="result-details">
                ${customer.address}, ${customer.postalCode} ${customer.city}<br>
                ${customer.subscriptions.length} actief abonnement(en)
            </div>
        </div>
    `).join('');
    
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
    document.getElementById('customerName').textContent = 
        `${currentCustomer.firstName} ${currentCustomer.lastName}`;
    document.getElementById('customerAddress').textContent = 
        `${currentCustomer.address}, ${currentCustomer.postalCode} ${currentCustomer.city}`;
    document.getElementById('customerEmail').textContent = currentCustomer.email;
    document.getElementById('customerPhone').textContent = currentCustomer.phone;

    // Display subscriptions
    displaySubscriptions();

    // Display contact history
    displayContactHistory();

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

    subscriptionsList.innerHTML = currentCustomer.subscriptions.map(sub => `
        <div class="subscription-item">
            <div class="subscription-info">
                <div class="subscription-name">📰 ${sub.magazine}</div>
                <div class="subscription-details">
                    Start: ${formatDate(sub.startDate)} • 
                    Laatste editie: ${formatDate(sub.lastEdition)}
                </div>
            </div>
            <div class="subscription-actions">
                <span class="subscription-status status-active">Actief</span>
                <button class="icon-btn" onclick="editSubscription(${sub.id})" title="Bewerken">✏️</button>
                <button class="icon-btn" onclick="cancelSubscription(${sub.id})" title="Opzeggen">🚫</button>
            </div>
        </div>
    `).join('');
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
    document.getElementById('newSubscriptionForm').style.display = 'flex';
    // Set today's date as default start date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('subStartDate').value = today;
}

// Create Subscription
function createSubscription(event) {
    event.preventDefault();

    const newCustomer = {
        id: customers.length > 0 ? Math.max(...customers.map(c => c.id)) + 1 : 1,
        firstName: document.getElementById('subFirstName').value,
        lastName: document.getElementById('subLastName').value,
        postalCode: document.getElementById('subPostalCode').value.toUpperCase(),
        houseNumber: document.getElementById('subHouseNumber').value,
        address: `${document.getElementById('subAddress').value} ${document.getElementById('subHouseNumber').value}`,
        city: document.getElementById('subCity').value,
        email: document.getElementById('subEmail').value,
        phone: document.getElementById('subPhone').value,
        subscriptions: [
            {
                id: Date.now(),
                magazine: document.getElementById('subMagazine').value,
                startDate: document.getElementById('subStartDate').value,
                status: 'active',
                lastEdition: new Date().toISOString().split('T')[0]
            }
        ],
        contactHistory: [
            {
                id: 1,
                type: 'Nieuw abonnement',
                date: new Date().toISOString(),
                description: `Abonnement ${document.getElementById('subMagazine').value} aangemaakt via telefonische bestelling.`
            }
        ]
    };

    customers.push(newCustomer);
    saveCustomers();

    closeForm('newSubscriptionForm');
    showToast('Nieuw abonnement succesvol aangemaakt!', 'success');
    
    // Reset form
    document.getElementById('subscriptionForm').reset();
    
    // Select the new customer
    selectCustomer(newCustomer.id);
}

// Edit Customer
function editCustomer() {
    if (!currentCustomer) return;

    document.getElementById('editCustomerId').value = currentCustomer.id;
    document.getElementById('editFirstName').value = currentCustomer.firstName;
    document.getElementById('editLastName').value = currentCustomer.lastName;
    document.getElementById('editPostalCode').value = currentCustomer.postalCode;
    document.getElementById('editHouseNumber').value = currentCustomer.houseNumber;
    document.getElementById('editAddress').value = currentCustomer.address.replace(/ \d+$/, '');
    document.getElementById('editCity').value = currentCustomer.city;
    document.getElementById('editEmail').value = currentCustomer.email;
    document.getElementById('editPhone').value = currentCustomer.phone;

    document.getElementById('editCustomerForm').style.display = 'flex';
}

// Save Customer Edit
function saveCustomerEdit(event) {
    event.preventDefault();

    const customerId = parseInt(document.getElementById('editCustomerId').value);
    const customer = customers.find(c => c.id === customerId);
    
    if (!customer) return;

    customer.firstName = document.getElementById('editFirstName').value;
    customer.lastName = document.getElementById('editLastName').value;
    customer.postalCode = document.getElementById('editPostalCode').value.toUpperCase();
    customer.houseNumber = document.getElementById('editHouseNumber').value;
    customer.address = `${document.getElementById('editAddress').value} ${customer.houseNumber}`;
    customer.city = document.getElementById('editCity').value;
    customer.email = document.getElementById('editEmail').value;
    customer.phone = document.getElementById('editPhone').value;

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
function editSubscription(subId) {
    showToast('Abonnement bewerken functie komt binnenkort', 'error');
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