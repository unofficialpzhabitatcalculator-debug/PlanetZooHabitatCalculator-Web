class MultiSpeciesHabitatBuilder:

    def __init__(self, members):
        self.members = members


    # =============================================================
    # AREA REQUIREMENTS
    # =============================================================

    def compute_area(
        self,
        base_key,
        adult_key,
        juv_key
    ):

        eligible = [
            member
            for member in self.members
            if (
                member.get(base_key) is not None
                and float(member[base_key]) > 0
            )
        ]


        if not eligible:
            return None


        owner = max(
            eligible,
            key=lambda member:
                float(member[base_key])
        )


        total = float(
            owner[base_key]
        )


        # Increments are calculated across ALL selected species,
        # including species without a BASE value for this category.

        for member in self.members:

            adults = int(
                member.get(
                    "adults",
                    0
                )
            )

            juveniles = int(
                member.get(
                    "juveniles",
                    0
                )
            )


            adult_add = float(
                member.get(
                    adult_key
                ) or 0
            )

            juvenile_add = float(
                member.get(
                    juv_key
                ) or 0
            )


            # The BASE includes the first adult
            # of the species owning the highest BASE.

            if member is owner:

                adults = max(
                    0,
                    adults - 1
                )


            total += (
                adults *
                adult_add
            )

            total += (
                juveniles *
                juvenile_add
            )


        return total


    def compute_all_areas(self):

        return {

            "land_m2":
                self.compute_area(
                    "LAND_BASE_M2",
                    "LAND_PER_ADULT_M2",
                    "LAND_PER_JUV_M2"
                ),

            "water_m2":
                self.compute_area(
                    "WATER_BASE_M2",
                    "WATER_PER_ADULT_M2",
                    "WATER_PER_JUV_M2"
                ),

            "deep_water_m2":
                self.compute_area(
                    "DEEP_WATER_BASE_M2",
                    "DEEP_WATER_PER_ADULT_M2",
                    "DEEP_WATER_PER_JUV_M2"
                ),

            "climb_m2":
                self.compute_area(
                    "CLIMB_BASE_M2",
                    "CLIMB_PER_ADULT_M2",
                    "CLIMB_PER_JUV_M2"
                )
        }


    # =============================================================
    # TERRAIN INTERSECTION
    # =============================================================

    def compute_terrain_requirements(self):

        terrain_keys = {

            "Short Grass": (
                "ShortGrass_Min",
                "ShortGrass_Max"
            ),

            "Long Grass": (
                "LongGrass_Min",
                "LongGrass_Max"
            ),

            "Soil": (
                "Soil_Min",
                "Soil_Max"
            ),

            "Rock": (
                "Rock_Min",
                "Rock_Max"
            ),

            "Sand": (
                "Sand_Min",
                "Sand_Max"
            ),

            "Snow": (
                "Snow_Min",
                "Snow_Max"
            )
        }


        requirements = {}

        incompatible = []


        for terrain_name, keys in terrain_keys.items():

            min_key, max_key = keys


            minimum = max(
                float(
                    member[min_key]
                )
                for member in self.members
            )


            maximum = min(
                float(
                    member[max_key]
                )
                for member in self.members
            )


            viable = (
                minimum <= maximum
            )


            requirements[
                terrain_name
            ] = {

                "min":
                    minimum,

                "max":
                    maximum,

                "viable":
                    viable
            }


            if not viable:

                incompatible.append(
                    terrain_name
                )


        minimum_total = sum(
            value["min"]
            for value
            in requirements.values()
        )


        minimum_total_viable = (
            minimum_total <= 100
        )


        return {

            "requirements":
                requirements,

            "minimum_total":
                minimum_total,

            "minimum_total_viable":
                minimum_total_viable,

            "incompatible_terrain":
                incompatible,

            "viable":
                not incompatible
                and minimum_total_viable
        }


    # =============================================================
    # BIOME INTERSECTION
    # =============================================================

    def compute_biome_overlap(self):

        biome_sets = []


        for member in self.members:

            biomes = set()


            for index in range(
                1,
                6
            ):

                biome = member.get(
                    f"BIOME_{index}"
                )


                if biome:

                    biomes.add(
                        biome
                    )


            biome_sets.append(
                biomes
            )


        if not biome_sets:
            return []


        overlap = biome_sets[0]


        for biomes in biome_sets[1:]:

            overlap &= biomes


        return sorted(
            overlap
        )


    # =============================================================
    # TEMPERATURE INTERSECTION
    # =============================================================

    def compute_temperature_overlap(self):

        mins = [
            float(
                member["TEMP_MIN_C"]
            )
            for member in self.members
            if member.get(
                "TEMP_MIN_C"
            ) is not None
        ]


        maxs = [
            float(
                member["TEMP_MAX_C"]
            )
            for member in self.members
            if member.get(
                "TEMP_MAX_C"
            ) is not None
        ]


        if not mins or not maxs:

            return {

                "min":
                    None,

                "max":
                    None,

                "viable":
                    False
            }


        shared_min = max(
            mins
        )

        shared_max = min(
            maxs
        )


        return {

            "min":
                shared_min,

            "max":
                shared_max,

            "viable":
                shared_min <= shared_max
        }


    # =============================================================
    # GROUP SIZE / POPULATION RULES
    # =============================================================

    def compute_group_size_rules(self):

        rules = []


        for member in self.members:

            rules.append({

                "name":
                    member["name"],

                "group_type":
                    member.get(
                        "group_type",
                        "General Group"
                    ),

                "group_min":
                    member.get(
                        "GROUP_MIN"
                    ),

                "group_max":
                    member.get(
                        "GROUP_MAX"
                    ),

                "bachelor_male_max":
                    member.get(
                        "BACHELOR_MALE_MAX"
                    ),

                "bachelor_female_max":
                    member.get(
                        "BACHELOR_FEMALE_MAX"
                    ),

                "mixed_male_max":
                    member.get(
                        "MIXED_MALE_MAX"
                    ),

                "mixed_female_max":
                    member.get(
                        "MIXED_FEMALE_MAX"
                    ),

                "adults":
                    int(
                        member.get(
                            "adults",
                            0
                        )
                    ),

                "juveniles":
                    int(
                        member.get(
                            "juveniles",
                            0
                        )
                    )
            })


        return rules


    # =============================================================
    # PREDATOR IDENTIFICATION
    # =============================================================

    def compute_predator_check(self):

        predators = [
            member["name"]
            for member in self.members
            if str(
                member.get(
                    "PREDATOR"
                ) or ""
            ).upper() == "YES"
        ]


        incompatible = (
            len(self.members) > 1
            and bool(predators)
        )


        return {

            "predators_present":
                bool(predators),

            "predator_species":
                predators,

            "incompatible":
                incompatible
        }


    # =============================================================
    # BARRIER REQUIREMENTS
    # =============================================================

    def compute_barrier_requirements(self):

        grades = [
            int(
                member[
                    "BARRIER_GRADE"
                ]
            )
            for member in self.members
            if member.get(
                "BARRIER_GRADE"
            ) is not None
        ]


        heights = [
            float(
                member[
                    "BARRIER_HEIGHT_M"
                ]
            )
            for member in self.members
            if member.get(
                "BARRIER_HEIGHT_M"
            ) is not None
        ]


        climbproof = any(

            str(
                member.get(
                    "CLIMBPROOF"
                ) or ""
            ).upper() == "YES"

            for member in self.members
        )


        # Water barrier information remains calculated
        # in the backend but is NOT displayed in V1.
        #
        # Every selected species must explicitly have
        # WATER_BARRIER == "YES" to be eligible.

        water_eligible = all(

            str(
                member.get(
                    "WATER_BARRIER"
                ) or ""
            ).upper() == "YES"

            for member in self.members
        )


        water_widths = [

            float(
                member[
                    "WATER_BARRIER_WIDTH_M"
                ]
            )

            for member in self.members

            if member.get(
                "WATER_BARRIER_WIDTH_M"
            ) is not None
        ]


        water_depths = [

            float(
                member[
                    "WATER_BARRIER_DEPTH_M"
                ]
            )

            for member in self.members

            if member.get(
                "WATER_BARRIER_DEPTH_M"
            ) is not None
        ]


        return {

            "required_grade":
                max(grades)
                if grades
                else None,

            "required_height_m":
                max(heights)
                if heights
                else None,

            "climbproof_required":
                climbproof,

            "water_barrier_eligible":
                water_eligible,

            "water_barrier_width_m":
                max(water_widths)
                if water_widths
                else None,

            "water_barrier_depth_m":
                max(water_depths)
                if water_depths
                else None
        }


    # =============================================================
    # NOTES
    # =============================================================

    def compute_notes(self):

        notes = []


        for member in self.members:

            note = member.get(
                "NOTES"
            )


            if (
                note is None
                or str(note).strip() == ""
            ):

                continue


            notes.append({

                "name":
                    member["name"],

                "note":
                    str(note).strip()
            })


        return notes


    # =============================================================
    # FINAL REPORT
    # =============================================================

    def generate_combined_report(self):

        return {

            "species": [

                {

                    "name":
                        member["name"],

                    "adults":
                        int(
                            member.get(
                                "adults",
                                0
                            )
                        ),

                    "juveniles":
                        int(
                            member.get(
                                "juveniles",
                                0
                            )
                        ),

                    "group_type":
                        member.get(
                            "group_type",
                            "General Group"
                        )
                }

                for member in self.members
            ],

            "habitat":
                self.compute_all_areas(),

            "terrain":
                self.compute_terrain_requirements(),

            "biomes":
                self.compute_biome_overlap(),

            "temperature":
                self.compute_temperature_overlap(),

            "group_sizes":
                self.compute_group_size_rules(),

            "predators":
                self.compute_predator_check(),

            "barrier":
                self.compute_barrier_requirements(),

            "notes":
                self.compute_notes()
        }