# Implementation Plan - Call Center Interface Improvements

**Date:** October 9, 2025  
**Project:** Kiwi Call Center Web Interface  
**Version:** 1.0

---

## Overview

This document outlines the implementation plan for four key improvements to the call center interface:

1. **Enter Key Search** - Enable search initiation by pressing Enter
2. **Customer Data Prefill** - Auto-populate new subscription form when customer is loaded
3. **Subscription Offers Dropdown** - Add subscription duration and payment options with pricing
4. **Edit Subscription Feature** - Implement the currently missing "Bewerken" functionality

---

## 1. Enter Key Search Functionality

### Current State
- Search is only triggered by clicking the "Zoeken" button
- No keyboard shortcut for initiating search

### Required Changes

#### File: `index.html`
**Location:** Search form inputs (lines 32-41)

**Changes:**
- Add `onkeypress` event handlers to all search input fields
- Event should trigger search when Enter key is pressed

**Implementation:**
```html
<!-- For searchName input -->
<input type="text" id="searchName" placeholder="Achternaam, Voornaam" 
       onkeypress="handleSearchKeyPress(event)">

<!-- For searchPostalCode input -->
<input type="text" id="searchPostalCode" placeholder="1234AB" 
       onkeypress="handleSearchKeyPress(event)">

<!-- For searchHouseNumber input -->
<input type="text" id="searchHouseNumber" placeholder="12" 
       onkeypress="handleSearchKeyPress(event)">
```

#### File: `app.js`
**Location:** Add new function after `searchCustomer()` (around line 175)

**Changes:**
- Create `handleSearchKeyPress()` function
- Check if Enter key (keyCode 13 or key === 'Enter')
- Call existing `searchCustomer()` function

**Implementation:**
```javascript
// Handle Enter key press in search fields
function handleSearchKeyPress(event) {
    if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault();
        searchCustomer();
    }
}
```

**Testing:**
- [ ] Verify Enter works in name field
- [ ] Verify Enter works in postal code field
- [ ] Verify Enter works in house number field
- [ ] Verify search results display correctly
- [ ] Verify button click still works

---

## 2. Customer Data Prefill for New Subscription

### Current State
- "Nieuw Abonnement" form always shows empty fields
- User must manually enter all customer data even when customer is already loaded

### Required Changes

#### File: `app.js`
**Location:** `showNewSubscription()` function (around line 326)

**Changes:**
- Check if `currentCustomer` exists
- If yes, prefill all customer fields
- If no, show empty form (new customer scenario)

**Implementation:**
```javascript
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
```

#### File: `app.js`
**Location:** `createSubscription()` function (around line 331)

**Changes:**
- Modify logic to check if customer already exists
- If customer exists, add subscription to existing customer
- If new customer, create customer with subscription

**Implementation:**
```javascript
// Create Subscription
function createSubscription(event) {
    event.preventDefault();

    const formData = {
        firstName: document.getElementById('subFirstName').value,
        lastName: document.getElementById('subLastName').value,
        postalCode: document.getElementById('subPostalCode').value.toUpperCase(),
        houseNumber: document.getElementById('subHouseNumber').value,
        address: `${document.getElementById('subAddress').value} ${document.getElementById('subHouseNumber').value}`,
        city: document.getElementById('subCity').value,
        email: document.getElementById('subEmail').value,
        phone: document.getElementById('subPhone').value,
        magazine: document.getElementById('subMagazine').value,
        duration: document.getElementById('subDuration').value, // New field
        startDate: document.getElementById('subStartDate').value
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
            description: `Extra abonnement ${formData.magazine} (${formData.duration}) toegevoegd.`
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
                    description: `Abonnement ${formData.magazine} (${formData.duration}) aangemaakt via telefonische bestelling.`
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
```

**Testing:**
- [ ] Verify prefill works when customer is selected
- [ ] Verify form is empty when no customer selected
- [ ] Verify adding subscription to existing customer
- [ ] Verify creating new customer with subscription
- [ ] Verify contact history is updated correctly

