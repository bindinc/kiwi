// Article search and ordering UI backed by /api/v1 catalog endpoints.

function translateArticle(key, params, fallback) {
    if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.t === 'function') {
        const value = window.i18n.t(key, params);
        if (value !== undefined && value !== null && value !== key) {
            return value;
        }
    }
    return fallback !== undefined ? fallback : key;
}

const articlesApiBaseUrl = '/api/v1/catalog/articles';
const quoteApiUrl = '/api/v1/catalog/article-order-quote';

let articleLookup = new Map();
let latestSearchArticles = [];
let modalArticles = [];
let currentArticleTab = 'all';
let selectedArticleIndex = -1;
let orderItems = [];
let appliedCoupon = null;
let lastOrderQuote = {
    items: [],
    subtotal: 0,
    discounts: [],
    totalDiscount: 0,
    total: 0,
    couponCode: null,
    coupon: null,
};

function asCurrency(amount) {
    return `€${Number(amount || 0).toFixed(2).replace('.', ',')}`;
}

function setArticleLookup(items) {
    items.forEach((item) => {
        articleLookup.set(String(item.id), item);
    });
}

async function fetchArticles(params = {}) {
    if (!window.kiwiApi) {
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
    const payload = await window.kiwiApi.get(url);
    const items = Array.isArray(payload && payload.items) ? payload.items : [];
    setArticleLookup(items);
    return items;
}

async function fetchArticleById(articleId) {
    const cached = articleLookup.get(String(articleId));
    if (cached) {
        return cached;
    }

    if (!window.kiwiApi) {
        return null;
    }

    try {
        const article = await window.kiwiApi.get(`${articlesApiBaseUrl}/${articleId}`);
        if (article) {
            articleLookup.set(String(article.id), article);
        }
        return article;
    } catch (_error) {
        return null;
    }
}

async function requestOrderQuote(couponCodeOverride) {
    if (!window.kiwiApi) {
        return { ...lastOrderQuote };
    }

    const payload = {
        items: orderItems,
        couponCode: couponCodeOverride !== undefined
            ? couponCodeOverride
            : (appliedCoupon ? appliedCoupon.code : null),
    };

    lastOrderQuote = await window.kiwiApi.post(quoteApiUrl, payload);
    return lastOrderQuote;
}

function initArticleSearch() {
    const searchInput = document.getElementById('articleSearch');
    const dropdown = document.getElementById('articleDropdown');

    if (!searchInput || !dropdown) return;

    searchInput.addEventListener('focus', async () => {
        await filterArticles(searchInput.value);
        dropdown.style.display = 'block';
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('.article-selector')) {
            dropdown.style.display = 'none';
        }
    });

    searchInput.addEventListener('keydown', handleArticleKeyNav);
}

async function filterArticles(query) {
    const dropdown = document.getElementById('articleDropdown');
    if (!dropdown) {
        return;
    }

    const normalizedQuery = (query || '').trim();

    try {
        latestSearchArticles = await fetchArticles({
            query: normalizedQuery,
            popular: normalizedQuery ? undefined : true,
            limit: 10,
        });
    } catch (error) {
        latestSearchArticles = [];
        if (typeof showToast === 'function') {
            showToast(error.message || 'Kan artikelen niet laden', 'error');
        }
    }

    renderArticleDropdown(latestSearchArticles, normalizedQuery);
    dropdown.style.display = 'block';
}

