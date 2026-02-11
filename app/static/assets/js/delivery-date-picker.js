// Delivery date picker backed by /api/v1/catalog/delivery-calendar.

function translateDelivery(key, params, fallback) {
    if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.t === 'function') {
        const value = window.i18n.t(key, params);
        if (value !== undefined && value !== null && value !== key) {
            return value;
        }
    }
    return fallback !== undefined ? fallback : key;
}

const deliveryCalendarApiUrl = '/api/v1/catalog/delivery-calendar';
const deliveryCalendarCache = new Map();
let currentCalendarDate = new Date();
let selectedDeliveryDate = null;

function formatDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

if (typeof module !== 'undefined') {
    module.exports = { formatDateInputValue };
}

function calendarCacheKey(year, month) {
    return `${year}-${month}`;
}

async function fetchDeliveryCalendar(year, month) {
    const key = calendarCacheKey(year, month);
    if (deliveryCalendarCache.has(key)) {
        return deliveryCalendarCache.get(key);
    }

    if (!window.kiwiApi) {
        throw new Error('kiwiApi client unavailable');
    }

    const payload = await window.kiwiApi.get(`${deliveryCalendarApiUrl}?year=${year}&month=${month}`);
    deliveryCalendarCache.set(key, payload);
    return payload;
}

function formatDeliveryDateLabel(isoDate) {
    const date = new Date(`${isoDate}T12:00:00`);
    const fallbackMonths = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
    const fallbackDays = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];

    const translatedMonths = translateDelivery('delivery.monthNames');
    const translatedDays = translateDelivery('delivery.dayNames');

    const monthNames = Array.isArray(translatedMonths) ? translatedMonths : fallbackMonths;
    const dayNames = Array.isArray(translatedDays) ? translatedDays : fallbackDays;

    return `${dayNames[date.getDay()]} ${date.getDate()} ${monthNames[date.getMonth()]}`;
}

async function initDeliveryDatePicker() {
    const container = document.getElementById('deliveryDatePickerContainer');
    if (!container) return;

    const hiddenInput = document.getElementById('articleDesiredDelivery');
    const displayDiv = document.getElementById('deliveryDateDisplay');
    const calendarDiv = document.getElementById('deliveryCalendar');

    if (!displayDiv || !calendarDiv || !hiddenInput) return;

    const today = new Date();
    currentCalendarDate = new Date(today.getFullYear(), today.getMonth(), 1);

    try {
        const initialCalendar = await fetchDeliveryCalendar(today.getFullYear(), today.getMonth() + 1);
        if (initialCalendar && initialCalendar.recommendedDate) {
            selectDeliveryDateByString(initialCalendar.recommendedDate);
        }
    } catch (error) {
        console.error('Kan bezorgkalender niet laden', error);
    }

    const newDisplayDiv = displayDiv.cloneNode(true);
    displayDiv.parentNode.replaceChild(newDisplayDiv, displayDiv);

    newDisplayDiv.addEventListener('click', async (event) => {
        event.stopPropagation();
        const isVisible = calendarDiv.classList.contains('is-open');
        if (isVisible) {
            closeCalendar();
        } else {
            await openCalendar();
        }
    });

    if (!window._deliveryCalendarClickHandler) {
        window._deliveryCalendarClickHandler = (event) => {
            const currentContainer = document.getElementById('deliveryDatePickerContainer');
            if (currentContainer && !currentContainer.contains(event.target)) {
                closeCalendar();
            }
        };
        document.addEventListener('click', window._deliveryCalendarClickHandler);
    }

    if (!window._deliveryCalendarKeyHandler) {
        window._deliveryCalendarKeyHandler = (event) => {
            if (event.key === 'Escape') {
                closeCalendar();
            }
        };
        document.addEventListener('keydown', window._deliveryCalendarKeyHandler);
    }

    if (!window._deliveryCalendarResizeHandlerAttached) {
        window.addEventListener('resize', handleCalendarResize);
        window._deliveryCalendarResizeHandlerAttached = true;
    }
}

async function openCalendar() {
    const calendarDiv = document.getElementById('deliveryCalendar');
    if (!calendarDiv) return;

    await generateCalendar(currentCalendarDate);
    calendarDiv.style.display = 'block';
    calendarDiv.classList.add('is-open');

    requestAnimationFrame(positionCalendarWithinViewport);
}

function closeCalendar() {
    const calendarDiv = document.getElementById('deliveryCalendar');
    if (!calendarDiv) return;

    calendarDiv.style.display = 'none';
    calendarDiv.classList.remove('is-open');
    calendarDiv.classList.remove('align-top');
}

function handleCalendarResize() {
    const calendarDiv = document.getElementById('deliveryCalendar');
    if (!calendarDiv || !calendarDiv.classList.contains('is-open')) return;
    positionCalendarWithinViewport();
}