---

## 3. Subscription Offers Dropdown with Pricing

### Current State
- Only magazine selection exists (Avrobode, Mikrogids, Ncrvgids)
- No duration or payment frequency options
- No price indication

### Required Changes

#### File: `index.html`
**Location:** After magazine selection dropdown (after line 156)

**Changes:**
- Add new dropdown for subscription duration and payment type
- Include price information in options
- Update form layout

**Implementation:**
```html
<!-- After the magazine selection dropdown -->
<div class="form-group">
    <label for="subDuration">Duur & Betaling *</label>
    <select id="subDuration" required>
        <option value="">Selecteer optie...</option>
        <optgroup label="Jaarlijks Betaald">
            <option value="1-jaar">1 jaar - €52,00 per jaar</option>
            <option value="2-jaar">2 jaar - €98,00 totaal (5% korting)</option>
            <option value="3-jaar">3 jaar - €140,00 totaal (10% korting)</option>
        </optgroup>
        <optgroup label="Maandelijks Betaald">
            <option value="1-jaar-maandelijks">1 jaar - €4,50 per maand (€54,00 totaal)</option>
            <option value="2-jaar-maandelijks">2 jaar - €4,35 per maand (€104,40 totaal)</option>
            <option value="3-jaar-maandelijks">3 jaar - €4,20 per maand (€151,20 totaal)</option>
        </optgroup>
    </select>
    <small class="form-hint">Maandelijkse betaling heeft een kleine toeslag</small>
</div>
```

#### File: `styles.css`
**Location:** Add after form styles (around line 400)

**Changes:**
- Add styling for optgroup labels
- Add styling for form hints
- Ensure dropdown is readable

**Implementation:**
```css
/* Form hint text */
.form-hint {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-style: italic;
}

/* Optgroup styling */
select optgroup {
    font-weight: 600;
    font-style: normal;
    color: var(--text-primary);
}

select option {
    padding: 0.5rem;
}
```

#### File: `app.js`
**Location:** Update data structures and functions

**Changes:**
- Add duration field to subscription objects
- Update display functions to show duration
- Create pricing lookup object for reference

**Implementation:**

```javascript
// Add after initialization (around line 10)
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
```

**Update `displaySubscriptions()` function:**
```javascript
// Display Subscriptions (update around line 240)
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
```

**Update demo data:**
```javascript
// Update subscription objects in initializeData() to include duration field
subscriptions: [
    {
        id: 1,
        magazine: 'Avrobode',
        duration: '1-jaar',  // Add this
        startDate: '2023-01-15',
        status: 'active',
        lastEdition: '2024-10-01'
    }
]
```

**Testing:**
- [ ] Verify all pricing options display correctly
- [ ] Verify dropdown is accessible and readable
- [ ] Verify hint text displays properly
- [ ] Verify pricing info shows in subscription list
- [ ] Verify form validation requires duration selection
- [ ] Calculate and verify all pricing is correct

---

## 4. Edit Subscription Feature Implementation

### Current State
- `editSubscription()` function shows error toast "komt binnenkort"
- No UI for editing subscription details
- Bewerken (✏️) button is visible but non-functional

### Required Changes

#### File: `index.html`
**Location:** After edit customer form (around line 230)

**Changes:**
- Create new modal form for editing subscription
- Include fields for magazine type, duration, and start date

