import { getGlobalScope } from '../services.js';

const DELIVERY_DATE_PICKER_SLICE_NAMESPACE = 'kiwiDeliveryDatePickerSlice';
const DELIVERY_CALENDAR_API_URL = '/api/v1/catalog/delivery-calendar';
const FALLBACK_DAY_NAMES_SHORT = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
const FALLBACK_MONTH_NAMES = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const FALLBACK_DAY_NAMES = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
const CALENDAR_SCAN_LIMIT_IN_MONTHS = 24;

const deliveryCalendarCache = new Map();
let currentCalendarDate = new Date();
let selectedDeliveryDate = null;
let focusedDeliveryDate = null;
let renderedCalendarDays = new Map();
let renderedRecommendedDate = null;
let calendarRenderVersion = 0;
let deliveryCalendarClickHandler = null;
let deliveryCalendarKeyHandler = null;
let deliveryCalendarResizeHandlerAttached = false;
let compatibilityExportsInstalled = false;
const deliveryDatePickerRuntime = {
    nowDate: () => new Date()
};

function getCurrentDate() {
    const runtimeDate = deliveryDatePickerRuntime.nowDate();
    if (runtimeDate instanceof Date) {
        return new Date(runtimeDate.getTime());
    }

    return new Date(runtimeDate);
}

function getDocumentRef() {
    const globalScope = getGlobalScope();
    if (!globalScope || !globalScope.document) {
        return null;
    }

    return globalScope.document;
}

function getWindowRef() {
    const globalScope = getGlobalScope();
    if (!globalScope || !globalScope.window) {
        return globalScope || null;
    }

    return globalScope.window;
}

function getApiClient() {
    const globalScope = getGlobalScope();
    if (!globalScope) {
        return null;
    }

    return globalScope.kiwiApi || null;
}

function getElementById(elementId) {
    const documentRef = getDocumentRef();
    if (!documentRef || typeof documentRef.getElementById !== 'function') {
        return null;
    }

    return documentRef.getElementById(elementId);
}

function translateDelivery(key, params = {}, fallback = key) {
    const globalScope = getGlobalScope();
    const translator = globalScope && globalScope.i18n ? globalScope.i18n.t : null;
    if (typeof translator !== 'function') {
        return fallback;
    }

    const translatedValue = translator(key, params);
    if (translatedValue === undefined || translatedValue === null || translatedValue === key) {
        return fallback;
    }

    return translatedValue;
}

function stopEventPropagation(event) {
    if (!event || typeof event.stopPropagation !== 'function') {
        return;
    }

    event.stopPropagation();
}

function calendarCacheKey(year, month) {
    return `${year}-${month}`;
}

function getMonthNames() {
    const translatedMonths = translateDelivery('delivery.monthNames', {}, FALLBACK_MONTH_NAMES);
    return Array.isArray(translatedMonths) ? translatedMonths : FALLBACK_MONTH_NAMES;
}

function getDayNames() {
    const translatedDays = translateDelivery('delivery.dayNames', {}, FALLBACK_DAY_NAMES);
    return Array.isArray(translatedDays) ? translatedDays : FALLBACK_DAY_NAMES;
}

function getShortDayNames() {
    const days = translateDelivery('delivery.dayNamesShort', {}, FALLBACK_DAY_NAMES_SHORT);
    return Array.isArray(days) ? days : FALLBACK_DAY_NAMES_SHORT;
}

function escapeCalendarText(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
}

function buildCalendarErrorMarkup() {
    const message = translateDelivery('delivery.calendarLoadFailed', {}, 'Kan kalender niet laden');
    return `<p role="alert">${escapeCalendarText(message)}</p>`;
}

function queueCalendarPositioning() {
    const windowRef = getWindowRef();
    const hasAnimationFrame = windowRef && typeof windowRef.requestAnimationFrame === 'function';
    if (hasAnimationFrame) {
        windowRef.requestAnimationFrame(positionCalendarWithinViewport);
        return;
    }

    positionCalendarWithinViewport();
}

