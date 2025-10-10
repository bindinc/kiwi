// Article Search and Selection Component
// Optimized for 100+ articles with search, filtering, and categorization

// Extended article database (100+ items)
const articles = [
    // Avrobode - Jaargang bundels
    { id: 1, code: 'AVR-JB-2023', name: 'Jaargang bundel 2023', magazine: 'Avrobode', price: 29.95, category: 'Jaargang bundels', popular: true, frequency: 145 },
    { id: 2, code: 'AVR-JB-2022', name: 'Jaargang bundel 2022', magazine: 'Avrobode', price: 29.95, category: 'Jaargang bundels', popular: true, frequency: 98 },
    { id: 3, code: 'AVR-JB-2021', name: 'Jaargang bundel 2021', magazine: 'Avrobode', price: 27.95, category: 'Jaargang bundels', popular: false, frequency: 45 },
    { id: 4, code: 'AVR-JB-2020', name: 'Jaargang bundel 2020', magazine: 'Avrobode', price: 27.95, category: 'Jaargang bundels', popular: false, frequency: 23 },
    
    // Avrobode - Speciale edities
    { id: 5, code: 'AVR-SE-50J', name: 'Speciale editie 50 jaar', magazine: 'Avrobode', price: 19.95, category: 'Speciale edities', popular: true, frequency: 87 },
    { id: 6, code: 'AVR-SE-KERST', name: 'Kersteditie special', magazine: 'Avrobode', price: 14.95, category: 'Speciale edities', popular: true, frequency: 156 },
    { id: 7, code: 'AVR-SE-PASEN', name: 'Paaseditie special', magazine: 'Avrobode', price: 14.95, category: 'Speciale edities', popular: false, frequency: 67 },
    { id: 8, code: 'AVR-SE-ZOMER', name: 'Zomereditie special', magazine: 'Avrobode', price: 14.95, category: 'Speciale edities', popular: false, frequency: 54 },
    
    // Avrobode - Themaboeken
    { id: 9, code: 'AVR-TB-KOKEN', name: 'Kookboek recepten', magazine: 'Avrobode', price: 24.95, category: 'Themaboeken', popular: true, frequency: 112 },
    { id: 10, code: 'AVR-TB-TUIN', name: 'Tuinieren door het jaar', magazine: 'Avrobode', price: 22.95, category: 'Themaboeken', popular: false, frequency: 43 },
    { id: 11, code: 'AVR-TB-GEZOND', name: 'Gezond leven gids', magazine: 'Avrobode', price: 21.95, category: 'Themaboeken', popular: false, frequency: 38 },
    { id: 12, code: 'AVR-TB-REIS', name: 'Reizen in Nederland', magazine: 'Avrobode', price: 26.95, category: 'Themaboeken', popular: false, frequency: 31 },
    
    // Mikrogids - Jaargang bundels
    { id: 13, code: 'MIK-JB-2023', name: 'Jaargang bundel 2023', magazine: 'Mikrogids', price: 49.95, category: 'Jaargang bundels', popular: true, frequency: 234 },
    { id: 14, code: 'MIK-JB-2022', name: 'Jaargang bundel 2022', magazine: 'Mikrogids', price: 49.95, category: 'Jaargang bundels', popular: true, frequency: 167 },
    { id: 15, code: 'MIK-JB-2021', name: 'Jaargang bundel 2021', magazine: 'Mikrogids', price: 47.95, category: 'Jaargang bundels', popular: false, frequency: 89 },
    { id: 16, code: 'MIK-JB-2020', name: 'Jaargang bundel 2020', magazine: 'Mikrogids', price: 47.95, category: 'Jaargang bundels', popular: false, frequency: 45 },
    
    // Mikrogids - Extra edities
    { id: 17, code: 'MIK-EX-WEEK', name: 'Extra TV gids week editie', magazine: 'Mikrogids', price: 3.95, category: 'Extra edities', popular: true, frequency: 445 },
    { id: 18, code: 'MIK-EX-PREMIUM', name: 'TV Gids Premium bundel', magazine: 'Mikrogids', price: 49.95, category: 'Extra edities', popular: true, frequency: 178 },
    { id: 19, code: 'MIK-EX-FILM', name: 'Film & Series special', magazine: 'Mikrogids', price: 12.95, category: 'Extra edities', popular: true, frequency: 134 },
    { id: 20, code: 'MIK-EX-SPORT', name: 'Sport TV special', magazine: 'Mikrogids', price: 11.95, category: 'Extra edities', popular: false, frequency: 76 },
    
    // Ncrvgids - Jaargang bundels
    { id: 21, code: 'NCR-JB-2023', name: 'Jaargang bundel 2023', magazine: 'Ncrvgids', price: 49.95, category: 'Jaargang bundels', popular: true, frequency: 198 },
    { id: 22, code: 'NCR-JB-2022', name: 'Jaargang bundel 2022', magazine: 'Ncrvgids', price: 49.95, category: 'Jaargang bundels', popular: true, frequency: 143 },
    { id: 23, code: 'NCR-JB-2021', name: 'Jaargang bundel 2021', magazine: 'Ncrvgids', price: 47.95, category: 'Jaargang bundels', popular: false, frequency: 67 },
    { id: 24, code: 'NCR-JB-2020', name: 'Jaargang bundel 2020', magazine: 'Ncrvgids', price: 47.95, category: 'Jaargang bundels', popular: false, frequency: 34 },
    
    // Ncrvgids - Extra edities
    { id: 25, code: 'NCR-EX-WEEK', name: 'Extra editie week', magazine: 'Ncrvgids', price: 3.95, category: 'Extra edities', popular: true, frequency: 367 },
    { id: 26, code: 'NCR-EX-MAAND', name: 'Extra editie maand', magazine: 'Ncrvgids', price: 9.95, category: 'Extra edities', popular: true, frequency: 156 },
    { id: 27, code: 'NCR-EX-DOCUS', name: 'Documentaire special', magazine: 'Ncrvgids', price: 13.95, category: 'Extra edities', popular: false, frequency: 89 },
    { id: 28, code: 'NCR-EX-NATUUR', name: 'Natuur TV special', magazine: 'Ncrvgids', price: 12.95, category: 'Extra edities', popular: false, frequency: 54 },
    
    // Add 72+ more articles to reach 100+
    { id: 29, code: 'AVR-ACC-MAP', name: 'Avrobode opbergmap', magazine: 'Avrobode', price: 8.95, category: 'Accessoires', popular: false, frequency: 23 },
    { id: 30, code: 'AVR-ACC-BOX', name: 'Avrobode jaargang box', magazine: 'Avrobode', price: 12.95, category: 'Accessoires', popular: false, frequency: 18 },
    { id: 31, code: 'MIK-ACC-MAP', name: 'Mikrogids opbergmap', magazine: 'Mikrogids', price: 8.95, category: 'Accessoires', popular: false, frequency: 34 },
    { id: 32, code: 'MIK-ACC-BOX', name: 'Mikrogids jaargang box', magazine: 'Mikrogids', price: 12.95, category: 'Accessoires', popular: false, frequency: 28 },
    { id: 33, code: 'NCR-ACC-MAP', name: 'Ncrvgids opbergmap', magazine: 'Ncrvgids', price: 8.95, category: 'Accessoires', popular: false, frequency: 31 },
    { id: 34, code: 'NCR-ACC-BOX', name: 'Ncrvgids jaargang box', magazine: 'Ncrvgids', price: 12.95, category: 'Accessoires', popular: false, frequency: 26 },
    
    // Continue with more variations...
    { id: 35, code: 'AVR-TB-BREIEN', name: 'Breien en haken gids', magazine: 'Avrobode', price: 19.95, category: 'Themaboeken', popular: false, frequency: 29 },
    { id: 36, code: 'AVR-TB-PUZZEL', name: 'Puzzelboek special', magazine: 'Avrobode', price: 16.95, category: 'Themaboeken', popular: true, frequency: 94 },
    { id: 37, code: 'AVR-TB-HISTORIE', name: 'Nederlandse historie', magazine: 'Avrobode', price: 24.95, category: 'Themaboeken', popular: false, frequency: 37 },
    { id: 38, code: 'AVR-TB-NATUUR', name: 'Natuur in Nederland', magazine: 'Avrobode', price: 22.95, category: 'Themaboeken', popular: false, frequency: 42 },
    { id: 39, code: 'AVR-TB-KUNST', name: 'Kunst en cultuur gids', magazine: 'Avrobode', price: 26.95, category: 'Themaboeken', popular: false, frequency: 21 },
    { id: 40, code: 'AVR-TB-MUZIEK', name: 'Muziek door de jaren', magazine: 'Avrobode', price: 24.95, category: 'Themaboeken', popular: false, frequency: 33 },
    
    { id: 41, code: 'MIK-TB-NETFLIX', name: 'Netflix series gids', magazine: 'Mikrogids', price: 15.95, category: 'Themaboeken', popular: true, frequency: 201 },
    { id: 42, code: 'MIK-TB-FILMS', name: 'Film klassieker overzicht', magazine: 'Mikrogids', price: 18.95, category: 'Themaboeken', popular: true, frequency: 123 },
    { id: 43, code: 'MIK-TB-BINGEWATCH', name: 'Binge-watch gids', magazine: 'Mikrogids', price: 14.95, category: 'Themaboeken', popular: true, frequency: 167 },
    { id: 44, code: 'MIK-TB-STREAMING', name: 'Streaming diensten overzicht', magazine: 'Mikrogids', price: 16.95, category: 'Themaboeken', popular: true, frequency: 145 },
    { id: 45, code: 'MIK-TB-CRIME', name: 'Crime series special', magazine: 'Mikrogids', price: 17.95, category: 'Themaboeken', popular: true, frequency: 189 },
    
    { id: 46, code: 'NCR-TB-DOCUS', name: 'Documentaire top 100', magazine: 'Ncrvgids', price: 19.95, category: 'Themaboeken', popular: false, frequency: 67 },
    { id: 47, code: 'NCR-TB-NATUUR', name: 'Natuurdocumentaires gids', magazine: 'Ncrvgids', price: 18.95, category: 'Themaboeken', popular: false, frequency: 54 },
    { id: 48, code: 'NCR-TB-CULT', name: 'Cultuurprogrammas overzicht', magazine: 'Ncrvgids', price: 16.95, category: 'Themaboeken', popular: false, frequency: 43 },
    { id: 49, code: 'NCR-TB-EDUCATIEF', name: 'Educatieve TV gids', magazine: 'Ncrvgids', price: 17.95, category: 'Themaboeken', popular: false, frequency: 38 },
    { id: 50, code: 'NCR-TB-KINDER', name: 'Kinderprogrammas overzicht', magazine: 'Ncrvgids', price: 15.95, category: 'Themaboeken', popular: false, frequency: 61 },
    
    // Additional 50 items to exceed 100 total
    ...generateAdditionalArticles(51, 100)
];

