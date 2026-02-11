import { getGlobalScope } from '../services.js';

const CONTACT_HISTORY_SLICE_NAMESPACE = 'kiwiContactHistorySlice';
let contactHistoryDependenciesResolver = null;

export function configureContactHistorySliceDependencies(dependenciesResolver) {
    contactHistoryDependenciesResolver = typeof dependenciesResolver === 'function'
        ? dependenciesResolver
        : null;
}

const contactTypeLabelConfig = {
    call_started_anonymous: { key: 'contactHistory.type.callStartedAnonymous', fallback: 'Anonieme call gestart', icon: '📞', color: '#fbbf24' },
    call_started_identified: { key: 'contactHistory.type.callStartedIdentified', fallback: 'Call gestart', icon: '📞', color: '#3b82f6' },
    call_identified: { key: 'contactHistory.type.callIdentified', fallback: 'Beller geïdentificeerd', icon: '👤', color: '#10b981' },
    call_ended_by_agent: { key: 'contactHistory.type.callEndedByAgent', fallback: 'Call beëindigd (agent)', icon: '📞', color: '#6b7280' },
    call_ended_by_customer: { key: 'contactHistory.type.callEndedByCustomer', fallback: 'Call beëindigd (klant)', icon: '📞', color: '#ef4444' },
    call_disposition: { key: 'contactHistory.type.callDisposition', fallback: 'Gesprek afgerond', icon: '📋', color: '#3b82f6' },
    call_hold: { key: 'contactHistory.type.callHold', fallback: 'Gesprek in wacht', icon: '⏸️', color: '#f59e0b' },
    call_resumed: { key: 'contactHistory.type.callResumed', fallback: 'Gesprek hervat', icon: '▶️', color: '#10b981' },
    recording_started: { key: 'contactHistory.type.recordingStarted', fallback: 'Opname gestart', icon: '🔴', color: '#dc2626' },
    acw_completed: { key: 'contactHistory.type.acwCompleted', fallback: 'Nabewerking voltooid', icon: '✅', color: '#10b981' },
    follow_up_scheduled: { key: 'contactHistory.type.followUpScheduled', fallback: 'Follow-up gepland', icon: '📅', color: '#8b5cf6' },
    agent_status_change: { key: 'contactHistory.type.agentStatusChange', fallback: 'Agent status gewijzigd', icon: '🔄', color: '#6b7280' },
    subscription_created: { key: 'contactHistory.type.subscriptionCreated', fallback: 'Abonnement aangemaakt', icon: '➕', color: '#10b981' },
    subscription_changed: { key: 'contactHistory.type.subscriptionChanged', fallback: 'Abonnement gewijzigd', icon: '✏️', color: '#3b82f6' },
    subscription_cancelled: { key: 'contactHistory.type.subscriptionCancelled', fallback: 'Abonnement opgezegd', icon: '❌', color: '#ef4444' },
    article_sold: { key: 'contactHistory.type.articleSold', fallback: 'Artikel verkocht', icon: '🛒', color: '#10b981' },
    magazine_resent: { key: 'contactHistory.type.magazineResent', fallback: 'Editie opnieuw verzonden', icon: '📬', color: '#3b82f6' },
    notification_success: { key: 'contactHistory.type.notification', fallback: 'Melding', icon: '✅', color: '#10b981' },
    notification_info: { key: 'contactHistory.type.notification', fallback: 'Melding', icon: 'ℹ️', color: '#3b82f6' },
    notification_warning: { key: 'contactHistory.type.notification', fallback: 'Melding', icon: '⚠️', color: '#f59e0b' },
    notification_error: { key: 'contactHistory.type.notification', fallback: 'Melding', icon: '❗', color: '#ef4444' },
    default: { key: 'contactHistory.type.default', fallback: 'Contact', icon: '📝', color: '#6b7280' }
};

function resolveDependencies() {
    if (typeof contactHistoryDependenciesResolver !== 'function') {
        return null;
    }

    const dependencies = contactHistoryDependenciesResolver();
    if (!dependencies || typeof dependencies !== 'object') {
        return null;
    }

    return dependencies;
}

function translateLabel(dependencies, key, fallback) {
    if (dependencies && typeof dependencies.translate === 'function') {
        return dependencies.translate(key, {}, fallback);
    }
    return fallback;
}

function getDateLocale(dependencies) {
    if (dependencies && typeof dependencies.getDateLocaleForApp === 'function') {
        return dependencies.getDateLocaleForApp();
    }
    return 'nl-NL';
}

export function getContactTypeInfo(type) {
    const dependencies = resolveDependencies();
    const config = contactTypeLabelConfig[type] || contactTypeLabelConfig.default;

    return {
        label: translateLabel(dependencies, config.key, config.fallback),
        icon: config.icon,
        color: config.color
    };
}

