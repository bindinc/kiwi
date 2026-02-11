import { getGlobalScope } from '../services.js';

const articlesApiBaseUrl = '/api/v1/catalog/articles';
const quoteApiUrl = '/api/v1/catalog/article-order-quote';

const DEFAULT_ORDER_QUOTE = {
    items: [],
    subtotal: 0,
    discounts: [],
    totalDiscount: 0,
    total: 0,
    couponCode: null,
    coupon: null
};

let articleLookup = new Map();
let latestSearchArticles = [];
let modalArticles = [];
let currentArticleTab = 'all';
let selectedArticleIndex = -1;
let orderItems = [];
let appliedCoupon = null;
let lastOrderQuote = createDefaultOrderQuote();
let compatibilityExportsInstalled = false;
let articleSearchInitialized = false;

function createDefaultOrderQuote() {
    return {
        ...DEFAULT_ORDER_QUOTE,
        items: [],
        discounts: []
    };
}

function translateArticle(key, params = {}, fallback = key) {
    const globalScope = getGlobalScope();
    if (!globalScope || !globalScope.i18n || typeof globalScope.i18n.t !== 'function') {
        return fallback;
    }

    const translatedValue = globalScope.i18n.t(key, params);
    if (translatedValue === undefined || translatedValue === null || translatedValue === key) {
        return fallback;
    }

    return translatedValue;
}

function showToast(message, type = 'success') {
    const globalScope = getGlobalScope();
    if (!globalScope || typeof globalScope.showToast !== 'function') {
        if (type === 'error') {
            console.error(message);
        }
        return;
    }

    globalScope.showToast(message, type);
}

function asCurrency(amount) {
    return `€${Number(amount || 0).toFixed(2).replace('.', ',')}`;
}

function setArticleLookup(items) {
    items.forEach((item) => {
        articleLookup.set(String(item.id), item);
    });
}

function setOrderItems(nextOrderItems) {
    if (!Array.isArray(nextOrderItems)) {
        orderItems = [];
        return;
    }

    orderItems = nextOrderItems;
}

function getElementValue(context, payload, fallbackKey = 'query') {
    if (context && context.element && 'value' in context.element) {
        return context.element.value;
    }

    if (payload && typeof payload[fallbackKey] === 'string') {
        return payload[fallbackKey];
    }

    return '';
}

function isActivationKey(event) {
    return event && (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar');
}

function getDocumentRef() {
    const globalScope = getGlobalScope();
    if (!globalScope || !globalScope.document) {
        return null;
    }

    return globalScope.document;
}

function getApiClient() {
    const globalScope = getGlobalScope();
    if (!globalScope) {
        return null;
    }

    return globalScope.kiwiApi || null;
}

export async function fetchArticles(params = {}) {
    const kiwiApi = getApiClient();
    if (!kiwiApi || typeof kiwiApi.get !== 'function') {
        throw new Error('kiwiApi client unavailable');
    }

    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
            return;
        }

        query.set(key, String(value));
    });

    const suffix = query.toString();
    const url = suffix ? `${articlesApiBaseUrl}?${suffix}` : articlesApiBaseUrl;
    const payload = await kiwiApi.get(url);
    const items = Array.isArray(payload && payload.items) ? payload.items : [];
    setArticleLookup(items);
    return items;
}

export async function fetchArticleById(articleId) {
    const cached = articleLookup.get(String(articleId));
    if (cached) {
        return cached;
    }

    const kiwiApi = getApiClient();
    if (!kiwiApi || typeof kiwiApi.get !== 'function') {
        return null;
    }

    try {
        const article = await kiwiApi.get(`${articlesApiBaseUrl}/${articleId}`);
        if (article) {
            articleLookup.set(String(article.id), article);
        }
        return article;
    } catch (_error) {
        return null;
    }
}

export async function requestOrderQuote(couponCodeOverride) {
    const kiwiApi = getApiClient();
    if (!kiwiApi || typeof kiwiApi.post !== 'function') {
        return {
            ...lastOrderQuote,
            items: Array.isArray(lastOrderQuote.items) ? lastOrderQuote.items.slice() : [],
            discounts: Array.isArray(lastOrderQuote.discounts) ? lastOrderQuote.discounts.slice() : []
        };
    }

    const payload = {
        items: orderItems,
        couponCode: couponCodeOverride !== undefined
            ? couponCodeOverride
            : (appliedCoupon ? appliedCoupon.code : null)
    };

    lastOrderQuote = await kiwiApi.post(quoteApiUrl, payload);
    return lastOrderQuote;
}