// Helper function to generate additional articles
function generateAdditionalArticles(startId, endId) {
    const additionalArticles = [];
    const magazines = ['Avrobode', 'Mikrogids', 'Ncrvgids'];
    const categories = ['Speciale edities', 'Themaboeken', 'Extra edities', 'Accessoires'];
    const themes = ['Vakantie', 'Winter', 'Lente', 'Herfst', 'Familie', 'Lifestyle', 'Technologie', 'Gezondheid', 'Mode', 'Wonen'];
    
    for (let i = startId; i <= endId; i++) {
        const magazine = magazines[i % magazines.length];
        const category = categories[i % categories.length];
        const theme = themes[i % themes.length];
        const price = (Math.random() * 30 + 10).toFixed(2);
        const frequency = Math.floor(Math.random() * 100);
        
        additionalArticles.push({
            id: i,
            code: `${magazine.substring(0, 3).toUpperCase()}-${category.substring(0, 2).toUpperCase()}-${i}`,
            name: `${theme} ${category.toLowerCase()}`,
            magazine: magazine,
            price: parseFloat(price),
            category: category,
            popular: frequency > 70,
            frequency: frequency
        });
    }
    
    return additionalArticles;
}

// Sort articles by frequency (most used first)
const sortedArticles = [...articles].sort((a, b) => b.frequency - a.frequency);