**Implementation:**
```html
<!-- Edit Subscription Form -->
<div id="editSubscriptionForm" class="form-container" style="display: none;">
    <div class="card">
        <div class="form-header">
            <h2>✏️ Abonnement Bewerken</h2>
            <button class="btn-close" onclick="closeForm('editSubscriptionForm')">✕</button>
        </div>
        <form id="subscriptionEditForm" onsubmit="saveSubscriptionEdit(event)">
            <input type="hidden" id="editSubId">
            
            <div class="info-box">
                <strong>Let op:</strong> Wijzigingen aan het abonnement worden direct doorgevoerd.
            </div>
            
            <div class="form-group">
                <label for="editSubMagazine">Magazine *</label>
                <select id="editSubMagazine" required>
                    <option value="">Selecteer magazine...</option>
                    <option value="Avrobode">Avrobode</option>
                    <option value="Mikrogids">Mikrogids</option>
                    <option value="Ncrvgids">Ncrvgids</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="editSubDuration">Duur & Betaling *</label>
                <select id="editSubDuration" required>
                    <option value="">Selecteer optie...</option>
                    <optgroup label="Jaarlijks Betaald">
                        <option value="1-jaar">1 jaar - €52,00 per jaar</option>
                        <option value="2-jaar">2 jaar - €98,00 totaal (5% korting)</option>
                        <option value="3-jaar">3 jaar - €140,00 totaal (10% korting)</option>
                    </optgroup>
                    <optgroup label="Maandelijks Betaald">
                        <option value="1-jaar-maandelijks">1 jaar - €4,50 per maand (€54,00 totaal)</option>
                        <option value="2-jaar-maandelijks">2 jaar - €4,35 per maand (€104,40 totaal)</option>
                        <option value="3-jaar-maandelijks">3 jaar - €4,20 per maand (€151,20 totaal)</option>
                    </optgroup>
                </select>
            </div>
            
            <div class="form-group">
                <label for="editSubStartDate">Startdatum *</label>
                <input type="date" id="editSubStartDate" required>
            </div>
            
            <div class="form-group">
                <label for="editSubStatus">Status *</label>
                <select id="editSubStatus" required>
                    <option value="active">Actief</option>
                    <option value="paused">Gepauzeerd</option>
                    <option value="cancelled">Opgezegd</option>
                </select>
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeForm('editSubscriptionForm')">Annuleren</button>
                <button type="submit" class="btn btn-primary">Wijzigingen Opslaan</button>
            </div>
        </form>
    </div>
</div>
```

#### File: `styles.css`
**Location:** Add after other form styles (around line 450)

**Changes:**
- Add styling for info box in edit form

**Implementation:**
```css
/* Info box for forms */
.info-box {
    background-color: #e0f2fe;
    border-left: 4px solid var(--primary-color);
    padding: 1rem;
    margin-bottom: 1.5rem;
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
    color: var(--text-primary);
}

.info-box strong {
    color: var(--primary-color);
}
```

#### File: `app.js`
**Location:** Replace existing `editSubscription()` function (around line 491)

**Changes:**
- Implement full edit subscription functionality
- Add save function
- Update contact history

**Implementation:**
```javascript
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
```

**Testing:**
- [ ] Verify edit form opens with correct data
- [ ] Verify all fields can be modified
- [ ] Verify status dropdown works correctly
- [ ] Verify changes are saved to localStorage
- [ ] Verify contact history records changes
- [ ] Verify subscription list updates after edit
- [ ] Verify cancel button works
- [ ] Verify form validation

---

## Implementation Order

### Phase 1: Quick Wins (1-2 hours)
1. ✅ Implement Enter key search (easiest, immediate UX improvement)
2. ✅ Add subscription duration dropdown with pricing

### Phase 2: Core Features (2-3 hours)
3. ✅ Implement customer data prefill
4. ✅ Modify createSubscription to handle existing customers

### Phase 3: Advanced Features (2-3 hours)
5. ✅ Create edit subscription form HTML
6. ✅ Implement edit subscription functionality
7. ✅ Add save subscription edit function

### Phase 4: Testing & Polish (1-2 hours)
8. ✅ Test all functionality end-to-end
9. ✅ Fix any bugs found
10. ✅ Update demo data to include new fields
11. ✅ Verify localStorage persistence

---

## Files to Modify

### index.html
- [ ] Add `onkeypress` handlers to search inputs (lines 32-41)
- [ ] Add duration dropdown in new subscription form (after line 156)
- [ ] Add edit subscription form (after line 230)

