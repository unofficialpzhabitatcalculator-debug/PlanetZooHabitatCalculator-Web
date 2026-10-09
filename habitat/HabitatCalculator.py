import json
import os

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "..", "data", "species_json")

class HabitatCalculator:
    def __init__(self, species_name):
        self.species_name = species_name
        self.data = self.load_species_json(species_name)

    # ---------------------------------------------------------
    # LOAD JSON
    # ---------------------------------------------------------
    def load_species_json(self, species_name):
        safe_name = species_name.replace("/", "_").replace("\\", "_")
        path = os.path.join(DATA_DIR, f"{safe_name}.json")

        if not os.path.exists(path):
            raise FileNotFoundError(f"Species JSON not found: {path}")

        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    # ---------------------------------------------------------
    # HABITAT REQUIREMENTS
    # ---------------------------------------------------------
    def compute_habitat_requirements(self):
        d = self.data

        land = {
            "base": d.get("LAND_BASE_M2", 0),
            "adult": d.get("LAND_PER_ADULT_M2", 0),
            "juvenile": d.get("LAND_PER_JUV_M2", 0)
        }

        water = {
            "base": d.get("WATER_BASE_M2", 0),
            "adult": d.get("WATER_PER_ADULT_M2", 0),
            "juvenile": d.get("WATER_PER_JUV_M2", 0)
        }

        deep_water = {
            "base": d.get("DEEP_WATER_BASE_M2", 0),
            "adult": d.get("DEEP_WATER_PER_ADULT_M2", 0),
            "juvenile": d.get("DEEP_WATER_PER_JUV_M2", 0)
        }

        climb = {
            "base": d.get("CLIMB_BASE_M2", 0),
            "adult": d.get("CLIMB_PER_ADULT_M2", 0),
            "juvenile": d.get("CLIMB_PER_JUV_M2", 0)
        }

        return {
            "land": land,
            "water": water,
            "deep_water": deep_water,
            "climb": climb
        }

    # ---------------------------------------------------------
    # TERRAIN REQUIREMENTS
    # ---------------------------------------------------------
    def compute_terrain(self):
        d = self.data

        terrain = {
            "ShortGrass": {
                "min": d.get("ShortGrass_Min", 0),
                "max": d.get("ShortGrass_Max", 0)
            },
            "LongGrass": {
                "min": d.get("LongGrass_Min", 0),
                "max": d.get("LongGrass_Max", 0)
            },
            "Soil": {
                "min": d.get("Soil_Min", 0),
                "max": d.get("Soil_Max", 0)
            },
            "Rock": {
                "min": d.get("Rock_Min", 0),
                "max": d.get("Rock_Max", 0)
            },
            "Sand": {
                "min": d.get("Sand_Min", 0),
                "max": d.get("Sand_Max", 0)
            },
            "Snow": {
                "min": d.get("Snow_Min", 0),
                "max": d.get("Snow_Max", 0)
            }
        }

        return terrain

    # ---------------------------------------------------------
    # BIOME COMPATIBILITY
    # ---------------------------------------------------------
    def compute_biomes(self):
        d = self.data

        biomes = []
        for key in ["BIOME_1", "BIOME_2", "BIOME_3", "BIOME_4", "BIOME_5"]:
            val = d.get(key)
            if val not in (None, "", "None"):
                biomes.append(val)

        return biomes

    # ---------------------------------------------------------
    # GROUP SIZE RULES
    # ---------------------------------------------------------
    def compute_group_sizes(self):
        d = self.data

        return {
            "group_min": d.get("GROUP_MIN", 1),
            "group_max": d.get("GROUP_MAX", 1),
            "bachelor_male_max": d.get("BACHELOR_MALE_MAX", None),
            "bachelor_female_max": d.get("BACHELOR_FEMALE_MAX", None),
            "mixed_male_max": d.get("MIXED_MALE_MAX", None),
            "mixed_female_max": d.get("MIXED_FEMALE_MAX", None)
        }

    # ---------------------------------------------------------
    # BARRIER REQUIREMENTS
    # ---------------------------------------------------------
    def compute_barrier(self):
        d = self.data

        return {
            "grade": d.get("BARRIER_GRADE", None),
            "climbproof": d.get("CLIMBPROOF", None),
            "height_m": d.get("BARRIER_HEIGHT_M", None)
        }

    # ---------------------------------------------------------
    # PREDATOR FLAG
    # ---------------------------------------------------------
    def compute_predator(self):
        return bool(self.data.get("PREDATOR", False))

    # ---------------------------------------------------------
    # FULL HABITAT REPORT
    # ---------------------------------------------------------
    def generate_report(self):
        return {
            "species": self.species_name,
            "habitat": self.compute_habitat_requirements(),
            "terrain": self.compute_terrain(),
            "biomes": self.compute_biomes(),
            "group_sizes": self.compute_group_sizes(),
            "barrier": self.compute_barrier(),
            "predator": self.compute_predator(),
            "notes": self.data.get("NOTES", None),
            "enrichment_partners": self.data.get("ENRICHMENT_PARTNERS", None)
        }


# ---------------------------------------------------------
# TEST HARNESS (optional)
# ---------------------------------------------------------
if __name__ == "__main__":
    calc = HabitatCalculator("African Elephant")
    report = calc.generate_report()
    print(json.dumps(report, indent=4))