// Initialize article search
function initArticleSearch() {
    const searchInput = document.getElementById('articleSearch');
    const dropdown = document.getElementById('articleDropdown');
    
    if (!searchInput || !dropdown) return;
    
    // Show dropdown on focus
    searchInput.addEventListener('focus', () => {
        filterArticles(searchInput.value);
        dropdown.style.display = 'block';
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.article-selector')) {
            dropdown.style.display = 'none';
        }
    });
    
    // Keyboard navigation
    searchInput.addEventListener('keydown', handleArticleKeyNav);
}

// Filter articles based on search query
function filterArticles(query) {
    const dropdown = document.getElementById('articleDropdown');
    const searchInput = document.getElementById('articleSearch');
    
    query = query.toLowerCase().trim();
    
    let filteredArticles;
    
    if (!query) {
        // Show popular items when no query
        filteredArticles = sortedArticles.filter(a => a.popular).slice(0, 10);
    } else {
        // Filter by name, code, or magazine
        filteredArticles = sortedArticles.filter(article => 
            article.name.toLowerCase().includes(query) ||
            article.code.toLowerCase().includes(query) ||
            article.magazine.toLowerCase().includes(query)
        ).slice(0, 10);
    }
    
    // Render dropdown
    renderArticleDropdown(filteredArticles, query);
    dropdown.style.display = 'block';
}

