import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const modulePath = fileURLToPath(import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');
const behaviorFiles = ['js/app/call-agent-runtime.js', 'js/app/header-scroll-inset.js', 'js/app/index.js',
    'js/app/slices/app-shell-slice.js', 'js/app/slices/customer-search-slice.js', 'js/i18n/en.js', 'js/i18n/nl.js'];
const sourceSnapshots = new Map();

export async function registerShellProvenance(report) {
    report.shellHarnessModules = {};
    for (const file of [modulePath, fileURLToPath(new URL('./compose-smoke-theme-audit-shell.mjs', import.meta.url))]) {
        report.shellHarnessModules[path.basename(file)] = { path: file, sourceSha256: hash(await readFile(file)) };
    }
}

export function normalizeKnownJsImports(body, source, sourceUrl) {
    const imports = /^([ \t]*import\s+(?:[^;'"]*?\bfrom\s*)?)(['"])([^'"]+)\2/gm;
    const known = [...source.matchAll(imports)].map(match => match[3]);
    return body.replace(imports, (statement, prefix, quote, value) => {
        const reference = known.find(raw => {
            if (value === raw) return true;
            if (!raw.startsWith('.')) return false;
            const expected = new URL(raw, sourceUrl), actual = new URL(value, sourceUrl);
            const escaped = expected.pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const versioned = new RegExp('^' + escaped.replace(/\\\.js$/, '(?:-[\\w-]{7})?\\.js') + '$');
            return actual.origin === expected.origin && actual.search === expected.search && actual.hash === expected.hash && versioned.test(actual.pathname);
        });
        return reference ? prefix + JSON.stringify(reference) : statement;
    });
}

export async function trackShellBehaviorAssets(page, driver, context) {
    await registerShellProvenance(driver.report);
    const key = driver.sourceRoot;
    if (!sourceSnapshots.has(key)) sourceSnapshots.set(key, Promise.all(behaviorFiles.map(async relative => [relative, await readFile(path.join(key, 'assets', relative), 'utf8')])));
    const sources = Object.fromEntries(await sourceSnapshots.get(key));
    driver.report.application.sourceBehaviorFiles = Object.fromEntries(Object.entries(sources).map(([relative, source]) => [relative, hash(source)]));
    driver.report.loadedBehaviorAssets ||= [];
    const pending = [], seen = new Set();
    page.on('response', response => {
        const url = new URL(response.url());
        const relative = behaviorFiles.find(file => {
            const expected = new URL('assets/' + file, driver.baseUrl), extension = path.posix.extname(expected.pathname);
            const directory = path.posix.dirname(expected.pathname), stem = path.posix.basename(expected.pathname, extension);
            return url.origin === expected.origin && path.posix.dirname(url.pathname) === directory
                && new RegExp('^' + stem + '(?:-[\\w-]{7})?\\.js$').test(path.posix.basename(url.pathname));
        });
        if (!relative) return;
        pending.push((async () => {
            const buffer = await response.body().catch(() => null); if (!buffer) return;
            const source = sources[relative], sourceUrl = new URL('assets/' + relative, driver.baseUrl);
            const expectedHash = hash(normalizeKnownJsImports(source, source, sourceUrl)), actualHash = hash(normalizeKnownJsImports(buffer.toString('utf8'), source, sourceUrl));
            const item = { relative, pathname: url.pathname, servedSha256: hash(buffer), normalizedSourceHash: expectedHash, normalizedServedHash: actualHash, context };
            driver.report.loadedBehaviorAssets.push(item); seen.add(relative);
            driver.check(relative + ' served behavior matches exact source', actualHash, expectedHash, { state: 'JS provenance', ...context }, 3);
            if (actualHash !== expectedHash) await writeFile(path.join(driver.evidenceDir, 'mismatch-' + path.basename(relative)), buffer);
        })());
    });
    return async () => {
        await Promise.all(pending);
        for (const relative of behaviorFiles) driver.check(relative + ' actual behavior asset loaded', seen.has(relative), true, { state: 'JS provenance', ...context }, 3);
    };
}

// theme_audit: required AFTER checks; BEFORE reports remain at their original tooling commit.
export function withinBounds(inner, outer, tolerance = 1) {
    return Boolean(inner && outer && inner.x >= outer.x - tolerance && inner.right <= outer.right + tolerance
        && inner.y >= outer.y - tolerance && inner.bottom <= outer.bottom + tolerance);
}

export function sameAnchor(before, after, position = 'sticky', tolerance = 1) {
    const coordinate = position === 'sticky' || position === 'fixed' ? 'y' : 'documentY';
    return Boolean(before && after && Math.abs(before.x - after.x) <= tolerance
        && Math.abs(before[coordinate] - after[coordinate]) <= tolerance);
}

export function menuAnchored(trigger, menu, viewportWidth, edge = 8) {
    const expectedLeft = Math.max(edge, Math.min(trigger.right - menu.width, viewportWidth - edge - menu.width));
    const adjacent = Math.abs(menu.y - trigger.bottom - edge) <= 1 || Math.abs(menu.bottom - trigger.y + edge) <= 1;
    return Boolean(menu.rendered && adjacent && Math.abs(menu.x - expectedLeft) <= 1);
}

function union(rects) {
    const present = rects.filter(rect => rect?.rendered);
    if (!present.length) return null;
    return { x: Math.min(...present.map(rect => rect.x)), right: Math.max(...present.map(rect => rect.right)),
        y: Math.min(...present.map(rect => rect.y)), bottom: Math.max(...present.map(rect => rect.bottom)) };
}

export async function readShellGeometry(page) {
    return page.evaluate(() => {
        const rectangle = node => {
            if (!node) return null;
            const r = node.getBoundingClientRect(), s = getComputedStyle(node);
            return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height, documentY: r.y + scrollY,
                rendered: r.width > 0 && r.height > 0 && s.visibility === 'visible', display: s.display, position: s.position,
                paddingTop: parseFloat(s.paddingTop), paddingRight: parseFloat(s.paddingRight), paddingBottom: parseFloat(s.paddingBottom), paddingLeft: parseFloat(s.paddingLeft),
                borderTop: parseFloat(s.borderTopWidth), borderRight: parseFloat(s.borderRightWidth), borderBottom: parseFloat(s.borderBottomWidth), borderLeft: parseFloat(s.borderLeftWidth),
                fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight,
                backgroundColor: s.backgroundColor, color: s.color, radius: s.borderRadius, shadow: s.boxShadow, transform: s.transform,
                overflowX: s.overflowX, overflowY: s.overflowY, touchAction: s.touchAction,
                clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, clientHeight: node.clientHeight, scrollHeight: node.scrollHeight,
                scrollTop: node.scrollTop, scrollLeft: node.scrollLeft, disabled: Boolean(node.disabled), hidden: node.hidden };
        };
        const textRects = node => {
            const boxes = [], walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
                const text = walker.currentNode;
                if (!text.textContent.trim() || text.parentElement.closest('input,select,textarea,.sr-only,[aria-hidden="true"]')) continue;
                const range = document.createRange(); range.selectNodeContents(text);
                for (const r of range.getClientRects()) if (r.width && r.height) boxes.push({ x: r.x, right: r.right, y: r.y, bottom: r.bottom });
            }
            return boxes;
        };
        const selectors = ['.header', '.header-top', '.header-brand', '.header-right', '.main-content', '.left-panel', '.center-panel', '.right-panel',
            '#customerWorkSessionIdentity', '.customer-work-session-label', '#customerWorkSessionName', '.customer-work-session-reference', '.customer-work-session-source',
            '#customerWorkSessionPersonId', '#customerWorkSessionSource', '#customerWorkSessionPendingMutation', '#endCustomerWorkSessionButton',
            '#agentProfileTrigger', '#agentStatusMenu', '#subscriptionQueueToggle', '#subscriptionQueuePanel', '#queueInfo', '#sessionInfo', '#acwBar',
            '#resultsTitle', '.results-controls', '#searchResultsView', '.results-table-wrapper', '.results-table'];
        const elements = Object.fromEntries(selectors.map(selector => [selector, rectangle(document.querySelector(selector))]));
        const cards = [...document.querySelectorAll('.left-panel > .card,.right-panel > .card')].map(card => {
            const bounds = rectangle(card);
            const children = [...card.querySelectorAll('input,select,textarea,button,a[href],label')]
                .map(node => ({ id: node.id, tag: node.tagName, type: node.type, bounds: rectangle(node), labelRendered: [...(node.labels || [])].some(label => { const r = label.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(label).visibility === 'visible'; }), captionRects: node.tagName === 'LABEL' ? textRects(node) : [] }))
                .filter(child => child.bounds.rendered);
            return { id: card.id, className: card.className, bounds, children };
        }).filter(card => card.bounds.rendered);
        const identityText = ['#customerWorkSessionName', '.customer-work-session-reference', '.customer-work-session-source'].map(selector => {
            const node = document.querySelector(selector), clippingAncestors = [];
            for (let parent = node?.parentElement; parent; parent = parent.parentElement) {
                const style = getComputedStyle(parent);
                const clipX = ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX);
                const clipY = ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowY);
                if (clipX || clipY) clippingAncestors.push({ bounds: rectangle(parent), clipX, clipY });
                if (parent.classList.contains('header')) break;
            }
            return { selector, bounds: rectangle(node), textRects: node ? textRects(node) : [], clippingAncestors };
        });
        const controls = ['#agentProfileTrigger', '#subscriptionQueueToggle', '#contextualFeedbackSettingsButton', '#endCustomerWorkSessionButton']
            .map(selector => ({ selector, bounds: rectangle(document.querySelector(selector)) })).filter(item => item.bounds?.rendered);
        const menuItems = [...document.querySelectorAll('#agentStatusMenu button,#agentStatusMenu a[href]')].map(node => ({
            bounds: rectangle(node), active: node.classList.contains('is-active'), status: node.dataset.statusOption || null,
            locale: node.dataset.localeOption || null, logout: node.type === 'submit' && Boolean(node.closest('form')), disabled: node.disabled
        }));
        const reference = window.kiwiCustomerWorkSession?.getRequestContext?.()?.customerReference;
        const customer = typeof currentCustomer === 'undefined' ? null : currentCustomer;
        const source = reference && (reference.mandant || reference.divisionId || customer?.credentialTitle || reference.sourceSystem);
        return { viewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio, visualScale: visualViewport?.scale,
            documentWidth: document.documentElement.scrollWidth, scrollX, scrollY, rootOverflowX: getComputedStyle(document.documentElement).overflowX, bodyOverflowX: getComputedStyle(document.body).overflowX,
            rootScrollPaddingTop: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0,
            elements, cards, identityText, controls, menuItems,
            identity: { selected: Boolean(reference), personMatches: Boolean(reference && document.querySelector('#customerWorkSessionPersonId')?.textContent.trim() === reference.personId),
                sourceMatches: Boolean(reference && document.querySelector('#customerWorkSessionSource')?.textContent.trim() === (String(source).toUpperCase() === 'HMC' ? 'TROS' : source)),
                nameSensitive: document.querySelector('#customerWorkSessionName')?.dataset.feedbackSensitive === 'name',
                personSensitive: document.querySelector('#customerWorkSessionPersonId')?.dataset.feedbackSensitive === 'id' },
            logoLoaded: Boolean(document.querySelector('.header-logo')?.complete && document.querySelector('.header-logo')?.naturalWidth > 0),
            logoPreserved: Boolean(document.querySelector('.header-logo')?.src.includes('Bindinc-Logo-RGB-WIT-2023')),
            avatarMasked: Boolean(document.querySelector('#agentProfileTrigger .agent-avatar[data-feedback-mask]')),
            table: { role: document.querySelector('.results-table-wrapper')?.getAttribute('role'), tabIndex: document.querySelector('.results-table-wrapper')?.tabIndex,
                named: Boolean(document.querySelector('.results-table-wrapper')?.getAttribute('aria-label') || document.querySelector('.results-table-wrapper')?.getAttribute('aria-labelledby')),
                headers: [...document.querySelectorAll('.results-table th')].map(rectangle) }
        };
    });
}

