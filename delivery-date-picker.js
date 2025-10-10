// Delivery Date Picker Component
// Advanced date picker with business logic for magazine delivery

// Dutch Holidays Configuration
const dutchHolidays = [
    { name: 'Nieuwjaarsdag', date: '01-01' },
    { name: 'Koningsdag', date: '04-27' },
    { name: 'Bevrijdingsdag', date: '05-05', everyFiveYears: true },
    { name: 'Eerste Kerstdag', date: '12-25' },
    { name: 'Tweede Kerstdag', date: '12-26' }
];

// Easter calculation (Computus algorithm)
function calculateEaster(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

// Get all Dutch holidays for a given year
function getDutchHolidays(year) {
    const holidays = [];
    
    // Fixed holidays
    dutchHolidays.forEach(holiday => {
        // Handle Bevrijdingsdag (every 5 years rule)
        if (holiday.name === 'Bevrijdingsdag' && holiday.everyFiveYears) {
            if (year % 5 === 0) {
                const [month, day] = holiday.date.split('-');
                holidays.push(new Date(year, parseInt(month) - 1, parseInt(day)));
            }
        } else {
            const [month, day] = holiday.date.split('-');
            holidays.push(new Date(year, parseInt(month) - 1, parseInt(day)));
        }
    });
    
    // Calculate Easter and related holidays
    const easter = calculateEaster(year);
    
    // Goede Vrijdag (Good Friday - 2 days before Easter)
    const goodFriday = new Date(easter);
    goodFriday.setDate(easter.getDate() - 2);
    holidays.push(goodFriday);
    
    // Eerste Paasdag (Easter Sunday)
    holidays.push(easter);
    
    // Tweede Paasdag (Easter Monday)
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);
    holidays.push(easterMonday);
    
    // Hemelvaartsdag (Ascension Day - 39 days after Easter)
    const ascension = new Date(easter);
    ascension.setDate(easter.getDate() + 39);
    holidays.push(ascension);
    
    // Eerste Pinksterdag (Pentecost - 49 days after Easter)
    const pentecost = new Date(easter);
    pentecost.setDate(easter.getDate() + 49);
    holidays.push(pentecost);
    
    // Tweede Pinksterdag (Whit Monday - 50 days after Easter)
    const pentecostMonday = new Date(easter);
    pentecostMonday.setDate(easter.getDate() + 50);
    holidays.push(pentecostMonday);
    
    return holidays;
}

// Check if a date is a Dutch holiday
function isHoliday(date) {
    const year = date.getFullYear();
    const holidays = getDutchHolidays(year);
    
    return holidays.some(holiday => 
        holiday.getDate() === date.getDate() &&
        holiday.getMonth() === date.getMonth() &&
        holiday.getFullYear() === date.getFullYear()
    );
}

// Check if delivery is available on a given date (without minimum date check)
function isDeliveryAvailableBasic(date) {
    const day = date.getDay();
    
    // No delivery on Sundays (0)
    if (day === 0) return false;
    
    // No delivery on holidays
    if (isHoliday(date)) return false;
    
    return true;
}

// Check if delivery is available on a given date (with minimum date check)
function isDeliveryAvailable(date) {
    if (!isDeliveryAvailableBasic(date)) return false;
    
    // Check minimum lead time (2 business days)
    const minDate = getMinimumDeliveryDate();
    if (date < minDate) return false;
    
    return true;
}

// Calculate minimum delivery date (2 business days from now)
function getMinimumDeliveryDate() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let businessDays = 0;
    let date = new Date(today);
    
    while (businessDays < 2) {
        date.setDate(date.getDate() + 1);
        if (isDeliveryAvailableBasic(date)) {
            businessDays++;
        }
    }
    
    return date;
}

// Get recommended (earliest) delivery date
function getRecommendedDate() {
    return getMinimumDeliveryDate();
}

// Format date with Dutch day name
function formatDeliveryDate(date) {
    const dayNames = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
    const monthNames = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 
                        'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
    
    const dayName = dayNames[date.getDay()];
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    
    return `${dayName} ${day} ${month}`;
}