// Render article dropdown
function renderArticleDropdown(filteredArticles, query) {
    const dropdown = document.getElementById('articleDropdown');
    
    if (filteredArticles.length === 0) {
        dropdown.innerHTML = '<div class="article-no-results">Geen artikelen gevonden. <button type="button" onclick="showAllArticles()" class="browse-all-link">Blader door alle artikelen →</button></div>';
        return;
    }
    
    let html = '';
    
    // Add "browse all" link at top
    html += '<div class="article-browse-all"><button type="button" onclick="showAllArticles()" class="browse-all-link">📚 Blader door alle artikelen</button></div>';
    
    // Group by magazine
    const groupedByMagazine = {};
    filteredArticles.forEach(article => {
        if (!groupedByMagazine[article.magazine]) {
            groupedByMagazine[article.magazine] = [];
        }
        groupedByMagazine[article.magazine].push(article);
    });
    
    // Render groups
    Object.keys(groupedByMagazine).forEach(magazine => {
        html += `<div class="article-category">${magazine}</div>`;
        groupedByMagazine[magazine].forEach(article => {
            const highlightedName = highlightMatch(article.name, query);
            const highlightedCode = highlightMatch(article.code, query);
            
            html += `
                <div class="article-item" onclick="selectArticle(${article.id})" tabindex="0">
                    <div class="article-item-main">
                        <div class="article-item-name">${highlightedName}</div>
                        <div class="article-item-code">${highlightedCode}</div>
                    </div>
                    <div class="article-item-price">€${article.price.toFixed(2).replace('.', ',')}</div>
                </div>
            `;
        });
    });

    dropdown.innerHTML = html;
}

