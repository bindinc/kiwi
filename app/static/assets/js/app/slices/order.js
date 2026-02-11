import { getGlobalScope } from '../services.js';

const ORDER_SLICE_NAMESPACE = 'kiwiOrderSlice';
const ORDER_SLICE_DEPENDENCIES_PROVIDER = 'kiwiGetOrderSliceDependencies';

const DELIVERY_STATUS_CLASS_BY_KEY = {
    ordered: 'status-ordered',
    in_transit: 'status-transit',
    delivered: 'status-delivered',
    returned: 'status-returned'
};

const PAYMENT_STATUS_CLASS_BY_KEY = {
    pending: 'status-pending',
    paid: 'status-paid',
    refunded: 'status-refunded'
};

function resolveDependencies() {
    const globalScope = getGlobalScope();
    const provider = globalScope ? globalScope[ORDER_SLICE_DEPENDENCIES_PROVIDER] : null;
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

function getInputValue(elementId) {
    const element = getElementById(elementId);
    if (!element || typeof element.value !== 'string') {
        return '';
    }

    return element.value;
}

function setInputValue(elementId, value) {
    const element = getElementById(elementId);
    if (!element || !('value' in element)) {
        return;
    }

    element.value = value;
}

function setElementDisplay(elementId, displayValue) {
    const element = getElementById(elementId);
    if (!element || !element.style) {
        return;
    }

    element.style.display = displayValue;
}

function getCheckedValue(inputName, fallback = '') {
    const documentRef = getDocumentRef();
    if (!documentRef || typeof documentRef.querySelector !== 'function') {
        return fallback;
    }

    const input = documentRef.querySelector(`input[name="${inputName}"]:checked`);
    if (!input || typeof input.value !== 'string') {
        return fallback;
    }

    return input.value;
}

function setCheckedValue(inputName, value) {
    const documentRef = getDocumentRef();
    if (!documentRef || typeof documentRef.querySelector !== 'function') {
        return;
    }

    const input = documentRef.querySelector(`input[name="${inputName}"][value="${value}"]`);
    if (!input) {
        return;
    }

    input.checked = true;
}

function translateLabel(dependencies, key, params = {}, fallback = key) {
    if (dependencies && typeof dependencies.translate === 'function') {
        return dependencies.translate(key, params, fallback);
    }

    return fallback;
}

function formatDateLabel(dependencies, dateString) {
    if (!dateString) {
        return '';
    }

    if (dependencies && typeof dependencies.formatDate === 'function') {
        return dependencies.formatDate(dateString);
    }

    const parsedDate = new Date(dateString);
    return parsedDate.toLocaleDateString('nl-NL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function getCurrentCustomer(dependencies) {
    if (!dependencies || typeof dependencies.getCurrentCustomer !== 'function') {
        return null;
    }

    return dependencies.getCurrentCustomer() || null;
}

function getCustomers(dependencies) {
    if (!dependencies || typeof dependencies.getCustomers !== 'function') {
        return [];
    }

    const customers = dependencies.getCustomers();
    return Array.isArray(customers) ? customers : [];
}

function getOrderItems(dependencies) {
    if (!dependencies || typeof dependencies.getOrderItems !== 'function') {
        return [];
    }

    const orderItems = dependencies.getOrderItems();
    return Array.isArray(orderItems) ? orderItems : [];
}

async function renderOrderItems(dependencies) {
    if (!dependencies || typeof dependencies.renderOrderItems !== 'function') {
        return;
    }

    await dependencies.renderOrderItems();
}

function resetOrderItems(dependencies) {
    if (!dependencies || typeof dependencies.resetOrderItems !== 'function') {
        return;
    }

    dependencies.resetOrderItems();
}

async function getOrderData(dependencies) {
    if (!dependencies || typeof dependencies.getOrderData !== 'function') {
        return null;
    }

    return dependencies.getOrderData();
}

function getApiClient(dependencies) {
    if (!dependencies || typeof dependencies.getApiClient !== 'function') {
        return null;
    }

    return dependencies.getApiClient();
}

function showToast(dependencies, message, type = 'success') {
    if (dependencies && typeof dependencies.showToast === 'function') {
        dependencies.showToast(message, type);
    }
}

function closeForm(dependencies, formId) {
    if (dependencies && typeof dependencies.closeForm === 'function') {
        dependencies.closeForm(formId);
        return;
    }

    setElementDisplay(formId, 'none');
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

function upsertCustomerInCache(dependencies, customer) {
    if (!dependencies || typeof dependencies.upsertCustomerInCache !== 'function') {
        return;
    }

    dependencies.upsertCustomerInCache(customer);
}

function showSuccessIdentificationPrompt(dependencies, customerId, customerName) {
    if (!dependencies || typeof dependencies.showSuccessIdentificationPrompt !== 'function') {
        return;
    }

    dependencies.showSuccessIdentificationPrompt(customerId, customerName);
}

function getWorkflowsApiUrl(dependencies) {
    if (!dependencies || typeof dependencies.getWorkflowsApiUrl !== 'function') {
        return '/api/v1/workflows';
    }

    return dependencies.getWorkflowsApiUrl() || '/api/v1/workflows';
}

function getElementValue(context, payload, fallbackKey = 'query') {
    if (context && context.element && 'value' in context.element) {
        return context.element.value;
    }

    return payload && payload[fallbackKey] ? payload[fallbackKey] : '';
}

function isActivationKey(event) {
    return event && (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar');
}

function getLegacyFunction(functionName) {
    const globalScope = getGlobalScope();
    if (!globalScope) {
        return null;
    }

    const candidate = globalScope[functionName];
    if (typeof candidate !== 'function') {
        return null;
    }

    return candidate;
}

function callLegacy(functionName, args = []) {
    const legacyFunction = getLegacyFunction(functionName);
    if (!legacyFunction) {
        return undefined;
    }

    return legacyFunction(...args);
}

function callLegacyAsync(functionName, args = []) {
    return Promise.resolve(callLegacy(functionName, args)).catch((error) => {
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
            console.error(`[kiwi-actions] Action "${functionName}" failed.`, error);
        }
    });
}

function resolveDeliveryStatus(order, dependencies) {
    const statusKey = order && order.deliveryStatus ? order.deliveryStatus : 'ordered';
    const deliveryStatusClass = DELIVERY_STATUS_CLASS_BY_KEY[statusKey] || 'status-ordered';
    const deliveryStatusLabelByKey = {
        ordered: translateLabel(dependencies, 'articleOrders.deliveryStatusOrdered', {}, 'Besteld'),
        in_transit: translateLabel(dependencies, 'articleOrders.deliveryStatusInTransit', {}, 'Onderweg'),
        delivered: translateLabel(dependencies, 'articleOrders.deliveryStatusDelivered', {}, 'Afgeleverd'),
        returned: translateLabel(dependencies, 'articleOrders.deliveryStatusReturned', {}, 'Geretourneerd')
    };

    return {
        className: deliveryStatusClass,
        label: deliveryStatusLabelByKey[statusKey] || deliveryStatusLabelByKey.ordered
    };
}

function resolvePaymentStatus(order, dependencies) {
    const statusKey = order && order.paymentStatus ? order.paymentStatus : 'pending';
    const paymentStatusClass = PAYMENT_STATUS_CLASS_BY_KEY[statusKey] || 'status-pending';
    const paymentStatusLabelByKey = {
        pending: translateLabel(dependencies, 'articleOrders.paymentStatusPending', {}, 'In behandeling'),
        paid: translateLabel(dependencies, 'articleOrders.paymentStatusPaid', {}, 'Betaald'),
        refunded: translateLabel(dependencies, 'articleOrders.paymentStatusRefunded', {}, 'Terugbetaald')
    };

    return {
        className: paymentStatusClass,
        label: paymentStatusLabelByKey[statusKey] || paymentStatusLabelByKey.pending
    };
}

function buildOrderItemsDisplay(order, dependencies) {
    const hasMultiItemPayload = order && Array.isArray(order.items);
    if (!hasMultiItemPayload) {
        return {
            itemsHtml: `${order.articleName || translateLabel(dependencies, 'articleOrders.itemFallback', {}, 'Artikel')} (${order.quantity}x)`,
            pricingHtml: `<strong>${translateLabel(dependencies, 'articleOrders.priceLabel', {}, 'Prijs')}:</strong> €${Number(order.price || 0).toFixed(2)}`
        };
    }

    const itemsHtml = order.items.map((item) => (
        `${item.name} (${item.quantity}x à €${Number(item.unitPrice || 0).toFixed(2)})`
    )).join('<br>');
    const discountMarkup = Number(order.totalDiscount || 0) > 0
        ? `<strong>${translateLabel(dependencies, 'articleOrders.discountLabel', {}, 'Korting')}:</strong> <span style="color: #059669;">-€${Number(order.totalDiscount || 0).toFixed(2)}</span> (${(order.discounts || []).map((discount) => discount.type).join(', ')})<br>`
        : '';
    const pricingHtml = `
        <strong>${translateLabel(dependencies, 'articleOrders.subtotalLabel', {}, 'Subtotaal')}:</strong> €${Number(order.subtotal || 0).toFixed(2)}<br>
        ${discountMarkup}
        <strong>${translateLabel(dependencies, 'articleOrders.totalLabel', {}, 'Totaal')}:</strong> €${Number(order.total || 0).toFixed(2)}
    `;

    return {
        itemsHtml,
        pricingHtml
    };
}

function renderOrder(order, dependencies) {
    const deliveryStatus = resolveDeliveryStatus(order, dependencies);
    const paymentStatus = resolvePaymentStatus(order, dependencies);
    const orderItemsDisplay = buildOrderItemsDisplay(order, dependencies);
    const returnPossible = Boolean(order.returnDeadline && new Date(order.returnDeadline) > new Date());

    return `
        <div class="article-item">
            <div class="article-info">
                <div class="article-name">${translateLabel(dependencies, 'articleOrders.orderNumber', { id: order.id }, `🛒 Bestelling #${order.id}`)}</div>
                <div class="article-details">
                    <strong>${translateLabel(dependencies, 'articleOrders.itemsLabel', {}, 'Artikelen')}:</strong><br>${orderItemsDisplay.itemsHtml}<br>
                    ${orderItemsDisplay.pricingHtml}<br>
                    <strong>${translateLabel(dependencies, 'articleOrders.orderedLabel', {}, 'Besteld')}:</strong> ${formatDateLabel(dependencies, order.orderDate)} •
                    <strong>${translateLabel(dependencies, 'articleOrders.desiredDeliveryLabel', {}, 'Gewenste levering')}:</strong> ${formatDateLabel(dependencies, order.desiredDeliveryDate)}
                    ${order.actualDeliveryDate ? `<br><strong>${translateLabel(dependencies, 'articleOrders.deliveredLabel', {}, 'Geleverd')}:</strong> ${formatDateLabel(dependencies, order.actualDeliveryDate)}` : ''}
                    ${order.trackingNumber ? `<br><strong>${translateLabel(dependencies, 'articleOrders.trackingLabel', {}, 'Track & Trace')}:</strong> ${order.trackingNumber}` : ''}
                    ${order.notes ? `<br><strong>${translateLabel(dependencies, 'articleOrders.remarkLabel', {}, 'Opmerking')}:</strong> ${order.notes}` : ''}
                    ${returnPossible ? `<br><strong>${translateLabel(dependencies, 'articleOrders.returnPossibleUntilLabel', {}, 'Retour mogelijk tot')}:</strong> ${formatDateLabel(dependencies, order.returnDeadline)}` : ''}
                </div>
            </div>
            <div class="article-actions">
                <span class="article-status ${deliveryStatus.className}">${deliveryStatus.label}</span>
                <span class="article-status ${paymentStatus.className}">${paymentStatus.label}</span>
            </div>
        </div>
    `;
}

export function displayArticles() {
    const dependencies = resolveDependencies();
    const articlesList = getElementById('articlesList');
    if (!articlesList) {
        return;
    }

    const currentCustomer = getCurrentCustomer(dependencies);
    const customerArticles = currentCustomer && Array.isArray(currentCustomer.articles)
        ? currentCustomer.articles
        : [];
    if (customerArticles.length === 0) {
        articlesList.innerHTML = `<p class="empty-state-small">${translateLabel(dependencies, 'articleOrders.none', {}, 'Geen artikelen')}</p>`;
        return;
    }

    const sortedArticles = customerArticles.slice().sort((left, right) => (
        new Date(right.orderDate) - new Date(left.orderDate)
    ));
    const itemsMarkup = sortedArticles.map((order) => renderOrder(order, dependencies)).join('');
    articlesList.innerHTML = `<div class="articles-group">${itemsMarkup}</div>`;
}

function prefillArticleSaleForm(currentCustomer, dependencies) {
    const selectedSalutation = currentCustomer.salutation || 'Dhr.';
    setCheckedValue('articleSalutation', selectedSalutation);

    setInputValue('articleInitials', currentCustomer.firstName || '');
    setInputValue('articleMiddleName', currentCustomer.middleName || '');
    setInputValue('articleLastName', currentCustomer.lastName || '');
    setInputValue('articlePostalCode', currentCustomer.postalCode || '');

    const houseNumberMatch = currentCustomer.houseNumber
        ? String(currentCustomer.houseNumber).match(/^(\d+)(.*)$/)
        : null;
    if (houseNumberMatch) {
        setInputValue('articleHouseNumber', houseNumberMatch[1] || '');
        setInputValue('articleHouseExt', houseNumberMatch[2] || '');
    } else {
        setInputValue('articleHouseNumber', currentCustomer.houseNumber || '');
        setInputValue('articleHouseExt', '');
    }

    const streetName = String(currentCustomer.address || '').replace(/\s+\d+.*$/, '');
    setInputValue('articleAddress', streetName);
    setInputValue('articleCity', currentCustomer.city || '');
    setInputValue('articleEmail', currentCustomer.email || '');
    setInputValue('articlePhone', currentCustomer.phone || '');

    if (dependencies && typeof dependencies.setBirthdayFields === 'function') {
        dependencies.setBirthdayFields('article', currentCustomer.birthday);
    }

    if (currentCustomer.deliveryRemarks && currentCustomer.deliveryRemarks.default) {
        setInputValue('articleNotes', currentCustomer.deliveryRemarks.default);
    }
}

export function showArticleSale() {
    const dependencies = resolveDependencies();
    const currentCustomer = getCurrentCustomer(dependencies);

    if (currentCustomer) {
        prefillArticleSaleForm(currentCustomer, dependencies);
    } else {
        const form = getElementById('articleForm');
        if (form && typeof form.reset === 'function') {
            form.reset();
        }

        if (dependencies && typeof dependencies.setBirthdayFields === 'function') {
            dependencies.setBirthdayFields('article');
        }
    }

    if (dependencies && typeof dependencies.initDeliveryDatePicker === 'function') {
        dependencies.initDeliveryDatePicker();
    }

    setInputValue('articleSearch', '');
    setInputValue('articleName', '');
    setInputValue('articlePrice', '€0,00');
    resetOrderItems(dependencies);
    void renderOrderItems(dependencies);

    setElementDisplay('articleSaleForm', 'flex');
}

export function addDeliveryRemark(remark) {
    if (!remark) {
        return;
    }

    const notesField = getElementById('articleNotes');
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

export function addDeliveryRemarkByKey(key) {
    if (!key) {
        return;
    }

    const dependencies = resolveDependencies();
    const resolvedRemark = translateLabel(dependencies, key, {}, key);
    addDeliveryRemark(resolvedRemark);
}

function createTrackingNumber() {
    return `3SABCD${Math.random().toString().substr(2, 10)}NL`;
}

function getTodayIsoDate() {
    return new Date().toISOString().split('T')[0];
}

function buildReturnDeadlineIsoDate(desiredDeliveryDate) {
    const returnDeadline = new Date(desiredDeliveryDate);
    returnDeadline.setDate(returnDeadline.getDate() + 14);
    return returnDeadline.toISOString().split('T')[0];
}

function buildContactDescription(orderData, formData, dependencies) {
    const itemsDescription = (orderData.items || []).map((item) => (
        `${item.name} (${item.quantity}x à €${Number(item.unitPrice || 0).toFixed(2)})`
    )).join(', ');

    let discountDescription = '';
    if (Array.isArray(orderData.discounts) && orderData.discounts.length > 0) {
        const discountDetails = orderData.discounts.map((discount) => {
            const formattedAmount = Number(discount.amount || 0).toFixed(2);
            if (discount.isCoupon) {
                return `${discount.type} "${discount.description}" -€${formattedAmount}`;
            }
            return `${discount.type} -€${formattedAmount}`;
        }).join(', ');
        discountDescription = ` Kortingen: ${discountDetails}.`;
    }

    const couponNote = orderData.couponCode ? ` Kortingscode: ${orderData.couponCode}.` : '';
    const notesPart = formData.notes ? ` Opmerkingen: ${formData.notes}` : '';
    return `Artikel bestelling: ${itemsDescription}. Subtotaal: €${Number(orderData.subtotal || 0).toFixed(2)}.${discountDescription}${couponNote} Totaal: €${Number(orderData.total || 0).toFixed(2)}. Gewenste levering: ${formatDateLabel(dependencies, formData.desiredDeliveryDate)}. Betaling: ${formData.paymentMethod}.${notesPart}`;
}

function buildArticleOrderPayload(orderData, formData, trackingNumber, returnDeadlineStr, contactDescription) {
    return {
        order: {
            orderDate: getTodayIsoDate(),
            desiredDeliveryDate: formData.desiredDeliveryDate,
            deliveryStatus: 'ordered',
            trackingNumber,
            paymentStatus: 'paid',
            paymentMethod: formData.paymentMethod,
            paymentDate: getTodayIsoDate(),
            actualDeliveryDate: null,
            returnDeadline: returnDeadlineStr,
            notes: formData.notes,
            items: orderData.items,
            couponCode: orderData.couponCode || null
        },
        contactEntry: {
            type: 'Artikel bestelling',
            description: contactDescription
        }
    };
}

function buildOrderModel(orderData, formData, trackingNumber, returnDeadlineStr) {
    return {
        id: Date.now(),
        orderDate: getTodayIsoDate(),
        desiredDeliveryDate: formData.desiredDeliveryDate,
        deliveryStatus: 'ordered',
        trackingNumber,
        paymentStatus: 'paid',
        paymentMethod: formData.paymentMethod,
        paymentDate: getTodayIsoDate(),
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
}

function createCustomerFromArticleOrder(formData, fullLastName, newOrder, contactDescription, customers) {
    const numericCustomerIds = customers
        .map((customer) => Number(customer && customer.id))
        .filter((id) => Number.isFinite(id));
    const nextCustomerId = numericCustomerIds.length > 0
        ? Math.max(...numericCustomerIds) + 1
        : 1;

    return {
        id: nextCustomerId,
        salutation: formData.salutation,
        firstName: formData.firstName,
        middleName: formData.middleName,
        lastName: fullLastName,
        birthday: formData.birthday,
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
                description: contactDescription
            }
        ]
    };
}

async function resetOrderEditorState(dependencies) {
    resetOrderItems(dependencies);
    await renderOrderItems(dependencies);
}

function readArticleSaleFormData(dependencies) {
    const birthday = dependencies && typeof dependencies.ensureBirthdayValue === 'function'
        ? dependencies.ensureBirthdayValue('article', false)
        : null;
    if (birthday === null) {
        return null;
    }

    const houseNumber = getInputValue('articleHouseNumber');
    const houseExt = getInputValue('articleHouseExt');
    const address = getInputValue('articleAddress');

    return {
        salutation: getCheckedValue('articleSalutation'),
        firstName: getInputValue('articleInitials'),
        middleName: getInputValue('articleMiddleName'),
        lastName: getInputValue('articleLastName'),
        postalCode: getInputValue('articlePostalCode').toUpperCase(),
        houseNumber: houseExt ? `${houseNumber}${houseExt}` : houseNumber,
        address: `${address} ${houseNumber}${houseExt}`,
        city: getInputValue('articleCity'),
        email: getInputValue('articleEmail'),
        phone: getInputValue('articlePhone'),
        birthday,
        desiredDeliveryDate: getInputValue('articleDesiredDelivery'),
        paymentMethod: getCheckedValue('articlePayment'),
        notes: getInputValue('articleNotes')
    };
}

async function submitArticleOrderViaApi(dependencies, options = {}) {
    const {
        currentCustomer,
        formData,
        orderData,
        trackingNumber,
        returnDeadlineStr,
        contactDescription,
        fullLastName
    } = options;
    const apiClient = getApiClient(dependencies);
    if (!apiClient || typeof apiClient.post !== 'function') {
        return false;
    }

    const hadCurrentCustomer = Boolean(currentCustomer);
    const payload = buildArticleOrderPayload(orderData, formData, trackingNumber, returnDeadlineStr, contactDescription);
    if (currentCustomer && currentCustomer.id !== undefined && currentCustomer.id !== null) {
        payload.customerId = currentCustomer.id;
    } else {
        payload.customer = {
            salutation: formData.salutation,
            firstName: formData.firstName,
            middleName: formData.middleName,
            lastName: fullLastName,
            birthday: formData.birthday,
            postalCode: formData.postalCode,
            houseNumber: formData.houseNumber,
            address: formData.address,
            city: formData.city,
            email: formData.email,
            phone: formData.phone,
            subscriptions: [],
            articles: [],
            contactHistory: []
        };
    }

    try {
        const response = await apiClient.post(`${getWorkflowsApiUrl(dependencies)}/article-order`, payload);
        const savedCustomer = response && response.customer ? response.customer : null;
        if (savedCustomer) {
            upsertCustomerInCache(dependencies, savedCustomer);
        }

        await resetOrderEditorState(dependencies);
        closeForm(dependencies, 'articleSaleForm');
        showToast(
            dependencies,
            hadCurrentCustomer
                ? translateLabel(dependencies, 'articleOrders.created', {}, 'Artikel bestelling succesvol aangemaakt!')
                : translateLabel(dependencies, 'articleOrders.createdWithCustomer', {}, 'Nieuwe klant en artikel bestelling succesvol aangemaakt!'),
            'success'
        );

        if (savedCustomer && savedCustomer.id !== undefined && savedCustomer.id !== null) {
            await selectCustomer(dependencies, savedCustomer.id);
            if (!hadCurrentCustomer) {
                showSuccessIdentificationPrompt(
                    dependencies,
                    savedCustomer.id,
                    `${savedCustomer.firstName} ${savedCustomer.lastName}`
                );
            }
        }
    } catch (error) {
        showToast(
            dependencies,
            error.message || translateLabel(dependencies, 'articleOrders.createFailed', {}, 'Artikel bestelling aanmaken via backend mislukt'),
            'error'
        );
        return true;
    }

    const articleForm = getElementById('articleForm');
    if (articleForm && typeof articleForm.reset === 'function') {
        articleForm.reset();
    }
    return true;
}

async function submitArticleOrderLocally(dependencies, options = {}) {
    const {
        currentCustomer,
        formData,
        orderData,
        trackingNumber,
        returnDeadlineStr,
        contactDescription,
        fullLastName
    } = options;
    const newOrder = buildOrderModel(orderData, formData, trackingNumber, returnDeadlineStr);

    if (currentCustomer) {
        if (!Array.isArray(currentCustomer.articles)) {
            currentCustomer.articles = [];
        }
        currentCustomer.articles.push(newOrder);
        currentCustomer.birthday = formData.birthday;

        pushContactHistory(
            dependencies,
            currentCustomer,
            {
                type: 'Artikel bestelling',
                description: contactDescription
            },
            {
                highlight: true,
                persist: false
            }
        );

        saveCustomers(dependencies);
        await resetOrderEditorState(dependencies);
        closeForm(dependencies, 'articleSaleForm');
        showToast(dependencies, translateLabel(dependencies, 'articleOrders.created', {}, 'Artikel bestelling succesvol aangemaakt!'), 'success');
        await selectCustomer(dependencies, currentCustomer.id);
    } else {
        const customers = getCustomers(dependencies);
        const newCustomer = createCustomerFromArticleOrder(
            formData,
            fullLastName,
            newOrder,
            contactDescription,
            customers
        );
        customers.push(newCustomer);

        saveCustomers(dependencies);
        await resetOrderEditorState(dependencies);
        closeForm(dependencies, 'articleSaleForm');
        showToast(
            dependencies,
            translateLabel(dependencies, 'articleOrders.createdWithCustomer', {}, 'Nieuwe klant en artikel bestelling succesvol aangemaakt!'),
            'success'
        );
        await selectCustomer(dependencies, newCustomer.id);
        showSuccessIdentificationPrompt(
            dependencies,
            newCustomer.id,
            `${formData.firstName} ${fullLastName}`
        );
    }

    const articleForm = getElementById('articleForm');
    if (articleForm && typeof articleForm.reset === 'function') {
        articleForm.reset();
    }
}

export async function createArticleSale(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }

    const dependencies = resolveDependencies();
    const orderItems = getOrderItems(dependencies);
    if (orderItems.length === 0) {
        showToast(
            dependencies,
            translateLabel(dependencies, 'articleOrders.addItem', {}, 'Voeg minimaal één artikel toe aan de bestelling'),
            'error'
        );
        return;
    }

    const formData = readArticleSaleFormData(dependencies);
    if (!formData) {
        return;
    }

    let orderData;
    try {
        orderData = await getOrderData(dependencies);
    } catch (error) {
        showToast(
            dependencies,
            error.message || translateLabel(dependencies, 'articleOrders.calculationFailed', {}, 'Bestelberekening via backend mislukt'),
            'error'
        );
        return;
    }

    const hasValidOrderData = orderData && Array.isArray(orderData.items);
    if (!hasValidOrderData) {
        showToast(
            dependencies,
            translateLabel(dependencies, 'articleOrders.calculationFailed', {}, 'Bestelberekening via backend mislukt'),
            'error'
        );
        return;
    }

    const trackingNumber = createTrackingNumber();
    const returnDeadlineStr = buildReturnDeadlineIsoDate(formData.desiredDeliveryDate);
    const contactDescription = buildContactDescription(orderData, formData, dependencies);
    const fullLastName = formData.middleName
        ? `${formData.middleName} ${formData.lastName}`
        : formData.lastName;
    const currentCustomer = getCurrentCustomer(dependencies);

    const apiPathHandled = await submitArticleOrderViaApi(dependencies, {
        currentCustomer,
        formData,
        orderData,
        trackingNumber,
        returnDeadlineStr,
        contactDescription,
        fullLastName
    });
    if (apiPathHandled) {
        return;
    }

    await submitArticleOrderLocally(dependencies, {
        currentCustomer,
        formData,
        orderData,
        trackingNumber,
        returnDeadlineStr,
        contactDescription,
        fullLastName
    });
}

function exposeOrderSliceApi() {
    const globalScope = getGlobalScope();
    if (!globalScope) {
        return;
    }

    globalScope[ORDER_SLICE_NAMESPACE] = {
        displayArticles,
        showArticleSale,
        addDeliveryRemark,
        addDeliveryRemarkByKey,
        createArticleSale
    };
}

export function registerOrderActions(actionRouter) {
    exposeOrderSliceApi();

    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    actionRouter.registerMany({
        'open-article-sale-form': () => {
            showArticleSale();
        },
        'close-article-sale-form': () => {
            const dependencies = resolveDependencies();
            closeForm(dependencies, 'articleSaleForm');
        },
        'submit-article-sale-form': (_payload, context) => {
            void createArticleSale(context.event);
        },
        'add-delivery-remark': (payload = {}) => {
            if (!payload.remarkKey) {
                return;
            }
            addDeliveryRemarkByKey(payload.remarkKey);
        },

        // Item 10+11 remain legacy-bridged until those checklist items migrate.
        'filter-articles': (payload, context) => {
            const query = getElementValue(context, payload);
            void callLegacyAsync('filterArticles', [query]);
        },
        'update-article-price': () => {
            callLegacy('updateArticlePrice');
        },
        'add-article-to-order': () => {
            void callLegacyAsync('addArticleToOrder');
        },
        'apply-coupon': () => {
            void callLegacyAsync('applyCoupon');
        },
        'apply-coupon-on-enter': (_payload, context) => {
            const isEnterPress = context && context.event && context.event.key === 'Enter';
            if (!isEnterPress) {
                return;
            }

            context.event.preventDefault();
            void callLegacyAsync('applyCoupon');
        },
        'show-all-articles': () => {
            void callLegacyAsync('showAllArticles');
        },
        'select-article': (payload = {}, context) => {
            if (payload.articleId === undefined || payload.articleId === null) {
                return;
            }

            const isKeyboardEvent = context && context.event && context.event.type === 'keydown';
            if (isKeyboardEvent && !isActivationKey(context.event)) {
                return;
            }
            if (isKeyboardEvent) {
                context.event.preventDefault();
            }

            void callLegacyAsync('selectArticle', [payload.articleId]);
        },
        'filter-modal-articles': (payload, context) => {
            const query = getElementValue(context, payload);
            void callLegacyAsync('filterModalArticles', [query]);
        },
        'show-article-tab': (payload = {}, context) => {
            if (!payload.tab) {
                return;
            }

            void callLegacyAsync('showArticleTab', [payload.tab, context.event]);
        },
        'select-article-from-modal': (payload = {}, context) => {
            if (payload.articleId === undefined || payload.articleId === null) {
                return;
            }

            const isKeyboardEvent = context && context.event && context.event.type === 'keydown';
            if (isKeyboardEvent && !isActivationKey(context.event)) {
                return;
            }
            if (isKeyboardEvent) {
                context.event.preventDefault();
            }

            void callLegacyAsync('selectArticleFromModal', [payload.articleId]);
        },
        'close-all-articles-modal': () => {
            callLegacy('closeAllArticlesModal');
        },
        'remove-article-from-order': (payload = {}) => {
            if (payload.articleId === undefined || payload.articleId === null) {
                return;
            }

            void callLegacyAsync('removeArticleFromOrder', [payload.articleId]);
        },
        'remove-coupon': () => {
            void callLegacyAsync('removeCoupon');
        },
        'select-recommended-delivery-date': (_payload, context) => {
            void callLegacyAsync('selectRecommendedDate', [context.event]);
        },
        'navigate-delivery-calendar': (payload = {}, context) => {
            const direction = Number(payload.direction);
            if (!Number.isFinite(direction) || direction === 0) {
                return;
            }

            void callLegacyAsync('navigateCalendar', [direction, context.event]);
        },
        'select-delivery-date': (payload = {}, context) => {
            if (!payload.date) {
                return;
            }

            const isKeyboardEvent = context && context.event && context.event.type === 'keydown';
            if (!isKeyboardEvent) {
                callLegacy('selectDeliveryDateByString', [payload.date, context.event]);
                return;
            }

            if (!isActivationKey(context.event)) {
                return;
            }

            context.event.preventDefault();
            callLegacy('selectDeliveryDateByString', [payload.date]);
        }
    });
}