export async function checkShellGeometry(page, driver, contract, meta, { emptyReset = null, ordinary = true, naturalResults = false } = {}) {
    const { check, report } = driver, observed = await readShellGeometry(page), e = observed.elements;
    const context = { ...meta, viewport: observed.viewport, dpr: observed.dpr, kind: meta.kind || 'Actual application AFTER acceptance' };
    const required = (name, actual, details = {}) => check(name, Boolean(actual), true, { ...context, ...details }, 3);
    required('shell document fits actual CSS viewport', observed.documentWidth <= observed.viewport.width + 1, { documentWidth: observed.documentWidth });
    required('shell does not conceal document overflow', ![observed.rootOverflowX, observed.bodyOverflowX].some(value => ['hidden', 'clip'].includes(value)));
    for (const selector of ['.left-panel', '.center-panel', '.right-panel']) {
        const box = e[selector]; required(selector + ' exists inside viewport horizontally', box?.rendered && box.x >= -1 && box.right <= observed.viewport.width + 1, { bounds: box });
    }
    required('search/work precedes supporting rail', e['.right-panel'].documentY >= e['.left-panel'].documentY - 1);
    const header = e['.header'], topbar = contract.shell?.['.preview-topbar'];
    required('header matches reference flat surface', header.shadow === topbar.boxShadow && header.backgroundColor === topbar.backgroundColor && header.radius === topbar.borderRadius);
    required('header uses reference system typography', header.fontFamily === topbar.fontFamily && header.fontSize === topbar.fontSize && header.lineHeight === topbar.lineHeight);
    required('real branding and masked avatar remain', observed.logoLoaded && observed.logoPreserved && observed.avatarMasked);
    const padding = Number.parseFloat(contract.spaces[observed.viewport.width <= 768 ? '--space-4' : '--space-5']);
    const searchCard = observed.cards.find(card => card.className.split(' ').includes('search-card'));
    required('actual search card and both address fields remain rendered', Boolean(searchCard && ['searchPostalCode', 'searchHouseNumber'].every(id => searchCard.children.some(child => child.id === id && child.labelRendered))));
    for (const card of observed.cards) {
        // Kiwi's three-region frame reflows at768; retain the rendered reference16/20px panel roles.
        required(card.id + card.className + ' reference panel insets', card.bounds.paddingLeft === padding && card.bounds.paddingRight === padding, { padding: card.bounds.paddingLeft, expected: padding });
        required(card.id + card.className + ' flat panel surface', card.bounds.shadow === contract.panel.boxShadow);
        if (card.id !== 'subscriptionQueuePanel') required(card.id + card.className + ' reference panel corner', card.bounds.radius === contract.panel.borderRadius);
        const content = { x: card.bounds.x + card.bounds.borderLeft + card.bounds.paddingLeft,
            right: card.bounds.right - card.bounds.borderRight - card.bounds.paddingRight, y: -Infinity, bottom: Infinity };
        for (const child of card.children) {
            required('card control/caption fits its own content insets', withinBounds(child.bounds, content), { card: card.id || card.className, child });
            for (const rect of child.captionRects) required('visible caption text fits its card', withinBounds(rect, content), { card: card.id || card.className, childId: child.id, rect });
        }
    }
    for (const control of observed.controls) {
        required(control.selector + ' shared40px target', control.bounds.width >= 40 && control.bounds.height >= 40);
        required(control.selector + ' remains inside actual header', withinBounds(control.bounds, header));
    }
    if (observed.identity.selected) {
        required('actual person/source identity mapping remains', observed.identity.personMatches && observed.identity.sourceMatches && observed.identity.nameSensitive && observed.identity.personSensitive);
        for (const item of observed.identityText) {
            required(item.selector + ' full context is rendered', item.bounds?.rendered && item.textRects.length > 0);
            for (const rect of item.textRects) {
                required(item.selector + ' context text fits its own box and header', withinBounds(rect, item.bounds) && withinBounds(rect, header), { rect, box: item.bounds, header });
                for (const ancestor of item.clippingAncestors) {
                    const clip = { x: ancestor.clipX ? ancestor.bounds.x : -Infinity, right: ancestor.clipX ? ancestor.bounds.right : Infinity,
                        y: ancestor.clipY ? ancestor.bounds.y : -Infinity, bottom: ancestor.clipY ? ancestor.bounds.bottom : Infinity };
                    required(item.selector + ' text fits clipping ancestor', withinBounds(rect, clip), { rect, ancestor });
                }
            }
        }
    }
    const resetType = e['#endCustomerWorkSessionButton'];
    required('reset text retains reference action typography', resetType.fontSize === contract.primary.fontSize && resetType.fontWeight === contract.primary.fontWeight
        && resetType.lineHeight === contract.primary.lineHeight && resetType.fontFamily === contract.primary.fontFamily);
    if (observed.identity.selected) {
        const caption = e['.customer-work-session-label'], name = e['#customerWorkSessionName'];
        required('header person caption retains13px reference label role', caption.fontSize === contract.label.fontSize && caption.fontWeight === contract.label.fontWeight && caption.lineHeight === contract.label.lineHeight);
        required('header customer name retains15px strong body role', name.fontSize === contract.body.fontSize && name.fontWeight === contract.primary.fontWeight && name.lineHeight === contract.body.lineHeight);
        for (const selector of ['#customerWorkSessionPersonId', '#customerWorkSessionSource']) {
            const value = e[selector]; required(selector + ' retains13px strong metadata role', value.fontSize === contract.label.fontSize && value.fontWeight === contract.label.fontWeight && value.lineHeight === contract.label.lineHeight);
        }
    }
    if (emptyReset && !naturalResults) required('reset anchor is stable across empty/active/fixture states', sameAnchor(emptyReset, e['#endCustomerWorkSessionButton'], header.position), { emptyReset, current: e['#endCustomerWorkSessionButton'] });
    const broad = observed.viewport.width >= 1440 && observed.viewport.height > 540;
    if (ordinary && broad) {
        const blocks = [e['.header-brand'], e['#endCustomerWorkSessionButton'], e['.header-right']];
        if (observed.identity.selected) blocks.push(e['#customerWorkSessionIdentity']);
        required('ordinary desktop header uses one logical row', Math.max(...blocks.map(r => r.y)) < Math.min(...blocks.map(r => r.bottom)), { blocks });
        const compactHeight = Number.parseFloat(contract.primary.minHeight) + Number.parseFloat(topbar.paddingTop) + Number.parseFloat(topbar.paddingBottom);
        required('ordinary desktop header keeps reference compact density', header.height <= compactHeight + 1, { height: header.height, maximum: compactHeight });
        if (observed.identity.selected) {
            const reset = e['#endCustomerWorkSessionButton'], name = union([e['.customer-work-session-label'], e['#customerWorkSessionName']]);
            const detail = union([e['.customer-work-session-reference'], e['.customer-work-session-source']]);
            const spacing = Number.parseFloat(contract.spaces['--space-6']);
            required('identity name and metadata form adjacent aligned subgroups', name && detail && detail.x >= name.right - 1 && detail.x - name.right <= spacing
                && Math.max(name.y, detail.y) < Math.min(name.bottom, detail.bottom)
                && Math.abs(e['.customer-work-session-reference'].x - e['.customer-work-session-source'].x) <= 1, { name, detail });
            required('reset stays immediately before the identity cluster', name && name.x >= reset.right - 1 && name.x - reset.right <= spacing, { reset, name });
            const cluster = union([reset, e['#customerWorkSessionIdentity']]);
            required('brand identity utilities stay separated', cluster.x >= e['.header-brand'].right + 7 && cluster.right <= e['.header-right'].x - 7, { cluster });
            required('identity subgroups retain compact40px leading', name && detail && name.bottom - name.y <= 41 && detail.bottom - detail.y <= 41);
        }
    }
    if (naturalResults) {
        const occlusionBottom = header.position === 'sticky' || header.position === 'fixed' ? Math.max(0, header.bottom) : 0;
        for (const selector of ['#resultsTitle', '.results-controls']) {
            const rect = e[selector]; required(selector + ' exposed by actual search scroll', rect?.rendered && rect.y >= occlusionBottom - 1 && rect.bottom <= observed.viewport.height + 1, { rect, occlusionBottom });
        }
        const wrapper = e['.results-table-wrapper'];
        required('results scrolling stays inside the task region', wrapper.rendered && wrapper.x >= e['.center-panel'].x - 1 && wrapper.right <= e['.center-panel'].right + 1 && ['auto', 'scroll'].includes(wrapper.overflowX));
        required('results scroller is a named keyboard group/region', ['group', 'region'].includes(observed.table.role) && observed.table.tabIndex === 0 && observed.table.named);
        required('all preserved table columns remain rendered', observed.table.headers.length >= 6 && observed.table.headers.every(r => r.rendered));
    }
    if (header.position === 'relative') required('short relative header clears sticky scroll offset', observed.rootScrollPaddingTop <= 1);
    else required('sticky scroll offset reflects actual header height', observed.rootScrollPaddingTop >= header.height - 1 && observed.rootScrollPaddingTop <= header.height + 17, { offset: observed.rootScrollPaddingTop, height: header.height });
    for (const selector of ['#queueInfo', '#sessionInfo', '#acwBar']) {
        const bar = e[selector];
        if (bar?.rendered) required(selector + ' participates in header layout', withinBounds(bar, header) && e['.main-content'].documentY >= header.documentY + header.height - 1, { bar, header });
    }
    report.shellAcceptance ||= { measurements: [], interactions: [], roles: [], fixtures: [] };
    report.shellAcceptance.measurements.push({ ...context, observed });
    return observed;
}