function buildDayCellClass(dayItem, isSelected) {
    let cellClass = 'delivery-day-cell';
    if (dayItem.past) {
        cellClass += ' past';
    } else if (!dayItem.available) {
        cellClass += ' unavailable';
    } else if (isSelected) {
        cellClass += ' selected';
    } else {
        cellClass += ' available';
    }

    const isToday = dayItem.date === formatDateInputValue(getCurrentDate());
    return isToday ? `${cellClass} today` : cellClass;
}

function buildDayCellAriaLabel(dayItem, isSelected, isRecommended) {
    const ariaParts = [`${formatDeliveryDateLabel(dayItem.date)} ${dayItem.date.slice(0, 4)}`];
    if (dayItem.past) {
        ariaParts.push(translateDelivery('delivery.pastDate', {}, 'verlopen datum'));
    } else if (!dayItem.available) {
        ariaParts.push(translateDelivery('delivery.unavailableDate', {}, 'niet beschikbaar'));
    } else if (isSelected) {
        ariaParts.push(translateDelivery('delivery.selectedDate', {}, 'geselecteerd'));
    } else if (isRecommended) {
        ariaParts.push(translateDelivery('delivery.firstAvailable', {}, 'Eerst beschikbaar'));
    } else {
        ariaParts.push(translateDelivery('delivery.availableDate', {}, 'beschikbaar'));
    }

    return ariaParts.join(' - ');
}

function buildDayCellAttributes(dayItem, tabDate) {
    const canSelectDay = dayItem.available && !dayItem.past;
    return [
        'type="button"',
        `tabindex="${dayItem.date === tabDate ? '0' : '-1'}"`,
        `aria-disabled="${!canSelectDay}"`,
        `aria-current="${dayItem.date === formatDateInputValue(getCurrentDate()) ? 'date' : 'false'}"`,
        'data-action="select-delivery-date"',
        'data-action-event="click,keydown"',
        `data-arg-date="${escapeCalendarText(dayItem.date)}"`
    ];
}

function getCalendarElements() {
    return {
        container: getElementById('deliveryDatePickerContainer'),
        hiddenInput: getElementById('articleDesiredDelivery'),
        displayDiv: getElementById('deliveryDateDisplay'),
        calendarDiv: getElementById('deliveryCalendar')
    };
}

function attachDisplayToggleHandler(displayDiv, calendarDiv) {
    if (!displayDiv || !displayDiv.parentNode || !calendarDiv) {
        return;
    }

    const replacementDisplay = displayDiv.cloneNode(true);
    displayDiv.parentNode.replaceChild(replacementDisplay, displayDiv);

    replacementDisplay.addEventListener('click', async (event) => {
        stopEventPropagation(event);
        const isCalendarVisible = calendarDiv.classList.contains('is-open');
        if (isCalendarVisible) {
            closeCalendar();
            return;
        }

        await openCalendar();
    });
}

function attachCalendarDismissHandlers() {
    const documentRef = getDocumentRef();
    if (!documentRef) {
        return;
    }

    if (!deliveryCalendarClickHandler) {
        deliveryCalendarClickHandler = (event) => {
            const container = getElementById('deliveryDatePickerContainer');
            const isOpen = getElementById('deliveryCalendar')?.classList.contains('is-open');
            // A calendar render can replace the clicked button before this listener runs.
            const clickedInsideContainer = event.composedPath?.().includes(container) || container?.contains(event.target);
            const clickedOutsideContainer = container && !clickedInsideContainer;
            if (isOpen && clickedOutsideContainer) {
                closeCalendar(false);
            }
        };
        documentRef.addEventListener('click', deliveryCalendarClickHandler);
    }

    if (!deliveryCalendarKeyHandler) {
        deliveryCalendarKeyHandler = (event) => {
            const isOpen = getElementById('deliveryCalendar')?.classList.contains('is-open');
            if (event.key === 'Escape' && isOpen) {
                event.preventDefault();
                stopEventPropagation(event);
                closeCalendar();
            }
        };
        // Capture Escape before the surrounding article form handles it.
        documentRef.addEventListener('keydown', deliveryCalendarKeyHandler, true);
        documentRef.addEventListener('focusin', (event) => {
            const container = getElementById('deliveryDatePickerContainer');
            const isOpen = getElementById('deliveryCalendar')?.classList.contains('is-open');
            if (isOpen && container && !container.contains(event.target)) {
                closeCalendar(false);
            }
        });
    }

    const windowRef = getWindowRef();
    const canAttachResizeHandler = windowRef && typeof windowRef.addEventListener === 'function';
    if (canAttachResizeHandler && !deliveryCalendarResizeHandlerAttached) {
        windowRef.addEventListener('resize', handleCalendarResize);
        deliveryCalendarResizeHandlerAttached = true;
    }
}

