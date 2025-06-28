document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.getElementById('app-container');
    let scheduleData = null;
    let isScheduleVisible = false;

    // --- Main Execution ---
    fetch('schedule.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(schedule => {
            scheduleData = schedule;
            // Always build the schedule table for later use
            displaySchedule(scheduleData);

            // Start the clock
            updateTime();
            setInterval(updateTime, 1000);

            const now = new Date();
            const dayOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
            const dayIndex = now.getDay();
            const hour = now.getHours();
            const hourKey = hour.toString().padStart(2, '0') + ":00";
            const currentProgram = schedule[dayOfWeek[dayIndex]]?.[hourKey];

            if (currentProgram && currentProgram.url) {
                embedLiveStream(currentProgram, schedule, dayIndex, hour);
                setupViewToggleListeners();
            } else {
                // No program now, show the schedule immediately
                toggleScheduleView(true);
            }
        })
        .catch(error => {
            console.error('Error fetching schedule:', error);
            const contentDiv = document.getElementById('content');
            if(contentDiv) contentDiv.innerText = '無法載入節目表。';
        });

    // --- View Toggling Logic ---
    function toggleScheduleView(forceShow = null) {
        isScheduleVisible = forceShow !== null ? forceShow : !isScheduleVisible;
        appContainer.classList.toggle('show-schedule', isScheduleVisible);
    }

    function setupViewToggleListeners() {
        const sidebar = document.getElementById('sidebar');
        const footer = document.getElementById('main-footer');
        const liveView = document.getElementById('live-view');

        sidebar.addEventListener('click', () => toggleScheduleView());
        footer.addEventListener('click', () => toggleScheduleView());

        // Swipe detection
        let touchstartY = 0;
        let touchstartX = 0;

        liveView.addEventListener('touchstart', e => {
            touchstartY = e.changedTouches[0].screenY;
            touchstartX = e.changedTouches[0].screenX;
        }, { passive: true });

        liveView.addEventListener('touchend', e => {
            const touchendY = e.changedTouches[0].screenY;
            const touchendX = e.changedTouches[0].screenX;
            handleSwipe(touchendY - touchstartY, touchendX - touchstartX);
        });
    }

    function handleSwipe(deltaY, deltaX) {
        // Check for vertical swipe, with more tolerance for vertical than horizontal movement
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 50) { 
            toggleScheduleView();
        }
        // Check for horizontal swipe
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            toggleScheduleView();
        }
    }

    // --- Content Update Functions ---
    function updateTime() {
        const timeEl = document.getElementById('current-time');
        if (!timeEl) return;
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const date = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        timeEl.innerText = `${year}${month}${date} ${hours}:${minutes}`;
    }

    function findNextProgram(schedule, startDayIndex, startHour) {
        const dayOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        let currentDayIndex = startDayIndex;
        for (let h = startHour + 1; h < 24; h++) {
            const hourKey = h.toString().padStart(2, '0') + ":00";
            const dayKey = dayOfWeek[currentDayIndex];
            if (schedule[dayKey]?.[hourKey]) return { hour: hourKey, ...schedule[dayKey][hourKey] };
        }
        for (let i = 1; i < 7; i++) {
            currentDayIndex = (startDayIndex + i) % 7;
            const dayKey = dayOfWeek[currentDayIndex];
            if (schedule[dayKey]) {
                for (let h = 0; h < 24; h++) {
                    const hourKey = h.toString().padStart(2, '0') + ":00";
                    if (schedule[dayKey][hourKey]) return { hour: hourKey, ...schedule[dayKey][hourKey] };
                }
            }
        }
        return null;
    }

    function embedLiveStream(program, schedule, dayIndex, hour) {
        const contentDiv = document.getElementById('content');
        contentDiv.innerHTML = '';
        const iframe = document.createElement('iframe');
        iframe.src = program.url + "?autoplay=1"; // Add autoplay
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allow', 'autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
        iframe.setAttribute('allowfullscreen', 'true');
        contentDiv.appendChild(iframe);

        const nextProgram = findNextProgram(schedule, dayIndex, hour);
        const nextProgramSpan = document.getElementById('next-program');
        if (nextProgram) {
            nextProgramSpan.innerText = `${nextProgram.hour} - ${nextProgram.channel} - ${nextProgram.program_name}`;
        } else {
            nextProgramSpan.innerText = '本週已無其他節目。';
        }
    }

    function displaySchedule(schedule) {
        const container = document.getElementById('schedule-container');
        container.innerHTML = ''; // Clear previous content
        const table = document.createElement('table');
        table.id = 'schedule-table';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const daysHeader = ['時間', '星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        daysHeader.forEach(dayText => {
            const th = document.createElement('th');
            th.innerText = dayText;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        for (let hour = 0; hour < 24; hour++) {
            const row = document.createElement('tr');
            const hourKey = hour.toString().padStart(2, '0') + ":00";
            const timeCell = document.createElement('td');
            timeCell.innerHTML = `<div class="time-slot">${hourKey}</div>`;
            row.appendChild(timeCell);
            for (let i = 0; i < 7; i++) {
                const dayKey = dayKeys[i];
                const cell = document.createElement('td');
                const program = schedule[dayKey]?.[hourKey];
                if (program) {
                    cell.innerHTML = `<div class="program-name">${program.program_name}</div><div class="channel-name">${program.channel}</div>`;
                } else {
                    cell.innerHTML = '-';
                }
                row.appendChild(cell);
            }
            tbody.appendChild(row);
        }
        table.appendChild(tbody);
        container.appendChild(table);
    }
});