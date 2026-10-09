import csv
import json
import os
from datetime import datetime

# ---------------------------------------------------------
# PATH HANDLING — ALWAYS CORRECT, NO MATTER WHERE YOU RUN IT
# ---------------------------------------------------------
BASE_DIR = os.path.dirname(__file__)
DATA_FOLDER = BASE_DIR

CSV_FILE = os.path.join(DATA_FOLDER, "DataSheet.csv")
SCHEMA_FILE = os.path.join(DATA_FOLDER, "species_schema.txt")  # optional
TEMPLATE_FILE = os.path.join(DATA_FOLDER, "species_template.json")  # optional
OUTPUT_FOLDER = os.path.join(DATA_FOLDER, "species_json")
LOG_FILE = os.path.join(DATA_FOLDER, "extraction_log.txt")

# Ensure output folder exists
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# ---------------------------------------------------------
# LOGGING
# ---------------------------------------------------------
def log(msg):
    timestamp = datetime.now().strftime("[%Y-%m-%d %H:%M:%S]")
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"{timestamp} {msg}\n")
    print(msg)

# ---------------------------------------------------------
# CRITICAL COLUMNS (Flexible Mode)
# ---------------------------------------------------------
CRITICAL_COLUMNS = [
    "Species","TEMP_MIN_C","TEMP_MAX_C",
    "LAND_BASE_M2","LAND_PER_ADULT_M2","LAND_PER_JUV_M2",
    "WATER_BASE_M2","WATER_PER_ADULT_M2","WATER_PER_JUV_M2",
    "DEEP_WATER_BASE_M2","DEEP_WATER_PER_ADULT_M2","DEEP_WATER_PER_JUV_M2",
    "CLIMB_BASE_M2","CLIMB_PER_ADULT_M2","CLIMB_PER_JUV_M2",
    "BARRIER_GRADE","CLIMBPROOF","BARRIER_HEIGHT_M",
    "BIOME_1","BIOME_2","BIOME_3","BIOME_4","BIOME_5",
    "GROUP_MIN","GROUP_MAX",
    "BACHELOR_MALE_MAX","BACHELOR_FEMALE_MAX",
    "MIXED_MALE_MAX","MIXED_FEMALE_MAX",
    "ShortGrass_Min","ShortGrass_Max",
    "LongGrass_Min","LongGrass_Max",
    "Soil_Min","Soil_Max",
    "Rock_Min","Rock_Max",
    "Sand_Min","Sand_Max",
    "Snow_Min","Snow_Max",
    "ENRICHMENT_PARTNERS","NOTES","PREDATOR"
]

# ---------------------------------------------------------
# SANITY CHECK (Flexible Mode)
# ---------------------------------------------------------
def sanity_check(headers):
    missing = [col for col in CRITICAL_COLUMNS if col not in headers]

    if missing:
        log(f"WARNING: Missing critical columns (flexible mode): {missing}")
        log("Continuing extraction anyway...")
    else:
        log("All critical columns present.")

    return True  # ALWAYS continue in flexible mode

# ---------------------------------------------------------
# LOAD CSV
# ---------------------------------------------------------
def load_csv():
    with open(CSV_FILE, "r", encoding="utf-8") as f:
        raw = f.read()

    # Strip BOM if present
    raw = raw.replace("\ufeff", "").replace("ï»¿", "")

    # Re-parse after cleaning
    lines = raw.splitlines()
    header_line = lines[0]

    # Remove trailing commas (empty columns)
    while header_line.endswith(","):
        header_line = header_line[:-1]

    # Rebuild cleaned CSV text
    cleaned_csv = "\n".join([header_line] + lines[1:])

    # Parse cleaned CSV
    reader = csv.DictReader(cleaned_csv.splitlines())
    headers = reader.fieldnames

    log(f"CSV loaded with {len(headers)} columns (cleaned).")
    sanity_check(headers)

    rows = list(reader)
    log(f"CSV contains {len(rows)} species rows.")
    return rows

# ---------------------------------------------------------
# MAP ROW → JSON (Option A: exact field names)
# ---------------------------------------------------------
def map_row_to_json(row):
    # Direct pass-through of all CSV fields
    species_json = {}

    for key, value in row.items():
        # Convert empty strings to None
        if value == "":
            species_json[key] = None
        else:
            # Try numeric conversion
            try:
                if "." in value:
                    species_json[key] = float(value)
                else:
                    species_json[key] = int(value)
            except:
                species_json[key] = value  # leave as string

    return species_json

# ---------------------------------------------------------
# WRITE JSON
# ---------------------------------------------------------
def write_json(species_name, data):
    safe_name = species_name.replace("/", "_").replace("\\", "_")
    out_path = os.path.join(OUTPUT_FOLDER, f"{safe_name}.json")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

    log(f"JSON written: {safe_name}.json")

# ---------------------------------------------------------
# MAIN EXTRACTION
# ---------------------------------------------------------
def run_extraction():
    log("----------------------------------------")
    log("START EXTRACTION")
    log("----------------------------------------")

    rows = load_csv()

    count = 0
    for row in rows:
        species_name = row.get("Species", "UNKNOWN")

        mapped = map_row_to_json(row)
        write_json(species_name, mapped)
        count += 1

    log("----------------------------------------")
    log(f"EXTRACTION COMPLETE — {count} species processed.")
    log("----------------------------------------")

# ---------------------------------------------------------
# EXECUTE
# ---------------------------------------------------------
if __name__ == "__main__":
    run_extraction()