function installCompatibilityExports() {
    if (compatibilityExportsInstalled) {
        return;
    }

    const globalScope = getGlobalScope();
    if (!globalScope) {
        return;
    }

    globalScope[DELIVERY_DATE_PICKER_SLICE_NAMESPACE] = {
        formatDateInputValue,
        fetchDeliveryCalendar,
        formatDeliveryDateLabel,
        initDeliveryDatePicker,
        openCalendar,
        closeCalendar,
        generateCalendar,
        navigateCalendar,
        selectDeliveryDate,
        selectDeliveryDateByString,
        selectRecommendedDate,
        findNextAvailableDate,
        selectNextWeek,
        selectTwoWeeks
    };

    globalScope.formatDateInputValue = formatDateInputValue;
    globalScope.fetchDeliveryCalendar = fetchDeliveryCalendar;
    globalScope.formatDeliveryDateLabel = formatDeliveryDateLabel;
    globalScope.initDeliveryDatePicker = initDeliveryDatePicker;
    globalScope.openCalendar = openCalendar;
    globalScope.closeCalendar = closeCalendar;
    globalScope.generateCalendar = generateCalendar;
    globalScope.navigateCalendar = navigateCalendar;
    globalScope.selectDeliveryDate = selectDeliveryDate;
    globalScope.selectDeliveryDateByString = selectDeliveryDateByString;
    globalScope.selectRecommendedDate = selectRecommendedDate;
    globalScope.findNextAvailableDate = findNextAvailableDate;
    globalScope.selectNextWeek = selectNextWeek;
    globalScope.selectTwoWeeks = selectTwoWeeks;

    compatibilityExportsInstalled = true;
}

export function formatDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export async function fetchDeliveryCalendar(year, month) {
    const cacheKey = calendarCacheKey(year, month);
    if (deliveryCalendarCache.has(cacheKey)) {
        return deliveryCalendarCache.get(cacheKey);
    }

    const kiwiApi = getApiClient();
    const canReadCalendar = kiwiApi && typeof kiwiApi.get === 'function';
    if (!canReadCalendar) {
        throw new Error('kiwiApi client unavailable');
    }

    const payload = await kiwiApi.get(`${DELIVERY_CALENDAR_API_URL}?year=${year}&month=${month}`);
    deliveryCalendarCache.set(cacheKey, payload);
    return payload;
}

export function formatDeliveryDateLabel(isoDate) {
    const date = new Date(`${isoDate}T12:00:00`);
    const hasValidDate = !Number.isNaN(date.getTime());
    if (!hasValidDate) {
        return isoDate;
    }

    const monthNames = getMonthNames();
    const dayNames = getDayNames();
    return `${dayNames[date.getDay()]} ${date.getDate()} ${monthNames[date.getMonth()]}`;
}

export async function initDeliveryDatePicker() {
    const { container, hiddenInput, displayDiv, calendarDiv } = getCalendarElements();
    if (!container || !hiddenInput || !displayDiv || !calendarDiv) {
        return;
    }

    closeCalendar(false);
    selectedDeliveryDate = hiddenInput.value || null;
    const today = getCurrentDate();
    currentCalendarDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const initializationVersion = calendarRenderVersion;

    attachDisplayToggleHandler(displayDiv, calendarDiv);
    attachCalendarDismissHandlers();
    if (selectedDeliveryDate) {
        selectDeliveryDateByString(selectedDeliveryDate);
        return;
    }

    try {
        const initialCalendar = await fetchDeliveryCalendar(today.getFullYear(), today.getMonth() + 1);
        const initializationIsCurrent = initializationVersion === calendarRenderVersion;
        if (initializationIsCurrent && !hiddenInput.value && initialCalendar?.recommendedDate) {
            selectDeliveryDateByString(initialCalendar.recommendedDate);
        }
    } catch (error) {
        console.error('Kan bezorgkalender niet laden', error);
    }
}

