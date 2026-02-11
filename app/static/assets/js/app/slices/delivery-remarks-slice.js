import { getGlobalScope } from '../services.js';

const DELIVERY_REMARKS_SLICE_NAMESPACE = 'kiwiDeliveryRemarksSlice';
const DELIVERY_REMARKS_SLICE_DEPENDENCIES_PROVIDER = 'kiwiGetDeliveryRemarksSliceDependencies';

function resolveDependencies() {
    const globalScope = getGlobalScope();
    const provider = globalScope ? globalScope[DELIVERY_REMARKS_SLICE_DEPENDENCIES_PROVIDER] : null;
    if (typeof provider !== 'function') {
        return null;
    }

    const dependencies = provider();
    if (!dependencies || typeof dependencies !== 'object') {
        return null;
    }

    return dependencies;
}

function getDocumentRef() {
    if (typeof document !== 'undefined') {
        return document;
    }

    const globalScope = getGlobalScope();
    return globalScope && globalScope.document ? globalScope.document : null;
}

function getElementById(elementId) {
    const documentRef = getDocumentRef();
    if (!documentRef || typeof documentRef.getElementById !== 'function') {
        return null;
    }

    return documentRef.getElementById(elementId);
}

function translateLabel(dependencies, key, params = {}, fallback = key) {
    if (dependencies && typeof dependencies.translate === 'function') {
        return dependencies.translate(key, params, fallback);
    }

    return fallback;
}

function getCurrentCustomer(dependencies) {
    if (!dependencies || typeof dependencies.getCurrentCustomer !== 'function') {
        return null;
    }

    return dependencies.getCurrentCustomer() || null;
}

function getApiClient(dependencies) {
    if (!dependencies || typeof dependencies.getApiClient !== 'function') {
        return null;
    }

    return dependencies.getApiClient();
}

function getPersonsApiUrl(dependencies) {
    if (!dependencies || typeof dependencies.getPersonsApiUrl !== 'function') {
        return '/api/v1/persons';
    }

    return dependencies.getPersonsApiUrl() || '/api/v1/persons';
}

function getAgentName(dependencies) {
    if (dependencies && typeof dependencies.getAgentName === 'function') {
        return dependencies.getAgentName() || '';
    }

    const agentNameElement = getElementById('agentName');
    return agentNameElement && typeof agentNameElement.textContent === 'string'
        ? agentNameElement.textContent
        : '';
}

function showToast(dependencies, message, type = 'success') {
    if (dependencies && typeof dependencies.showToast === 'function') {
        dependencies.showToast(message, type);
    }
}

async function selectCustomer(dependencies, customerId) {
    if (!dependencies || typeof dependencies.selectCustomer !== 'function') {
        return;
    }

    await dependencies.selectCustomer(customerId);
}

function pushContactHistory(dependencies, customer, entry, options = {}) {
    if (!dependencies || typeof dependencies.pushContactHistory !== 'function') {
        return;
    }

    dependencies.pushContactHistory(customer, entry, options);
}

function saveCustomers(dependencies) {
    if (!dependencies || typeof dependencies.saveCustomers !== 'function') {
        return;
    }

    dependencies.saveCustomers();
}

function ensureDeliveryRemarksModel(customer) {
    if (!customer.deliveryRemarks || typeof customer.deliveryRemarks !== 'object') {
        customer.deliveryRemarks = {
            default: '',
            lastUpdated: null,
            history: []
        };
        return;
    }

    if (!Array.isArray(customer.deliveryRemarks.history)) {
        customer.deliveryRemarks.history = [];
    }
}

function buildCustomerName(customer) {
    if (!customer) {
        return '';
    }

    const nameParts = [customer.firstName, customer.middleName, customer.lastName]
        .map((part) => String(part || '').trim())
        .filter(Boolean);
    return nameParts.join(' ');
}

export function editDeliveryRemarks() {
    const dependencies = resolveDependencies();
    const currentCustomer = getCurrentCustomer(dependencies);
    if (!currentCustomer) {
        return;
    }

    const modal = getElementById('editDeliveryRemarksModal');
    const customerName = getElementById('editRemarksCustomerName');
    const remarksTextarea = getElementById('editCustomerDeliveryRemarks');
    if (!modal || !customerName || !remarksTextarea) {
        return;
    }

    customerName.textContent = buildCustomerName(currentCustomer);
    remarksTextarea.value = currentCustomer.deliveryRemarks?.default || '';
    modal.style.display = 'flex';
}

export function addDeliveryRemarkToModal(remark) {
    if (!remark) {
        return;
    }

    const notesField = getElementById('editCustomerDeliveryRemarks');
    if (!notesField || !('value' in notesField)) {
        return;
    }

    const currentValue = String(notesField.value || '').trim();
    notesField.value = currentValue ? `${currentValue}\n${remark}` : remark;
    if (typeof notesField.focus === 'function') {
        notesField.focus();
    }
    if ('scrollHeight' in notesField) {
        notesField.scrollTop = notesField.scrollHeight;
    }
}