// Format date for display (short version)
function formatDateShort(date) {
    const dayNames = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
    return dayNames[date.getDay()];
}

// Initialize the delivery date picker
function initDeliveryDatePicker() {
    const container = document.getElementById('deliveryDatePickerContainer');
    if (!container) return;
    
    const hiddenInput = document.getElementById('articleDesiredDelivery');
    const displayDiv = document.getElementById('deliveryDateDisplay');
    const calendarDiv = document.getElementById('deliveryCalendar');
    
    if (!displayDiv || !calendarDiv || !hiddenInput) return;
    
    // Set recommended date by default
    const recommendedDate = getRecommendedDate();
    selectDeliveryDate(recommendedDate);
    
    // Remove old event listener by cloning and replacing (to avoid duplicates)
    const newDisplayDiv = displayDiv.cloneNode(true);
    displayDiv.parentNode.replaceChild(newDisplayDiv, displayDiv);
    
    // Toggle calendar on click
    newDisplayDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = calendarDiv.classList.contains('is-open');
        
        if (isVisible) {
            closeCalendar();
        } else {
            openCalendar();
        }
    });
    
    // Close calendar when clicking outside (use a named function to avoid duplicates)
    if (!window._deliveryCalendarClickHandler) {
        window._deliveryCalendarClickHandler = (e) => {
            const currentContainer = document.getElementById('deliveryDatePickerContainer');
            if (currentContainer && !currentContainer.contains(e.target)) {
                closeCalendar();
            }
        };
        document.addEventListener('click', window._deliveryCalendarClickHandler);
    }
    
    // Allow Escape key to close the calendar
    if (!window._deliveryCalendarKeyHandler) {
        window._deliveryCalendarKeyHandler = (e) => {
            if (e.key === 'Escape') {
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

function openCalendar() {
    const calendarDiv = document.getElementById('deliveryCalendar');
    if (!calendarDiv) return;
    
    generateCalendar(currentCalendarDate);
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

// Generate calendar grid
function generateCalendar(startDate) {
    const calendarDiv = document.getElementById('deliveryCalendar');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    currentCalendarDate = new Date(startDate);
    
    const hiddenInput = document.getElementById('articleDesiredDelivery');
    const selectedDate = hiddenInput ? hiddenInput.value : '';
    const recommendedDate = getRecommendedDate();
    
    let html = '<div class="delivery-calendar-content">';
    
    // Quick selection buttons
    html += '<div class="delivery-quick-buttons">';
    html += '<button type="button" class="delivery-quick-btn" onclick="selectRecommendedDate(event)" aria-label="Selecteer eerst beschikbare datum"><span aria-hidden="true">★</span> Eerst beschikbare</button>';
    html += '</div>';
    
    // Calendar header with navigation
    const displayMonth = startDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
    html += '<div class="delivery-calendar-header">';
    html += '<button type="button" class="calendar-nav" onclick="navigateCalendar(-1, event)" aria-label="Vorige maand"><span aria-hidden="true">&lsaquo;</span></button>';
    html += '<span class="calendar-month" aria-live="polite">' + displayMonth + '</span>';
    html += '<button type="button" class="calendar-nav" onclick="navigateCalendar(1, event)" aria-label="Volgende maand"><span aria-hidden="true">&rsaquo;</span></button>';
    html += '</div>';
    
    // Day headers
    html += '<div class="delivery-calendar-grid">';
    const dayHeaders = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
    dayHeaders.forEach(day => {
        html += `<div class="delivery-day-header">${day}</div>`;
    });
    
    // Get first day of month (Monday = 0, Sunday = 6)
    const firstDay = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    let firstDayOfWeek = firstDay.getDay() - 1;
    if (firstDayOfWeek === -1) firstDayOfWeek = 6;
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDayOfWeek; i++) {
        html += '<div class="delivery-day-cell empty"></div>';
    }
    
    // Add days of the month
    const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(startDate.getFullYear(), startDate.getMonth(), day);
        const dateStr = date.toISOString().split('T')[0];
        const isAvailable = isDeliveryAvailable(date);
        const isPast = date < today;
        const isRecommended = date.getTime() === recommendedDate.getTime();
        const isSelected = dateStr === selectedDate;
        const dayName = formatDateShort(date);
        const dayLabel = formatDeliveryDate(date);
        const ariaParts = [dayLabel];
        
        let cellClass = 'delivery-day-cell';
        if (isPast) {
            cellClass += ' past';
            ariaParts.push('verlopen datum');
        } else if (!isAvailable) {
            cellClass += ' unavailable';
            ariaParts.push('niet beschikbaar');
        } else if (isSelected) {
            cellClass += ' selected';
            ariaParts.push('geselecteerd');
        } else if (isRecommended) {
            cellClass += ' recommended';
            ariaParts.push('aanbevolen');
        } else {
            cellClass += ' available';
            ariaParts.push('beschikbaar');
        }
        
        const cellAttributes = [];
        if (isAvailable && !isPast) {
            cellAttributes.push(`role="button"`);
            cellAttributes.push(`tabindex="0"`);
            cellAttributes.push(`onclick="selectDeliveryDateByString('${dateStr}', event)"`);
            cellAttributes.push(`onkeydown="handleDayCellKeydown(event, '${dateStr}')"`);
        }
        cellAttributes.push(`title="${dayLabel}"`);
        cellAttributes.push(`aria-label="${ariaParts.join(' - ')}"`);
        
        html += `<div class="${cellClass}" ${cellAttributes.join(' ')}>`;
        html += `<div class="day-number">${day}</div>`;
        html += `<div class="day-name">${dayName}</div>`;
        if (isRecommended && !isSelected) {
            html += '<div class="day-badge recommended-badge" aria-hidden="true">Aanr.</div>';
        }
        if (!isAvailable && !isPast) {
            html += '<div class="day-badge unavailable-badge" aria-hidden="true">X</div>';
        }
        html += '</div>';
    }
    
    html += '</div>'; // Close grid
    html += '</div>'; // Close content
    
    calendarDiv.innerHTML = html;
}

// Navigate calendar months
let currentCalendarDate = new Date();
function navigateCalendar(direction, event) {
    if (event) {
        event.stopPropagation();
    }
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    generateCalendar(currentCalendarDate);
}

// Select delivery date
function selectDeliveryDate(date) {
    const hiddenInput = document.getElementById('articleDesiredDelivery');
    const displayDiv = document.getElementById('deliveryDateDisplay');
    
    const dateStr = date.toISOString().split('T')[0];
    hiddenInput.value = dateStr;
    displayDiv.textContent = formatDeliveryDate(date);
    displayDiv.classList.add('selected');
    
    closeCalendar();
}

// Select date by string (called from calendar)
function selectDeliveryDateByString(dateStr, event) {
    if (event) {
        event.stopPropagation();
    }
    const date = new Date(dateStr + 'T12:00:00');
    selectDeliveryDate(date);
}

function handleDayCellKeydown(event, dateStr) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectDeliveryDateByString(dateStr);
    }
}

// Quick selection functions
function selectRecommendedDate(event) {
    if (event) {
        event.stopPropagation();
    }
    const date = getRecommendedDate();
    selectDeliveryDate(date);
}

function selectNextWeek() {
    const today = new Date();
    let date = new Date(today);
    date.setDate(date.getDate() + 7);
    
    // Find next available delivery date from that point
    while (!isDeliveryAvailable(date)) {
        date.setDate(date.getDate() + 1);
    }
    
    selectDeliveryDate(date);
}

function selectTwoWeeks() {
    const today = new Date();
    let date = new Date(today);
    date.setDate(date.getDate() + 14);
    
    // Find next available delivery date from that point
    while (!isDeliveryAvailable(date)) {
        date.setDate(date.getDate() + 1);
    }
    
    selectDeliveryDate(date);
}