function focusCalendarDay(dateString) {
    const calendarDiv = getElementById('deliveryCalendar');
    const buttons = calendarDiv?.querySelectorAll?.('.delivery-day-cell[data-arg-date]') || [];
    let target;
    for (const button of buttons) {
        const matchesDate = button.dataset.argDate === dateString;
        button.tabIndex = matchesDate ? 0 : -1;
        if (matchesDate) {
            target = button;
        }
    }
    focusedDeliveryDate = dateString;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

export async function openCalendar() {
    const { calendarDiv, displayDiv } = getCalendarElements();
    if (!calendarDiv) {
        return;
    }

    calendarDiv.style.display = 'block';
    calendarDiv.classList.add('is-open');
    displayDiv?.setAttribute?.('aria-expanded', 'true');
    const openingDate = selectedDeliveryDate ? new Date(`${selectedDeliveryDate}T12:00:00`) : currentCalendarDate;
    const rendering = generateCalendar(openingDate);
    const openingVersion = calendarRenderVersion;
    const rendered = await rendering;
    if (openingVersion !== calendarRenderVersion || !calendarDiv.classList.contains('is-open')) {
        return;
    }
    if (rendered) {
        focusCalendarDay(focusedDeliveryDate);
    } else {
        calendarDiv.focus?.({ preventScroll: true });
    }
    queueCalendarPositioning();
}

export function closeCalendar(restoreFocus = true) {
    calendarRenderVersion += 1;
    const { calendarDiv, displayDiv } = getCalendarElements();
    if (!calendarDiv) {
        return;
    }

    const wasOpen = calendarDiv.classList.contains('is-open');
    calendarDiv.style.display = 'none';
    calendarDiv.classList.remove('is-open');
    calendarDiv.classList.remove('align-top');
    calendarDiv.removeAttribute?.('aria-busy');
    displayDiv?.setAttribute?.('aria-expanded', 'false');
    if (wasOpen && restoreFocus) {
        displayDiv?.focus?.({ preventScroll: true });
    }
}

export function handleCalendarResize() {
    const calendarDiv = getElementById('deliveryCalendar');
    const isCalendarVisible = calendarDiv && calendarDiv.classList.contains('is-open');
    if (!isCalendarVisible) {
        return;
    }

    positionCalendarWithinViewport();
}

export function positionCalendarWithinViewport() {
    const calendarDiv = getElementById('deliveryCalendar');
    if (!calendarDiv) {
        return;
    }

    const windowRef = getWindowRef();
    const hasViewportHeight = windowRef && typeof windowRef.innerHeight === 'number';
    if (!hasViewportHeight) {
        return;
    }

    calendarDiv.classList.remove('align-top');
    calendarDiv.style.marginLeft = '';
    const rect = calendarDiv.getBoundingClientRect();
    const viewportHeight = windowRef.innerHeight;

    if (windowRef.innerWidth > 768) {
        const overflowRight = Math.max(0, rect.right - windowRef.innerWidth + 8);
        const overflowLeft = Math.max(0, 8 - rect.left);
        calendarDiv.style.marginLeft = `${overflowLeft - overflowRight}px`;
    }

    const bottomOverflow = rect.bottom - viewportHeight;
    const hasSpaceAbove = rect.top > rect.height + 16;
    if (bottomOverflow > 0 && hasSpaceAbove) {
        calendarDiv.classList.add('align-top');
    }

    const updatedRect = calendarDiv.getBoundingClientRect();
    const canScrollCalendar = typeof calendarDiv.scrollIntoView === 'function';
    if (!canScrollCalendar) {
        return;
    }

    if (updatedRect.bottom > viewportHeight) {
        calendarDiv.scrollIntoView({ block: 'end', behavior: 'smooth' });
        return;
    }

    if (updatedRect.top < 0) {
        calendarDiv.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
}

function buildCalendarHeader(year, month) {
    const monthLabel = escapeCalendarText(`${getMonthNames()[month - 1]} ${year}`);
    const previousLabel = escapeCalendarText(translateDelivery('delivery.previousMonth', {}, 'Vorige maand'));
    const nextLabel = escapeCalendarText(translateDelivery('delivery.nextMonth', {}, 'Volgende maand'));
    return `<div class="delivery-calendar-header">
        <h3 id="deliveryCalendarMonth" class="calendar-month" aria-live="polite">${monthLabel}</h3>
        <div class="delivery-calendar-navigation">
            <button type="button" class="calendar-nav" data-action="navigate-delivery-calendar" data-action-event="click" data-arg-direction="-1" aria-label="${previousLabel}"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m12 5-5 5 5 5"/></svg></button>
            <button type="button" class="calendar-nav" data-action="navigate-delivery-calendar" data-action-event="click" data-arg-direction="1" aria-label="${nextLabel}"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m8 5 5 5-5 5"/></svg></button>
        </div>
    </div>`;
}

function buildCalendarFooter(recommendedDate) {
    const parts = ['<div class="delivery-calendar-footer">'];
    if (recommendedDate) {
        const date = new Date(`${recommendedDate}T12:00:00`);
        const shortDate = `${getShortDayNames()[date.getDay()]} ${date.getDate()} ${getMonthNames()[date.getMonth()].slice(0, 3)}`;
        const label = translateDelivery('delivery.firstAvailable', {}, 'Eerst beschikbaar');
        parts.push(`<button type="button" class="delivery-quick-btn" data-action="select-recommended-delivery-date" data-action-event="click" data-arg-date="${escapeCalendarText(recommendedDate)}">${escapeCalendarText(label)}: ${escapeCalendarText(shortDate)}</button>`);
    }
    const hint = translateDelivery('delivery.unavailableHint', {}, 'Doorgestreepte dagen zijn niet beschikbaar.');
    parts.push(`<p id="deliveryCalendarHint" class="delivery-calendar-hint">${escapeCalendarText(hint)}</p></div>`);
    return parts.join('');
}

function buildCalendarGrid(calendarData, year, month, tabDate) {
    const parts = ['<div class="delivery-calendar-grid" role="grid" aria-labelledby="deliveryCalendarMonth" aria-describedby="deliveryCalendarHint">'];
    const shortDays = getShortDayNames();
    const fullDays = getDayNames();
    parts.push('<div class="delivery-calendar-row" role="row">');
    for (const index of [1, 2, 3, 4, 5, 6, 0]) {
        parts.push(`<div class="delivery-day-header" role="columnheader" aria-label="${escapeCalendarText(fullDays[index])}">${escapeCalendarText(shortDays[index])}</div>`);
    }
    parts.push('</div><div class="delivery-calendar-row" role="row">');
    const firstDayOfWeek = (new Date(year, month - 1, 1, 12).getDay() + 6) % 7;
    for (let index = 0; index < firstDayOfWeek; index += 1) {
        parts.push('<div class="delivery-calendar-cell empty" role="gridcell"></div>');
    }
    calendarData.days.forEach((dayItem, index) => {
        const isSelected = dayItem.date === selectedDeliveryDate;
        const isRecommended = dayItem.date === calendarData.recommendedDate;
        const cellClass = buildDayCellClass(dayItem, isSelected);
        const label = escapeCalendarText(buildDayCellAriaLabel(dayItem, isSelected, isRecommended));
        const attributes = buildDayCellAttributes(dayItem, tabDate);
        parts.push(`<div class="delivery-calendar-cell" role="gridcell" aria-selected="${isSelected}"><button class="${cellClass}" ${attributes.join(' ')} aria-label="${label}"><span class="day-number">${escapeCalendarText(dayItem.day)}</span></button></div>`);
        const endOfWeek = (firstDayOfWeek + index + 1) % 7 === 0;
        if (endOfWeek && index < calendarData.days.length - 1) {
            parts.push('</div><div class="delivery-calendar-row" role="row">');
        }
    });
    const trailingCells = (7 - (firstDayOfWeek + calendarData.days.length) % 7) % 7;
    for (let index = 0; index < trailingCells; index += 1) {
        parts.push('<div class="delivery-calendar-cell empty" role="gridcell"></div>');
    }
    parts.push('</div></div>');
    return parts.join('');
}

export async function generateCalendar(startDate, preferredFocusDate = null) {
    const calendarDiv = getElementById('deliveryCalendar');
    if (!calendarDiv) {
        return false;
    }

    const year = startDate.getFullYear();
    const month = startDate.getMonth() + 1;
    const renderVersion = ++calendarRenderVersion;
    currentCalendarDate = new Date(year, month - 1, 1);
    calendarDiv.setAttribute?.('aria-busy', 'true');
    let calendarData;
    try {
        calendarData = await fetchDeliveryCalendar(year, month);
    } catch (_error) {
        if (renderVersion === calendarRenderVersion) {
            renderedCalendarDays.clear();
            renderedRecommendedDate = null;
            calendarDiv.innerHTML = buildCalendarHeader(year, month) + buildCalendarErrorMarkup();
            calendarDiv.removeAttribute?.('aria-busy');
        }
        return false;
    }
    if (renderVersion !== calendarRenderVersion) {
        return false;
    }

    renderedCalendarDays = new Map(calendarData.days.map((day) => [day.date, day]));
    renderedRecommendedDate = calendarData.recommendedDate;
    const candidates = [preferredFocusDate, selectedDeliveryDate, calendarData.recommendedDate];
    const matchingDate = candidates.find((date) => renderedCalendarDays.has(date));
    const firstAvailable = calendarData.days.find((day) => day.available && !day.past);
    focusedDeliveryDate = matchingDate || firstAvailable?.date || calendarData.days[0]?.date;
    calendarDiv.innerHTML = '<div class="delivery-calendar-content">'
        + buildCalendarHeader(year, month)
        + buildCalendarGrid(calendarData, year, month, focusedDeliveryDate)
        + buildCalendarFooter(calendarData.recommendedDate)
        + '</div>';
    calendarDiv.removeAttribute?.('aria-busy');
    return true;
}

export async function navigateCalendar(direction, event) {
    stopEventPropagation(event);
    const numericDirection = Number(direction);
    if (!Number.isInteger(numericDirection) || numericDirection === 0) {
        return;
    }

    const calendarDiv = getElementById('deliveryCalendar');
    const focusWasInside = calendarDiv?.contains?.(getDocumentRef()?.activeElement);
    const nextMonth = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + numericDirection, 1);
    const rendering = generateCalendar(nextMonth);
    const navigationVersion = calendarRenderVersion;
    await rendering;
    if (navigationVersion !== calendarRenderVersion) {
        return;
    }
    if (focusWasInside && calendarDiv?.classList.contains('is-open')) {
        calendarDiv.querySelector?.(`[data-arg-direction="${numericDirection}"]`)?.focus({ preventScroll: true });
    }
    queueCalendarPositioning();
}

export function selectDeliveryDate(date) {
    const hiddenInput = getElementById('articleDesiredDelivery');
    const displayDiv = getElementById('deliveryDateDisplay');
    const hasRequiredElements = hiddenInput && displayDiv;
    if (!hasRequiredElements) {
        return;
    }

    const dateValue = formatDateInputValue(date);
    selectedDeliveryDate = dateValue;
    hiddenInput.value = dateValue;
    const valueElement = displayDiv.querySelector?.('.delivery-date-value') || displayDiv;
    valueElement.textContent = formatDeliveryDateLabel(dateValue);
    displayDiv.classList.add('selected');
    closeCalendar();
}

export function selectDeliveryDateByString(dateStr, event) {
    stopEventPropagation(event);

    const date = new Date(`${dateStr}T12:00:00`);
    const hasValidDate = !Number.isNaN(date.getTime());
    if (!hasValidDate) {
        return;
    }

    selectDeliveryDate(date);
}

export async function handleDayCellKeydown(event, dateStr) {
    const date = new Date(`${dateStr}T12:00:00`);
    const weekday = (date.getDay() + 6) % 7;
    const dayOffsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday };
    const isMonthNavigation = event.key === 'PageUp' || event.key === 'PageDown';
    if (!Object.hasOwn(dayOffsets, event.key) && !isMonthNavigation) {
        return;
    }
    event.preventDefault();
    stopEventPropagation(event);
    if (isMonthNavigation) {
        const monthOffset = event.key === 'PageUp' ? -1 : 1;
        const targetMonth = new Date(date.getFullYear(), date.getMonth() + monthOffset, 1, 12);
        const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
        date.setDate(1);
        date.setFullYear(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(Number(dateStr.slice(-2)), lastDay));
    } else {
        date.setDate(date.getDate() + dayOffsets[event.key]);
    }
    const targetDate = formatDateInputValue(date);
    const changesMonth = date.getMonth() !== currentCalendarDate.getMonth() || date.getFullYear() !== currentCalendarDate.getFullYear();
    if (changesMonth && !await generateCalendar(date, targetDate)) {
        return;
    }
    const calendarDiv = getElementById('deliveryCalendar');
    if (calendarDiv?.classList.contains('is-open')) {
        focusCalendarDay(targetDate);
        queueCalendarPositioning();
    }
}

