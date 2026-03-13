import { getGlobalScope } from '../services.js';

const DELIVERY_DATE_PICKER_SLICE_NAMESPACE = 'kiwiDeliveryDatePickerSlice';
const DELIVERY_CALENDAR_API_URL = '/api/v1/catalog/delivery-calendar';
const DAY_HEADERS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const FALLBACK_MONTH_NAMES = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const FALLBACK_DAY_NAMES = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
const CALENDAR_SCAN_LIMIT_IN_MONTHS = 24;

const deliveryCalendarCache = new Map();
let currentCalendarDate = new Date();
let selectedDeliveryDate = null;
let deliveryCalendarClickHandler = null;
let deliveryCalendarKeyHandler = null;
let deliveryCalendarResizeHandlerAttached = false;
let compatibilityExportsInstalled = false;

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

function isActivationKey(event) {
    if (!event) {
        return false;
    }

    return event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar';
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

function buildCalendarErrorMarkup() {
    const message = translateDelivery('delivery.calendarLoadFailed', {}, 'Kan kalender niet laden');
    return `<div class="delivery-calendar-content"><p>${message}</p></div>`;
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

function buildDayCellClass(dayItem, isSelected, isRecommended) {
    let cellClass = 'delivery-day-cell';
    if (dayItem.past) {
        cellClass += ' past';
    } else if (!dayItem.available) {
        cellClass += ' unavailable';
    } else if (isSelected) {
        cellClass += ' selected';
    } else if (isRecommended) {
        cellClass += ' recommended';
    } else {
        cellClass += ' available';
    }

    return cellClass;
}

function buildDayCellAriaLabel(dayItem, isSelected, isRecommended) {
    const ariaParts = [dayItem.title];
    if (dayItem.past) {
        ariaParts.push('verlopen datum');
    } else if (!dayItem.available) {
        ariaParts.push('niet beschikbaar');
    } else if (isSelected) {
        ariaParts.push('geselecteerd');
    } else if (isRecommended) {
        ariaParts.push('aanbevolen');
    } else {
        ariaParts.push('beschikbaar');
    }

    return ariaParts.join(' - ');
}

function buildDayCellAttributes(dayItem) {
    const attrs = [];
    const canSelectDay = dayItem.available && !dayItem.past;
    if (canSelectDay) {
        attrs.push('role="button"');
        attrs.push('tabindex="0"');
        attrs.push('data-action="select-delivery-date"');
        attrs.push('data-action-event="click,keydown"');
        attrs.push(`data-arg-date="${dayItem.date}"`);
    }

    return attrs;
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
            const clickedOutsideContainer = container && !container.contains(event.target);
            if (clickedOutsideContainer) {
                closeCalendar();
            }
        };
        documentRef.addEventListener('click', deliveryCalendarClickHandler);
    }

    if (!deliveryCalendarKeyHandler) {
        deliveryCalendarKeyHandler = (event) => {
            if (event.key === 'Escape') {
                closeCalendar();
            }
        };
        documentRef.addEventListener('keydown', deliveryCalendarKeyHandler);
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
    const hasRequiredElements = container && hiddenInput && displayDiv && calendarDiv;
    if (!hasRequiredElements) {
        return;
    }

    const today = new Date();
    currentCalendarDate = new Date(today.getFullYear(), today.getMonth(), 1);

    try {
        const initialCalendar = await fetchDeliveryCalendar(today.getFullYear(), today.getMonth() + 1);
        const hasRecommendedDate = initialCalendar && initialCalendar.recommendedDate;
        if (hasRecommendedDate) {
            selectDeliveryDateByString(initialCalendar.recommendedDate);
        }
    } catch (error) {
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
            console.error('Kan bezorgkalender niet laden', error);
        }
    }

    attachDisplayToggleHandler(displayDiv, calendarDiv);
    attachCalendarDismissHandlers();
}

export async function openCalendar() {
    const calendarDiv = getElementById('deliveryCalendar');
    if (!calendarDiv) {
        return;
    }

    await generateCalendar(currentCalendarDate);
    calendarDiv.style.display = 'block';
    calendarDiv.classList.add('is-open');
    queueCalendarPositioning();
}