// Highlight matching text
function highlightMatch(text, query) {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// Select an article
function selectArticle(articleId) {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;
    
    const searchInput = document.getElementById('articleSearch');
    const hiddenInput = document.getElementById('articleName');
    const hiddenPrice = document.getElementById('articleNamePrice');
    const dropdown = document.getElementById('articleDropdown');
    
    searchInput.value = `${article.name} (${article.code})`;
    hiddenInput.value = article.name;
    hiddenInput.setAttribute('data-article-id', article.id);
    
    // Store price in data attribute
    if (hiddenPrice) {
        hiddenPrice.value = article.price;
    } else {
        // Create hidden input for price if it doesn't exist
        const priceInput = document.createElement('input');
        priceInput.type = 'hidden';
        priceInput.id = 'articleNamePrice';
        priceInput.value = article.price;
        hiddenInput.parentNode.appendChild(priceInput);
    }
    
    dropdown.style.display = 'none';
    
    // Update price calculation
    updateArticlePrice();
}

// Show all articles in modal
function showAllArticles() {
    const modal = document.getElementById('allArticlesModal');
    if (!modal) {
        createAllArticlesModal();
    }
    
    renderAllArticlesTabs();
    document.getElementById('allArticlesModal').style.display = 'flex';
}

// Create all articles modal
function createAllArticlesModal() {
    const modalHtml = `
        <div id="allArticlesModal" class="modal" style="display: none;">
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h3>📚 Alle Artikelen</h3>
                    <button class="btn-close" onclick="closeAllArticlesModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="article-search-in-modal">
                        <input type="text" id="modalArticleSearch" placeholder="Zoek artikel..." oninput="filterModalArticles(this.value)">
                    </div>
                    <div class="article-tabs">
                        <button class="article-tab active" onclick="showArticleTab('all')">Alle</button>
                        <button class="article-tab" onclick="showArticleTab('popular')">Populair</button>
                        <button class="article-tab" onclick="showArticleTab('Avrobode')">Avrobode</button>
                        <button class="article-tab" onclick="showArticleTab('Mikrogids')">Mikrogids</button>
                        <button class="article-tab" onclick="showArticleTab('Ncrvgids')">Ncrvgids</button>
                    </div>
                    <div id="articleTabContent" class="article-grid"></div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Render all articles tabs
let currentArticleTab = 'all';
function renderAllArticlesTabs() {
    currentArticleTab = 'all';
    showArticleTab('all');
}

// Show specific article tab
function showArticleTab(tab) {
    currentArticleTab = tab;
    
    // Update active tab button
    document.querySelectorAll('.article-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    event?.target?.classList.add('active');
    
    // Filter articles
    let filteredArticles;
    if (tab === 'all') {
        filteredArticles = sortedArticles;
    } else if (tab === 'popular') {
        filteredArticles = sortedArticles.filter(a => a.popular);
    } else {
        filteredArticles = sortedArticles.filter(a => a.magazine === tab);
    }
    
    renderArticleGrid(filteredArticles);
}

// Filter articles in modal
function filterModalArticles(query) {
    query = query.toLowerCase().trim();
    
    let filteredArticles;
    if (!query) {
        showArticleTab(currentArticleTab);
        return;
    }
    
    filteredArticles = sortedArticles.filter(article => 
        article.name.toLowerCase().includes(query) ||
        article.code.toLowerCase().includes(query) ||
        article.magazine.toLowerCase().includes(query) ||
        article.category.toLowerCase().includes(query)
    );
    
    renderArticleGrid(filteredArticles);
}

// Render article grid
function renderArticleGrid(articles) {
    const grid = document.getElementById('articleTabContent');
    
    if (articles.length === 0) {
        grid.innerHTML = '<div class="empty-state">Geen artikelen gevonden</div>';
        return;
    }
    
    let html = '';
    articles.forEach(article => {
        html += `
            <div class="article-card" onclick="selectArticleFromModal(${article.id})">
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
                    <div class="article-card-price">€${article.price.toFixed(2).replace('.', ',')}</div>
                </div>
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

// Select article from modal
function selectArticleFromModal(articleId) {
    selectArticle(articleId);
    closeAllArticlesModal();
}

// Close all articles modal
function closeAllArticlesModal() {
    document.getElementById('allArticlesModal').style.display = 'none';
    document.getElementById('modalArticleSearch').value = '';
}

// Keyboard navigation for article dropdown
let selectedArticleIndex = -1;
function handleArticleKeyNav(e) {
    const dropdown = document.getElementById('articleDropdown');
    const items = dropdown.querySelectorAll('.article-item');
    
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedArticleIndex = Math.min(selectedArticleIndex + 1, items.length - 1);
        highlightArticleItem(items, selectedArticleIndex);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedArticleIndex = Math.max(selectedArticleIndex - 1, 0);
        highlightArticleItem(items, selectedArticleIndex);
    } else if (e.key === 'Enter' && selectedArticleIndex >= 0) {
        e.preventDefault();
        items[selectedArticleIndex].click();
        selectedArticleIndex = -1;
    } else if (e.key === 'Escape') {
        dropdown.style.display = 'none';
        selectedArticleIndex = -1;
    }
}

// Highlight article item
function highlightArticleItem(items, index) {
    items.forEach((item, i) => {
        if (i === index) {
            item.classList.add('highlighted');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('highlighted');
        }
    });
}

// Update updateArticlePrice to use new article system
function updateArticlePrice() {
    const hiddenInput = document.getElementById('articleName');
    const quantityInput = document.getElementById('articleQuantity');
    const priceInput = document.getElementById('articlePrice');
    const priceHidden = document.getElementById('articleNamePrice');
    
    if (!hiddenInput || !hiddenInput.value) {
        priceInput.value = '€0,00';
        return;
    }
    
    const unitPrice = parseFloat(priceHidden?.value || 0);
    
    priceInput.value = `€${unitPrice.toFixed(2).replace('.', ',')}`;
}

// Global order items array
let orderItems = [];
let appliedCoupon = null;

// Valid coupon codes
const validCoupons = {
    'WELKOM10': { type: 'fixed', amount: 10.00, description: 'Welkomstkorting' },
    'KORTING10': { type: 'fixed', amount: 10.00, description: '€10 korting' },
    'ZOMER15': { type: 'fixed', amount: 15.00, description: 'Zomeractie' },
    'VOORJAAR20': { type: 'fixed', amount: 20.00, description: 'Voorjaarskorting' },
    'LOYAL25': { type: 'fixed', amount: 25.00, description: 'Loyaliteitskorting' },
    'VIP10': { type: 'percentage', amount: 10, description: 'VIP korting 10%' },
    'SAVE15': { type: 'percentage', amount: 15, description: 'Bespaar 15%' }
};

// Add article to order
function addArticleToOrder() {
    const hiddenInput = document.getElementById('articleName');
    const articleId = hiddenInput.getAttribute('data-article-id');
    const quantityInput = document.getElementById('articleQuantity');
    const priceHidden = document.getElementById('articleNamePrice');
    
    if (!hiddenInput.value || !articleId) {
        showToast('Selecteer eerst een artikel', 'error');
        return;
    }
    
    const quantity = parseInt(quantityInput.value) || 1;
    if (quantity < 1) {
        showToast('Aantal moet minimaal 1 zijn', 'error');
        return;
    }
    
    const article = articles.find(a => a.id === parseInt(articleId));
    if (!article) {
        showToast('Artikel niet gevonden', 'error');
        return;
    }
    
    // Check if article already in order
    const existingItem = orderItems.find(item => item.articleId === article.id);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        orderItems.push({
            articleId: article.id,
            code: article.code,
            name: article.name,
            unitPrice: article.price,
            quantity: quantity,
            magazine: article.magazine
        });
    }
    
    // Clear selection
    document.getElementById('articleSearch').value = '';
    document.getElementById('articleName').value = '';
    document.getElementById('articleQuantity').value = '1';
    document.getElementById('articlePrice').value = '€0,00';
    
    // Update display
    renderOrderItems();
    showToast(`${article.name} toegevoegd aan bestelling`, 'success');
}