export function initArticleSearch() {
    if (articleSearchInitialized) {
        return;
    }

    const documentRef = getDocumentRef();
    if (!documentRef) {
        return;
    }

    const searchInput = documentRef.getElementById('articleSearch');
    const dropdown = documentRef.getElementById('articleDropdown');

    if (!searchInput || !dropdown) {
        return;
    }

    searchInput.addEventListener('focus', async () => {
        await filterArticles(searchInput.value);
        dropdown.style.display = 'block';
    });

    documentRef.addEventListener('click', (event) => {
        if (!event.target.closest('.article-selector')) {
            dropdown.style.display = 'none';
        }
    });

    searchInput.addEventListener('keydown', handleArticleKeyNav);
    articleSearchInitialized = true;
}

export async function filterArticles(query) {
    const documentRef = getDocumentRef();
    if (!documentRef) {
        return;
    }

    const dropdown = documentRef.getElementById('articleDropdown');
    if (!dropdown) {
        return;
    }

    selectedArticleIndex = -1;
    const normalizedQuery = (query || '').trim();

    try {
        latestSearchArticles = await fetchArticles({
            query: normalizedQuery,
            popular: normalizedQuery ? undefined : true,
            limit: 10
        });
    } catch (error) {
        latestSearchArticles = [];
        showToast(error.message || 'Kan artikelen niet laden', 'error');
    }

    renderArticleDropdown(latestSearchArticles, normalizedQuery);
    dropdown.style.display = 'block';
}

export function renderArticleDropdown(filteredArticles, query) {
    const documentRef = getDocumentRef();
    if (!documentRef) {
        return;
    }

    const dropdown = documentRef.getElementById('articleDropdown');
    if (!dropdown) {
        return;
    }

    if (!filteredArticles.length) {
        const noResults = translateArticle('articleSearch.noResults', {}, 'Geen artikelen gevonden.');
        const browseAllCta = translateArticle('articleSearch.browseAllCta', {}, 'Blader door alle artikelen →');
        dropdown.innerHTML = `<div class="article-no-results">${noResults} <button type="button" data-action="show-all-articles" class="browse-all-link">${browseAllCta}</button></div>`;
        return;
    }

    const groupedByMagazine = {};
    filteredArticles.forEach((article) => {
        if (!groupedByMagazine[article.magazine]) {
            groupedByMagazine[article.magazine] = [];
        }
        groupedByMagazine[article.magazine].push(article);
    });

    let html = '';
    const browseAll = translateArticle('articleSearch.browseAll', {}, '📚 Blader door alle artikelen');
    html += `<div class="article-browse-all"><button type="button" data-action="show-all-articles" class="browse-all-link">${browseAll}</button></div>`;

    Object.keys(groupedByMagazine).forEach((magazine) => {
        html += `<div class="article-category">${magazine}</div>`;
        groupedByMagazine[magazine].forEach((article) => {
            const highlightedName = highlightMatch(article.name, query);
            const highlightedCode = highlightMatch(article.code, query);
            html += `
                <div class="article-item"
                     role="button"
                     tabindex="0"
                     data-action="select-article"
                     data-action-event="click,keydown"
                     data-arg-article-id="${article.id}">
                    <div class="article-item-main">
                        <div class="article-item-name">${highlightedName}</div>
                        <div class="article-item-code">${highlightedCode}</div>
                    </div>
                    <div class="article-item-price">${asCurrency(article.price)}</div>
                </div>
            `;
        });
    });

    dropdown.innerHTML = html;
}

export function highlightMatch(text, query) {
    if (!query) {
        return text;
    }

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return String(text).replace(regex, '<mark>$1</mark>');
}