export function closeCalendar() {
    const calendarDiv = getElementById('deliveryCalendar');
    if (!calendarDiv) {
        return;
    }

    calendarDiv.style.display = 'none';
    calendarDiv.classList.remove('is-open');
    calendarDiv.classList.remove('align-top');
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
    const rect = calendarDiv.getBoundingClientRect();
    const viewportHeight = windowRef.innerHeight;

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

export async function generateCalendar(startDate) {
    const calendarDiv = getElementById('deliveryCalendar');
    if (!calendarDiv) {
        return;
    }

    const year = startDate.getFullYear();
    const month = startDate.getMonth() + 1;

    let calendarData;
    try {
        calendarData = await fetchDeliveryCalendar(year, month);
    } catch (_error) {
        calendarDiv.innerHTML = buildCalendarErrorMarkup();
        return;
    }

    currentCalendarDate = new Date(year, month - 1, 1);

    const selectedDate = selectedDeliveryDate;
    const recommendedDate = calendarData.recommendedDate;

    const markupParts = [];
    markupParts.push('<div class="delivery-calendar-content">');
    markupParts.push('<div class="delivery-quick-buttons">');
    markupParts.push('<button type="button" class="delivery-quick-btn" data-action="select-recommended-delivery-date" aria-label="Selecteer eerst beschikbare datum"><span aria-hidden="true">★</span> Eerst beschikbare</button>');
    markupParts.push('</div>');

    markupParts.push('<div class="delivery-calendar-header">');
    markupParts.push('<button type="button" class="calendar-nav" data-action="navigate-delivery-calendar" data-arg-direction="-1" aria-label="Vorige maand"><span aria-hidden="true">&lsaquo;</span></button>');
    markupParts.push(`<span class="calendar-month" aria-live="polite">${calendarData.monthLabel}</span>`);
    markupParts.push('<button type="button" class="calendar-nav" data-action="navigate-delivery-calendar" data-arg-direction="1" aria-label="Volgende maand"><span aria-hidden="true">&rsaquo;</span></button>');
    markupParts.push('</div>');

    markupParts.push('<div class="delivery-calendar-grid">');
    DAY_HEADERS.forEach((dayLabel) => {
        markupParts.push(`<div class="delivery-day-header">${dayLabel}</div>`);
    });

    const firstOfMonth = new Date(`${year}-${String(month).padStart(2, '0')}-01T12:00:00`);
    let firstDayOfWeek = firstOfMonth.getDay() - 1;
    if (firstDayOfWeek === -1) {
        firstDayOfWeek = 6;
    }

    for (let index = 0; index < firstDayOfWeek; index += 1) {
        markupParts.push('<div class="delivery-day-cell empty"></div>');
    }

    calendarData.days.forEach((dayItem) => {
        const isSelected = dayItem.date === selectedDate;
        const isRecommended = dayItem.date === recommendedDate;
        const dayCellClass = buildDayCellClass(dayItem, isSelected, isRecommended);
        const dayCellAriaLabel = buildDayCellAriaLabel(dayItem, isSelected, isRecommended);
        const dayCellAttributes = buildDayCellAttributes(dayItem);

        dayCellAttributes.push(`title="${dayItem.title}"`);
        dayCellAttributes.push(`aria-label="${dayCellAriaLabel}"`);

        markupParts.push(`<div class="${dayCellClass}" ${dayCellAttributes.join(' ')}>`);
        markupParts.push(`<div class="day-number">${dayItem.day}</div>`);
        markupParts.push(`<div class="day-name">${dayItem.weekdayShort}</div>`);
        if (isRecommended && !isSelected) {
            markupParts.push('<div class="day-badge recommended-badge" aria-hidden="true">Aanr.</div>');
        }
        if (!dayItem.available && !dayItem.past) {
            markupParts.push('<div class="day-badge unavailable-badge" aria-hidden="true">X</div>');
        }
        markupParts.push('</div>');
    });

    markupParts.push('</div>');
    markupParts.push('</div>');

    calendarDiv.innerHTML = markupParts.join('');
}

export async function navigateCalendar(direction, event) {
    stopEventPropagation(event);

    const numericDirection = Number(direction);
    const hasValidDirection = Number.isFinite(numericDirection) && numericDirection !== 0;
    if (!hasValidDirection) {
        return;
    }

    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + numericDirection);
    await generateCalendar(currentCalendarDate);
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
    displayDiv.textContent = formatDeliveryDateLabel(dateValue);
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

export function handleDayCellKeydown(event, dateStr) {
    if (!isActivationKey(event)) {
        return;
    }

    if (typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    selectDeliveryDateByString(dateStr);
}

export async function selectRecommendedDate(event) {
    stopEventPropagation(event);

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth() + 1;
    const calendarData = await fetchDeliveryCalendar(year, month);
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
    const candidate = new Date();
    candidate.setDate(candidate.getDate() + 7);
    const nextAvailableDate = await findNextAvailableDate(candidate);
    if (!nextAvailableDate) {
        return;
    }

    selectDeliveryDateByString(nextAvailableDate);
}

export async function selectTwoWeeks() {
    const candidate = new Date();
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
        'select-recommended-delivery-date': (_payload, context) => {
            void selectRecommendedDate(context.event);
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

            const isKeyboardEvent = context && context.event && context.event.type === 'keydown';
            if (!isKeyboardEvent) {
                selectDeliveryDateByString(payload.date, context.event);
                return;
            }

            if (!isActivationKey(context.event)) {
                return;
            }

            if (typeof context.event.preventDefault === 'function') {
                context.event.preventDefault();
            }
            selectDeliveryDateByString(payload.date);
        }
    });
}