async function stable(page, customer = false) {
    await page.waitForFunction(state => {
        const r = document.querySelector(state.customer ? '.customer-header' : '.main-content')?.getBoundingClientRect();
        const ready = r?.width > 0 && r.height > 0 && (!state.customer || (!document.querySelector('#customerAddressRetry')?.disabled && scrollY === 0));
        if (!ready) { state.previous = null; state.frames = 0; return false; }
        const now = [scrollX, scrollY, r.x, r.y, r.width, r.height];
        state.frames = JSON.stringify(now) === JSON.stringify(state.previous) ? state.frames + 1 : 0;
        state.previous = now; return state.frames >= 2;
    }, { customer, previous: null, frames: 0 }, { polling: 'raf', timeout: 12000 });
}

async function captureAfter(page, driver, name, kind = 'Actual shell AFTER flow') {
    await driver.capture(page, name, undefined, kind);
    const item = driver.report.captures.at(-1);
    const png = await readFile(path.join(driver.evidenceDir, item.filename));
    item.imagePixels = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
    item.pixelScope = 'Image pixels are separate from recorded CSS viewport/DPR; native captures include browser chrome.';
}

async function focusState(page) {
    return page.evaluate(() => {
        const node = document.activeElement, r = node.getBoundingClientRect(), s = getComputedStyle(node);
        return { id: node.id, tag: node.tagName, status: node.dataset.statusOption || null, locale: node.dataset.localeOption || null,
            logout: node.type === 'submit' && Boolean(node.closest('#agentStatusMenu form')), inMenu: Boolean(node.closest('#agentStatusMenu')),
            menuContainer: node.id === 'agentStatusMenu', focusVisible: node.matches(':focus-visible'), outlineColor: s.outlineColor,
            outlineWidth: s.outlineWidth, outlineOffset: s.outlineOffset, x: r.x, y: r.y, right: r.right, bottom: r.bottom };
    });
}