export async function selectArticle(articleId) {
    const article = await fetchArticleById(articleId);
    if (!article) {
        return;
    }

    const documentRef = getDocumentRef();
    if (!documentRef) {
        return;
    }

    const searchInput = documentRef.getElementById('articleSearch');
    const hiddenInput = documentRef.getElementById('articleName');
    const hiddenPrice = documentRef.getElementById('articleNamePrice');
    const dropdown = documentRef.getElementById('articleDropdown');

    if (searchInput) {
        searchInput.value = `${article.name} (${article.code})`;
    }

    if (hiddenInput) {
        hiddenInput.value = article.name;
        hiddenInput.setAttribute('data-article-id', article.id);
    }

    if (hiddenPrice) {
        hiddenPrice.value = article.price;
    } else if (hiddenInput) {
        const priceInput = documentRef.createElement('input');
        priceInput.type = 'hidden';
        priceInput.id = 'articleNamePrice';
        priceInput.value = article.price;
        hiddenInput.parentNode.appendChild(priceInput);
    }

    if (dropdown) {
        dropdown.style.display = 'none';
    }

    updateArticlePrice();
}

export async function showAllArticles() {
    const documentRef = getDocumentRef();
    if (!documentRef) {
        return;
    }

    const modal = documentRef.getElementById('allArticlesModal');
    if (!modal) {
        createAllArticlesModal();
    }

    await renderAllArticlesTabs();

    const allArticlesModal = documentRef.getElementById('allArticlesModal');
    if (allArticlesModal) {
        allArticlesModal.style.display = 'flex';
    }
}

