document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.getElementById('app-container');
    let scheduleData = null;
    let isScheduleVisible = false;
    let currentProgramState = {}; // Initialize with a non-null value to ensure the first check always runs

    // --- Main Execution ---
    fetch('schedule.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(schedule => {
            scheduleData = schedule;
            // Start the clock
            updateTime();
            setInterval(updateTime, 1000);

            // Set initial content and start periodic checks for updates
            checkAndUpdateContent();

            function scheduleHourlyChecks() {
                const now = new Date();
                // Set target to 5 seconds past the next hour for reliability
                const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 5, 0);
                const msUntilNextHour = nextHour - now;

                console.log(`Next hourly check scheduled in ${Math.round(msUntilNextHour / 1000 / 60)} minutes.`);

                setTimeout(() => {
                    console.log('Performing scheduled hourly content check.');
                    checkAndUpdateContent();
                    // After the first precise check, run every hour thereafter
                    setInterval(checkAndUpdateContent, 3600 * 1000);
                }, msUntilNextHour);
            }
            scheduleHourlyChecks();

            // Always setup the listeners
            setupViewToggleListeners();
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

        // Scroll the current timeslot into view when the schedule is shown
        if (isScheduleVisible) {
            // Use a timeout to allow the CSS transition to start, ensuring the element is visible before scrolling.
            setTimeout(() => {
                const currentTimeslot = document.querySelector('.current-timeslot');
                if (currentTimeslot) {
                    currentTimeslot.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }
            }, 100); // 100ms delay is usually sufficient for the transition to begin.
        }
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

    function showStandbyScreen() {
        const contentDiv = document.getElementById('content');
        const programInfoEl = document.getElementById('program-info');

        programInfoEl.innerHTML = '這馬無咧播，期待後一个時段。<a href="#" id="listen-music-link">嘛會使聽音樂</a>';
        programInfoEl.style.display = 'block';

        const listenLink = document.getElementById('listen-music-link');
        if (listenLink) {
            listenLink.addEventListener('click', (e) => {
                e.preventDefault();
                toggleScheduleView(false);
            });
        }

        contentDiv.innerHTML = `
            <iframe style="border-radius:12px" 
                    src="https://open.spotify.com/embed/playlist/5X2giMLXlE2YWj3ZoRMk3U?utm_source=generator&theme=0" 
                    width="100%" 
                    height="100%" 
                    frameBorder="0" 
                    allowfullscreen="" 
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                    loading="lazy">
            </iframe>`;
    }

    function updateNextProgramInfo(schedule, dayIndex, hour) {
        const nextProgram = findNextProgram(schedule, dayIndex, hour);
        const nextProgramSpan = document.getElementById('next-program');
        if (nextProgram) {
            nextProgramSpan.innerText = `${nextProgram.hour} - ${nextProgram.channel} - ${nextProgram.program_name}`;
        } else {
            nextProgramSpan.innerText = '本週已無其他節目。';
        }
    }

    function embedLiveStream(program) {
        const contentDiv = document.getElementById('content');
        const programInfoEl = document.getElementById('program-info');
        
        programInfoEl.innerHTML = `${program.channel} - ${program.program_name}，請點放送，嘛會使<a href="${program.url}" target="_blank" rel="noopener noreferrer">點去官方頁面</a>`;
        programInfoEl.style.display = 'block';
        
        contentDiv.innerHTML = ''; // Clear standby content

        if (program.channel === "台視新聞台") {
            contentDiv.innerHTML = `
                <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; text-align: center; padding: 2rem;">
                    <h2>無法直接在此播放</h2>
                    <p>台視新聞台因頻道政策因素，無法直接嵌入播放。</p>
                    <a href="${program.url}" target="_blank" rel="noopener noreferrer" style="padding: 1rem 2rem; background-color: #c00; color: white; text-decoration: none; border-radius: 5px; font-size: 1.2rem; margin-top: 1rem;">
                        點此前往官方頁面觀看
                    </a>
                </div>
            `;
        } else {
            const iframe = document.createElement('iframe');
            iframe.src = program.url;
            iframe.setAttribute('frameborder', '0');
            iframe.setAttribute('allow', 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
            iframe.setAttribute('allowfullscreen', 'true');
            contentDiv.appendChild(iframe);
        }
    }

    function checkAndUpdateContent() {
        if (!scheduleData) return;

        const now = new Date();
        const dayIndex = now.getDay();
        const hour = now.getHours();
        const dayOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const hourKey = hour.toString().padStart(2, '0') + ":00";
        const targetProgram = scheduleData[dayOfWeek[dayIndex]]?.[hourKey];

        // A more robust check: compare the program objects directly.
        // JSON.stringify is a simple way to deep-compare the relevant data.
        if (JSON.stringify(targetProgram) !== JSON.stringify(currentProgramState)) {
            console.log(`Updating content for ${hourKey}. New program: ${targetProgram?.program_name || 'Standby'}`);
            
            // Update main content view
            if (targetProgram && targetProgram.url) {
                embedLiveStream(targetProgram);
                currentProgramState = targetProgram;
                // If there's a live program, ensure the schedule is hidden by default
                if (isScheduleVisible) {
                    toggleScheduleView(false);
                }
            } else {
                showStandbyScreen();
                currentProgramState = null;
                // If there's no live program, show the schedule by default
                if (!isScheduleVisible) {
                    toggleScheduleView(true);
                }
            }

            // Update footer with the next program's info
            updateNextProgramInfo(scheduleData, dayIndex, hour);
            
            // Re-draw the schedule to update the 'current-timeslot' highlight
            displaySchedule(scheduleData, dayIndex, hour);
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
                    const channelDisplay = program.url
                        ? `<a href="${program.url}" target="_blank" rel="noopener noreferrer">⛓️ ${program.channel}</a>`
                        : program.channel;
                    cell.innerHTML = `<div class="program-name">${program.program_name}</div><div class="channel-name">${channelDisplay}</div>`;
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