function renderArticleDropdown(filteredArticles, query) {
    const dropdown = document.getElementById('articleDropdown');
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

function highlightMatch(text, query) {
    if (!query) {
        return text;
    }

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return String(text).replace(regex, '<mark>$1</mark>');
}

async function selectArticle(articleId) {
    const article = await fetchArticleById(articleId);
    if (!article) {
        return;
    }

    const searchInput = document.getElementById('articleSearch');
    const hiddenInput = document.getElementById('articleName');
    const hiddenPrice = document.getElementById('articleNamePrice');
    const dropdown = document.getElementById('articleDropdown');

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
        const priceInput = document.createElement('input');
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

async function showAllArticles() {
    const modal = document.getElementById('allArticlesModal');
    if (!modal) {
        createAllArticlesModal();
    }

    await renderAllArticlesTabs();
    const allArticlesModal = document.getElementById('allArticlesModal');
    if (allArticlesModal) {
        allArticlesModal.style.display = 'flex';
    }
}

function createAllArticlesModal() {
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

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function renderAllArticlesTabs() {
    currentArticleTab = 'all';
    await showArticleTab('all');
}

async function showArticleTab(tab, event) {
    currentArticleTab = tab;

    document.querySelectorAll('.article-tab').forEach((button) => {
        button.classList.toggle('active', button.dataset.tab === tab);
    });

    if (event && event.target) {
        event.target.classList.add('active');
    }

    try {
        modalArticles = await fetchArticles({ tab, limit: 200 });
    } catch (error) {
        modalArticles = [];
        if (typeof showToast === 'function') {
            showToast(error.message || 'Kan artikelen niet laden', 'error');
        }
    }

    renderArticleGrid(modalArticles);
}

async function filterModalArticles(query) {
    const normalizedQuery = (query || '').trim();
    if (!normalizedQuery) {
        await showArticleTab(currentArticleTab);
        return;
    }

    try {
        modalArticles = await fetchArticles({ query: normalizedQuery, limit: 200 });
    } catch (error) {
        modalArticles = [];
        if (typeof showToast === 'function') {
            showToast(error.message || 'Kan artikelen niet laden', 'error');
        }
    }

    renderArticleGrid(modalArticles);
}

function renderArticleGrid(articles) {
    const grid = document.getElementById('articleTabContent');
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

async function selectArticleFromModal(articleId) {
    await selectArticle(articleId);
    closeAllArticlesModal();
}

function closeAllArticlesModal() {
    const modal = document.getElementById('allArticlesModal');
    if (modal) {
        modal.style.display = 'none';
    }

    const searchInput = document.getElementById('modalArticleSearch');
    if (searchInput) {
        searchInput.value = '';
    }
}

function handleArticleKeyNav(event) {
    const dropdown = document.getElementById('articleDropdown');
    if (!dropdown) {
        return;
    }

    const items = dropdown.querySelectorAll('.article-item');

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        selectedArticleIndex = Math.min(selectedArticleIndex + 1, items.length - 1);
        highlightArticleItem(items, selectedArticleIndex);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        selectedArticleIndex = Math.max(selectedArticleIndex - 1, 0);
        highlightArticleItem(items, selectedArticleIndex);
    } else if (event.key === 'Enter' && selectedArticleIndex >= 0) {
        event.preventDefault();
        if (items[selectedArticleIndex]) {
            items[selectedArticleIndex].click();
        }
        selectedArticleIndex = -1;
    } else if (event.key === 'Escape') {
        dropdown.style.display = 'none';
        selectedArticleIndex = -1;
    }
}

function highlightArticleItem(items, index) {
    items.forEach((item, itemIndex) => {
        if (itemIndex === index) {
            item.classList.add('highlighted');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('highlighted');
        }
    });
}

function updateArticlePrice() {
    const hiddenInput = document.getElementById('articleName');
    const priceInput = document.getElementById('articlePrice');
    const priceHidden = document.getElementById('articleNamePrice');

    if (!hiddenInput || !hiddenInput.value || !priceInput) {
        if (priceInput) {
            priceInput.value = '€0,00';
        }
        return;
    }

    const unitPrice = parseFloat(priceHidden && priceHidden.value ? priceHidden.value : 0);
    priceInput.value = asCurrency(unitPrice);
}

async function addArticleToOrder() {
    const hiddenInput = document.getElementById('articleName');
    const quantityInput = document.getElementById('articleQuantity');

    if (!hiddenInput) {
        return;
    }

    const articleId = hiddenInput.getAttribute('data-article-id');
    if (!hiddenInput.value || !articleId) {
        if (typeof showToast === 'function') {
            showToast('Selecteer eerst een artikel', 'error');
        }
        return;
    }

    const quantity = parseInt((quantityInput && quantityInput.value) || '1', 10);
    if (!Number.isFinite(quantity) || quantity < 1) {
        if (typeof showToast === 'function') {
            showToast('Aantal moet minimaal 1 zijn', 'error');
        }
        return;
    }

    const article = await fetchArticleById(articleId);
    if (!article) {
        if (typeof showToast === 'function') {
            showToast('Artikel niet gevonden', 'error');
        }
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
            magazine: article.magazine,
        });
    }

    const articleSearch = document.getElementById('articleSearch');
    const articlePrice = document.getElementById('articlePrice');

    if (articleSearch) articleSearch.value = '';
    if (hiddenInput) {
        hiddenInput.value = '';
        hiddenInput.removeAttribute('data-article-id');
    }
    if (quantityInput) quantityInput.value = '1';
    if (articlePrice) articlePrice.value = '€0,00';

    await renderOrderItems();

    if (typeof showToast === 'function') {
        showToast(`${article.name} toegevoegd aan bestelling`, 'success');
    }
}

async function removeArticleFromOrder(articleId) {
    orderItems = orderItems.filter((item) => String(item.articleId) !== String(articleId));
    await renderOrderItems();

    if (typeof showToast === 'function') {
        showToast('Artikel verwijderd uit bestelling', 'success');
    }
}

async function applyCoupon() {
    const couponInput = document.getElementById('couponCode');
    const messageEl = document.getElementById('couponMessage');
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
            description: quote.coupon.description,
        };

        messageEl.className = 'coupon-message success';
        if (quote.coupon.type === 'fixed') {
            messageEl.textContent = `✓ Kortingscode toegepast: ${asCurrency(quote.coupon.amount)} korting`;
        } else {
            messageEl.textContent = `✓ Kortingscode toegepast: ${quote.coupon.amount}% korting`;
        }

        await renderOrderItems();

        if (typeof showToast === 'function') {
            showToast('Kortingscode toegepast!', 'success');
        }
    } catch (error) {
        messageEl.className = 'coupon-message error';
        messageEl.textContent = error.message || 'Kon kortingscode niet toepassen';
    }
}

async function removeCoupon() {
    appliedCoupon = null;
    const couponInput = document.getElementById('couponCode');
    const messageEl = document.getElementById('couponMessage');

    if (couponInput) {
        couponInput.value = '';
    }

    if (messageEl) {
        messageEl.className = 'coupon-message';
        messageEl.style.display = 'none';
    }

    await renderOrderItems();

    if (typeof showToast === 'function') {
        showToast('Kortingscode verwijderd', 'success');
    }
}

async function renderOrderItems() {
    const section = document.getElementById('orderItemsSection');
    const list = document.getElementById('orderItemsList');
    const discountsBreakdown = document.getElementById('discountsBreakdown');
    const subtotalEl = document.getElementById('orderSubtotal');
    const totalEl = document.getElementById('orderTotal');

    if (!section || !list || !discountsBreakdown || !subtotalEl || !totalEl) {
        return;
    }

    if (!orderItems.length) {
        section.style.display = 'none';
        lastOrderQuote = {
            items: [],
            subtotal: 0,
            discounts: [],
            totalDiscount: 0,
            total: 0,
            couponCode: null,
            coupon: null,
        };
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
        if (typeof showToast === 'function') {
            showToast(error.message || 'Kan ordersamenvatting niet berekenen', 'error');
        }
    }
}

async function getOrderData() {
    return requestOrderQuote();
}