async function menuBounds(page) {
    return page.locator('#agentStatusMenu').evaluate(node => {
        const r = node.getBoundingClientRect(), s = getComputedStyle(node);
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height,
            clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, scrollTop: node.scrollTop,
            overflowY: s.overflowY, touchAction: s.touchAction, radius: s.borderRadius,
            viewportWidth: innerWidth, viewportHeight: innerHeight };
    });
}

async function checkMenuGeometry(page, driver, contract, meta) {
    const menu = await menuBounds(page), context = { ...meta, menu };
    driver.check('profile menu fits actual viewport', menu.x >= 7 && menu.y >= 7 && menu.right <= menu.viewportWidth - 7 && menu.bottom <= menu.viewportHeight - 7, true, context, 3);
    driver.check('profile menu retains bounded internal scrolling', ['auto', 'scroll'].includes(menu.overflowY) && !['none', 'pan-x'].includes(menu.touchAction), true, context, 3);
    driver.check('profile overlay uses restrained reference corner', parseFloat(menu.radius) <= 4, true, context, 3);
    const items = await page.locator('#agentStatusMenu button').evaluateAll(nodes => nodes.map(node => {
        const s = getComputedStyle(node), r = node.getBoundingClientRect();
        return { width: r.width, height: r.height, fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight, transform: s.transform };
    }));
    driver.check('profile actions remain populated', items.length >= 9, true, context, 3);
    for (const item of items) {
        driver.check('profile action reference type/target', item.width >= 40 && item.height >= 40 && item.fontSize === contract.primary.fontSize
            && item.fontFamily === contract.primary.fontFamily && item.fontWeight === contract.primary.fontWeight && item.lineHeight === contract.primary.lineHeight && item.transform === 'none', true, { ...context, item }, 3);
    }
    const choices = await page.evaluate(() => ({ statuses: document.querySelectorAll('#agentStatusMenu [data-status-option].is-active').length,
        locales: [...document.querySelectorAll('#agentStatusMenu [data-locale-option].is-active')].map(node => node.dataset.localeOption),
        expanded: document.querySelector('#agentProfileTrigger').getAttribute('aria-expanded'), hidden: document.querySelector('#agentStatusMenu').hidden }));
    driver.check('profile selected status and locale remain explicit', choices.statuses === 1 && choices.locales.length === 1 && choices.locales[0] === meta.locale && choices.expanded === 'true' && !choices.hidden, true, { ...context, choices }, 3);
    return menu;
}

export async function inspectProfileAppearance(page, driver, contract, meta, { native = false } = {}) {
    const trigger = page.locator('#agentProfileTrigger');
    await page.mouse.move(0, 0); await trigger.blur(); await driver.painted(page);
    const read = () => trigger.evaluate(node => {
        const s = getComputedStyle(node), r = node.getBoundingClientRect();
        const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
        canvas.width = canvas.height = 1;
        context.clearRect(0, 0, 1, 1); context.fillStyle = s.borderTopColor; context.fillRect(0, 0, 1, 1);
        const borderAlpha = context.getImageData(0, 0, 1, 1).data[3];
        context.clearRect(0, 0, 1, 1); context.fillStyle = s.outlineColor; context.fillRect(0, 0, 1, 1);
        const outlineAlpha = context.getImageData(0, 0, 1, 1).data[3];
        context.clearRect(0, 0, 1, 1); context.fillStyle = s.backgroundColor; context.fillRect(0, 0, 1, 1);
        const backgroundAlpha = context.getImageData(0, 0, 1, 1).data[3];
        const radius = s.borderTopLeftRadius.endsWith('%') ? r.width * parseFloat(s.borderTopLeftRadius) / 100 : parseFloat(s.borderTopLeftRadius);
        return { width: r.width, height: r.height, viewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio, radius, borderWidth: parseFloat(s.borderTopWidth), borderAlpha,
            background: s.backgroundColor, backgroundAlpha, transform: s.transform, shadow: s.boxShadow,
            hovered: node.matches(':hover'), focused: node.matches(':focus'), focusVisible: node.matches(':focus-visible'),
            outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle, outlineColor: s.outlineColor, outlineAlpha,
            avatarRound: getComputedStyle(node.querySelector('.agent-avatar')).borderRadius === '50%',
            statusRound: getComputedStyle(node.querySelector('.agent-status-badge')).borderRadius === '50%' };
    });
    const rest = await read();
    driver.check('profile resting identity has no permanent frame', !rest.hovered && !rest.focused && (!rest.borderWidth || rest.borderAlpha === 0) && rest.shadow === 'none' && rest.backgroundAlpha === 0
        && (rest.outlineStyle === 'none' || parseFloat(rest.outlineWidth) === 0 || rest.outlineAlpha === 0), true, { ...meta, rest }, 3);
    driver.check('profile retains circular40px identity role', rest.width === 40 && rest.height === 40 && rest.radius >= 20 && rest.avatarRound && rest.statusRound, true, { ...meta, rest }, 3);
    await captureAfter(page, driver, meta.prefix + 'profile-rest');
    if (!native) {
        const filename = `${page.viewportSize().width}x${page.viewportSize().height}-${meta.prefix}profile-rest-native-pixels.png`;
        const file = path.join(driver.evidenceDir, filename); await trigger.screenshot({ path: file, animations: 'disabled' });
        const triggerPng = await readFile(file);
        const corners = await page.evaluate(async dataUrl => {
            const image = new Image(); image.src = dataUrl; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
            return [[0, 0], [image.width - 1, 0], [0, image.height - 1], [image.width - 1, image.height - 1]]
                .map(([x, y]) => [...context.getImageData(x, y, 1, 1).data].slice(0, 3));
        }, 'data:image/png;base64,' + triggerPng.toString('base64'));
        const expected = contract.primary.backgroundColor.match(/[\d.]+/g).slice(0, 3).map(Number);
        driver.check('actual resting trigger corners expose header without square paint', corners.every(rgb => rgb.every((value, index) => Math.abs(value - expected[index]) <= 1)), true, { ...meta, corners, expected }, 3);
        driver.report.captures.push({ name: 'profile resting native pixels', filename, viewport: page.viewportSize(), kind: 'Actual default-scale profile identity pixels; not native200zoom screenshot.',
            imagePixels: { width: triggerPng.readUInt32BE(16), height: triggerPng.readUInt32BE(20) }, cssTarget: { width: rest.width, height: rest.height }, dpr: rest.dpr });
        await trigger.hover();
        await page.waitForFunction(state => {
            const node = document.querySelector('#agentProfileTrigger'), color = getComputedStyle(node).backgroundColor;
            if (!node.matches(':hover') || color === 'rgba(0, 0, 0, 0)') return false;
            state.frames = state.previous === color ? state.frames + 1 : 0; state.previous = color; return state.frames >= 2;
        }, { previous: null, frames: 0 }, { polling: 'raf', timeout: 3000 });
        const hover = await read();
        driver.check('profile hover remains circular flat and stable', hover.hovered && hover.radius >= 20 && hover.width === rest.width && hover.height === rest.height
            && hover.transform === 'none' && hover.shadow === 'none', true, { ...meta, hover }, 3);
        await captureAfter(page, driver, meta.prefix + 'profile-hover');
        await page.mouse.move(0, 0);
    }
    await trigger.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    const focus = await read();
    driver.check('profile keyboard focus is inverse and circular', focus.focusVisible && focus.radius >= 20 && focus.outlineWidth === '3px' && focus.outlineColor === contract.primary.color, true, { ...meta, focus }, 3);
    await captureAfter(page, driver, meta.prefix + 'profile-keyboard-focus');
    driver.report.shellAcceptance.interactions.push({ ...meta, rest, focus, scope: 'Unfocused/unhovered rest, separate pointer hover and genuine Tab/ShiftTab focus; circular profile identity exception.' });
}