export async function selectRecommendedDate(event, displayedDate = null) {
    stopEventPropagation(event);
    if (displayedDate) {
        if (displayedDate === renderedRecommendedDate) {
            selectDeliveryDateByString(displayedDate);
        }
        return;
    }

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth() + 1;
    const selectionVersion = calendarRenderVersion;
    let calendarData;
    try {
        calendarData = await fetchDeliveryCalendar(year, month);
    } catch (_error) {
        return;
    }
    if (selectionVersion !== calendarRenderVersion) {
        return;
    }
    const hasRecommendedDate = calendarData && calendarData.recommendedDate;
    if (!hasRecommendedDate) {
        return;
    }

    selectDeliveryDateByString(calendarData.recommendedDate);
}

export async function findNextAvailableDate(startDate) {
    let year = startDate.getFullYear();
    let month = startDate.getMonth() + 1;
    let checkedMonthCount = 0;
    const minimumDate = formatDateInputValue(startDate);

    while (checkedMonthCount < CALENDAR_SCAN_LIMIT_IN_MONTHS) {
        const calendarData = await fetchDeliveryCalendar(year, month);
        const candidate = calendarData.days.find((day) => day.available && day.date >= minimumDate);
        if (candidate) {
            return candidate.date;
        }

        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
        checkedMonthCount += 1;
    }

    return null;
}