function positionCalendarWithinViewport() {
    const calendarDiv = document.getElementById('deliveryCalendar');
    if (!calendarDiv) return;

    calendarDiv.classList.remove('align-top');
    const rect = calendarDiv.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    const bottomOverflow = rect.bottom - viewportHeight;
    const spaceAbove = rect.top;

    if (bottomOverflow > 0 && spaceAbove > rect.height + 16) {
        calendarDiv.classList.add('align-top');
    }

    const updatedRect = calendarDiv.getBoundingClientRect();
    if (updatedRect.bottom > viewportHeight) {
        calendarDiv.scrollIntoView({ block: 'end', behavior: 'smooth' });
    } else if (updatedRect.top < 0) {
        calendarDiv.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
}

async function generateCalendar(startDate) {
    const calendarDiv = document.getElementById('deliveryCalendar');
    if (!calendarDiv) {
        return;
    }

    const year = startDate.getFullYear();
    const month = startDate.getMonth() + 1;

    let calendarData;
    try {
        calendarData = await fetchDeliveryCalendar(year, month);
    } catch (error) {
        calendarDiv.innerHTML = '<div class="delivery-calendar-content"><p>Kan kalender niet laden</p></div>';
        return;
    }

    currentCalendarDate = new Date(year, month - 1, 1);

    const selectedDate = selectedDeliveryDate;
    const recommendedDate = calendarData.recommendedDate;

    let html = '<div class="delivery-calendar-content">';
    html += '<div class="delivery-quick-buttons">';
    html += '<button type="button" class="delivery-quick-btn" data-action="select-recommended-delivery-date" aria-label="Selecteer eerst beschikbare datum"><span aria-hidden="true">★</span> Eerst beschikbare</button>';
    html += '</div>';

    html += '<div class="delivery-calendar-header">';
    html += '<button type="button" class="calendar-nav" data-action="navigate-delivery-calendar" data-arg-direction="-1" aria-label="Vorige maand"><span aria-hidden="true">&lsaquo;</span></button>';
    html += `<span class="calendar-month" aria-live="polite">${calendarData.monthLabel}</span>`;
    html += '<button type="button" class="calendar-nav" data-action="navigate-delivery-calendar" data-arg-direction="1" aria-label="Volgende maand"><span aria-hidden="true">&rsaquo;</span></button>';
    html += '</div>';

    html += '<div class="delivery-calendar-grid">';
    ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].forEach((day) => {
        html += `<div class="delivery-day-header">${day}</div>`;
    });

    const firstOfMonth = new Date(`${year}-${String(month).padStart(2, '0')}-01T12:00:00`);
    let firstDayOfWeek = firstOfMonth.getDay() - 1;
    if (firstDayOfWeek === -1) {
        firstDayOfWeek = 6;
    }

    for (let index = 0; index < firstDayOfWeek; index += 1) {
        html += '<div class="delivery-day-cell empty"></div>';
    }

    calendarData.days.forEach((dayItem) => {
        const isSelected = dayItem.date === selectedDate;
        const isRecommended = dayItem.date === recommendedDate;

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

        const attrs = [];
        if (dayItem.available && !dayItem.past) {
            attrs.push('role="button"');
            attrs.push('tabindex="0"');
            attrs.push('data-action="select-delivery-date"');
            attrs.push('data-action-event="click,keydown"');
            attrs.push(`data-arg-date="${dayItem.date}"`);
        }
        attrs.push(`title="${dayItem.title}"`);
        attrs.push(`aria-label="${ariaParts.join(' - ')}"`);

        html += `<div class="${cellClass}" ${attrs.join(' ')}>`;
        html += `<div class="day-number">${dayItem.day}</div>`;
        html += `<div class="day-name">${dayItem.weekdayShort}</div>`;
        if (isRecommended && !isSelected) {
            html += '<div class="day-badge recommended-badge" aria-hidden="true">Aanr.</div>';
        }
        if (!dayItem.available && !dayItem.past) {
            html += '<div class="day-badge unavailable-badge" aria-hidden="true">X</div>';
        }
        html += '</div>';
    });

    html += '</div>';
    html += '</div>';

    calendarDiv.innerHTML = html;
}

async function navigateCalendar(direction, event) {
    if (event) {
        event.stopPropagation();
    }

    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    await generateCalendar(currentCalendarDate);
}

function selectDeliveryDate(date) {
    const hiddenInput = document.getElementById('articleDesiredDelivery');
    const displayDiv = document.getElementById('deliveryDateDisplay');
    if (!hiddenInput || !displayDiv) {
        return;
    }

    const dateStr = formatDateInputValue(date);
    selectedDeliveryDate = dateStr;
    hiddenInput.value = dateStr;
    displayDiv.textContent = formatDeliveryDateLabel(dateStr);
    displayDiv.classList.add('selected');

    closeCalendar();
}

function selectDeliveryDateByString(dateStr, event) {
    if (event) {
        event.stopPropagation();
    }

    const date = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
        return;
    }

    selectDeliveryDate(date);
}

function handleDayCellKeydown(event, dateStr) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectDeliveryDateByString(dateStr);
    }
}

async function selectRecommendedDate(event) {
    if (event) {
        event.stopPropagation();
    }

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth() + 1;
    const calendarData = await fetchDeliveryCalendar(year, month);
    if (calendarData && calendarData.recommendedDate) {
        selectDeliveryDateByString(calendarData.recommendedDate);
    }
}

async function findNextAvailableDate(startDate) {
    let year = startDate.getFullYear();
    let month = startDate.getMonth() + 1;
    let iterations = 0;

    while (iterations < 24) {
        const calendarData = await fetchDeliveryCalendar(year, month);
        const candidate = calendarData.days.find((day) => day.available && day.date >= formatDateInputValue(startDate));
        if (candidate) {
            return candidate.date;
        }

        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
        iterations += 1;
    }

    return null;
}

async function selectNextWeek() {
    const candidate = new Date();
    candidate.setDate(candidate.getDate() + 7);
    const nextAvailable = await findNextAvailableDate(candidate);
    if (nextAvailable) {
        selectDeliveryDateByString(nextAvailable);
    }
}

async function selectTwoWeeks() {
    const candidate = new Date();
    candidate.setDate(candidate.getDate() + 14);
    const nextAvailable = await findNextAvailableDate(candidate);
    if (nextAvailable) {
        selectDeliveryDateByString(nextAvailable);
    }
}