export async function inspectProfileInteractions(page, driver, contract, meta, { native = false, outside = true } = {}) {
    const { check, report } = driver;
    await page.locator('#agentProfileTrigger').press('Enter');
    await page.locator('#agentStatusMenu').waitFor({ state: 'visible' });
    const menu = await checkMenuGeometry(page, driver, contract, meta);
    await captureAfter(page, driver, meta.prefix + 'profile-open', meta.kind);
    const needsScroll = menu.scrollHeight > menu.clientHeight + 1;
    let wheel = null;
    if (needsScroll && !native) {
        await page.mouse.move(menu.x + menu.width / 2, menu.y + Math.min(menu.height / 2, 60));
        const direction = menu.scrollTop < menu.scrollHeight - menu.clientHeight - 1 ? 1 : -1;
        await page.mouse.wheel(0, direction * 800);
        await page.waitForFunction(state => {
            const current = document.querySelector('#agentStatusMenu').scrollTop;
            return state.direction > 0 ? current > state.before : current < state.before;
        }, { before: menu.scrollTop, direction }, { timeout: 3000 }).catch(() => {});
        wheel = await menuBounds(page);
        const moved = direction > 0 ? wheel.scrollTop > menu.scrollTop : wheel.scrollTop < menu.scrollTop;
        check('actual wheel scroll reveals menu content', moved, true, { ...meta, direction, before: menu, after: wheel }, 3);
    }
    const traversal = [];
    for (let index = 0; index < 12; index++) {
        await page.keyboard.press('Tab');
        const current = await focusState(page); traversal.push(current);
        if (current.logout || !current.inMenu) break;
    }
    const actions = traversal.filter(item => !item.menuContainer);
    check('native Tab reaches all profile actions through the menu', actions.length >= 9 && actions.every(item => item.inMenu) && actions.at(-1)?.logout, true, { ...meta, traversal }, 3);
    const finalBounds = await menuBounds(page), last = actions.at(-1);
    check('last profile action has visible light-surface focus', last?.focusVisible && last.outlineWidth === '3px'
        && last.outlineColor === contract.primary.backgroundColor && withinBounds(last, finalBounds), true, { ...meta, last, finalBounds }, 3);
    await captureAfter(page, driver, meta.prefix + 'profile-last-action-focus', meta.kind);
    await page.keyboard.press('Shift+Tab');
    const previous = await focusState(page);
    check('ShiftTab returns to preceding locale action', previous.inMenu && previous.locale === 'en', true, { ...meta, previous }, 3);
    await page.keyboard.press('Escape');
    const escaped = await page.evaluate(() => ({ hidden: document.querySelector('#agentStatusMenu').hidden,
        expanded: document.querySelector('#agentProfileTrigger').getAttribute('aria-expanded'), focused: document.activeElement?.id === 'agentProfileTrigger' }));
    check('Escape closes profile and restores trigger focus', escaped.hidden && escaped.expanded === 'false' && escaped.focused, true, { ...meta, escaped }, 3);
    const trigger = await focusState(page);
    check('dark-header trigger has visible inverse focus', trigger.focusVisible && trigger.outlineWidth === '3px' && trigger.outlineColor === contract.primary.color, true, { ...meta, trigger }, 3);
    if (!escaped.hidden) await page.locator('#agentProfileTrigger').press('Enter');
    if (outside && !native) {
        await page.locator('#agentProfileTrigger').press('Space');
        const input = page.locator('#searchPostalCode');
        const point = { x: 8, y: 8 };
        const uncovered = await input.evaluate((node, point) => {
            const bounds = node.getBoundingClientRect();
            const viewportPoint = { x: bounds.x + point.x, y: bounds.y + point.y };
            return { hit: document.elementFromPoint(viewportPoint.x, viewportPoint.y) === node, viewportPoint,
                bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } };
        }, point);
        check('outside-click work point is visibly uncovered by menu', uncovered.hit, true, { ...meta, point, ...uncovered }, 3);
        if (!uncovered.hit) throw new Error('No verified outside input point; do not click through the menu.');
        await page.mouse.click(uncovered.viewportPoint.x, uncovered.viewportPoint.y);
        const clicked = await page.evaluate(() => ({ closed: document.querySelector('#agentStatusMenu').hidden, active: document.activeElement?.id }));
        check('outside click closes menu without stealing work focus', clicked.closed && clicked.active === 'searchPostalCode', true, { ...meta, clicked }, 3);
    }
    report.shellAcceptance.interactions.push({ ...meta, menu, wheel, traversal, escaped,
        scope: native ? 'Actual keyboard menu navigation under OS browser zoom; wheel/outside-click covered separately at default zoom.' : 'Actual Enter/Space, native Tab/ShiftTab/Escape and wheel/outside-click.' });
}

async function inspectResultsKeyboard(page, driver, meta) {
    const { check } = driver;
    await page.locator('#sortBy').focus();
    const traversed = [];
    for (let index = 0; index < 5; index++) {
        await page.keyboard.press('Tab');
        const state = await page.evaluate(() => ({ wrapper: document.activeElement?.classList.contains('results-table-wrapper'),
            id: document.activeElement?.id, tag: document.activeElement?.tagName, role: document.activeElement?.getAttribute('role') }));
        traversed.push(state); if (state.wrapper) break;
    }
    check('actual Tab reaches named result scroller', traversed.at(-1)?.wrapper === true, true, { ...meta, traversed }, 3);
    const before = await page.locator('.results-table-wrapper').evaluate(node => ({ left: node.scrollLeft, width: node.clientWidth, scrollWidth: node.scrollWidth, documentX: scrollX }));
    if (before.scrollWidth > before.width + 1 && traversed.at(-1)?.wrapper) {
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => document.querySelector('.results-table-wrapper').scrollLeft > 0, null, { timeout: 3000 }).catch(() => {});
        const after = await page.locator('.results-table-wrapper').evaluate(node => ({ left: node.scrollLeft, documentX: scrollX }));
        check('native ArrowRight scrolls table locally', after.left > before.left && after.documentX === before.documentX, true, { ...meta, before, after }, 3);
    }
}