export async function selectNextWeek() {
    const candidate = getCurrentDate();
    candidate.setDate(candidate.getDate() + 7);
    const nextAvailableDate = await findNextAvailableDate(candidate);
    if (!nextAvailableDate) {
        return;
    }

    selectDeliveryDateByString(nextAvailableDate);
}

export async function selectTwoWeeks() {
    const candidate = getCurrentDate();
    candidate.setDate(candidate.getDate() + 14);
    const nextAvailableDate = await findNextAvailableDate(candidate);
    if (!nextAvailableDate) {
        return;
    }

    selectDeliveryDateByString(nextAvailableDate);
}

export function registerDeliveryDatePickerSlice(actionRouter) {
    installCompatibilityExports();

    const canRegisterActions = actionRouter && typeof actionRouter.registerMany === 'function';
    if (!canRegisterActions) {
        return;
    }

    actionRouter.registerMany({
        'select-recommended-delivery-date': (payload = {}, context) => {
            void selectRecommendedDate(context.event, payload.date);
        },
        'navigate-delivery-calendar': (payload = {}, context) => {
            const direction = Number(payload.direction);
            const hasValidDirection = Number.isFinite(direction) && direction !== 0;
            if (!hasValidDirection) {
                return;
            }

            void navigateCalendar(direction, context.event);
        },
        'select-delivery-date': (payload = {}, context) => {
            if (!payload.date) {
                return;
            }

            const isKeyboardEvent = context?.event?.type === 'keydown';
            if (isKeyboardEvent) {
                void handleDayCellKeydown(context.event, payload.date);
                return;
            }
            const day = renderedCalendarDays.get(payload.date);
            if (!day || day.past || !day.available) {
                return;
            }
            selectDeliveryDateByString(payload.date, context.event);
        }
    });
}

export function configureDeliveryDatePickerRuntimeForTests(overrides = {}) {
    deliveryDatePickerRuntime.nowDate = typeof overrides.nowDate === 'function'
        ? overrides.nowDate
        : (() => new Date());
}

export function __resetDeliveryDatePickerForTests() {
    deliveryCalendarCache.clear();
    currentCalendarDate = getCurrentDate();
    selectedDeliveryDate = null;
    focusedDeliveryDate = null;
    renderedCalendarDays.clear();
    renderedRecommendedDate = null;
    calendarRenderVersion += 1;
    configureDeliveryDatePickerRuntimeForTests();
}
