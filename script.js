document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.getElementById('app-container');
    let scheduleData = null;
    let isScheduleVisible = false;
    let currentProgramState = {}; // Initialize to ensure the first check always runs
    let lastCheckedHour = -1;     // Initialize to ensure the first check always runs

    // --- Main Execution ---
    fetch('schedule.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(schedule => {
            scheduleData = schedule;

            const simulatedTime = getSimulatedTime();
            const isSimulated = simulatedTime !== null;

            if (isSimulated) {
                document.body.classList.add('simulation-mode');
                const h1 = document.querySelector('#main-header h1');
                if (h1) {
                    h1.innerHTML = '規工看臺員話新聞，模擬時間：<span id="current-time"></span>';
                }
                updateTime(simulatedTime); // Update time with simulated time
            } else {
                updateTime(); // Initial call
                setInterval(updateTime, 1000); // Update every second
            }

            // Set initial content and start periodic checks for updates
            checkAndUpdateContent();

            function scheduleHourlyChecks() {
                // If a test time is specified, don't schedule hourly checks
                if (isSimulated) {
                    console.log("Test time is active, hourly checks are disabled.");
                    return;
                }

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
            if(contentDiv) contentDiv.innerText = '無法度載入節目表。';
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
        const header = document.getElementById('main-header'); // Get the header element

        // --- Click Listeners ---
        sidebar.addEventListener('click', () => toggleScheduleView());
        footer.addEventListener('click', () => toggleScheduleView());
        // It might be confusing to have the header also toggle, so we can omit it unless requested.

        // --- Touch and Mouse Listeners for Swipe/Drag/Wheel ---
        const swipeAreas = [liveView, header]; // Add header to the areas that detect swipes/drags

        swipeAreas.forEach(area => {
            let touchstartY = 0, touchstartX = 0;
            area.addEventListener('touchstart', e => {
                touchstartY = e.changedTouches[0].screenY;
                touchstartX = e.changedTouches[0].screenX;
            }, { passive: true });

            area.addEventListener('touchend', e => {
                const touchendY = e.changedTouches[0].screenY;
                const touchendX = e.changedTouches[0].screenX;
                if (Math.abs(touchendY - touchstartY) > 50 || Math.abs(touchendX - touchstartX) > 50) {
                    toggleScheduleView();
                }
            });

            // Listen for mouse wheel events on desktop
            area.addEventListener('wheel', e => {
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

            area.addEventListener('mousedown', e => {
                isDragging = true;
                dragStartX = e.screenX;
                dragStartY = e.screenY;
            });

            area.addEventListener('mousemove', e => {
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

            area.addEventListener('mouseup', () => {
                isDragging = false;
            });

            area.addEventListener('mouseleave', () => {
                isDragging = false;
            });
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
    function getSimulatedTime() {
        const params = new URLSearchParams(window.location.search);
        const testTime = params.get('test');
        if (testTime && /^[0-2][0-9][0-5][0-9]$/.test(testTime)) {
            const hours = parseInt(testTime.substring(0, 2), 10);
            const minutes = parseInt(testTime.substring(2, 4), 10);
            const simDate = new Date();
            simDate.setHours(hours, minutes, 0, 0); // Set hours and minutes, reset seconds and ms
            return simDate;
        }
        return null;
    }


    function updateTime(forcedTime = null) {
        const timeEl = document.getElementById('current-time');
        if (!timeEl) return;
        const now = forcedTime || new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const date = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        timeEl.innerText = `${year}${month}${date} ${hours}:${minutes}`;
    }

    function findNextProgram(schedule, startDayIndex, startHour) {
        const dayOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        // Start searching from the next hour of the current day
        for (let h = startHour + 1; h < 24; h++) {
            const hourKey = h.toString().padStart(2, '0') + ":00";
            const programs = schedule[dayOfWeek[startDayIndex]]?.[hourKey];
            if (programs && programs.length > 0) {
                return { hour: hourKey, programs: programs };
            }
        }
        // If nothing is found today, search the next 6 days
        for (let i = 1; i < 7; i++) {
            const dayIndex = (startDayIndex + i) % 7;
            const dayKey = dayOfWeek[dayIndex];
            if (schedule[dayKey]) {
                for (let h = 0; h < 24; h++) {
                    const hourKey = h.toString().padStart(2, '0') + ":00";
                    const programs = schedule[dayKey][hourKey];
                    if (programs && programs.length > 0) {
                        return { hour: hourKey, programs: programs };
                    }
                }
            }
        }
        return null; // Return null if no programs are found in the entire week
    }

    function showStandbyScreen() {
        const contentDiv = document.getElementById('content');
        const programInfoEl = document.getElementById('program-info');

        programInfoEl.innerHTML = '這馬無咧播，期待後一个時段。<a href="#" id="listen-music-link">嘛會使聽寡臺灣味音樂</a>';
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

    function showProgramSelection(programs) {
        const contentDiv = document.getElementById('content');
        const programInfoEl = document.getElementById('program-info');

        programInfoEl.innerHTML = '這个時段有多元ê選擇，請點選一个頻道來收看：';
        programInfoEl.style.display = 'block';

        let selectionHTML = '<div class="program-selection-container">';
        programs.forEach(program => {
            selectionHTML += `
                <div class="program-selection-card" data-embed-url="${program.embed_url}" data-live-url="${program.live_url}" data-channel="${program.channel}" data-program-name="${program.program_name}">
                    <h3>${program.program_name}</h3>
                    <p>${program.channel}</p>
                    <button class="watch-button">佇遮看</button>
                    <a href="${program.live_url}" target="_blank" rel="noopener noreferrer" class="official-link-button">去官網看</a>
                </div>
            `;
        });
        selectionHTML += '</div>';
        contentDiv.innerHTML = selectionHTML;

        // Add event listeners to the new buttons
        document.querySelectorAll('.program-selection-card .watch-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const card = e.target.closest('.program-selection-card');
                const program = {
                    embed_url: card.dataset.embedUrl,
                    live_url: card.dataset.liveUrl,
                    channel: card.dataset.channel,
                    program_name: card.dataset.programName
                };
                embedLiveStream(program, programs);
            });
        });
    }

    function updateNextProgramInfo(schedule, dayIndex, hour) {
        const nextProgramSlot = findNextProgram(schedule, dayIndex, hour);
        const nextProgramSpan = document.getElementById('next-program');
        if (nextProgramSlot && nextProgramSlot.programs.length > 0) {
            const programTitles = nextProgramSlot.programs.map(p => `${p.channel} - ${p.program_name}`).join(' | ');
            nextProgramSpan.innerText = `${nextProgramSlot.hour} - ${programTitles}`;
        } else {
            nextProgramSpan.innerText = '這禮拜已經無其他節目。';
        }
    }

    function embedLiveStream(program, allProgramsInSlot = []) {
        const contentDiv = document.getElementById('content');
        const programInfoEl = document.getElementById('program-info');
        
        let headerHTML = '';

        if (allProgramsInSlot.length > 1) {
            const otherProgram = allProgramsInSlot.find(p => p.channel !== program.channel);
            
            // The text for the currently selected program
            const currentProgramHTML = `<span class="program-part program-part-1">${program.channel} - ${program.program_name}，請點放送，嘛會使<a href="${program.live_url}" target="_blank" rel="noopener noreferrer" class="official-link">點去官方頁面</a></span>`;
            
            // The text for the other program, which is a link to switch
            const otherProgramHTML = `<span class="program-part program-part-2"><a href="#" id="switch-channel-link">切換到${otherProgram.channel} - ${otherProgram.program_name}</a></span>`;

            headerHTML = currentProgramHTML + otherProgramHTML;

        } else {
            headerHTML = `${program.channel} - ${program.program_name}，請點放送，嘛會使<a href="${program.live_url}" target="_blank" rel="noopener noreferrer" class="official-link">點去官方頁面</a>`;
        }
        
        programInfoEl.innerHTML = headerHTML;
        programInfoEl.style.display = 'block';

        // Add click listener for the switch link if it exists
        const switchLink = document.getElementById('switch-channel-link');
        if (switchLink) {
            const otherProgram = allProgramsInSlot.find(p => p.channel !== program.channel);
            switchLink.addEventListener('click', (e) => {
                e.preventDefault();
                embedLiveStream(otherProgram, allProgramsInSlot);
            });
        }
        
        contentDiv.innerHTML = ''; // Clear standby content

        if (program.channel === "台視新聞台" || program.channel === "台視主頻") {
            contentDiv.innerHTML = `
                <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; text-align: center; padding: 2rem;">
                    <h2>袂當直接佇遮放送</h2>
                    <p>${program.channel}因為頻道政策因素，無法度直接嵌入放送。</p>
                    <a href="${program.live_url}" target="_blank" rel="noopener noreferrer" style="padding: 1rem 2rem; background-color: #c00; color: white; text-decoration: none; border-radius: 5px; font-size: 1.2rem; margin-top: 1rem;">
                        點遮去官方頁面看
                    </a>
                </div>
            `;
        } else {
            const iframe = document.createElement('iframe');
            iframe.src = program.embed_url;
            iframe.setAttribute('frameborder', '0');
            iframe.setAttribute('allow', 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
            iframe.setAttribute('allowfullscreen', 'true');
            contentDiv.appendChild(iframe);
        }
    }

    function checkAndUpdateContent() {
        if (!scheduleData) return;

        const now = getSimulatedTime() || new Date();
        const dayIndex = now.getDay();
        const hour = now.getHours();
        const dayOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const hourKey = hour.toString().padStart(2, '0') + ":00";
        const targetPrograms = scheduleData[dayOfWeek[dayIndex]]?.[hourKey]; // This is now an array

        // Check if the content has actually changed to prevent unnecessary DOM updates
        if (JSON.stringify(targetPrograms) !== JSON.stringify(currentProgramState) || hour !== lastCheckedHour) {
            console.log(`Updating content for ${hourKey}. Hour changed: ${hour !== lastCheckedHour}`);
            lastCheckedHour = hour;
            currentProgramState = targetPrograms;

            // Update main content view
            if (targetPrograms && targetPrograms.length > 0) {
                // If there is more than one program, show a selection screen.
                if (targetPrograms.length > 1) {
                    showProgramSelection(targetPrograms);
                } else {
                    // If there is only one, embed it directly.
                    embedLiveStream(targetPrograms[0], targetPrograms);
                }
                // If there's a live program, ensure the schedule is hidden by default
                if (isScheduleVisible) {
                    toggleScheduleView(false);
                }
            } else {
                showStandbyScreen();
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
        const daysHeader = ['時間', '禮拜', '拜一', '拜二', '拜三', '拜四', '拜五', '拜六'];
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
                const programs = schedule[dayKeys[dayIndex]]?.[hourKey]; // This is now an array
                
                if (programs && programs.length > 0) {
                    let cellHTML = '';
                    programs.forEach(program => {
                        const channelDisplay = program.live_url
                            ? `<a href="${program.live_url}" target="_blank" rel="noopener noreferrer">⛓️ ${program.channel}</a>`
                            : program.channel;
                        cellHTML += `<div class="program-entry"><div class="program-name">${program.program_name}</div><div class="channel-name">${channelDisplay}</div></div>`;
                    });
                    cell.innerHTML = cellHTML;
                } else {
                    cell.innerHTML = ' - ';
                }

                if (dayIndex === currentDayIndex && hour === currentHour) {
                    cell.classList.add('current-timeslot');
                    // Create a new div for the "這馬" text to control its style independently
                    const nowIndicator = document.createElement('div');
                    nowIndicator.innerHTML = '<b>這馬</b>';
                    nowIndicator.style.textAlign = 'center';
                    nowIndicator.style.fontWeight = 'bold';
                    nowIndicator.style.marginBottom = '5px'; 
                    cell.insertBefore(nowIndicator, cell.firstChild);
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