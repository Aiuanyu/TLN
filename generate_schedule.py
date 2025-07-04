
import csv
import json
import os
import re

def convert_to_embed_url(url):
    """Converts a YouTube /live/ or /watch URL to an /embed/ URL."""
    if url is None:
        return None
    # Check if it's already an embed URL
    if "/embed/" in url:
        return url
    
    # Regex to find video ID from /live/ or /watch?v=
    match = re.search(r"(youtube\.com/live/|youtube\.com/watch\?v=)([a-zA-Z0-9_-]+)", url)
    if match:
        video_id = match.group(2)
        return f"https://www.youtube.com/embed/{video_id}"
    
    # Return original URL if no match is found (for non-YouTube links like 4gtv)
    return url

# Get the directory where the script is located to build absolute paths
script_dir = os.path.dirname(os.path.abspath(__file__))
urls_csv_path = os.path.join(script_dir, "URLs.csv")
raw_table_csv_path = os.path.join(script_dir, "rawTable.csv")
output_json_path = os.path.join(script_dir, "schedule.json")
urls_csv_path = os.path.join(script_dir, "URLs.csv")
raw_table_csv_path = os.path.join(script_dir, "rawTable.csv")
output_json_path = os.path.join(script_dir, "schedule.json")

# --- 1. Load Data & Create URL Mapping ---
try:
    with open(urls_csv_path, mode='r', encoding='utf-8') as infile:
        reader = csv.reader(infile)
        next(reader)  # Skip header
        # url_map now stores a dictionary for each channel
        url_map = {
            rows[0].strip(): {
                "live_url": rows[1].strip(),
                "embed_url": rows[2].strip() if len(rows) > 2 else convert_to_embed_url(rows[1].strip())
            }
            for rows in reader
        }

    with open(raw_table_csv_path, mode='r', encoding='utf-8') as infile:
        reader = csv.reader(infile)
        next(reader) # Skip header
        raw_data = list(reader)

except FileNotFoundError as e:
    print(f"Error: Could not find a required CSV file. Make sure 'URLs.csv' and 'rawTable.csv' are in the same directory as the script.")
    print(f"Details: {e}")
    exit(1)


# --- 2. Initialize Schedule Structure ---
days_of_week = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
# New structure: Use a dictionary with "HH:00" keys
schedule = {day: {f"{h:02d}:00": None for h in range(24)} for day in days_of_week}

# --- Helper Functions ---




# --- 3. Populate Schedule from rawTable.csv ---
for row in raw_data:
    if not row: continue # Skip empty rows
    start_time_str, day_category, program_name, channels_str = row
    
    try:
        hour = int(start_time_str.split(':')[0])
        time_key = f"{hour:02d}:00"
    except (ValueError, IndexError):
        print(f"Warning: Skipping row due to invalid time format: {row}")
        continue

    # Handles both CJK '、' and standard ',' as separators
    channels = channels_str.replace('、', ',').split(',')
    programs_in_slot = []

    for channel_name in channels:
        channel_name = channel_name.strip()
        if channel_name in url_map:
            program_info = {
                "program_name": program_name.strip(),
                "channel": channel_name,
                "live_url": url_map[channel_name].get("live_url"),
                "embed_url": url_map[channel_name].get("embed_url")
            }
            programs_in_slot.append(program_info)
        else:
            print(f"Warning: Channel '{channel_name}' for program '{program_name.strip()}' not found in URLs.csv. Skipping this channel.")

    # If no valid channels were found for this row, skip it.
    if not programs_in_slot:
        continue

    target_days = []
    if day_category == "每天":
        target_days = days_of_week
    elif day_category == "平日":
        target_days = days_of_week[:5]
    elif day_category == "週末":
        target_days = days_of_week[5:]
    elif day_category == "週六":
        target_days = ["saturday"]
    elif day_category == "週日":
        target_days = ["sunday"]

    for day in target_days:
        if time_key in schedule[day]:
            # If there's already a program, convert it to a list before appending
            if schedule[day][time_key] is None:
                schedule[day][time_key] = [] # Start with an empty list
            schedule[day][time_key].extend(programs_in_slot)

# --- 4. (REMOVED) Fill Gaps Logic is no longer needed ---
# Empty slots will remain None (null in JSON) by default.

# --- 5. Generate and Write JSON ---
try:
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(schedule, f, indent=2, ensure_ascii=False)
    print(f"Successfully generated '{output_json_path}' with embed URLs.")
except IOError as e:
    print(f"Error: Could not write to '{output_json_path}'.")
    print(f"Details: {e}")
    exit(1)