async function inspectDraftAndDebug(page, driver, meta) {
    const { check, report } = driver;
    const draft = 'theme_audit retained local draft';
    await page.locator('[data-action="open-article-sale-form"]').first().press('Enter');
    await page.locator('#articleSaleForm').waitFor({ state: 'visible' });
    await page.locator('#articleNotes').fill(draft);
    // Installed-handler overlap tests dismissal priority; the form's overlay covers the header.
    await page.evaluate(() => window.kiwiCallAgentRuntime.setStatusMenuOpen(true));
    await page.keyboard.press('Escape');
    const overlap = await page.evaluate(() => ({ menuClosed: document.querySelector('#agentStatusMenu').hidden,
        draftOpen: getComputedStyle(document.querySelector('#articleSaleForm')).display !== 'none',
        retained: document.querySelector('#articleNotes').value === 'theme_audit retained local draft' }));
    check('menu Escape leaves the actual open draft unchanged', overlap.menuClosed && overlap.draftOpen && overlap.retained, true,
        { ...meta, overlap, kind: 'Installed menu-handler overlap with actual open draft; not pointer reachability behind a modal.' }, 3);
    await captureAfter(page, driver, meta.prefix + 'draft-after-menu-escape', 'Installed-handler overlap with actual retained article draft; no submission.');
    await page.locator('#articleSaleForm [data-action="close-article-sale-form"]').first().press('Enter');
    await page.locator('#agentProfileTrigger').press('Enter'); await page.keyboard.press('Escape');
    await page.locator('[data-action="open-article-sale-form"]').first().press('Enter');
    check('ordinary profile interaction preserves a closed local draft', await page.locator('#articleNotes').inputValue(), draft, meta, 3);
    await page.locator('#articleSaleForm [data-action="close-article-sale-form"]').first().press('Enter');
    const original = await page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem('kiwi.featureFlags') || '{}');
        return { overridden: Object.prototype.hasOwnProperty.call(stored, 'debugModal'), value: stored.debugModal };
    });
    try {
        await page.evaluate(() => window.featureFlags.setFlag('debugModal', false));
        await page.locator('#agentProfileTrigger').press('Enter');
        for (let index = 0; index < 4; index++) await page.keyboard.press(']');
        check('actual disabled debug flag blocks its shortcut', await page.locator('#debugModal').evaluate(node => !node.classList.contains('show')), true, meta, 3);
        await page.keyboard.press('Escape');
        await page.evaluate(() => window.featureFlags.setFlag('debugModal', true));
        await page.locator('#agentProfileTrigger').press('Enter'); await page.keyboard.press('Tab');
        for (let index = 0; index < 4; index++) await page.keyboard.press(']');
        await page.locator('#debugModal.show').waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
        const priority = await page.evaluate(() => ({ debugClosed: !document.querySelector('#debugModal').classList.contains('show'),
            profileOpen: !document.querySelector('#agentStatusMenu').hidden, retained: document.querySelector('#articleNotes').value === 'theme_audit retained local draft' }));
        check('Escape closes topmost debug before profile/draft', priority.debugClosed && priority.profileOpen && priority.retained, true, { ...meta, priority }, 3);
        await captureAfter(page, driver, meta.prefix + 'debug-escape-priority');
        await page.keyboard.press('Escape');
    } finally {
        await page.evaluate(value => window.featureFlags.setFlag('debugModal', value.overridden ? value.value : null), original);
    }
    await page.keyboard.press('Control+k');
    check('existing search shortcut focuses the visible name field', await page.locator('#searchName').evaluate(node => document.activeElement === node), true, meta, 3);
    report.shellAcceptance.interactions.push({ ...meta, overlap, scope: 'Actual retained draft, native debug shortcuts, and installed-handler menu/draft overlap explicitly separated.' });
}

async function inspectLongProfileLabels(page, driver, contract, meta) {
    const original = await page.evaluateHandle(language => {
        const name = document.querySelector('.profile-menu-user-name');
        const role = document.querySelector('.profile-menu-role');
        if (!name || !role) throw new Error('Actual populated profile name and role are required.');
        const saved = [{ node: name, text: name.textContent }, { node: role, text: role.textContent }];
        name.textContent = Array(3).fill(language === 'nl' ? 'Synthetische lange medewerkernaam met meerdere familienaamdelen' : 'Synthetic long agent name with several family name components').join(' ');
        role.textContent = language === 'nl' ? 'SYNTHETISCHE_LANGE_WEERGEGEVEN_ROL_ZONDER_WIJZIGING_VAN_RECHTEN' : 'SYNTHETIC_LONG_DISPLAYED_ROLE_WITHOUT_ANY_PERMISSION_CHANGE';
        return saved;
    }, meta.locale);
    const fixture = { ...meta, prefix: meta.prefix + 'long-profile-', state: 'long-profile-labels',
        kind: 'DOM-only synthetic agent/role display text; authenticated roles and business permissions unchanged.' };
    try {
        await driver.painted(page);
        await inspectProfileInteractions(page, driver, contract, fixture, { outside: false });
        await page.locator('#agentProfileTrigger').press('Enter');
        await driver.painted(page);
        let menu = await menuBounds(page);
        const wheelSteps = [];
        const maximumWheels = Math.ceil(menu.scrollHeight / Math.max(1, menu.clientHeight)) + 1;
        for (let index = 0; menu.scrollTop > 0 && index < maximumWheels; index++) {
            const before = menu.scrollTop;
            await page.mouse.move(menu.x + menu.width / 2, menu.y + Math.min(menu.height / 2, 60));
            await page.mouse.wheel(0, -menu.scrollHeight);
            await page.waitForFunction(previous => document.querySelector('#agentStatusMenu').scrollTop < previous,
                before, { timeout: 3000 }).catch(() => {});
            menu = await menuBounds(page);
            wheelSteps.push({ before, after: menu.scrollTop });
            if (menu.scrollTop >= before) break;
        }
        driver.check('actual upward wheels expose the top profile labels', menu.scrollTop === 0, true, { ...fixture, maximumWheels, wheelSteps }, 3);
        const labels = await page.evaluate(() => {
            const menu = document.querySelector('#agentStatusMenu'), menuBounds = menu.getBoundingClientRect();
            return [...document.querySelectorAll('.profile-menu-user-name,.profile-menu-role')].map(node => {
                const bounds = node.getBoundingClientRect(), range = document.createRange();
                range.selectNodeContents(node);
                const textBounds = [...range.getClientRects()].filter(rect => rect.width && rect.height);
                return { className: node.className, populated: Boolean(node.textContent.trim()),
                    fitsOwnBox: textBounds.length > 0 && textBounds.every(rect => rect.x >= bounds.x - 1 && rect.right <= bounds.right + 1 && rect.y >= bounds.y - 1 && rect.bottom <= bounds.bottom + 1),
                    fitsMenuWidth: textBounds.every(rect => rect.x >= menuBounds.x - 1 && rect.right <= menuBounds.right + 1),
                    clientWidth: node.clientWidth, scrollWidth: node.scrollWidth };
            });
        });
        driver.check('long profile name and role fixtures remain populated and fully wrapped', labels.length >= 2 && labels.every(label => label.populated && label.fitsOwnBox && label.fitsMenuWidth && label.scrollWidth <= label.clientWidth + 1), true, { ...fixture, labels }, 3);
        await captureAfter(page, driver, fixture.prefix + 'wrapped-labels', fixture.kind);
        await page.keyboard.press('Escape');
        driver.report.shellAcceptance.fixtures.push({ ...fixture, labels, scope: 'Display-only stress plus genuine wheel/Tab/ShiftTab/Escape; no permission simulation.' });
    } finally {
        await page.evaluate(saved => { for (const item of saved) item.node.textContent = item.text; }, original);
        await original.dispose();
        if (await page.locator('#agentStatusMenu').isVisible()) await page.keyboard.press('Escape');
        await driver.painted(page);
    }
}

