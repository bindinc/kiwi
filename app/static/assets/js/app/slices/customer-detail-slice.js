import { getGlobalScope } from '../services.js';
import { displayContactHistory, formatDate } from './contact-history-slice.js';

const CUSTOMER_DETAIL_SLICE_NAMESPACE = 'kiwiCustomerDetailSlice';
let customerDetailDependenciesResolver = null;

export function configureCustomerDetailSliceDependencies(dependenciesResolver) {
    customerDetailDependenciesResolver = typeof dependenciesResolver === 'function'
        ? dependenciesResolver
        : null;
}

function resolveDependencies() {
    if (typeof customerDetailDependenciesResolver !== 'function') {
        return null;
    }

    const dependencies = customerDetailDependenciesResolver();
    if (!dependencies || typeof dependencies !== 'object') {
        return null;
    }

    return dependencies;
}

function translateLabel(dependencies, key, fallback, params = {}) {
    if (dependencies && typeof dependencies.translate === 'function') {
        return dependencies.translate(key, params, fallback);
    }
    return fallback;
}

function resolveApiClient() {
    const globalScope = getGlobalScope();
    const apiClient = globalScope ? globalScope.kiwiApi : null;
    if (!apiClient || typeof apiClient.get !== 'function') {
        return null;
    }
    return apiClient;
}

function normalizeCustomerId(customerId) {
    const numericId = Number(customerId);
    if (Number.isFinite(numericId)) {
        return numericId;
    }
    return customerId;
}

function setElementText(id, value) {
    if (typeof document === 'undefined') {
        return;
    }

    const element = document.getElementById(id);
    if (!element) {
        return;
    }

    element.textContent = value || '';
}

function setElementDisplay(id, displayValue) {
    if (typeof document === 'undefined') {
        return;
    }

    const element = document.getElementById(id);
    if (!element) {
        return;
    }

    element.style.display = displayValue;
}

function buildCustomerFullName(customer) {
    if (!customer) {
        return '';
    }

    const nameParts = [
        customer.salutation || '',
        customer.firstName || '',
        customer.middleName || '',
        customer.lastName || ''
    ]
        .map((part) => String(part).trim())
        .filter(Boolean);
    return nameParts.join(' ');
}

function buildCustomerAddressLine(customer) {
    if (!customer) {
        return '';
    }

    const address = customer.address || '';
    const postalCode = customer.postalCode || '';
    const city = customer.city || '';
    return `${address}, ${postalCode} ${city}`.trim();
}

function getCurrentCustomer(dependencies) {
    if (!dependencies || typeof dependencies.getCurrentCustomer !== 'function') {
        return null;
    }
    return dependencies.getCurrentCustomer();
}

function getSubscriptionMetadata(dependencies, subscription) {
    const pricingInfo = typeof dependencies.getSubscriptionDurationDisplay === 'function'
        ? dependencies.getSubscriptionDurationDisplay(subscription)
        : '';
    const requesterMeta = typeof dependencies.getSubscriptionRequesterMetaLine === 'function'
        ? dependencies.getSubscriptionRequesterMetaLine(subscription)
        : '';

    return {
        pricingInfo,
        requesterMeta
    };
}