### app.js
- [ ] Add `handleSearchKeyPress()` function (after line 175)
- [ ] Update `showNewSubscription()` to prefill data (line 326)
- [ ] Update `createSubscription()` to handle existing customers (line 331)
- [ ] Add `subscriptionPricing` object (after line 10)
- [ ] Add `getPricingDisplay()` helper function
- [ ] Update `displaySubscriptions()` to show pricing (line 240)
- [ ] Replace `editSubscription()` function (line 491)
- [ ] Add `saveSubscriptionEdit()` function (new)
- [ ] Update demo data subscriptions to include duration field (line 30-40)

### styles.css
- [ ] Add `.form-hint` styling (after line 400)
- [ ] Add `optgroup` and `option` styling (after line 400)
- [ ] Add `.info-box` styling (after line 450)

---

## Testing Checklist

### Feature 1: Enter Key Search
- [ ] Enter works in name field
- [ ] Enter works in postal code field  
- [ ] Enter works in house number field
- [ ] Search results display correctly
- [ ] Button click still works
- [ ] Works with partial inputs
- [ ] Works with empty fields

### Feature 2: Customer Prefill
- [ ] Form prefills when customer loaded
- [ ] Form is empty when no customer
- [ ] Address parsing works correctly
- [ ] All fields populate correctly
- [ ] Can still create new customer
- [ ] Can add subscription to existing customer
- [ ] Contact history updates properly

### Feature 3: Subscription Offers
- [ ] Dropdown displays all options
- [ ] Optgroups are styled correctly
- [ ] Prices display in subscription list
- [ ] Form validation works
- [ ] Pricing calculations are correct
- [ ] Old subscriptions display gracefully

### Feature 4: Edit Subscription
- [ ] Edit form opens with correct data
- [ ] All fields are editable
- [ ] Status dropdown works
- [ ] Changes save correctly
- [ ] Contact history records changes
- [ ] Subscription list updates
- [ ] Cancel button works
- [ ] Form validation works

### Integration Testing
- [ ] All features work together
- [ ] No console errors
- [ ] LocalStorage persists correctly
- [ ] UI remains responsive
- [ ] No regression in existing features

---

## Potential Issues & Solutions

### Issue 1: Address Parsing
**Problem:** Current address format includes house number, may cause issues when splitting  
**Solution:** Use regex to properly extract street name: `address.replace(/\s+\d+.*$/, '')`

### Issue 2: Existing Demo Data
**Problem:** Existing subscriptions don't have duration field  
**Solution:** Handle gracefully with fallback: `sub.duration || 'Oude prijsstructuur'`

### Issue 3: Multiple Subscriptions per Customer
**Problem:** Need to ensure new subscription logic works for existing customers  
**Solution:** Check `if (currentCustomer)` and branch logic accordingly

### Issue 4: Form Reset
**Problem:** Forms need proper cleanup after submission  
**Solution:** Always call `reset()` and restore defaults where needed

---

## Future Enhancements

After completing these features, consider:

1. **Advanced Search Filters**
   - Search by email
   - Search by phone number
   - Search by subscription type

2. **Subscription Analytics**
   - Revenue per customer
   - Subscription duration trends
   - Cancellation reasons analytics

3. **Bulk Operations**
   - Bulk price changes
   - Mass communication
   - Batch imports

4. **Payment Integration**
   - Real payment gateway
   - Invoice generation
   - Payment status tracking

5. **Advanced Reporting**
   - Export customer data
   - Generate reports
   - Dashboard with KPIs

---

## Notes

- All prices are in EUR (€)
- Pricing structure allows for flexible discounts
- Consider adding VAT calculation in future
- Monthly payment has small premium to encourage yearly payment
- Status field (active/paused/cancelled) provides flexibility for subscription management

---

## Sign-off

**Plan Created By:** GitHub Copilot  
**Review Status:** Ready for Implementation  
**Estimated Total Time:** 6-10 hours  
**Priority:** High - All features requested by stakeholder