export function formatDate(dateString) {
    const dependencies = resolveDependencies();
    const date = new Date(dateString);
    return date.toLocaleDateString(getDateLocale(dependencies), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

export function formatDateTime(dateString) {
    const dependencies = resolveDependencies();
    const date = new Date(dateString);
    return date.toLocaleDateString(getDateLocale(dependencies), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function renderTimelinePagination(currentPage, totalPages) {
    if (totalPages <= 1) {
        return '';
    }

    return `
        <div class="timeline-pagination">
            <button type="button" class="timeline-nav-btn" ${currentPage === 1 ? 'disabled' : ''} data-action="change-contact-history-page" data-arg-new-page="${currentPage - 1}">← Vorige</button>
            <span class="timeline-page-indicator">Pagina ${currentPage} van ${totalPages}</span>
            <button type="button" class="timeline-nav-btn" ${currentPage >= totalPages ? 'disabled' : ''} data-action="change-contact-history-page" data-arg-new-page="${currentPage + 1}">Volgende →</button>
        </div>
    `;
}

function buildEntryDomId(rawEntryId, fallbackIndex) {
    const rawId = String(rawEntryId ?? fallbackIndex);
    const sanitizedId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (sanitizedId) {
        return `ch-${sanitizedId}`;
    }
    return `ch-entry-${fallbackIndex}`;
}

export function displayContactHistory() {
    if (typeof document === 'undefined') {
        return;
    }

    const dependencies = resolveDependencies();
    if (!dependencies) {
        return;
    }

    const historyContainer = document.getElementById('contactHistory');
    if (!historyContainer) {
        return;
    }

    const currentCustomer = dependencies.getCurrentCustomer
        ? dependencies.getCurrentCustomer()
        : null;
    const contactHistoryState = dependencies.getContactHistoryState
        ? dependencies.getContactHistoryState()
        : null;
    if (!contactHistoryState) {
        return;
    }

    const contactHistory = currentCustomer && Array.isArray(currentCustomer.contactHistory)
        ? currentCustomer.contactHistory
        : [];
    if (contactHistory.length === 0) {
        historyContainer.innerHTML = `<div class="empty-state-small"><p>${translateLabel(dependencies, 'contactHistory.none', 'Geen contactgeschiedenis beschikbaar')}</p></div>`;
        return;
    }

    const sortedHistory = [...contactHistory].sort((left, right) => new Date(right.date) - new Date(left.date));
    const totalItems = sortedHistory.length;
    const itemsPerPage = contactHistoryState.itemsPerPage;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

    if (contactHistoryState.currentPage > totalPages) {
        contactHistoryState.currentPage = totalPages;
    }
    if (contactHistoryState.currentPage < 1) {
        contactHistoryState.currentPage = 1;
    }

    const startIndex = (contactHistoryState.currentPage - 1) * itemsPerPage;
    const pageItems = sortedHistory.slice(startIndex, startIndex + itemsPerPage);
    const paginationMarkup = renderTimelinePagination(contactHistoryState.currentPage, totalPages);

    const timelineItems = pageItems.map((item, index) => {
        const typeInfo = getContactTypeInfo(item.type);
        const rawItemId = String(item.id ?? `${startIndex + index}`);
        const entryDomId = buildEntryDomId(item.id, startIndex + index);
        const highlightId = contactHistoryState.highlightId;
        const isHighlighted = highlightId && String(highlightId) === String(item.id);
        const highlightClass = isHighlighted ? ' timeline-item--highlight' : '';
        const descriptionHtml = String(item.description || '').replace(/\n/g, '<br>');

        return `
        <div class="timeline-item${highlightClass}" data-contact-id="${rawItemId}">
            <div class="timeline-dot" style="background-color: ${typeInfo.color}"></div>
            <div class="timeline-header" data-action="toggle-timeline-item" data-arg-entry-dom-id="${entryDomId}">
                <span class="timeline-type" style="color: ${typeInfo.color}">
                    ${typeInfo.icon} ${typeInfo.label}
                </span>
                <span class="timeline-expand expanded" id="expand-${entryDomId}">▼</span>
                <span class="timeline-date">${formatDateTime(item.date)}</span>
            </div>
            <div class="timeline-content expanded" id="content-${entryDomId}">
                ${descriptionHtml}
            </div>
        </div>
        `;
    }).join('');

    historyContainer.innerHTML = `
        ${paginationMarkup}
        <div class="timeline-list">
            ${timelineItems}
        </div>
        ${paginationMarkup}
    `;
}

export function toggleTimelineItem(entryDomId) {
    if (typeof document === 'undefined') {
        return;
    }

    const content = document.getElementById(`content-${entryDomId}`);
    const expand = document.getElementById(`expand-${entryDomId}`);
    if (!content || !expand) {
        return;
    }

    const isExpanded = content.classList.toggle('expanded');
    expand.classList.toggle('expanded', isExpanded);
}

export function changeContactHistoryPage(newPage) {
    const dependencies = resolveDependencies();
    if (!dependencies) {
        return;
    }

    const currentCustomer = dependencies.getCurrentCustomer
        ? dependencies.getCurrentCustomer()
        : null;
    const contactHistoryState = dependencies.getContactHistoryState
        ? dependencies.getContactHistoryState()
        : null;
    if (!currentCustomer || !contactHistoryState) {
        return;
    }

    const requestedPage = Number(newPage);
    if (!Number.isFinite(requestedPage)) {
        return;
    }

    const totalItems = Array.isArray(currentCustomer.contactHistory)
        ? currentCustomer.contactHistory.length
        : 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / contactHistoryState.itemsPerPage));
    const targetPage = Math.min(Math.max(requestedPage, 1), totalPages);
    if (targetPage === contactHistoryState.currentPage) {
        return;
    }

    contactHistoryState.currentPage = targetPage;
    displayContactHistory();
}

function exposeContactHistoryGlobals() {
    const globalScope = getGlobalScope();
    if (!globalScope) {
        return;
    }

    globalScope[CONTACT_HISTORY_SLICE_NAMESPACE] = {
        getContactTypeInfo,
        displayContactHistory,
        toggleTimelineItem,
        changeContactHistoryPage,
        formatDate,
        formatDateTime
    };
}

export function registerContactHistorySlice(actionRouter) {
    exposeContactHistoryGlobals();

    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    actionRouter.registerMany({
        'toggle-timeline-item': (payload = {}) => {
            if (!payload.entryDomId) {
                return;
            }
            toggleTimelineItem(payload.entryDomId);
        },
        'change-contact-history-page': (payload = {}) => {
            if (payload.newPage === undefined || payload.newPage === null) {
                return;
            }
            changeContactHistoryPage(payload.newPage);
        }
    });
}