async function inspectContextStress(page, driver, contract, meta, emptyReset) {
    // Keep the original identity object in the browser; reports never serialize its fields.
    const original = await page.evaluateHandle(() => {
        if (typeof currentCustomer === 'undefined' || !currentCustomer) throw new Error('A selected customer is required.');
        return currentCustomer;
    });
    // Only in-memory display data changes; actual identity/source reference and backend record stay intact.
    await page.locator('#agentProfileTrigger').press('Enter');
    const before = await readShellGeometry(page);
    await page.evaluate(language => {
        const customer = currentCustomer;
        window.kiwiCustomerWorkSession.acceptCorrectedCustomer({ ...customer,
            firstName: Array(3).fill(language === 'nl' ? 'Synthetische lange klantnaam voor context en uitlijning' : 'Synthetic long customer name for context and alignment').join(' '),
            middleName: '', lastName: language === 'nl' ? 'Meerdere familienaamdelen voor de shellmeting' : 'Several family name components for shell measurement' });
    }, meta.locale);
    try {
        await driver.painted(page);
        const stressMeta = { ...meta, state: 'actual-renderer-long-context', kind: 'Deliberately repeated synthetic name to force header growth even at2048CSSpx, passed to actual work-session renderer; identity/source preserved, no backend correction.' };
        const after = await checkShellGeometry(page, driver, contract, stressMeta, { emptyReset, ordinary: false });
        const trigger = after.elements['#agentProfileTrigger'], menu = after.elements['#agentStatusMenu'];
        driver.check('actual-renderer stress changes header allocation without window resize', after.elements['.header'].height > before.elements['.header'].height + 1, true, { ...stressMeta, beforeHeight: before.elements['.header'].height, afterHeight: after.elements['.header'].height }, 3);
        driver.check('open profile remains anchored after actual header growth', menuAnchored(trigger, menu, after.viewport.width, parseFloat(contract.spaces['--space-2'])),
            true, { ...stressMeta, trigger, menu, beforeTrigger: before.elements['#agentProfileTrigger'] }, 3);
        await checkMenuGeometry(page, driver, contract, stressMeta);
        await captureAfter(page, driver, meta.prefix + 'renderer-long-context-menu', stressMeta.kind);
        await page.keyboard.press('Escape');
        const pending = await page.locator('#customerWorkSessionPendingMutation').evaluate(node => ({ hidden: node.hidden }));
        const wasDisabled = await page.locator('#endCustomerWorkSessionButton').isDisabled();
        await page.locator('#customerWorkSessionPendingMutation').evaluate(node => { node.hidden = false; });
        await page.locator('#endCustomerWorkSessionButton').evaluate(node => { node.disabled = true; });
        await driver.painted(page);
        try {
            await checkShellGeometry(page, driver, contract, { ...meta, state: 'pending-placement', kind: 'DOM-only pending-warning/disabled-reset placement; no transaction or guard-behavior acceptance.' }, { emptyReset, ordinary: false });
            await captureAfter(page, driver, meta.prefix + 'pending-anchor-fixture', 'Actual rendered long context plus DOM-only pending visibility; no submission.');
        } finally {
            await page.locator('#customerWorkSessionPendingMutation').evaluate((node, value) => { node.hidden = value; }, pending.hidden);
            await page.locator('#endCustomerWorkSessionButton').evaluate((node, value) => { node.disabled = value; }, wasDisabled);
            await driver.painted(page);
        }
        driver.report.shellAcceptance.fixtures.push({ ...stressMeta, sourceReferencePreserved: true,
            scope: 'Renderer fixture followed by separate DOM pending placement; no API write/mutation registration.' });
    } finally {
        await page.evaluate(value => window.kiwiCustomerWorkSession.acceptCorrectedCustomer(value), original);
        await original.dispose();
        if (await page.locator('#agentStatusMenu').isVisible()) await page.locator('#agentProfileTrigger').press('Enter');
        await driver.painted(page);
    }
}

async function inspectOperationalPlacement(page, driver, contract, meta, emptyReset) {
    for (const id of ['queueInfo', 'sessionInfo', 'acwBar']) {
        const style = await page.locator('#' + id).getAttribute('style');
        await page.locator('#' + id).evaluate(node => { node.style.display = 'block'; });
        await driver.painted(page);
        try {
            const fixture = { ...meta, state: id + '-placement', kind: 'Controlled actual operational-template visibility only; no queue/call/ACW operation.' };
            await checkShellGeometry(page, driver, contract, fixture, { emptyReset, ordinary: false });
            await captureAfter(page, driver, meta.prefix + id + '-placement', fixture.kind);
        } finally {
            await page.locator('#' + id).evaluate((node, value) => { if (value === null) node.removeAttribute('style'); else node.setAttribute('style', value); }, style);
            await driver.painted(page);
        }
    }
}

export async function inspectShellAcceptance(driver, viewport, contract, suite) {
    const { check, login, newContext, report, saveReport, trackStylesheets } = driver;
    report.shellAcceptance ||= { measurements: [], interactions: [], roles: [], fixtures: [] };
    for (const locale of ['nl', 'en']) {
        const context = await newContext({ width: viewport.width, height: Math.max(1000, viewport.height) });
        const page = await context.newPage(), finishAssets = trackStylesheets(page, { ...viewport, locale, suite });
        const finishBehavior = await trackShellBehaviorAssets(page, driver, { ...viewport, locale, suite });
        page.setDefaultTimeout(12000);
        page.on('pageerror', error => report.errors.push({ scenario: 'required shell runtime', viewport, locale, message: error.message }));
        const meta = { locale, suite, prefix: 'after-' + locale + '-' + suite + '-' };
        try {
            await login(page);
            if (locale === 'en') { await page.locator('#agentProfileTrigger').press('Enter'); await page.locator('[data-locale-option="en"]').press('Enter'); }
            await page.setViewportSize(viewport); await stable(page);
            check('actual AFTER requested locale', await page.locator('html').getAttribute('lang'), locale, meta, 3);
            if (suite === 'profile') { await inspectProfileAppearance(page, driver, contract, meta); continue; }
            const empty = await checkShellGeometry(page, driver, contract, { ...meta, state: 'empty' });
            const emptyReset = empty.elements['#endCustomerWorkSessionButton'];
            await captureAfter(page, driver, meta.prefix + 'empty');
            if (suite !== 'boundaries') await inspectProfileAppearance(page, driver, contract, meta);
            if (suite !== 'boundaries') await inspectProfileInteractions(page, driver, contract, meta, { outside: viewport.width >= 768 && viewport.height > 540 });
            if (suite !== 'boundaries') await inspectLongProfileLabels(page, driver, contract, meta);
            if (!await page.locator('#searchName').isVisible()) await page.locator('#additionalFiltersToggle').press('Enter');
            await driver.controlChecks(page, contract, 'AFTER expanded search', '.search-card');
            await page.locator('#searchName').fill('Jansen');
            await page.locator('button[data-action="search-customer"]').press('Enter');
            await page.locator('#paginatedResults .result-row').first().waitFor(); await stable(page);
            await checkShellGeometry(page, driver, contract, { ...meta, state: 'natural-results' }, { emptyReset, naturalResults: true });
            await captureAfter(page, driver, meta.prefix + 'natural-results');
            await inspectResultsKeyboard(page, driver, meta);
            await page.locator('#paginatedResults .result-row button[data-action="select-customer"]').first().press('Enter');
            await page.locator('#customerDetail').waitFor({ state: 'visible' }); await stable(page, true);
            await checkShellGeometry(page, driver, contract, { ...meta, state: 'selected-session' }, { emptyReset });
            await captureAfter(page, driver, meta.prefix + 'selected-session');
            if (suite === 'interactions') await inspectDraftAndDebug(page, driver, meta);
            if (suite !== 'boundaries') {
                await page.locator('#subscriptionQueueToggle').press('Enter');
                await page.locator('#subscriptionQueuePanel').waitFor({ state: 'visible' });
                check('outbox actual disclosure ARIA remains consistent', await page.locator('#subscriptionQueueToggle').getAttribute('aria-expanded'), 'true', meta, 3);
                await checkShellGeometry(page, driver, contract, { ...meta, state: 'outbox' }, { emptyReset });
                await captureAfter(page, driver, meta.prefix + 'outbox');
                await inspectContextStress(page, driver, contract, meta, emptyReset);
                await inspectOperationalPlacement(page, driver, contract, meta, emptyReset);
            }
        } catch (error) {
            report.errors.push({ scenario: 'required shell acceptance', viewport, locale, suite, message: error.message });
            await captureAfter(page, driver, meta.prefix + 'failure', 'Incomplete required shell gate').catch(() => {});
        } finally { await finishBehavior(); await finishAssets(); await context.close(); await saveReport(); }
    }
}