function renderActiveSubscriptions(subscriptions, dependencies) {
    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
        return '';
    }

    const rows = subscriptions.map((subscription) => {
        const { pricingInfo, requesterMeta } = getSubscriptionMetadata(dependencies, subscription);
        return `
            <div class="subscription-item">
                <div class="subscription-info">
                    <div class="subscription-name">📰 ${subscription.magazine}</div>
                    <div class="subscription-details">
                        ${translateLabel(dependencies, 'subscription.startLabel', 'Start')}: ${formatDate(subscription.startDate)} •
                        ${translateLabel(dependencies, 'subscription.lastEditionLabel', 'Laatste editie')}: ${formatDate(subscription.lastEdition)}<br>
                        ${pricingInfo}${requesterMeta}
                    </div>
                </div>
                <div class="subscription-actions">
                    <span class="subscription-status status-active">${translateLabel(dependencies, 'subscription.statusActive', 'Actief')}</span>
                    <button class="icon-btn" type="button" data-action="edit-subscription" data-arg-sub-id="${subscription.id}" title="${translateLabel(dependencies, 'subscription.editTitle', 'Bewerken')}">✏️</button>
                    <button class="icon-btn" type="button" data-action="cancel-subscription" data-arg-sub-id="${subscription.id}" title="${translateLabel(dependencies, 'subscription.cancelTitle', 'Opzeggen')}">🚫</button>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="subscription-group">
            <h4 class="subscription-group-title">${translateLabel(dependencies, 'subscription.groupActive', 'Actieve Abonnementen')}</h4>
            ${rows}
        </div>
    `;
}

function renderEndedSubscriptions(subscriptions, dependencies) {
    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
        return '';
    }

    const rows = subscriptions.map((subscription) => {
        const { pricingInfo, requesterMeta } = getSubscriptionMetadata(dependencies, subscription);
        const statusClass = subscription.status === 'cancelled' ? 'status-cancelled' : 'status-ended';
        const statusText = subscription.status === 'cancelled'
            ? translateLabel(dependencies, 'subscription.statusCancelled', 'Opgezegd')
            : translateLabel(dependencies, 'subscription.statusEnded', 'Beëindigd');
        const endDateLabel = subscription.endDate
            ? `${translateLabel(dependencies, 'subscription.endLabel', 'Einde')}: ${formatDate(subscription.endDate)} • `
            : '';

        return `
            <div class="subscription-item subscription-ended">
                <div class="subscription-info">
                    <div class="subscription-name">📰 ${subscription.magazine}</div>
                    <div class="subscription-details">
                        ${translateLabel(dependencies, 'subscription.startLabel', 'Start')}: ${formatDate(subscription.startDate)} •
                        ${endDateLabel}
                        ${translateLabel(dependencies, 'subscription.lastEditionLabel', 'Laatste editie')}: ${formatDate(subscription.lastEdition)}<br>
                        ${pricingInfo}${requesterMeta}
                    </div>
                </div>
                <div class="subscription-actions">
                    <span class="subscription-status ${statusClass}">${statusText}</span>
                    <button class="btn btn-small btn-winback" type="button" data-action="start-winback-for-subscription" data-arg-sub-id="${subscription.id}" title="${translateLabel(dependencies, 'subscription.winbackTitle', 'Winback/Opzegging')}">
                        ${translateLabel(dependencies, 'subscription.winbackAction', '🎯 Winback/Opzegging')}
                    </button>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="subscription-group">
            <h4 class="subscription-group-title">${translateLabel(dependencies, 'subscription.groupEnded', 'Beëindigde Abonnementen')}</h4>
            ${rows}
        </div>
    `;
}

function renderRestitutedSubscriptions(subscriptions, dependencies) {
    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
        return '';
    }

    const rows = subscriptions.map((subscription) => {
        const { pricingInfo, requesterMeta } = getSubscriptionMetadata(dependencies, subscription);
        const endDateLabel = subscription.endDate
            ? `${translateLabel(dependencies, 'subscription.endLabel', 'Einde')}: ${formatDate(subscription.endDate)} • `
            : '';
        const refundInfo = subscription.refundInfo
            ? `<br>${translateLabel(dependencies, 'subscription.refundToLabel', 'Restitutie naar')}: ${subscription.refundInfo.email}`
            : '';

        return `
            <div class="subscription-item subscription-restituted">
                <div class="subscription-info">
                    <div class="subscription-name">📰 ${subscription.magazine}</div>
                    <div class="subscription-details">
                        ${translateLabel(dependencies, 'subscription.startLabel', 'Start')}: ${formatDate(subscription.startDate)} •
                        ${endDateLabel}
                        ${translateLabel(dependencies, 'subscription.lastEditionLabel', 'Laatste editie')}: ${formatDate(subscription.lastEdition)}<br>
                        ${pricingInfo}${requesterMeta}${refundInfo}
                    </div>
                </div>
                <div class="subscription-actions">
                    <span class="subscription-status status-restituted">${translateLabel(dependencies, 'subscription.statusRestituted', 'Gerestitueerd')}</span>
                    <button class="btn btn-small btn-secondary" type="button" data-action="revert-restitution" data-arg-sub-id="${subscription.id}" title="${translateLabel(dependencies, 'subscription.transferToOtherTitle', 'Overzetten naar andere persoon')}">
                        ${translateLabel(dependencies, 'subscription.transferAction', '🔄 Overzetten')}
                    </button>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="subscription-group">
            <h4 class="subscription-group-title">${translateLabel(dependencies, 'subscription.groupRestituted', 'Gerestitueerde Abonnementen')}</h4>
            ${rows}
        </div>
    `;
}

function renderTransferredSubscriptions(subscriptions, dependencies) {
    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
        return '';
    }

    const rows = subscriptions.map((subscription) => {
        const { pricingInfo, requesterMeta } = getSubscriptionMetadata(dependencies, subscription);
        let transferInfo = '';
        if (subscription.transferredTo) {
            const transferNameParts = [
                subscription.transferredTo.firstName || '',
                subscription.transferredTo.middleName || '',
                subscription.transferredTo.lastName || ''
            ]
                .map((part) => String(part).trim())
                .filter(Boolean);
            const transferName = transferNameParts.join(' ');
            transferInfo = `<br>${translateLabel(dependencies, 'subscription.transferredToLabel', 'Overgezet naar')}: ${transferName} (${subscription.transferredTo.email})`;
        }

        return `
            <div class="subscription-item subscription-transferred">
                <div class="subscription-info">
                    <div class="subscription-name">📰 ${subscription.magazine}</div>
                    <div class="subscription-details">
                        Start: ${formatDate(subscription.startDate)} •
                        Laatste editie: ${formatDate(subscription.lastEdition)}<br>
                        ${pricingInfo}${requesterMeta}${transferInfo}
                    </div>
                </div>
                <div class="subscription-actions">
                    <span class="subscription-status status-transferred">Overgezet</span>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="subscription-group">
            <h4 class="subscription-group-title">${translateLabel(dependencies, 'subscription.groupTransferred', 'Overgezette Abonnementen')}</h4>
            ${rows}
        </div>
    `;
}

export function displayDeceasedStatusBanner() {
    if (typeof document === 'undefined') {
        return;
    }

    const dependencies = resolveDependencies();
    if (!dependencies) {
        return;
    }

    const existingBanner = document.querySelector('.deceased-status-banner');
    if (existingBanner) {
        existingBanner.remove();
    }

    const currentCustomer = getCurrentCustomer(dependencies);
    const contactHistory = currentCustomer && Array.isArray(currentCustomer.contactHistory)
        ? currentCustomer.contactHistory
        : [];
    if (contactHistory.length === 0) {
        return;
    }

    const hasDeceasedEntry = contactHistory.some((entry) => {
        const entryType = String(entry.type || '').toLowerCase();
        const entryDescription = String(entry.description || '').toLowerCase();
        return entryType.includes('overlijden') || entryDescription.includes('overlijden');
    });
    if (!hasDeceasedEntry) {
        return;
    }

    const banner = document.createElement('div');
    banner.className = 'deceased-status-banner';
    banner.innerHTML = `
        <div class="deceased-banner-icon">⚠️</div>
        <div class="deceased-banner-content">
            <strong>${translateLabel(dependencies, 'customer.deceasedBannerTitle', 'Deze klant is overleden')}</strong>
            <p>${translateLabel(dependencies, 'customer.deceasedBannerDescription', 'Let op bij het verwerken van abonnementen en bestellingen')}</p>
        </div>
    `;

    const customerDetail = document.getElementById('customerDetail');
    const customerHeader = customerDetail ? customerDetail.querySelector('.customer-header') : null;
    if (customerHeader && customerHeader.parentNode) {
        customerHeader.parentNode.insertBefore(banner, customerHeader.nextSibling);
    }
}

export function displaySubscriptions() {
    if (typeof document === 'undefined') {
        return;
    }

    const dependencies = resolveDependencies();
    if (!dependencies) {
        return;
    }

    const subscriptionsList = document.getElementById('subscriptionsList');
    if (!subscriptionsList) {
        return;
    }

    const currentCustomer = getCurrentCustomer(dependencies);
    const subscriptions = currentCustomer && Array.isArray(currentCustomer.subscriptions)
        ? currentCustomer.subscriptions
        : [];
    if (subscriptions.length === 0) {
        subscriptionsList.innerHTML = `<p class="empty-state-small">${translateLabel(dependencies, 'subscription.none', 'Geen abonnementen')}</p>`;
        return;
    }

    const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === 'active');
    const endedSubscriptions = subscriptions.filter((subscription) => subscription.status === 'ended' || subscription.status === 'cancelled');
    const restitutedSubscriptions = subscriptions.filter((subscription) => subscription.status === 'restituted');
    const transferredSubscriptions = subscriptions.filter((subscription) => subscription.status === 'transferred');

    const sections = [
        renderActiveSubscriptions(activeSubscriptions, dependencies),
        renderEndedSubscriptions(endedSubscriptions, dependencies),
        renderRestitutedSubscriptions(restitutedSubscriptions, dependencies),
        renderTransferredSubscriptions(transferredSubscriptions, dependencies)
    ]
        .filter(Boolean)
        .join('');

    subscriptionsList.innerHTML = sections;
}

export async function selectCustomer(customerId) {
    if (typeof document === 'undefined') {
        return;
    }

    const dependencies = resolveDependencies();
    if (!dependencies) {
        return;
    }

    const normalizedCustomerId = normalizeCustomerId(customerId);
    let customer = dependencies.findCustomerById
        ? dependencies.findCustomerById(normalizedCustomerId)
        : null;
    const apiClient = resolveApiClient();

    if (apiClient && dependencies.personsApiUrl) {
        try {
            customer = await apiClient.get(`${dependencies.personsApiUrl}/${normalizedCustomerId}`);
            if (typeof dependencies.upsertCustomerInCache === 'function') {
                dependencies.upsertCustomerInCache(customer);
            }
        } catch (error) {
            if (typeof dependencies.showToast === 'function') {
                dependencies.showToast(
                    translateLabel(dependencies, 'customer.detailLoadFailed', 'Kon klantdetail niet laden'),
                    'error'
                );
            }
            console.error('Kon klantdetail niet laden via API', error);
            return;
        }
    }

    if (typeof dependencies.setCurrentCustomer === 'function') {
        dependencies.setCurrentCustomer(customer || null);
    }

    const selectedCustomer = getCurrentCustomer(dependencies);
    if (!selectedCustomer) {
        return;
    }

    if (typeof dependencies.resetContactHistoryViewState === 'function') {
        dependencies.resetContactHistoryViewState();
    }

    setElementDisplay('welcomeMessage', 'none');
    setElementDisplay('searchResultsView', 'none');
    setElementDisplay('customerDetail', 'block');

    setElementText('customerName', buildCustomerFullName(selectedCustomer));
    setElementText('customerAddress', buildCustomerAddressLine(selectedCustomer));
    setElementText('customerEmail', selectedCustomer.email || '');
    setElementText('customerPhone', selectedCustomer.phone || '');

    displayDeceasedStatusBanner();
    displaySubscriptions();
    if (typeof dependencies.displayArticles === 'function') {
        dependencies.displayArticles();
    }
    displayContactHistory();

    if (typeof dependencies.updateCustomerActionButtons === 'function') {
        dependencies.updateCustomerActionButtons();
    }
    if (typeof dependencies.updateIdentifyCallerButtons === 'function') {
        dependencies.updateIdentifyCallerButtons();
    }

    const globalScope = getGlobalScope();
    if (globalScope && typeof globalScope.scrollTo === 'function') {
        globalScope.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function exposeCustomerDetailGlobals() {
    const globalScope = getGlobalScope();
    if (!globalScope) {
        return;
    }

    globalScope[CUSTOMER_DETAIL_SLICE_NAMESPACE] = {
        selectCustomer,
        displayDeceasedStatusBanner,
        displaySubscriptions
    };
}

export function registerCustomerDetailSlice(actionRouter) {
    exposeCustomerDetailGlobals();

    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    actionRouter.registerMany({
        'select-customer': (payload = {}) => {
            if (payload.customerId === undefined || payload.customerId === null) {
                return;
            }
            void Promise.resolve(selectCustomer(payload.customerId)).catch((error) => {
                console.error('Kon klantselectie niet verwerken', error);
            });
        }
    });
}
