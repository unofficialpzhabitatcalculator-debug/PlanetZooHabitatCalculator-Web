import json
import os

from flask import Flask, jsonify, render_template, request

from habitat.MultiSpeciesHabitatBuilder import MultiSpeciesHabitatBuilder


# =================================================================
# PATHS
# =================================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

SPECIES_DIR = os.path.join(
    BASE_DIR,
    "data",
    "species_json"
)

SPECIES_IMAGE_DIR = os.path.join(
    BASE_DIR,
    "static",
    "images",
    "species"
)

# Known source filenames that differ from the exact Species name.
SPECIES_IMAGE_ALIASES = {
    "Black Rhinoceros": "Black_Rhinceros.jpg",
    "Père David's Deer": "P#U00e8re_David's_Deer.JPG",
    "Colombian White-Faced Capuchin Monkey": "Columbian_White-Faced_Capuchin_Monkey.jpg",
    "European Badger": "European_Badge.jpg",
}


def get_species_image_filename(species_name):
    """Return the existing image filename for a species, or None if unavailable."""
    alias = SPECIES_IMAGE_ALIASES.get(species_name)
    if alias and os.path.isfile(os.path.join(SPECIES_IMAGE_DIR, alias)):
        return alias

    stem = species_name.replace(" ", "_")
    for extension in (".jpg", ".JPG", ".jpeg", ".JPEG", ".png", ".PNG", ".webp", ".WEBP", ".gif", ".GIF"):
        filename = stem + extension
        if os.path.isfile(os.path.join(SPECIES_IMAGE_DIR, filename)):
            return filename

    return None


# =================================================================
# FLASK APP
# =================================================================

app = Flask(__name__)


# =================================================================
# SPECIES DATA
# =================================================================

def load_species():

    species_list = []

    if not os.path.isdir(SPECIES_DIR):

        print(
            f"ERROR: Species directory not found: {SPECIES_DIR}"
        )

        return species_list


    for filename in os.listdir(SPECIES_DIR):

        if not filename.lower().endswith(".json"):
            continue


        if filename.upper() == "UNKNOWN.JSON":
            continue


        path = os.path.join(
            SPECIES_DIR,
            filename
        )


        try:

            with open(
                path,
                "r",
                encoding="utf-8"
            ) as file:

                data = json.load(file)


            species_name = data.get("Species")


            if not species_name:
                continue


            data["name"] = species_name
            data["image_filename"] = get_species_image_filename(species_name)

            species_list.append(data)


        except json.JSONDecodeError as error:

            print(
                f"JSON ERROR in {filename}: {error}"
            )


        except OSError as error:

            print(
                f"FILE ERROR in {filename}: {error}"
            )


    species_list.sort(
        key=lambda animal:
            animal["name"].lower()
    )


    print(
        f"Loaded {len(species_list)} species."
    )


    return species_list


# =================================================================
# ROUTES
# =================================================================

def load_image_credits():
    """Read the supplied attribution file without changing its credit wording."""
    path = os.path.join(BASE_DIR, "static", "images", "species", "_image_credits.txt")
    with open(path, encoding="utf-8-sig") as source:
        blocks = source.read().strip().split("\n\n")
    credits = []
    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if not lines or lines[0].startswith(("Photographer:", "License:", "Source:")):
            continue
        fields = []
        for line in lines[1:]:
            label, separator, value = line.partition(":")
            if separator and value.strip():
                value = value.strip()
                fields.append({"label": label, "value": value,
                               "link": label == "Source" and value.startswith(("https://", "http://"))})
        credits.append({"name": lines[0], "fields": fields})
    return credits


@app.route("/")
def index():

    return render_template(
        "index.html",
        image_credits=load_image_credits()
    )


@app.route("/api/species")
def species_api():

    return jsonify(
        load_species()
    )


@app.route(
    "/api/build-habitat",
    methods=["POST"]
)
def build_habitat_api():

    payload = request.get_json(
        silent=True
    ) or {}


    selections = payload.get(
        "species",
        []
    )


    if not selections:

        return jsonify({
            "error":
                "No species were selected."
        }), 400


    all_species = load_species()


    species_lookup = {
        animal["name"]: animal
        for animal in all_species
    }


    members = []


    for selection in selections:

        species_name = selection.get(
            "name"
        )


        if species_name not in species_lookup:
            continue


        member = dict(
            species_lookup[species_name]
        )


        member["adults"] = max(
            1,
            int(
                selection.get(
                    "adults",
                    1
                )
            )
        )


        member["juveniles"] = max(
            0,
            int(
                selection.get(
                    "juveniles",
                    0
                )
            )
        )


        member["group_type"] = selection.get(
            "groupType",
            "General Group"
        )


        members.append(member)


    if not members:

        return jsonify({
            "error":
                "No valid species were supplied."
        }), 400


    builder = MultiSpeciesHabitatBuilder(
        members
    )


    report = builder.generate_combined_report()


    return jsonify(report)


# =================================================================
# RUN APP
# =================================================================

if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=int(os.environ.get("PORT", "5000")),
        debug=False
    )