export async function inspectRoleShell(driver, viewport, contract) {
    const { login, newContext, check, report, saveReport, trackStylesheets } = driver;
    report.shellAcceptance ||= { measurements: [], interactions: [], roles: [], fixtures: [] };
    for (const [username, settingsAllowed] of [['kiwi-admin', true], ['kiwi-view', false]]) {
        const context = await newContext({ width: viewport.width, height: Math.max(1000, viewport.height) });
        const page = await context.newPage(), finishAssets = trackStylesheets(page, { ...viewport, role: username });
        const finishBehavior = await trackShellBehaviorAssets(page, driver, { ...viewport, role: username });
        const meta = { role: username, locale: 'nl', suite: 'roles', prefix: 'after-role-' + username + '-' };
        try {
            await login(page, username); await page.setViewportSize(viewport); await stable(page);
            const actual = await page.evaluate(() => ({ settingsButtons: document.querySelectorAll('#contextualFeedbackSettingsButton').length,
                renderedRoles: document.querySelectorAll('.profile-menu-role').length,
                logoutIsPost: document.querySelector('#agentStatusMenu form')?.method === 'post',
                logoutCsrfPresent: Boolean(document.querySelector('#agentStatusMenu form input[name="_csrf_token"]')?.value),
                avatarMasked: Boolean(document.querySelector('.agent-avatar[data-feedback-mask]')) }));
            check('actual authenticated role controls settings rendering', actual.settingsButtons, settingsAllowed ? 1 : 0, { ...meta, actual }, 3);
            check('actual roles logout CSRF and avatar privacy remain', actual.renderedRoles > 0 && actual.logoutIsPost && actual.logoutCsrfPresent && actual.avatarMasked, true, meta, 3);
            await checkShellGeometry(page, driver, contract, { ...meta, state: 'real-role-empty' });
            await captureAfter(page, driver, meta.prefix + 'actual-server-render');
            await inspectProfileInteractions(page, driver, contract, meta, { outside: viewport.width >= 768 && viewport.height > 540 });
            report.shellAcceptance.roles.push({ ...meta, actual, scope: 'Real fallback OIDC login and server-rendered role conditional; no DOM permission simulation.' });
        } catch (error) {
            report.errors.push({ scenario: 'actual role shell', role: username, viewport, message: error.message });
            await captureAfter(page, driver, meta.prefix + 'failure', 'Incomplete real-role acceptance').catch(() => {});
        } finally { await finishBehavior(); await finishAssets(); await context.close(); await saveReport(); }
    }
}

export async function inspectNativeShell(page, driver, contract) {
    const meta = { locale: 'nl', suite: 'native', prefix: 'native-03-', kind: 'Actual OS-shortcut200% browser zoom; no CSS/device-scale simulation.' };
    const empty = await checkShellGeometry(page, driver, contract, { ...meta, state: 'native-empty' }, { ordinary: false });
    const emptyReset = empty.elements['#endCustomerWorkSessionButton'];
    await captureAfter(page, driver, meta.prefix + 'empty');
    await inspectProfileAppearance(page, driver, contract, meta, { native: true });
    await inspectProfileInteractions(page, driver, contract, meta, { native: true, outside: false });
    if (!await page.locator('#searchName').isVisible()) await page.locator('#additionalFiltersToggle').press('Enter');
    await driver.controlChecks(page, contract, 'native03 search', '.search-card', 'Actual native browser zoom search controls', { inspectHover: false });
    await page.locator('#searchName').fill('Jansen');
    await page.locator('button[data-action="search-customer"]').press('Enter');
    await page.locator('#paginatedResults .result-row').first().waitFor(); await stable(page);
    await checkShellGeometry(page, driver, contract, { ...meta, state: 'native-natural-results' }, { emptyReset, ordinary: false, naturalResults: true });
    await captureAfter(page, driver, meta.prefix + 'natural-results');
    await inspectResultsKeyboard(page, driver, meta);
    await page.locator('#paginatedResults .result-row button[data-action="select-customer"]').first().press('Enter');
    await page.locator('#customerDetail').waitFor({ state: 'visible' }); await stable(page, true);
    await checkShellGeometry(page, driver, contract, { ...meta, state: 'native-selected-session' }, { emptyReset, ordinary: false });
    await captureAfter(page, driver, meta.prefix + 'selected-session');
    const initialDisclosure = await page.evaluate(() => {
        const panel = document.querySelector('#subscriptionQueuePanel'), bounds = panel.getBoundingClientRect();
        return { visible: bounds.width > 0 && bounds.height > 0 && !panel.hidden,
            expanded: document.querySelector('#subscriptionQueueToggle').getAttribute('aria-expanded') };
    });
    driver.check('native outbox actual disclosure state is consistent', initialDisclosure.expanded === String(initialDisclosure.visible), true, { ...meta, initialDisclosure }, 3);
    if (initialDisclosure.visible) {
        await page.locator('#subscriptionQueueToggle').press('Enter');
        await page.locator('#subscriptionQueuePanel').waitFor({ state: 'hidden' });
        driver.check('native Enter closes the already-open outbox', await page.locator('#subscriptionQueueToggle').getAttribute('aria-expanded'), 'false', meta, 3);
    }
    await page.locator('#subscriptionQueueToggle').press('Enter');
    await page.locator('#subscriptionQueuePanel').waitFor({ state: 'visible' });
    driver.check('native Enter opens outbox with consistent ARIA', await page.locator('#subscriptionQueueToggle').getAttribute('aria-expanded'), 'true', meta, 3);
    await checkShellGeometry(page, driver, contract, { ...meta, state: 'native-outbox' }, { emptyReset, ordinary: false });
    await captureAfter(page, driver, meta.prefix + 'outbox');
}
