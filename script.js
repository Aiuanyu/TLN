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
            const now = new Date();
            const dayIndex = now.getDay();
            const hour = now.getHours();

            // Always build the schedule table for later use and highlight the current time
            displaySchedule(scheduleData, dayIndex, hour);

            // Start the clock
            updateTime();
            setInterval(updateTime, 1000);

            const dayOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
            const hourKey = hour.toString().padStart(2, '0') + ":00";
            const currentProgram = schedule[dayOfWeek[dayIndex]]?.[hourKey];

            if (currentProgram && currentProgram.url) {
                embedLiveStream(currentProgram, schedule, dayIndex, hour);
                setupViewToggleListeners();
            } else {
                toggleScheduleView(true); // No program now, show the schedule immediately
            }
            
            // Setup listeners to close the schedule view
            setupCloseListeners();
        })
        .catch(error => {
            console.error('Error fetching schedule:', error);
            const contentDiv = document.getElementById('content');
            if(contentDiv) contentDiv.innerText = '無法載入節目表。';
        });

    // --- View Toggling and Closing Logic ---
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

        let touchstartY = 0, touchstartX = 0;
        liveView.addEventListener('touchstart', e => {
            touchstartY = e.changedTouches[0].screenY;
            touchstartX = e.changedTouches[0].screenX;
        }, { passive: true });

        liveView.addEventListener('touchend', e => {
            const touchendY = e.changedTouches[0].screenY;
            const touchendX = e.changedTouches[0].screenX;
            if (Math.abs(touchendY - touchstartY) > 50 || Math.abs(touchendX - touchstartX) > 50) {
                toggleScheduleView();
            }
        });

        // Listen for mouse wheel events on desktop
        liveView.addEventListener('wheel', e => {
            // Check for significant movement in either X or Y direction
            if (Math.abs(e.deltaY) > 1 || Math.abs(e.deltaX) > 1) {
                e.preventDefault(); // Prevent the page from scrolling
                toggleScheduleView();
            }
        }, { passive: false });

        // Listen for mouse drag events on desktop
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;

        liveView.addEventListener('mousedown', e => {
            isDragging = true;
            dragStartX = e.screenX;
            dragStartY = e.screenY;
        });

        liveView.addEventListener('mousemove', e => {
            if (isDragging) {
                const deltaX = e.screenX - dragStartX;
                const deltaY = e.screenY - dragStartY;
                // Use a lower threshold for drag detection
                if (Math.abs(deltaX) > 30 || Math.abs(deltaY) > 30) {
                    isDragging = false; // Stop tracking after the first trigger
                    toggleScheduleView();
                }
            }
        });

        liveView.addEventListener('mouseup', () => {
            isDragging = false;
        });

        liveView.addEventListener('mouseleave', () => {
            isDragging = false;
        });
    }

    function setupCloseListeners() {
        const closeBtn = document.getElementById('close-schedule-btn');
        closeBtn.addEventListener('click', () => toggleScheduleView(false));

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isScheduleVisible) {
                toggleScheduleView(false);
            }
        });
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
        for (let h = startHour + 1; h < 24; h++) {
            const hourKey = h.toString().padStart(2, '0') + ":00";
            if (schedule[dayOfWeek[startDayIndex]]?.[hourKey]) return { hour: hourKey, ...schedule[dayOfWeek[startDayIndex]][hourKey] };
        }
        for (let i = 1; i < 7; i++) {
            const dayIndex = (startDayIndex + i) % 7;
            const dayKey = dayOfWeek[dayIndex];
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
        iframe.src = program.url;
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allow', 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
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

    function displaySchedule(schedule, currentDayIndex, currentHour) {
        const container = document.getElementById('schedule-container');
        container.innerHTML = '';
        const table = document.createElement('table');
        table.id = 'schedule-table';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const daysHeader = ['時間', '星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        daysHeader.forEach(dayText => headerRow.appendChild(Object.assign(document.createElement('th'), { innerText: dayText })));
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        for (let hour = 0; hour < 24; hour++) {
            const row = document.createElement('tr');
            const hourKey = hour.toString().padStart(2, '0') + ":00";
            row.appendChild(Object.assign(document.createElement('td'), { innerHTML: `<div class="time-slot">${hourKey}</div>` }));
            
            for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
                const cell = document.createElement('td');
                const program = schedule[dayKeys[dayIndex]]?.[hourKey];
                
                if (program) {
                    cell.innerHTML = `<div class="program-name">${program.program_name}</div><div class="channel-name">${program.channel}</div>`;
                } else {
                    cell.innerHTML = ' - ';
                }

                if (dayIndex === currentDayIndex && hour === currentHour) {
                    cell.classList.add('current-timeslot');
                    cell.innerHTML = `<b>這馬</b><br>` + cell.innerHTML;
                    cell.addEventListener('click', () => toggleScheduleView(false));
                }
                row.appendChild(cell);
            }
            tbody.appendChild(row);
        }
        table.appendChild(tbody);
        container.appendChild(table);
    }
});