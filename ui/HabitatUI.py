import os
import json
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext

from App_Skeleton.habitat.MultiSpeciesHabitatBuilder import MultiSpeciesHabitatBuilder

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "..", "data", "species_json")


class HabitatUI(tk.Tk):
    def __init__(self):
        super().__init__()

        self.title("Planet Zoo Habitat Calculator")
        self.geometry("900x700")

        self.selected_species = []
        self.species_data = self.load_species_data()
        self.population_state = {}

        # ---------------------------------------------------------
        # SPECIES DROPDOWN
        # ---------------------------------------------------------
        species_list = sorted(self.species_data.keys())

        self.species_var = tk.StringVar()

        self.species_dropdown = ttk.Combobox(
            self,
            textvariable=self.species_var,
            values=species_list,
            state="readonly"
        )

        self.species_dropdown.grid(
            row=0,
            column=0,
            padx=10,
            pady=10,
            sticky="w"
        )

        # ---------------------------------------------------------
        # ADD BUTTON
        # ---------------------------------------------------------
        ttk.Button(
            self,
            text="Add Species",
            command=self.add_species
        ).grid(
            row=0,
            column=1,
            padx=10,
            pady=10
        )

        # ---------------------------------------------------------
        # POPULATION CONTROLS
        # ---------------------------------------------------------
        tk.Label(
            self,
            text="Adults:"
        ).grid(
            row=0,
            column=2,
            padx=5,
            pady=10,
            sticky="e"
        )

        self.adults_var = tk.IntVar(value=1)

        tk.Spinbox(
            self,
            from_=1,
            to=50,
            textvariable=self.adults_var,
            width=5
        ).grid(
            row=0,
            column=3,
            padx=5,
            pady=10
        )

        tk.Label(
            self,
            text="Juveniles:"
        ).grid(
            row=0,
            column=4,
            padx=5,
            pady=10,
            sticky="e"
        )

        self.juv_var = tk.IntVar(value=0)

        tk.Spinbox(
            self,
            from_=0,
            to=50,
            textvariable=self.juv_var,
            width=5
        ).grid(
            row=0,
            column=5,
            padx=5,
            pady=10
        )

        # ---------------------------------------------------------
        # SELECTED SPECIES LIST
        # ---------------------------------------------------------
        self.selected_listbox = tk.Listbox(
            self,
            height=10,
            width=40
        )

        self.selected_listbox.grid(
            row=1,
            column=0,
            columnspan=2,
            padx=10,
            pady=10,
            sticky="w"
        )

        # ---------------------------------------------------------
        # REMOVE BUTTON
        # ---------------------------------------------------------
        ttk.Button(
            self,
            text="Remove Species",
            command=self.remove_species
        ).grid(
            row=1,
            column=2,
            padx=10,
            pady=10,
            sticky="nw"
        )

        # ---------------------------------------------------------
        # CALCULATE BUTTON
        # ---------------------------------------------------------
        ttk.Button(
            self,
            text="Calculate Habitat",
            command=self.calculate_habitat
        ).grid(
            row=2,
            column=0,
            padx=10,
            pady=10,
            sticky="w"
        )

        # ---------------------------------------------------------
        # OUTPUT
        # ---------------------------------------------------------
        self.output = scrolledtext.ScrolledText(
            self,
            width=100,
            height=30
        )

        self.output.grid(
            row=3,
            column=0,
            columnspan=6,
            padx=10,
            pady=10
        )

    # ---------------------------------------------------------
    # LOAD SPECIES
    # ---------------------------------------------------------
    def load_species_data(self):

        data = {}

        for filename in os.listdir(DATA_DIR):

            if filename.endswith(".json"):

                path = os.path.join(DATA_DIR, filename)

                with open(path, "r") as f:
                    species_record = json.load(f)

                species_name = filename.replace(".json", "")

                data[species_name] = species_record

        return data

    # ---------------------------------------------------------
    # ADD SPECIES
    # ---------------------------------------------------------
    def add_species(self):

        species = self.species_var.get()

        if not species:
            return

        if species in self.selected_species:

            messagebox.showwarning(
                "Warning",
                "Species already added."
            )

            return

        self.selected_species.append(species)

        self.population_state[species] = {
            "adults": self.adults_var.get(),
            "juveniles": self.juv_var.get()
        }

        self.selected_listbox.insert(
            tk.END,
            species
        )

        # Reset population controls
        self.adults_var.set(1)
        self.juv_var.set(0)

    # ---------------------------------------------------------
    # REMOVE SPECIES
    # ---------------------------------------------------------
    def remove_species(self):

        selection = self.selected_listbox.curselection()

        if not selection:

            messagebox.showwarning(
                "Remove Species",
                "Select a species from the habitat first."
            )

            return

        index = selection[0]

        species = self.selected_listbox.get(index)

        confirm = messagebox.askyesno(
            "Remove Species",
            f"Remove {species} from the habitat?"
        )

        if not confirm:
            return

        self.selected_listbox.delete(index)

        if species in self.selected_species:
            self.selected_species.remove(species)

        self.population_state.pop(
            species,
            None
        )

    # ---------------------------------------------------------
    # CALCULATE HABITAT
    # ---------------------------------------------------------
    def calculate_habitat(self):

        if not self.selected_species:

            messagebox.showwarning(
                "Warning",
                "No species selected."
            )

            return

        members = []

        for name in self.selected_species:

            species_record = self.species_data[name]

            population = self.population_state[name]

            member = {
                "name": name,
                "adults": population["adults"],
                "juveniles": population["juveniles"],
                **species_record
            }

            members.append(member)

        builder = MultiSpeciesHabitatBuilder(
            members
        )

        report = builder.generate_combined_report()

        self.display_report(report)

    # ---------------------------------------------------------
    # DISPLAY REPORT
    # ---------------------------------------------------------
    def display_report(self, report):

        self.output.delete(
            "1.0",
            tk.END
        )

        self.output.insert(
            tk.END,
            "=== Combined Habitat Report ===\n\n"
        )

        # SPECIES
        self.output.insert(
            tk.END,
            "Species in Habitat:\n"
        )

        for s in report["species"]:

            self.output.insert(
                tk.END,
                f" - {s['name']} "
                f"(Adults: {s['adults']}, "
                f"Juveniles: {s['juveniles']})\n"
            )

        # AREA
        self.output.insert(
            tk.END,
            "\n--- Habitat Requirements ---\n"
        )

        self.output.insert(
            tk.END,
            json.dumps(
                report["habitat"],
                indent=4
            )
        )

        # TERRAIN
        self.output.insert(
            tk.END,
            "\n\n--- Terrain Requirements ---\n"
        )

        terrain = report["terrain"]

        for terrain_name, values in terrain["requirements"].items():

            self.output.insert(
                tk.END,
                f"{terrain_name}: "
                f"{values['min']}% - "
                f"{values['max']}%"
            )

            if not values["viable"]:
                self.output.insert(
                    tk.END,
                    "  *** INCOMPATIBLE ***"
                )

            self.output.insert(
                tk.END,
                "\n"
            )

        self.output.insert(
            tk.END,
            f"\nMinimum Total: "
            f"{terrain['minimum_total']}%\n"
        )

        self.output.insert(
            tk.END,
            f"Terrain Viable: "
            f"{terrain['viable']}\n"
        )

        if not terrain["minimum_total_viable"]:

            self.output.insert(
                tk.END,
                "*** HABITAT TERRAIN INCOMPATIBLE. "
                "MINIMUM VALUES EXCEED 100% ***\n"
            )

        # BIOME
        self.output.insert(
            tk.END,
            "\n--- Biome Overlap ---\n"
        )

        self.output.insert(
            tk.END,
            json.dumps(
                report["biomes"],
                indent=4
            )
        )

        # TEMPERATURE
        self.output.insert(
            tk.END,
            "\n\n--- Temperature Overlap ---\n"
        )

        self.output.insert(
            tk.END,
            json.dumps(
                report["temperature"],
                indent=4
            )
        )

        # GROUP SIZE
        self.output.insert(
            tk.END,
            "\n\n--- Group Sizes ---\n"
        )

        self.output.insert(
            tk.END,
            json.dumps(
                report["group_sizes"],
                indent=4
            )
        )

        # PREDATOR
        self.output.insert(
            tk.END,
            "\n\n--- Predator Check ---\n"
        )

        self.output.insert(
            tk.END,
            json.dumps(
                report["predators"],
                indent=4
            )
        )

        # BARRIER
        self.output.insert(
            tk.END,
            "\n\n--- Barrier Requirements ---\n"
        )

        self.output.insert(
            tk.END,
            json.dumps(
                report["barrier"],
                indent=4
            )
        )


if __name__ == "__main__":

    app = HabitatUI()
    app.mainloop()