// Remove article from order
function removeArticleFromOrder(articleId) {
    orderItems = orderItems.filter(item => item.articleId !== articleId);
    renderOrderItems();
    showToast('Artikel verwijderd uit bestelling', 'success');
}

// Apply coupon code
function applyCoupon() {
    const couponInput = document.getElementById('couponCode');
    const couponCode = couponInput.value.trim().toUpperCase();
    const messageEl = document.getElementById('couponMessage');
    
    if (!couponCode) {
        messageEl.className = 'coupon-message error';
        messageEl.textContent = 'Voer een kortingscode in';
        return;
    }
    
    if (orderItems.length === 0) {
        messageEl.className = 'coupon-message error';
        messageEl.textContent = 'Voeg eerst artikelen toe aan je bestelling';
        return;
    }
    
    const coupon = validCoupons[couponCode];
    
    if (!coupon) {
        messageEl.className = 'coupon-message error';
        messageEl.textContent = `Kortingscode "${couponCode}" is ongeldig`;
        appliedCoupon = null;
        renderOrderItems();
        return;
    }
    
    if (appliedCoupon && appliedCoupon.code === couponCode) {
        messageEl.className = 'coupon-message info';
        messageEl.textContent = 'Deze kortingscode is al toegepast';
        return;
    }
    
    appliedCoupon = {
        code: couponCode,
        ...coupon
    };
    
    messageEl.className = 'coupon-message success';
    if (coupon.type === 'fixed') {
        messageEl.textContent = `✓ Kortingscode toegepast: €${coupon.amount.toFixed(2)} korting`;
    } else {
        messageEl.textContent = `✓ Kortingscode toegepast: ${coupon.amount}% korting`;
    }
    
    renderOrderItems();
    showToast('Kortingscode toegepast!', 'success');
}