function createAllArticlesModal() {
    const documentRef = getDocumentRef();
    if (!documentRef || !documentRef.body) {
        return;
    }

    const modalTitle = translateArticle('articleSearch.modalTitle', {}, '📚 Alle Artikelen');
    const searchPlaceholder = translateArticle('articleSearch.searchPlaceholder', {}, 'Zoek artikel...');
    const tabAll = translateArticle('articleSearch.tabAll', {}, 'Alle');
    const tabPopular = translateArticle('articleSearch.tabPopular', {}, 'Populair');
    const tabAvrobode = translateArticle('articleSearch.tabAvrobode', {}, 'Avrobode');
    const tabMikrogids = translateArticle('articleSearch.tabMikrogids', {}, 'Mikrogids');
    const tabNcrvgids = translateArticle('articleSearch.tabNcrvgids', {}, 'Ncrvgids');

    const modalHtml = `
        <div id="allArticlesModal" class="modal" style="display: none;">
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h3>${modalTitle}</h3>
                    <button class="btn-close" type="button" data-action="close-all-articles-modal">✕</button>
                </div>
                <div class="modal-body">
                    <div class="article-search-in-modal">
                        <input type="text"
                               id="modalArticleSearch"
                               placeholder="${searchPlaceholder}"
                               data-action="filter-modal-articles"
                               data-action-event="input">
                    </div>
                    <div class="article-tabs">
                        <button class="article-tab active" data-tab="all" data-action="show-article-tab" data-arg-tab="all">${tabAll}</button>
                        <button class="article-tab" data-tab="popular" data-action="show-article-tab" data-arg-tab="popular">${tabPopular}</button>
                        <button class="article-tab" data-tab="Avrobode" data-action="show-article-tab" data-arg-tab="Avrobode">${tabAvrobode}</button>
                        <button class="article-tab" data-tab="Mikrogids" data-action="show-article-tab" data-arg-tab="Mikrogids">${tabMikrogids}</button>
                        <button class="article-tab" data-tab="Ncrvgids" data-action="show-article-tab" data-arg-tab="Ncrvgids">${tabNcrvgids}</button>
                    </div>
                    <div id="articleTabContent" class="article-grid"></div>
                </div>
            </div>
        </div>
    `;

    documentRef.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function renderAllArticlesTabs() {
    currentArticleTab = 'all';
    await showArticleTab('all');
}

export async function showArticleTab(tab, event) {
    const documentRef = getDocumentRef();
    if (!documentRef) {
        return;
    }

    currentArticleTab = tab;

    documentRef.querySelectorAll('.article-tab').forEach((button) => {
        button.classList.toggle('active', button.dataset.tab === tab);
    });

    if (event && event.target) {
        event.target.classList.add('active');
    }

    try {
        modalArticles = await fetchArticles({ tab, limit: 200 });
    } catch (error) {
        modalArticles = [];
        showToast(error.message || 'Kan artikelen niet laden', 'error');
    }

    renderArticleGrid(modalArticles);
}

export async function filterModalArticles(query) {
    const normalizedQuery = (query || '').trim();

    if (!normalizedQuery) {
        await showArticleTab(currentArticleTab);
        return;
    }

    try {
        modalArticles = await fetchArticles({ query: normalizedQuery, limit: 200 });
    } catch (error) {
        modalArticles = [];
        showToast(error.message || 'Kan artikelen niet laden', 'error');
    }

    renderArticleGrid(modalArticles);
}

function renderArticleGrid(articles) {
    const documentRef = getDocumentRef();
    if (!documentRef) {
        return;
    }

    const grid = documentRef.getElementById('articleTabContent');
    if (!grid) {
        return;
    }

    if (!articles.length) {
        const emptyState = translateArticle('articleSearch.emptyState', {}, 'Geen artikelen gevonden');
        grid.innerHTML = `<div class="empty-state">${emptyState}</div>`;
        return;
    }

    let html = '';
    articles.forEach((article) => {
        html += `
            <div class="article-card"
                 role="button"
                 tabindex="0"
                 data-action="select-article-from-modal"
                 data-action-event="click,keydown"
                 data-arg-article-id="${article.id}">
                <div class="article-card-header">
                    <span class="article-card-magazine">${article.magazine}</span>
                    ${article.popular ? '<span class="article-card-badge">⭐</span>' : ''}
                </div>
                <div class="article-card-body">
                    <div class="article-card-name">${article.name}</div>
                    <div class="article-card-code">${article.code}</div>
                </div>
                <div class="article-card-footer">
                    <div class="article-card-category">${article.category}</div>
                    <div class="article-card-price">${asCurrency(article.price)}</div>
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

export async function selectArticleFromModal(articleId) {
    await selectArticle(articleId);
    closeAllArticlesModal();
}

export function closeAllArticlesModal() {
    const documentRef = getDocumentRef();
    if (!documentRef) {
        return;
    }

    const modal = documentRef.getElementById('allArticlesModal');
    if (modal) {
        modal.style.display = 'none';
    }

    const searchInput = documentRef.getElementById('modalArticleSearch');
    if (searchInput) {
        searchInput.value = '';
    }
}

export function handleArticleKeyNav(event) {
    const documentRef = getDocumentRef();
    if (!documentRef) {
        return;
    }

    const dropdown = documentRef.getElementById('articleDropdown');
    if (!dropdown) {
        return;
    }

    const items = dropdown.querySelectorAll('.article-item');

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        selectedArticleIndex = Math.min(selectedArticleIndex + 1, items.length - 1);
        highlightArticleItem(items, selectedArticleIndex);
        return;
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault();
        selectedArticleIndex = Math.max(selectedArticleIndex - 1, 0);
        highlightArticleItem(items, selectedArticleIndex);
        return;
    }

    if (event.key === 'Enter' && selectedArticleIndex >= 0) {
        event.preventDefault();
        if (items[selectedArticleIndex]) {
            items[selectedArticleIndex].click();
        }
        selectedArticleIndex = -1;
        return;
    }

    if (event.key === 'Escape') {
        dropdown.style.display = 'none';
        selectedArticleIndex = -1;
    }
}

function highlightArticleItem(items, index) {
    items.forEach((item, itemIndex) => {
        if (itemIndex === index) {
            item.classList.add('highlighted');
            item.scrollIntoView({ block: 'nearest' });
            return;
        }

        item.classList.remove('highlighted');
    });
}

export function updateArticlePrice() {
    const documentRef = getDocumentRef();
    if (!documentRef) {
        return;
    }

    const hiddenInput = documentRef.getElementById('articleName');
    const priceInput = documentRef.getElementById('articlePrice');
    const priceHidden = documentRef.getElementById('articleNamePrice');

    if (!hiddenInput || !hiddenInput.value || !priceInput) {
        if (priceInput) {
            priceInput.value = '€0,00';
        }
        return;
    }

    const unitPrice = parseFloat(priceHidden && priceHidden.value ? priceHidden.value : 0);
    priceInput.value = asCurrency(unitPrice);
}

export async function addArticleToOrder() {
    const documentRef = getDocumentRef();
    if (!documentRef) {
        return;
    }

    const hiddenInput = documentRef.getElementById('articleName');
    const quantityInput = documentRef.getElementById('articleQuantity');

    if (!hiddenInput) {
        return;
    }

    const articleId = hiddenInput.getAttribute('data-article-id');
    if (!hiddenInput.value || !articleId) {
        showToast('Selecteer eerst een artikel', 'error');
        return;
    }

    const quantity = parseInt((quantityInput && quantityInput.value) || '1', 10);
    if (!Number.isFinite(quantity) || quantity < 1) {
        showToast('Aantal moet minimaal 1 zijn', 'error');
        return;
    }

    const article = await fetchArticleById(articleId);
    if (!article) {
        showToast('Artikel niet gevonden', 'error');
        return;
    }

    const existing = orderItems.find((item) => String(item.articleId) === String(article.id));
    if (existing) {
        existing.quantity += quantity;
    } else {
        orderItems.push({
            articleId: article.id,
            code: article.code,
            name: article.name,
            unitPrice: article.price,
            quantity,
            magazine: article.magazine
        });
    }

    const articleSearch = documentRef.getElementById('articleSearch');
    const articlePrice = documentRef.getElementById('articlePrice');

    if (articleSearch) {
        articleSearch.value = '';
    }
    hiddenInput.value = '';
    hiddenInput.removeAttribute('data-article-id');

    if (quantityInput) {
        quantityInput.value = '1';
    }
    if (articlePrice) {
        articlePrice.value = '€0,00';
    }

    await renderOrderItems();
    showToast(`${article.name} toegevoegd aan bestelling`, 'success');
}

export async function removeArticleFromOrder(articleId) {
    orderItems = orderItems.filter((item) => String(item.articleId) !== String(articleId));
    await renderOrderItems();
    showToast('Artikel verwijderd uit bestelling', 'success');
}

export async function applyCoupon() {
    const documentRef = getDocumentRef();
    if (!documentRef) {
        return;
    }

    const couponInput = documentRef.getElementById('couponCode');
    const messageEl = documentRef.getElementById('couponMessage');
    const couponCode = (couponInput && couponInput.value ? couponInput.value : '').trim().toUpperCase();

    if (!messageEl) {
        return;
    }

    if (!couponCode) {
        messageEl.className = 'coupon-message error';
        messageEl.textContent = 'Voer een kortingscode in';
        return;
    }

    if (!orderItems.length) {
        messageEl.className = 'coupon-message error';
        messageEl.textContent = 'Voeg eerst artikelen toe aan je bestelling';
        return;
    }

    try {
        const quote = await requestOrderQuote(couponCode);
        if (!quote.coupon || !quote.coupon.valid) {
            messageEl.className = 'coupon-message error';
            messageEl.textContent = (quote.coupon && quote.coupon.message) || `Kortingscode "${couponCode}" is ongeldig`;
            appliedCoupon = null;
            await renderOrderItems();
            return;
        }

        appliedCoupon = {
            code: quote.coupon.code,
            type: quote.coupon.type,
            amount: quote.coupon.amount,
            description: quote.coupon.description
        };

        messageEl.className = 'coupon-message success';
        if (quote.coupon.type === 'fixed') {
            messageEl.textContent = `✓ Kortingscode toegepast: ${asCurrency(quote.coupon.amount)} korting`;
        } else {
            messageEl.textContent = `✓ Kortingscode toegepast: ${quote.coupon.amount}% korting`;
        }

        await renderOrderItems();
        showToast('Kortingscode toegepast!', 'success');
    } catch (error) {
        messageEl.className = 'coupon-message error';
        messageEl.textContent = error.message || 'Kon kortingscode niet toepassen';
    }
}

export async function removeCoupon() {
    const documentRef = getDocumentRef();
    if (!documentRef) {
        return;
    }

    appliedCoupon = null;

    const couponInput = documentRef.getElementById('couponCode');
    const messageEl = documentRef.getElementById('couponMessage');

    if (couponInput) {
        couponInput.value = '';
    }

    if (messageEl) {
        messageEl.className = 'coupon-message';
        messageEl.style.display = 'none';
    }

    await renderOrderItems();
    showToast('Kortingscode verwijderd', 'success');
}

export async function renderOrderItems() {
    const documentRef = getDocumentRef();
    if (!documentRef) {
        return;
    }

    const section = documentRef.getElementById('orderItemsSection');
    const list = documentRef.getElementById('orderItemsList');
    const discountsBreakdown = documentRef.getElementById('discountsBreakdown');
    const subtotalEl = documentRef.getElementById('orderSubtotal');
    const totalEl = documentRef.getElementById('orderTotal');

    if (!section || !list || !discountsBreakdown || !subtotalEl || !totalEl) {
        return;
    }

    if (!orderItems.length) {
        section.style.display = 'none';
        lastOrderQuote = createDefaultOrderQuote();
        return;
    }

    section.style.display = 'block';

    try {
        const quote = await requestOrderQuote();

        let itemsHtml = '';
        quote.items.forEach((item) => {
            const itemTotal = Number(item.unitPrice) * Number(item.quantity);
            const hasVolumeDiscount = Number(item.quantity) >= 5
                && quote.discounts.some((discount) => discount.type === 'Stapelkorting' && discount.itemName === item.name);

            itemsHtml += `
                <div class="order-item">
                    <div class="order-item-details">
                        <div class="order-item-name">${item.name}</div>
                        <div class="order-item-meta">${item.code} • ${item.magazine} • ${asCurrency(item.unitPrice)} per stuk</div>
                        ${hasVolumeDiscount ? '<div class="order-item-discount">✨ Stapelkorting actief (10%)<span class="order-item-discount-badge">KORTING</span></div>' : ''}
                    </div>
                    <div class="order-item-quantity">${item.quantity}x</div>
                    <div class="order-item-price">${asCurrency(itemTotal)}</div>
                    <button class="order-item-remove"
                            data-action="remove-article-from-order"
                            data-arg-article-id="${item.articleId}"
                            type="button">🗑️</button>
                </div>
            `;
        });
        list.innerHTML = itemsHtml;

        subtotalEl.textContent = asCurrency(quote.subtotal);
        totalEl.innerHTML = `<strong>${asCurrency(quote.total)}</strong>`;

        if (quote.totalDiscount > 0 && quote.discounts.length > 0) {
            discountsBreakdown.style.display = 'block';
            discountsBreakdown.innerHTML = quote.discounts.map((discount) => {
                const isCoupon = Boolean(discount.isCoupon);
                return `
                    <div class="discount-item">
                        <div>
                            <div class="discount-item-label">
                                <span class="discount-icon">${isCoupon ? '🎟️' : '💰'}</span>
                                <span class="discount-type">${discount.type}</span>
                                <span class="discount-badge ${isCoupon ? 'coupon-applied' : ''}">${isCoupon ? 'COUPON' : 'ACTIE'}</span>
                            </div>
                            <div class="discount-description">${discount.description}</div>
                        </div>
                        <div class="discount-item-amount">
                            -${asCurrency(discount.amount)}
                            ${isCoupon ? '<button data-action="remove-coupon" type="button" style="margin-left: 0.5rem; background: none; border: none; cursor: pointer; color: #dc2626; font-size: 1rem;" title="Verwijder kortingscode">✕</button>' : ''}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            discountsBreakdown.style.display = 'none';
        }
    } catch (error) {
        showToast(error.message || 'Kan ordersamenvatting niet berekenen', 'error');
    }
}

export async function getOrderData() {
    return requestOrderQuote();
}

function installOrderItemsCompatibilityProperty(globalScope) {
    const existingDescriptor = Object.getOwnPropertyDescriptor(globalScope, 'orderItems');
    const hasCompatibleDescriptor = !existingDescriptor || existingDescriptor.configurable;

    if (!hasCompatibleDescriptor) {
        globalScope.orderItems = orderItems;
        return;
    }

    Object.defineProperty(globalScope, 'orderItems', {
        configurable: true,
        enumerable: true,
        get() {
            return orderItems;
        },
        set(value) {
            setOrderItems(value);
        }
    });
}

function installLegacyCompatibilityExports() {
    if (compatibilityExportsInstalled) {
        return;
    }

    const globalScope = getGlobalScope();
    if (!globalScope) {
        return;
    }

    installOrderItemsCompatibilityProperty(globalScope);
    globalScope.initArticleSearch = initArticleSearch;
    globalScope.filterArticles = filterArticles;
    globalScope.renderArticleDropdown = renderArticleDropdown;
    globalScope.selectArticle = selectArticle;
    globalScope.showAllArticles = showAllArticles;
    globalScope.filterModalArticles = filterModalArticles;
    globalScope.showArticleTab = showArticleTab;
    globalScope.selectArticleFromModal = selectArticleFromModal;
    globalScope.closeAllArticlesModal = closeAllArticlesModal;
    globalScope.updateArticlePrice = updateArticlePrice;
    globalScope.addArticleToOrder = addArticleToOrder;
    globalScope.removeArticleFromOrder = removeArticleFromOrder;
    globalScope.applyCoupon = applyCoupon;
    globalScope.removeCoupon = removeCoupon;
    globalScope.renderOrderItems = renderOrderItems;
    globalScope.getOrderData = getOrderData;

    compatibilityExportsInstalled = true;
}

export function registerArticleSearchSlice(actionRouter) {
    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    installLegacyCompatibilityExports();

    actionRouter.registerMany({
        'filter-articles': (payload, context) => {
            const query = getElementValue(context, payload);
            void filterArticles(query);
        },
        'update-article-price': () => {
            updateArticlePrice();
        },
        'add-article-to-order': () => {
            void addArticleToOrder();
        },
        'apply-coupon': () => {
            void applyCoupon();
        },
        'apply-coupon-on-enter': (_payload, context) => {
            if (context.event.key !== 'Enter') {
                return;
            }
            context.event.preventDefault();
            void applyCoupon();
        },
        'show-all-articles': () => {
            void showAllArticles();
        },
        'select-article': (payload, context) => {
            const articleId = payload.articleId;
            if (articleId === undefined || articleId === null) {
                return;
            }

            if (context.event.type === 'keydown') {
                if (!isActivationKey(context.event)) {
                    return;
                }
                context.event.preventDefault();
            }

            void selectArticle(articleId);
        },
        'filter-modal-articles': (payload, context) => {
            const query = getElementValue(context, payload);
            void filterModalArticles(query);
        },
        'show-article-tab': (payload, context) => {
            if (!payload.tab) {
                return;
            }
            void showArticleTab(payload.tab, context.event);
        },
        'select-article-from-modal': (payload, context) => {
            const articleId = payload.articleId;
            if (articleId === undefined || articleId === null) {
                return;
            }

            if (context.event.type === 'keydown') {
                if (!isActivationKey(context.event)) {
                    return;
                }
                context.event.preventDefault();
            }

            void selectArticleFromModal(articleId);
        },
        'close-all-articles-modal': () => {
            closeAllArticlesModal();
        },
        'remove-article-from-order': (payload) => {
            const articleId = payload.articleId;
            if (articleId === undefined || articleId === null) {
                return;
            }
            void removeArticleFromOrder(articleId);
        },
        'remove-coupon': () => {
            void removeCoupon();
        }
    });
}

export const __articleSearchTestUtils = {
    createDefaultOrderQuote,
    resetStateForTests() {
        articleLookup = new Map();
        latestSearchArticles = [];
        modalArticles = [];
        currentArticleTab = 'all';
        selectedArticleIndex = -1;
        orderItems = [];
        appliedCoupon = null;
        lastOrderQuote = createDefaultOrderQuote();
        compatibilityExportsInstalled = false;
        articleSearchInitialized = false;
    },
    getStateSnapshot() {
        return {
            articleLookupSize: articleLookup.size,
            latestSearchArticles: latestSearchArticles.slice(),
            modalArticles: modalArticles.slice(),
            currentArticleTab,
            selectedArticleIndex,
            orderItems: orderItems.slice(),
            appliedCoupon: appliedCoupon ? { ...appliedCoupon } : null,
            lastOrderQuote: {
                ...lastOrderQuote,
                items: Array.isArray(lastOrderQuote.items) ? lastOrderQuote.items.slice() : [],
                discounts: Array.isArray(lastOrderQuote.discounts) ? lastOrderQuote.discounts.slice() : []
            },
            compatibilityExportsInstalled,
            articleSearchInitialized
        };
    }
};