export function addDeliveryRemarkToModalByKey(key) {
    if (!key) {
        return;
    }

    const dependencies = resolveDependencies();
    const resolvedRemark = translateLabel(dependencies, key, {}, key);
    addDeliveryRemarkToModal(resolvedRemark);
}

export function closeEditRemarksModal() {
    const modal = getElementById('editDeliveryRemarksModal');
    if (!modal || !modal.style) {
        return;
    }

    modal.style.display = 'none';
}

async function saveDeliveryRemarksViaApi(dependencies, currentCustomer, newRemarks) {
    const apiClient = getApiClient(dependencies);
    if (!apiClient || typeof apiClient.put !== 'function') {
        return false;
    }

    try {
        const payload = await apiClient.put(
            `${getPersonsApiUrl(dependencies)}/${currentCustomer.id}/delivery-remarks`,
            {
                default: newRemarks,
                updatedBy: getAgentName(dependencies)
            }
        );

        if (payload && payload.deliveryRemarks) {
            currentCustomer.deliveryRemarks = payload.deliveryRemarks;
        }

        closeEditRemarksModal();
        showToast(
            dependencies,
            translateLabel(dependencies, 'delivery.remarksSaved', {}, 'Bezorgvoorkeuren opgeslagen!'),
            'success'
        );
        await selectCustomer(dependencies, currentCustomer.id);
    } catch (error) {
        showToast(
            dependencies,
            error.message || translateLabel(dependencies, 'delivery.saveFailed', {}, 'Bezorgvoorkeuren opslaan via backend mislukt'),
            'error'
        );
    }

    return true;
}

function saveDeliveryRemarksLocally(dependencies, currentCustomer, newRemarks) {
    ensureDeliveryRemarksModel(currentCustomer);

    const existingDefaultRemark = currentCustomer.deliveryRemarks.default || '';
    const hasNewValue = existingDefaultRemark !== newRemarks;
    if (hasNewValue) {
        currentCustomer.deliveryRemarks.history.unshift({
            date: new Date().toISOString(),
            remark: newRemarks,
            updatedBy: getAgentName(dependencies)
        });

        pushContactHistory(
            dependencies,
            currentCustomer,
            {
                type: 'Bezorgvoorkeuren gewijzigd',
                description: `Bezorgvoorkeuren bijgewerkt: "${newRemarks || '(leeg)'}"`
            },
            {
                highlight: true,
                persist: false
            }
        );
    }

    currentCustomer.deliveryRemarks.default = newRemarks;
    currentCustomer.deliveryRemarks.lastUpdated = new Date().toISOString();

    saveCustomers(dependencies);
    closeEditRemarksModal();
    showToast(
        dependencies,
        translateLabel(dependencies, 'delivery.remarksSaved', {}, 'Bezorgvoorkeuren opgeslagen!'),
        'success'
    );
}

export async function saveDeliveryRemarks() {
    const dependencies = resolveDependencies();
    const currentCustomer = getCurrentCustomer(dependencies);
    if (!currentCustomer) {
        return;
    }

    const remarksTextarea = getElementById('editCustomerDeliveryRemarks');
    if (!remarksTextarea || typeof remarksTextarea.value !== 'string') {
        return;
    }

    const newRemarks = remarksTextarea.value.trim();
    const apiPathHandled = await saveDeliveryRemarksViaApi(dependencies, currentCustomer, newRemarks);
    if (apiPathHandled) {
        return;
    }

    saveDeliveryRemarksLocally(dependencies, currentCustomer, newRemarks);
}

function exposeDeliveryRemarksSliceApi() {
    const globalScope = getGlobalScope();
    if (!globalScope) {
        return;
    }

    globalScope[DELIVERY_REMARKS_SLICE_NAMESPACE] = {
        editDeliveryRemarks,
        addDeliveryRemarkToModal,
        addDeliveryRemarkToModalByKey,
        saveDeliveryRemarks,
        closeEditRemarksModal
    };
}

export function registerDeliveryRemarksSlice(actionRouter) {
    exposeDeliveryRemarksSliceApi();

    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    actionRouter.registerMany({
        'edit-delivery-remarks': () => {
            editDeliveryRemarks();
        },
        'add-delivery-remark-modal': (payload = {}) => {
            if (!payload.remarkKey) {
                return;
            }
            addDeliveryRemarkToModalByKey(payload.remarkKey);
        },
        'close-edit-delivery-remarks-modal': () => {
            closeEditRemarksModal();
        },
        'save-delivery-remarks': () => {
            void saveDeliveryRemarks();
        }
    });
}