// Remove applied coupon
function removeCoupon() {
    appliedCoupon = null;
    document.getElementById('couponCode').value = '';
    const messageEl = document.getElementById('couponMessage');
    messageEl.className = 'coupon-message';
    messageEl.style.display = 'none';
    renderOrderItems();
    showToast('Kortingscode verwijderd', 'success');
}

// Calculate discounts based on order
function calculateDiscounts() {
    let discounts = [];
    let totalDiscount = 0;
    
    // Calculate subtotal
    const subtotal = orderItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    
    // 1. Volume Discount: 10% off when ordering 5+ of the same item
    let volumeDiscounts = [];
    orderItems.forEach(item => {
        if (item.quantity >= 5) {
            const itemTotal = item.unitPrice * item.quantity;
            const discount = itemTotal * 0.10;
            volumeDiscounts.push({
                type: 'Stapelkorting',
                icon: '📦',
                description: `10% korting op ${item.name} (${item.quantity}x)`,
                amount: discount,
                itemName: item.name
            });
            totalDiscount += discount;
        }
    });
    
    // 2. Bundle Discount: 15% off when ordering items from all 3 magazines
    const magazines = [...new Set(orderItems.map(item => item.magazine))];
    if (magazines.length === 3 && orderItems.length >= 3) {
        const bundleDiscount = subtotal * 0.15;
        // Remove volume discounts and apply bundle discount instead if it's better
        if (bundleDiscount > totalDiscount) {
            discounts = [{
                type: 'Bundelkorting',
                icon: '🎁',
                description: 'Artikelen van alle 3 magazines',
                amount: bundleDiscount
            }];
            totalDiscount = bundleDiscount;
        } else {
            discounts = volumeDiscounts;
        }
    } else {
        discounts = volumeDiscounts;
    }
    
    // 3. Order Total Discount: 5% off orders over €100
    if (subtotal >= 100 && totalDiscount === 0) {
        const orderDiscount = subtotal * 0.05;
        discounts.push({
            type: 'Actiekorting',
            icon: '🎯',
            description: 'Bij bestellingen vanaf €100',
            amount: orderDiscount
        });
        totalDiscount += orderDiscount;
    }
    
    // 4. Apply Coupon Code (if any)
    if (appliedCoupon) {
        let couponDiscount = 0;
        
        if (appliedCoupon.type === 'fixed') {
            // Fixed amount discount
            couponDiscount = Math.min(appliedCoupon.amount, subtotal - totalDiscount);
        } else if (appliedCoupon.type === 'percentage') {
            // Percentage discount on subtotal after other discounts
            couponDiscount = (subtotal - totalDiscount) * (appliedCoupon.amount / 100);
        }
        
        if (couponDiscount > 0) {
            discounts.push({
                type: 'Kortingscode',
                icon: '🎟️',
                description: `${appliedCoupon.description} (${appliedCoupon.code})`,
                amount: couponDiscount,
                isCoupon: true
            });
            totalDiscount += couponDiscount;
        }
    }
    
    return {
        discounts: discounts,
        totalDiscount: totalDiscount
    };
}

