document.addEventListener('DOMContentLoaded', () => {
    fetch('schedule.json')
        .then(response => response.json())
        .then(schedule => {
            const now = new Date();
            const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const day = dayOfWeek[now.getDay()];
            const hour = now.getHours();

            const currentProgram = schedule[day] ? schedule[day][hour] : null;

            const contentDiv = document.getElementById('content');

            if (currentProgram && currentProgram.url) {
                // Embed YouTube live stream
                const iframe = document.createElement('iframe');
                iframe.src = currentProgram.url;
                iframe.setAttribute('frameborder', '0');
                iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
                iframe.setAttribute('allowfullscreen', 'true');
                contentDiv.appendChild(iframe);
            } else {
                // Display the full schedule
                displaySchedule(schedule);
            }
        })
        .catch(error => {
            console.error('Error fetching schedule:', error);
            document.getElementById('content').innerText = '無法載入節目表。';
        });
});

function displaySchedule(schedule) {
    const contentDiv = document.getElementById('content');
    const table = document.createElement('table');
    table.id = 'schedule-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const daysHeader = ['時間', '星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    daysHeader.forEach(day => {
        const th = document.createElement('th');
        th.innerText = day;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const dayKeys = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    for (let hour = 0; hour < 24; hour++) {
        const row = document.createElement('tr');
        const timeCell = document.createElement('td');
        timeCell.innerHTML = `<div class="time-slot">${hour.toString().padStart(2, '0')}:00</div>`;
        row.appendChild(timeCell);

        for (let i = 0; i < 7; i++) {
            const dayKey = dayKeys[i];
            const cell = document.createElement('td');
            const program = schedule[dayKey] ? schedule[dayKey][hour] : null;
            if (program) {
                cell.innerHTML = `<div class="program-name">${program.program_name}</div><div class="channel-name">${program.channel_name}</div>`;
            } else {
                cell.innerHTML = '-';
            }
            row.appendChild(cell);
        }
        tbody.appendChild(row);
    }
    table.appendChild(tbody);

    contentDiv.innerHTML = ''; // Clear previous content
    contentDiv.appendChild(table);
}