// Render order items
function renderOrderItems() {
    const section = document.getElementById('orderItemsSection');
    const list = document.getElementById('orderItemsList');
    
    if (orderItems.length === 0) {
        section.style.display = 'none';
        appliedCoupon = null;
        document.getElementById('couponCode').value = '';
        const messageEl = document.getElementById('couponMessage');
        messageEl.className = 'coupon-message';
        messageEl.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    
    // Calculate totals and discounts
    const subtotal = orderItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const { discounts, totalDiscount } = calculateDiscounts();
    const total = subtotal - totalDiscount;
    
    // Render items
    let html = '';
    orderItems.forEach(item => {
        const itemTotal = item.unitPrice * item.quantity;
        
        // Check if this item has volume discount
        const hasVolumeDiscount = item.quantity >= 5 && discounts.some(d => d.type === 'Stapelkorting' && d.itemName === item.name);
        
        html += `
            <div class="order-item">
                <div class="order-item-details">
                    <div class="order-item-name">${item.name}</div>
                    <div class="order-item-meta">${item.code} • ${item.magazine} • €${item.unitPrice.toFixed(2).replace('.', ',')} per stuk</div>
                    ${hasVolumeDiscount ? '<div class="order-item-discount">✨ Stapelkorting actief (10%)<span class="order-item-discount-badge">KORTING</span></div>' : ''}
                </div>
                <div class="order-item-quantity">${item.quantity}x</div>
                <div class="order-item-price">€${itemTotal.toFixed(2).replace('.', ',')}</div>
                <button class="order-item-remove" onclick="removeArticleFromOrder(${item.articleId})" type="button">🗑️</button>
            </div>
        `;
    });
    
    list.innerHTML = html;
    
    // Update summary
    document.getElementById('orderSubtotal').textContent = `€${subtotal.toFixed(2).replace('.', ',')}`;
    document.getElementById('orderTotal').innerHTML = `<strong>€${total.toFixed(2).replace('.', ',')}</strong>`;
    
    // Render discounts breakdown
    const discountsBreakdown = document.getElementById('discountsBreakdown');
    if (totalDiscount > 0 && discounts.length > 0) {
        discountsBreakdown.style.display = 'block';
        
        let discountsHtml = '';
        discounts.forEach(discount => {
            const badgeClass = discount.isCoupon ? 'coupon-applied' : '';
            discountsHtml += `
                <div class="discount-item">
                    <div>
                        <div class="discount-item-label">
                            <span class="discount-icon">${discount.icon || '💰'}</span>
                            <span class="discount-type">${discount.type}</span>
                            ${discount.isCoupon ? '<span class="discount-badge ' + badgeClass + '">COUPON</span>' : '<span class="discount-badge">ACTIE</span>'}
                        </div>
                        <div class="discount-description">${discount.description}</div>
                    </div>
                    <div class="discount-item-amount">
                        -€${discount.amount.toFixed(2).replace('.', ',')}
                        ${discount.isCoupon ? '<button onclick="removeCoupon()" type="button" style="margin-left: 0.5rem; background: none; border: none; cursor: pointer; color: #dc2626; font-size: 1rem;" title="Verwijder kortingscode">✕</button>' : ''}
                    </div>
                </div>
            `;
        });
        
        discountsBreakdown.innerHTML = discountsHtml;
    } else {
        discountsBreakdown.style.display = 'none';
    }
}

// Get order data for submission
function getOrderData() {
    const subtotal = orderItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const { discounts, totalDiscount } = calculateDiscounts();
    const total = subtotal - totalDiscount;
    
    return {
        items: orderItems,
        subtotal: subtotal,
        discounts: discounts,
        totalDiscount: totalDiscount,
        total: total,
        couponCode: appliedCoupon ? appliedCoupon.code : null
    };
}
