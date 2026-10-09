"use strict";

let speciesData = [];
const selectedSpecies = new Map();

// Phase 2A: tab-local habitat persistence. The URL remains the Launch URL.
const HABITAT_STORAGE_KEY = "pz-habitat-v1732-tab";
const HABITAT_EXIT_KEY = "pz-habitat-v1732-left-from-launch";
const HABITAT_REPORT_KEY = "pz-habitat-v1732-step3-report";

// Only reuse a report when its inputs exactly match the restored selections.
function habitatSelectionSignature() {
    return JSON.stringify(Array.from(selectedSpecies.entries())
        .map(([name, entry]) => [name, entry.adults, entry.juveniles, entry.groupType])
        .sort((a, b) => a[0].localeCompare(b[0])));
}
function clearStoredHabitatReport() {
    sessionStorage.removeItem(HABITAT_REPORT_KEY);
}
function saveStep3Report(report) {
    try {
        sessionStorage.setItem(HABITAT_REPORT_KEY, JSON.stringify({
            signature: habitatSelectionSignature(), report
        }));
    } catch (error) {
        console.warn("Step 3 report could not be cached", error);
    }
}
function restoreStep3Report() {
    try {
        const cached = JSON.parse(sessionStorage.getItem(HABITAT_REPORT_KEY) || "null");
        if (!cached || cached.signature !== habitatSelectionSignature()) return false;
        currentHabitatReport = cached.report;
        renderStep3(currentHabitatReport);
        return true;
    } catch (error) {
        console.warn("Step 3 report could not be restored", error);
        return false;
    }
}


// Leaving the Launch page can be a refresh OR a departure to another site.
// Defer clearing until the browser returns, so a Launch refresh stays intact.
function browserNavigationType() {
    return performance.getEntriesByType("navigation")[0]?.type || "navigate";
}

// Reset the alphabet rail's visual state when a tab session truly ends.
// The rail is a jump-to-letter control, not a species filter.
function resetAlphabetRailHighlight() {
    const rail = document.getElementById("alphabet-filter");
    if (!rail) return;
    rail.querySelectorAll("button[data-letter]").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.letter === "ALL"));
    });
}

function clearExitedHabitatSession() {
    if (sessionStorage.getItem(HABITAT_EXIT_KEY) !== "1") return false;
    sessionStorage.removeItem(HABITAT_EXIT_KEY);
    sessionStorage.removeItem(HABITAT_STORAGE_KEY);
    clearStoredHabitatReport();
    selectedSpecies.clear();
    currentHabitatReport = null;
    pendingRestoredScreen = "launch-screen";
    resetAlphabetRailHighlight();
    return true;
}

// On a new document load, only a real refresh retains the pending session.
if (sessionStorage.getItem(HABITAT_EXIT_KEY) === "1" && browserNavigationType() !== "reload") {
    sessionStorage.removeItem(HABITAT_EXIT_KEY);
    sessionStorage.removeItem(HABITAT_STORAGE_KEY);
    clearStoredHabitatReport();
} else if (browserNavigationType() === "reload") {
    sessionStorage.removeItem(HABITAT_EXIT_KEY);
}
let restoringNavigation = false;
let pendingRestoredScreen = "launch-screen";

function saveHabitatSession() {
    try {
        sessionStorage.setItem(HABITAT_STORAGE_KEY, JSON.stringify({
            screen: document.querySelector(".screen.active-screen")?.id || "launch-screen",
            selections: Array.from(selectedSpecies.entries()).map(([name, entry]) => ({
                name, adults: entry.adults, juveniles: entry.juveniles,
                groupType: entry.groupType
            }))
        }));
    } catch (error) {
        console.warn("Habitat session could not be saved", error);
    }
}

function restoreHabitatSelections() {
    try {
        const saved = JSON.parse(sessionStorage.getItem(HABITAT_STORAGE_KEY) || "null");
        if (!saved || !Array.isArray(saved.selections)) return;
        const byName = new Map(speciesData.map(species => [species.name, species]));
        selectedSpecies.clear();
        for (const item of saved.selections) {
            const species = byName.get(item.name);
            if (!species) continue;
            selectedSpecies.set(item.name, {
                species,
                adults: Math.max(1, Math.trunc(Number(item.adults) || 1)),
                juveniles: Math.max(0, Math.trunc(Number(item.juveniles) || 0)),
                groupType: item.groupType || "General"
            });
        }
        pendingRestoredScreen = saved.screen || "launch-screen";
        syncStep1Selections();
        updateSelectedCount();
        if (pendingRestoredScreen === "step2-screen" || pendingRestoredScreen === "step3-screen") {
            renderStep2();
        }
        // Restore the exact report displayed before refresh when inputs match.
        if (pendingRestoredScreen === "step3-screen" && selectedSpecies.size && !restoreStep3Report()) {
            // If the cache is unavailable, regenerate from the existing selections.
            showScreen(step2Screen, false);
            buildHabitat(false);
        } else {
            showScreen(document.getElementById(pendingRestoredScreen) || launchScreen, false);
        }
    } catch (error) {
        console.warn("Unable to restore habitat session", error);
    }
}

window.addEventListener("pagehide", () => {
    saveHabitatSession();
    if (document.querySelector(".screen.active-screen")?.id === "launch-screen") {
        sessionStorage.setItem(HABITAT_EXIT_KEY, "1");
    }
});

// Back/Forward cache restores the existing document without re-running scripts.
window.addEventListener("pageshow", event => {
    if (!event.persisted || !clearExitedHabitatSession()) return;
    syncStep1Selections();
    updateSelectedCount();
    showScreen(launchScreen, false);
    saveHabitatSession();
});
window.addEventListener("popstate", event => {
    const screenId = event.state?.pzScreen || "launch-screen";
    const target = document.getElementById(screenId) || launchScreen;
    if (screenId === "step3-screen" && !currentHabitatReport && !restoreStep3Report()) {
        renderStep2();
        showScreen(step2Screen, false);
        if (selectedSpecies.size) buildHabitat(false);
    } else {
        if (screenId === "step2-screen") renderStep2();
        showScreen(target, false);
    }
});

// Save on every selection mutation, including edits in the Step 2 popup.
for (const method of ["set", "delete", "clear"]) {
    const original = selectedSpecies[method].bind(selectedSpecies);
    selectedSpecies[method] = (...args) => {
        const result = original(...args);
        saveHabitatSession();
        return result;
    };
}
let currentPopupSpecies = null;
let currentHabitatReport = null;

const speciesColors = [
    "#e53935",
    "#fb8c00",
    "#fdd835",
    "#43a047",
    "#00acc1",
    "#1e88e5",
    "#8e24aa",
    "#d81b60",
    "#6d4c41",
    "#546e7a",
    "#7cb342",
    "#3949ab"
];

const launchScreen = document.getElementById("launch-screen");
const step1Screen = document.getElementById("step1-screen");
const step2Screen = document.getElementById("step2-screen");
const step3Screen = document.getElementById("step3-screen");
const speciesList = document.getElementById("species-list");
const summaryList = document.getElementById("summary-list");
const selectedCount = document.getElementById("selected-count");
const continueButton = document.getElementById("continue-button");
const step2WarningArea = document.getElementById("step2-warning-area");

function showScreen(screen, addHistory = true) {
    document.querySelectorAll(".screen").forEach(element => {
        element.classList.remove("active-screen");
    });

    screen.classList.add("active-screen");
    if (addHistory && history.state?.pzScreen !== screen.id) {
        history.pushState({pzScreen: screen.id}, "", location.pathname);
    }
    saveHabitatSession();
    window.scrollTo(0, 0);
}

const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalContent = document.getElementById("modal-content");

function showModal(title, content) {
    modalTitle.textContent = title;
    modalContent.innerHTML = content;
    modalOverlay.classList.add("visible");
}

function closeModal() {
    modalOverlay.classList.remove("visible");
}

document.getElementById("modal-close").addEventListener("click", closeModal);

modalOverlay.addEventListener("click", event => {
    if (event.target === modalOverlay) {
        closeModal();
    }
});

// Phase 3.1: ask what to do with a habitat when START is clicked on Launch.
function resetHabitatForNewStart() {
    selectedSpecies.clear();
    currentHabitatReport = null;
    clearStoredHabitatReport();
    pendingRestoredScreen = "step1-screen";
    resetAlphabetRailHighlight();
    syncStep1Selections();
    updateSelectedCount();
    renderStep2();
    closeModal();
    showScreen(step1Screen);
}

function showExistingHabitatPrompt() {
    showModal("EXISTING HABITAT DETECTED", `
        <p class="restore-habitat-description">You have an existing habitat selection. Would you like to restore your previous selections or start a new habitat?</p>
        <div class="restore-habitat-actions">
            <button type="button" id="restore-habitat-button" class="popup-apply-button">RESTORE PREVIOUS SELECTION</button>
            <button type="button" id="new-habitat-button" class="popup-remove-button">START NEW HABITAT</button>
        </div>
    `);
    document.getElementById("restore-habitat-button").addEventListener("click", () => {
        closeModal();
        showScreen(step1Screen);
    });
    document.getElementById("new-habitat-button").addEventListener("click", resetHabitatForNewStart);
    document.getElementById("restore-habitat-button").focus();
}

document.getElementById("start-button").addEventListener("click", () => {
    if (selectedSpecies.size > 0) {
        showExistingHabitatPrompt();
    } else {
        showScreen(step1Screen);
    }
});

document.getElementById("step1-back-button").addEventListener("click", () => {
    showScreen(launchScreen);
});

document.getElementById("credits-button").addEventListener("click", () => {
    showScreen(document.getElementById("credits-screen"));
    filterCredits();
    document.getElementById("credits-heading").focus();
});

document.getElementById("donate-button").addEventListener("click", () => {
    window.open("https://ko-fi.com/unofficialpzhabitatcalculator", "_blank", "noopener,noreferrer");
});

document.getElementById("feedback-button").addEventListener("click", () => {
    window.open("https://unofficialplanetzoohabitatcalc.userjot.com/?cursor=1&order=top&limit=10", "_blank", "noopener,noreferrer");
});

function displayValue(value) {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    return value;
}

function cleanNumber(value) {
    const number = Number(value);

    if (Number.isInteger(number)) {
        return number;
    }

    return Number(number.toFixed(2));
}

function celsiusToFahrenheitDown(celsius) {
    return Math.floor((Number(celsius) * 9 / 5) + 32);
}

function getBiomes(species) {
    const biomes = [];

    for (let index = 1; index <= 5; index++) {
        const biome = species[`BIOME_${index}`];

        if (biome) {
            biomes.push(biome);
        }
    }

    return biomes;
}

function isPredator(species) {
    return String(species.PREDATOR || "").toUpperCase() === "YES";
}

function getEnrichmentPartners(species) {
    if (!species.ENRICHMENT_PARTNERS) {
        return [];
    }

    return String(species.ENRICHMENT_PARTNERS)
        .split(";")
        .map(name => name.trim())
        .filter(Boolean);
}

function getAlphabeticalSelections() {
    return Array
        .from(selectedSpecies.values())
        .sort((a, b) =>
            a.species.name.localeCompare(b.species.name)
        );
}

function getGroupTypes(species) {
    const generalMax = Number(species.GROUP_MAX);
    const maleBachelorMax = Number(species.BACHELOR_MALE_MAX);
    const femaleBachelorMax = Number(species.BACHELOR_FEMALE_MAX);
    const mixedMaleMax = Number(species.MIXED_MALE_MAX);
    const mixedFemaleMax = Number(species.MIXED_FEMALE_MAX);

    const allSame =
        generalMax === maleBachelorMax &&
        generalMax === femaleBachelorMax &&
        generalMax === mixedMaleMax &&
        generalMax === mixedFemaleMax;

    if (allSame) {
        return ["General Group"];
    }

    return [
        "Breeding Group",
        "Male Bachelor Group",
        "Female Bachelor Group"
    ];
}

function hasPopulationWarning(entry) {
    const minimum = Number(entry.species.GROUP_MIN);
    const maximum = Number(entry.species.GROUP_MAX);
    const adults = Number(entry.adults);

    return (
        (
            Number.isFinite(minimum) &&
            adults < minimum
        ) ||
        (
            Number.isFinite(maximum) &&
            adults > maximum
        )
    );
}

function getPopulationWarning(entry) {
    const minimum = Number(entry.species.GROUP_MIN);
    const maximum = Number(entry.species.GROUP_MAX);
    const adults = Number(entry.adults);

    if (
        Number.isFinite(minimum) &&
        adults < minimum
    ) {
        return (
            "GROUP SIZE WARNING — " +
            `Minimum adult group size is ${minimum}.`
        );
    }

    if (
        Number.isFinite(maximum) &&
        adults > maximum
    ) {
        return (
            "GROUP SIZE WARNING — " +
            `Maximum adult group size is ${maximum}.`
        );
    }

    return "";
}

function hasPredatorPreyIncompatibility() {
    if (selectedSpecies.size < 2) {
        return false;
    }

    return getAlphabeticalSelections()
        .some(entry => isPredator(entry.species));
}

function isPredatorOffender(entry) {
    return (
        selectedSpecies.size >= 2 &&
        isPredator(entry.species)
    );
}

function createNumberControl(
    label,
    initialValue,
    minimumValue
) {
    const container = document.createElement("div");
    container.className = "control-block";

    const controlLabel = document.createElement("label");
    controlLabel.className = "control-label";
    controlLabel.textContent = label;

    const stepper = document.createElement("div");
    stepper.className = "number-stepper";

    const down = document.createElement("button");
    down.type = "button";
    down.textContent = "▼";

    const value = document.createElement("input");
    value.type = "number";
    value.className = "number-value";
    value.min = String(minimumValue);
    value.step = "1";
    value.inputMode = "numeric";
    value.value = String(initialValue);
    value.setAttribute("aria-label", `${label} count`);

    const up = document.createElement("button");
    up.type = "button";
    up.textContent = "▲";

    function getValue() {
        const parsed = Number.parseInt(value.value, 10);
        return Number.isFinite(parsed)
            ? Math.max(minimumValue, parsed)
            : minimumValue;
    }

    function setValue(newValue) {
        const parsed = Number.parseInt(newValue, 10);
        value.value = String(
            Math.max(
                minimumValue,
                Number.isFinite(parsed) ? parsed : minimumValue
            )
        );
    }

    function commitTypedValue() {
        setValue(value.value);
    }

    value.addEventListener("change", commitTypedValue);
    value.addEventListener("blur", commitTypedValue);
    value.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            commitTypedValue();
            value.blur();
        }
    });

    down.addEventListener("click", () => {
        setValue(getValue() - 1);
    });

    up.addEventListener("click", () => {
        setValue(getValue() + 1);
    });

    stepper.append(
        down,
        value,
        up
    );

    container.append(
        controlLabel,
        stepper
    );

    return {
        container,
        getValue,
        setValue
    };
}

function createSpeciesCard(species) {
    const card = document.createElement("article");
    card.className = "species-card";
    card.dataset.speciesName = species.name;

    const row = document.createElement("div");
    row.className = "species-row";

    const expandButton = document.createElement("button");
    expandButton.className = "expand-button";
    expandButton.textContent = "+";

    const name = document.createElement("div");
    name.className = "species-name";
    name.textContent = species.name;

    const marker = document.createElement("div");
    marker.className = "selection-marker";

    row.append(
        expandButton,
        name,
        marker
    );

    const details = document.createElement("div");
    details.className = "species-details";

    const top = document.createElement("div");
    top.className = "detail-top";

    const imageBox = document.createElement("div");
    imageBox.className = "species-image";

    if (species.image_filename) {
        const speciesImage = document.createElement("img");
        speciesImage.src = `/static/images/species/${encodeURIComponent(species.image_filename)}`;
        speciesImage.alt = species.name;
        speciesImage.loading = "lazy";
        imageBox.appendChild(speciesImage);
    } else {
        imageBox.classList.add("image-unavailable");
        imageBox.textContent = "IMAGE UNAVAILABLE";
    }

    const information = document.createElement("div");
    information.className = "species-information";

    const flags = document.createElement("div");
    flags.className = "species-flags";

    getBiomes(species).forEach(biome => {
        const tag = document.createElement("span");
        tag.className = "biome-tag";
        tag.textContent = biome;

        flags.appendChild(tag);
    });

    if (isPredator(species)) {
        const predator = document.createElement("span");
        predator.className = "predator-tag";
        predator.textContent = "⚠ PREDATOR ⚠";

        flags.appendChild(predator);
    }

    const groupTitle = document.createElement("h3");
    groupTitle.className = "group-title";
    groupTitle.textContent = "Group Size";

    const groupTable = document.createElement("table");
    groupTable.className = "group-table";

    groupTable.innerHTML = `
        <tbody>
            <tr>
                <th>General:</th>
                <td>
                    ${displayValue(species.GROUP_MIN)}
                    THROUGH
                    ${displayValue(species.GROUP_MAX)}
                    ADULTS
                </td>
            </tr>

            <tr>
                <th>Bachelor:</th>
                <td>
                    ♂ ${displayValue(species.BACHELOR_MALE_MAX)}
                    &nbsp;&nbsp;
                    ♀ ${displayValue(species.BACHELOR_FEMALE_MAX)}
                </td>
            </tr>

            <tr>
                <th>Breeding:</th>
                <td>
                    ♂ ${displayValue(species.MIXED_MALE_MAX)}
                    &nbsp;&nbsp;
                    ♀ ${displayValue(species.MIXED_FEMALE_MAX)}
                </td>
            </tr>
        </tbody>
    `;

    information.append(
        flags,
        groupTitle,
        groupTable
    );

    top.append(
        imageBox,
        information
    );

    const controls = document.createElement("div");
    controls.className = "species-controls";

    const groupBlock = document.createElement("div");
    groupBlock.className = "control-block";

    const groupLabel = document.createElement("label");
    groupLabel.className = "control-label";
    groupLabel.textContent = "Group Type";

    const groupSelect = document.createElement("select");
    groupSelect.className = "group-select";

    getGroupTypes(species).forEach(groupType => {
        const option = document.createElement("option");

        option.value = groupType;
        option.textContent = groupType;

        groupSelect.appendChild(option);
    });

    groupBlock.append(
        groupLabel,
        groupSelect
    );

    const adultControl = createNumberControl(
        "Adults",
        1,
        1
    );

    const juvenileControl = createNumberControl(
        "Juvenile",
        0,
        0
    );

    controls.append(
        groupBlock,
        adultControl.container,
        juvenileControl.container
    );

    const actions = document.createElement("div");
    actions.className = "species-actions";

    const discardButton = document.createElement("button");
    discardButton.className = "discard-button";
    discardButton.textContent = "DISCARD";

    const addButton = document.createElement("button");
    addButton.className = "add-button";
    addButton.textContent = "ADD TO HABITAT";

    actions.append(
        discardButton,
        addButton
    );

    details.append(
        top,
        controls,
        actions
    );

    card.append(
        row,
        details
    );

    expandButton.addEventListener("click", () => {
        const expanded = card.classList.toggle("expanded");

        expandButton.textContent =
            expanded
                ? "−"
                : "+";

        if (expanded) {
            const existing = selectedSpecies.get(species.name);

            if (existing) {
                adultControl.setValue(existing.adults);
                juvenileControl.setValue(existing.juveniles);
                groupSelect.value = existing.groupType;
            } else {
                adultControl.setValue(1);
                juvenileControl.setValue(0);
                groupSelect.selectedIndex = 0;
            }
        }
    });

    discardButton.addEventListener("click", () => {
        card.classList.remove("expanded");
        expandButton.textContent = "+";
    });

    addButton.addEventListener("click", () => {
        selectedSpecies.set(
            species.name,
            {
                species: species,
                adults: adultControl.getValue(),
                juveniles: juvenileControl.getValue(),
                groupType: groupSelect.value
            }
        );

        card.classList.add("selected");
        marker.textContent = "✓";

        card.classList.remove("expanded");
        expandButton.textContent = "+";

        updateSelectedCount();
    });

    return card;
}

function renderSpecies(speciesArray) {
    speciesList.innerHTML = "";

    if (!speciesArray.length) {
        speciesList.innerHTML =
            '<div class="loading-message">No species found.</div>';

        return;
    }

    speciesArray.forEach(species => {
        speciesList.appendChild(
            createSpeciesCard(species)
        );
    });
}

function buildAlphabetRail() {
    const rail = document.getElementById("alphabet-filter");
    rail.replaceChildren();
    const letters = [...new Set(speciesData.map(species => species.name[0].toUpperCase()))].sort();
    ["ALL", ...letters].forEach(letter => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = letter;
        button.dataset.letter = letter;
        button.setAttribute("aria-label", letter === "ALL" ? "Top of species list" : `Go to species starting with ${letter}`);
        button.setAttribute("aria-pressed", String(letter === "ALL"));
        button.addEventListener("click", () => {
            rail.querySelectorAll("button").forEach(item => {
                item.setAttribute("aria-pressed", String(item === button));
            });
            const target = letter === "ALL" ? speciesList : document.querySelector(
                `[data-species-name="${CSS.escape(speciesData.find(species => species.name.toUpperCase().startsWith(letter)).name)}"]`
            );
            if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        rail.appendChild(button);
    });
}

function updateSelectedCount() {
    const count = selectedSpecies.size;

    selectedCount.textContent =
        `${count} SPECIES SELECTED`;

    continueButton.disabled =
        count === 0;
}

function getStep2ColorMap() {
    const colorMap = new Map();

    getAlphabeticalSelections().forEach(
        (entry, index) => {
            colorMap.set(
                entry.species.name,
                speciesColors[
                    index % speciesColors.length
                ]
            );
        }
    );

    return colorMap;
}

function createEnrichmentMarks(
    entry,
    colorMap
) {
    const container = document.createElement("div");
    container.className = "summary-enrichment";

    const partners = getEnrichmentPartners(
        entry.species
    );

    getAlphabeticalSelections().forEach(
        otherEntry => {
            if (
                otherEntry.species.name ===
                entry.species.name
            ) {
                return;
            }

            if (
                partners.includes(
                    otherEntry.species.name
                )
            ) {
                const check = document.createElement("span");

                check.className = "enrichment-check";
                check.textContent = "✓";

                check.style.color = colorMap.get(
                    otherEntry.species.name
                );

                check.title =
                    otherEntry.species.name;

                container.appendChild(check);
            }
        }
    );

    return container;
}
function createTopWarning(
    titleText,
    descriptionText
) {
    const warning = document.createElement("div");
    warning.className = "step2-top-warning";

    const title = document.createElement("div");
    title.className = "warning-title";
    title.textContent = `⚠ ${titleText}`;

    const description = document.createElement("div");
    description.className = "warning-description";
    description.textContent = descriptionText;

    warning.append(
        title,
        description
    );

    return warning;
}

function renderStep2Warnings() {
    step2WarningArea.innerHTML = "";

    const populationWarnings =
        getAlphabeticalSelections()
            .filter(
                entry =>
                    hasPopulationWarning(entry)
            );

    const predatorWarning =
        hasPredatorPreyIncompatibility();

    if (
        populationWarnings.length === 0 &&
        !predatorWarning
    ) {
        step2WarningArea.classList.remove(
            "has-warning"
        );

        return;
    }

    step2WarningArea.classList.add(
        "has-warning"
    );

    if (predatorWarning) {
        step2WarningArea.appendChild(
            createTopWarning(
                "PREDATOR/PREY INCOMPATABILITY",
                "One or more selected species is a predator and cannot cohabitate with other species."
            )
        );
    }

    if (populationWarnings.length > 0) {
        step2WarningArea.appendChild(
            createTopWarning(
                "POPULATION INCONSISTENCY",
                "One or more selected species are outside their general adult group-size requirement."
            )
        );
    }
}

function renderStep2() {
    summaryList.innerHTML = "";

    renderStep2Warnings();

    const alphabetical =
        getAlphabeticalSelections();

    const colorMap =
        getStep2ColorMap();

    alphabetical.forEach(entry => {
        const row = document.createElement("div");
        row.className = "summary-species-row";

        const left = document.createElement("div");
        left.className = "summary-species-info";

        const nameLine = document.createElement("div");
        nameLine.className = "summary-name-line";

        const colorBox = document.createElement("span");
        colorBox.className = "summary-color-box";

        colorBox.style.backgroundColor =
            colorMap.get(entry.species.name);

        const nameButton = document.createElement("button");
        nameButton.className = "summary-species-name";
        nameButton.textContent = entry.species.name;

        nameButton.addEventListener("click", () => {
            openSpeciesPopup(entry.species.name);
        });

        nameLine.append(
            colorBox,
            nameButton
        );

        if (hasPopulationWarning(entry) || isPredatorOffender(entry)) {
            const warning = document.createElement("button");
            warning.type = "button";
            warning.className = "species-warning-icon";
            warning.textContent = "⚠";
            warning.title = [
                getPopulationWarning(entry),
                isPredatorOffender(entry) ? "PREDATOR/PREY INCOMPATABILITY" : ""
            ].filter(Boolean).join("\n");
            warning.setAttribute("aria-label", `View warnings and options for ${entry.species.name}`);
            warning.addEventListener("click", () => openSpeciesPopup(entry.species.name));
            nameLine.appendChild(warning);
        }

        if (isPredator(entry.species)) {
            const predator = document.createElement("span");

            predator.className =
                "summary-predator";

            predator.textContent =
                "PREDATOR";

            nameLine.appendChild(predator);
        }

        const counts = document.createElement("div");
        counts.className = "summary-counts";

        counts.textContent =
            `${entry.adults} Adult / ${entry.juveniles} Juveniles`;

        left.append(
            nameLine,
            counts
        );

        const right =
            createEnrichmentMarks(
                entry,
                colorMap
            );

        row.append(
            left,
            right
        );

        summaryList.appendChild(row);
    });
}

continueButton.addEventListener(
    "click",
    () => {
        renderStep2();
        showScreen(step2Screen);
    }
);

document
    .getElementById("go-back-button")
    .addEventListener(
        "click",
        () => {
            showScreen(step1Screen);
        }
    );

const speciesPopupOverlay =
    document.getElementById(
        "species-popup-overlay"
    );

const popupSpeciesName =
    document.getElementById(
        "popup-species-name"
    );

const popupWarning =
    document.getElementById(
        "popup-warning"
    );

const popupAdultsValue =
    document.getElementById(
        "popup-adults-value"
    );

const popupJuvenilesValue =
    document.getElementById(
        "popup-juveniles-value"
    );

function normalizePopupPopulation() {
    [[popupAdultsValue, 1], [popupJuvenilesValue, 0]].forEach(([input, minimum]) => {
        const count = Number(input.value);
        input.value = String(Number.isFinite(count) ? Math.max(minimum, Math.floor(count)) : minimum);
    });
}
[popupAdultsValue, popupJuvenilesValue].forEach(input => {
    input.addEventListener("change", normalizePopupPopulation);
});

function openSpeciesPopup(speciesName) {
    const entry =
        selectedSpecies.get(speciesName);

    if (!entry) {
        return;
    }

    currentPopupSpecies =
        speciesName;

    popupSpeciesName.textContent =
        speciesName;

    popupAdultsValue.value =
        entry.adults;

    popupJuvenilesValue.value =
        entry.juveniles;

    const warnings = [];

    const populationWarning =
        getPopulationWarning(entry);

    if (populationWarning) {
        warnings.push(
            populationWarning
        );
    }

    if (isPredatorOffender(entry)) {
        warnings.push(
            "PREDATOR/PREY INCOMPATABILITY — This predator cannot cohabitate with other species."
        );
    }

    if (warnings.length) {
        popupWarning.innerHTML =
            warnings
                .map(
                    warning =>
                        `⚠ ${warning}`
                )
                .join("<br><br>");

        popupWarning.classList.add(
            "visible"
        );
    } else {
        popupWarning.innerHTML = "";

        popupWarning.classList.remove(
            "visible"
        );
    }

    speciesPopupOverlay.classList.add(
        "visible"
    );
}

function closeSpeciesPopup() {
    speciesPopupOverlay.classList.remove(
        "visible"
    );

    currentPopupSpecies = null;
}

document
    .getElementById("species-popup-close")
    .addEventListener(
        "click",
        closeSpeciesPopup
    );

speciesPopupOverlay.addEventListener(
    "click",
    event => {
        if (
            event.target ===
            speciesPopupOverlay
        ) {
            closeSpeciesPopup();
        }
    }
);

document
    .getElementById("popup-adults-down")
    .addEventListener(
        "click",
        () => {
            popupAdultsValue.value =
                Math.max(
                    1,
                    Number(
                        popupAdultsValue.value
                    ) - 1
                );
        }
    );

document
    .getElementById("popup-adults-up")
    .addEventListener(
        "click",
        () => {
            popupAdultsValue.value =
                Number(
                    popupAdultsValue.value
                ) + 1;
        }
    );

document
    .getElementById("popup-juveniles-down")
    .addEventListener(
        "click",
        () => {
            popupJuvenilesValue.value =
                Math.max(
                    0,
                    Number(
                        popupJuvenilesValue.value
                    ) - 1
                );
        }
    );

document
    .getElementById("popup-juveniles-up")
    .addEventListener(
        "click",
        () => {
            popupJuvenilesValue.value =
                Number(
                    popupJuvenilesValue.value
                ) + 1;
        }
    );

document
    .getElementById("popup-apply")
    .addEventListener(
        "click",
        () => {
            if (!currentPopupSpecies) {
                return;
            }

            const entry =
                selectedSpecies.get(
                    currentPopupSpecies
                );

            if (!entry) {
                return;
            }

            normalizePopupPopulation();

            entry.adults =
                Number(
                    popupAdultsValue.value
                );

            entry.juveniles =
                Number(
                    popupJuvenilesValue.value
                );

            selectedSpecies.set(
                currentPopupSpecies,
                entry
            );

            closeSpeciesPopup();
            renderStep2();
        }
    );

document
    .getElementById("popup-remove")
    .addEventListener(
        "click",
        () => {
            if (!currentPopupSpecies) {
                return;
            }

            const speciesName =
                currentPopupSpecies;

            const confirmed =
                window.confirm(
                    `Remove ${speciesName} from this habitat?`
                );

            if (!confirmed) {
                return;
            }

            selectedSpecies.delete(
                speciesName
            );

            closeSpeciesPopup();

            syncStep1Selections();
            updateSelectedCount();

            if (
                selectedSpecies.size === 0
            ) {
                showScreen(step1Screen);
                return;
            }

            renderStep2();
        }
    );

function syncStep1Selections() {
    document
        .querySelectorAll(".species-card")
        .forEach(card => {
            const speciesName =
                card.dataset.speciesName;

            const marker =
                card.querySelector(
                    ".selection-marker"
                );

            if (
                selectedSpecies.has(
                    speciesName
                )
            ) {
                card.classList.add(
                    "selected"
                );

                marker.textContent = "✓";
            } else {
                card.classList.remove(
                    "selected"
                );

                marker.textContent = "";
            }
        });
}

document
    .getElementById(
        "build-habitat-button"
    )
    .addEventListener(
        "click",
        buildHabitat
    );

async function buildHabitat(addHistory = true) {
    const selections =
        getAlphabeticalSelections()
            .map(
                entry => ({
                    name:
                        entry.species.name,

                    adults:
                        entry.adults,

                    juveniles:
                        entry.juveniles,

                    groupType:
                        entry.groupType
                })
            );

    try {
        const response =
            await fetch(
                "/api/build-habitat",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            species:
                                selections
                        })
                }
            );

        const report =
            await response.json();

        if (!response.ok) {
            throw new Error(
                report.error ||
                "Unable to build habitat."
            );
        }

        currentHabitatReport =
            report;
        saveStep3Report(report);

        renderStep3(report);

        // Count a successful, user-initiated build once. Do not count refresh,
        // cached report restoration, or automatic recovery after navigation.
        if (addHistory && typeof window.umami?.track === "function") {
            window.umami.track("habitat_completed");
        }

        showScreen(step3Screen, addHistory);
    } catch (error) {
        console.error(error);

        showModal(
            "ERROR",
            `<p>${error.message}</p>`
        );
    }
}

function renderStep3Warnings(report) {
    const area =
        document.getElementById(
            "step3-warning-area"
        );

    area.innerHTML = "";

    const warnings = [];

    if (
        report.predators &&
        report.predators.incompatible
    ) {
        warnings.push(
            "HABITAT INCOMPATIBILITY. PREDATOR/PREY RELATIONSHIP"
        );
    }

    if (
        report.temperature &&
        !report.temperature.viable
    ) {
        warnings.push(
            "HABITAT INCOMPATIBILITY. TEMPERATURE RANGE IMPOSSIBILITY"
        );
    }

    if (
        report.terrain &&
        report.terrain.incompatible_terrain
    ) {
        report.terrain.incompatible_terrain
            .forEach(
                terrain => {
                    warnings.push(
                        `HABITAT INCOMPATIBILITY. TERRAIN REQUIREMENT IMPOSSIBILITY (${terrain.toUpperCase()})`
                    );
                }
            );
    }

    if (
        report.terrain &&
        !report.terrain.minimum_total_viable
    ) {
        warnings.push(
            "HABITAT TERRAIN INCOMPATIBLE. MINIMUM VALUES EXCEED 100%"
        );
    }

    if (
        report.biomes &&
        report.biomes.length === 0
    ) {
        warnings.push(
            "HABITAT INCOMPATIBILITY. NO SHARED BIOME"
        );
    }

    if (warnings.length === 0) {
        area.classList.remove(
            "visible"
        );

        return;
    }

    area.classList.add(
        "visible"
    );

    warnings.forEach(warning => {
        const item =
            document.createElement(
                "div"
            );

        item.className =
            "step3-warning";

        item.textContent =
            `⚠ ${warning}`;

        area.appendChild(item);
    });
}

function renderStep3Notes(report) {
    const container =
        document.getElementById(
            "step3-notes"
        );

    container.innerHTML = "";

    if (
        !report.notes ||
        report.notes.length === 0
    ) {
        container.style.display =
            "none";

        return;
    }

    container.style.display =
        "block";

    const title =
        document.createElement(
            "strong"
        );

    title.textContent =
        "NOTES";

    container.appendChild(title);

    report.notes.forEach(note => {
        const line =
            document.createElement(
                "div"
            );

        line.textContent =
            `${note.name}: ${note.note}`;

        container.appendChild(line);
    });
}


/*
=================================================================
STEP 3 SPECIES WARNING / OFFENDER LOGIC
=================================================================
*/

function getPairwiseFailureCounts(testFunction) {
    const entries = getAlphabeticalSelections();

    const counts = new Map(
        entries.map(
            entry => [
                entry.species.name,
                0
            ]
        )
    );

    for (
        let i = 0;
        i < entries.length;
        i++
    ) {
        for (
            let j = i + 1;
            j < entries.length;
            j++
        ) {
            if (
                !testFunction(
                    entries[i].species,
                    entries[j].species
                )
            ) {
                counts.set(
                    entries[i].species.name,
                    counts.get(
                        entries[i].species.name
                    ) + 1
                );

                counts.set(
                    entries[j].species.name,
                    counts.get(
                        entries[j].species.name
                    ) + 1
                );
            }
        }
    }

    return counts;
}

function getHighestFailureSpecies(
    counts
) {
    let highest = 0;

    counts.forEach(count => {
        highest =
            Math.max(
                highest,
                count
            );
    });

    if (highest === 0) {
        return new Set();
    }

    return new Set(
        [...counts.entries()]
            .filter(
                ([, count]) =>
                    count === highest
            )
            .map(
                ([name]) => name
            )
    );
}

function speciesShareBiome(
    first,
    second
) {
    const firstBiomes =
        new Set(
            getBiomes(first)
        );

    return getBiomes(second)
        .some(
            biome =>
                firstBiomes.has(
                    biome
                )
        );
}

function speciesShareTemperature(
    first,
    second
) {
    if (
        first.TEMP_MIN_C === null ||
        first.TEMP_MIN_C === undefined ||
        first.TEMP_MAX_C === null ||
        first.TEMP_MAX_C === undefined ||
        second.TEMP_MIN_C === null ||
        second.TEMP_MIN_C === undefined ||
        second.TEMP_MAX_C === null ||
        second.TEMP_MAX_C === undefined
    ) {
        return true;
    }

    const sharedMin =
        Math.max(
            Number(
                first.TEMP_MIN_C
            ),
            Number(
                second.TEMP_MIN_C
            )
        );

    const sharedMax =
        Math.min(
            Number(
                first.TEMP_MAX_C
            ),
            Number(
                second.TEMP_MAX_C
            )
        );

    return (
        sharedMin <= sharedMax
    );
}

function speciesShareTerrain(
    first,
    second,
    terrainName
) {
    const terrainKeys = {
        "Short Grass": [
            "ShortGrass_Min",
            "ShortGrass_Max"
        ],

        "Long Grass": [
            "LongGrass_Min",
            "LongGrass_Max"
        ],

        "Soil": [
            "Soil_Min",
            "Soil_Max"
        ],

        "Rock": [
            "Rock_Min",
            "Rock_Max"
        ],

        "Sand": [
            "Sand_Min",
            "Sand_Max"
        ],

        "Snow": [
            "Snow_Min",
            "Snow_Max"
        ]
    };

    const keys =
        terrainKeys[
            terrainName
        ];

    if (!keys) {
        return true;
    }

    const [
        minKey,
        maxKey
    ] = keys;

    const sharedMin =
        Math.max(
            Number(
                first[minKey]
            ),
            Number(
                second[minKey]
            )
        );

    const sharedMax =
        Math.min(
            Number(
                first[maxKey]
            ),
            Number(
                second[maxKey]
            )
        );

    return (
        sharedMin <= sharedMax
    );
}

function getStep3MajorOffenders(
    report
) {
    const offenders =
        new Set();

    if (
        report.predators &&
        report.predators.incompatible
    ) {
        getAlphabeticalSelections()
            .filter(
                entry =>
                    isPredatorOffender(
                        entry
                    )
            )
            .forEach(
                entry =>
                    offenders.add(
                        entry.species.name
                    )
            );
    }

    if (
        report.temperature &&
        !report.temperature.viable
    ) {
        const temperatureOffenders =
            getHighestFailureSpecies(
                getPairwiseFailureCounts(
                    speciesShareTemperature
                )
            );

        temperatureOffenders
            .forEach(
                name =>
                    offenders.add(
                        name
                    )
            );
    }

    if (
        report.biomes &&
        report.biomes.length === 0
    ) {
        const biomeOffenders =
            getHighestFailureSpecies(
                getPairwiseFailureCounts(
                    speciesShareBiome
                )
            );

        biomeOffenders
            .forEach(
                name =>
                    offenders.add(
                        name
                    )
            );
    }

    if (
        report.terrain &&
        report.terrain
            .incompatible_terrain &&
        report.terrain
            .incompatible_terrain
            .length
    ) {
        const entries =
            getAlphabeticalSelections();

        const terrainCounts =
            new Map(
                entries.map(
                    entry => [
                        entry.species.name,
                        0
                    ]
                )
            );

        report.terrain
            .incompatible_terrain
            .forEach(
                terrainName => {
                    for (
                        let i = 0;
                        i < entries.length;
                        i++
                    ) {
                        for (
                            let j = i + 1;
                            j < entries.length;
                            j++
                        ) {
                            if (
                                !speciesShareTerrain(
                                    entries[i].species,
                                    entries[j].species,
                                    terrainName
                                )
                            ) {
                                terrainCounts.set(
                                    entries[i]
                                        .species
                                        .name,

                                    terrainCounts.get(
                                        entries[i]
                                            .species
                                            .name
                                    ) + 1
                                );

                                terrainCounts.set(
                                    entries[j]
                                        .species
                                        .name,

                                    terrainCounts.get(
                                        entries[j]
                                            .species
                                            .name
                                    ) + 1
                                );
                            }
                        }
                    }
                }
            );

        getHighestFailureSpecies(
            terrainCounts
        ).forEach(
            name =>
                offenders.add(
                    name
                )
        );
    }

    if (
        report.terrain &&
        !report.terrain
            .minimum_total_viable &&
        offenders.size === 0
    ) {
        getAlphabeticalSelections()
            .forEach(
                entry =>
                    offenders.add(
                        entry.species.name
                    )
            );
    }

    return offenders;
}

function getStep3WarningText(
    entry,
    report,
    majorOffenders
) {
    const warnings = [];

    const populationWarning =
        getPopulationWarning(
            entry
        );

    if (populationWarning) {
        warnings.push(
            populationWarning
        );
    }

    if (
        majorOffenders.has(
            entry.species.name
        )
    ) {
        if (
            isPredatorOffender(
                entry
            )
        ) {
            warnings.push(
                "PREDATOR/PREY INCOMPATABILITY"
            );
        }

        if (
            report.temperature &&
            !report.temperature.viable
        ) {
            warnings.push(
                "TEMPERATURE RANGE IMPOSSIBILITY"
            );
        }

        if (
            report.biomes &&
            report.biomes.length === 0
        ) {
            warnings.push(
                "NO SHARED BIOME"
            );
        }

        if (
            report.terrain &&
            (
                (
                    report.terrain
                        .incompatible_terrain &&
                    report.terrain
                        .incompatible_terrain
                        .length
                ) ||
                !report.terrain
                    .minimum_total_viable
            )
        ) {
            warnings.push(
                "TERRAIN REQUIREMENT IMPOSSIBILITY"
            );
        }
    }

    return warnings.join(
        " | "
    );
}
function renderOverviewSpecies(report) {
    const container =
        document.getElementById(
            "overview-species"
        );

    container.innerHTML = "";

    const colorMap =
        getStep2ColorMap();

    [...report.species]
        .sort(
            (a, b) =>
                a.name.localeCompare(
                    b.name
                )
        )
        .forEach(species => {
            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "overview-species-row";

            const color =
                document.createElement(
                    "span"
                );

            color.className =
                "summary-color-box";

            color.style.backgroundColor =
                colorMap.get(
                    species.name
                );

            const text =
                document.createElement(
                    "div"
                );

            const selectedEntry =
                selectedSpecies.get(
                    species.name
                );

            const majorOffenders =
                getStep3MajorOffenders(
                    report
                );

            const warningText =
                selectedEntry
                    ? getStep3WarningText(
                        selectedEntry,
                        report,
                        majorOffenders
                    )
                    : "";

            const warningIcon =
                warningText
                    ? `<span class="species-warning-icon" title="${warningText}">⚠</span>`
                    : "";

            text.innerHTML = `
                <strong>${species.name}</strong>
                ${warningIcon}

                <div class="overview-small">
                    ${species.adults} Adult /
                    ${species.juveniles} Juveniles
                    &nbsp;—&nbsp;
                    ${species.group_type}
                </div>
            `;

            /*
            Find the original Step 1/Step 2 selection object.
            That contains the full species JSON, including
            ENRICHMENT_PARTNERS.
            */

            /*
            Reuse the exact enrichment rendering function
            already used by Step 2.
            */

            const enrichment =
                selectedEntry
                    ? createEnrichmentMarks(
                        selectedEntry,
                        colorMap
                    )
                    : document.createElement(
                        "div"
                    );

            enrichment.classList.add(
                "overview-enrichment"
            );

            row.append(
                color,
                text,
                enrichment
            );

            container.appendChild(
                row
            );
        });
}

function renderOverviewBiomes(report) {
    const container =
        document.getElementById(
            "overview-biomes"
        );

    if (
        report.biomes.length === 0
    ) {
        container.innerHTML =
            '<span class="incompatible-value">NO COMPATIBLE BIOME</span>';

        return;
    }

    container.textContent =
        report.biomes.join(" / ");
}

function renderOverviewTemperature(report) {
    const container =
        document.getElementById(
            "overview-temperature"
        );

    const temperature =
        report.temperature;

    if (
        !temperature ||
        temperature.min === null ||
        temperature.max === null
    ) {
        container.textContent =
            "NO TEMPERATURE DATA";

        return;
    }

    const minC =
        cleanNumber(
            temperature.min
        );

    const maxC =
        cleanNumber(
            temperature.max
        );

    const minF =
        celsiusToFahrenheitDown(
            temperature.min
        );

    const maxF =
        celsiusToFahrenheitDown(
            temperature.max
        );

    container.textContent =
        `${minC}-${maxC}°C / ${minF}-${maxF}°F`;

    if (!temperature.viable) {
        container.classList.add(
            "incompatible-value"
        );
    } else {
        container.classList.remove(
            "incompatible-value"
        );
    }
}

function addOverviewValue(
    container,
    label,
    value
) {
    const item =
        document.createElement(
            "div"
        );

    item.className =
        "overview-grid-item";

    item.innerHTML = `
        <div class="overview-label">
            ${label}
        </div>

        <div class="overview-number">
            ${value}
        </div>
    `;

    container.appendChild(item);
}

function renderOverviewArea(report) {
    const container =
        document.getElementById(
            "overview-area"
        );

    container.innerHTML = "";

    addOverviewValue(
        container,
        "LAND",
        `${cleanNumber(report.habitat.land_m2)} m²`
    );

    if (
        report.habitat.water_m2 !== null
    ) {
        addOverviewValue(
            container,
            "WATER",
            `${cleanNumber(report.habitat.water_m2)} m²`
        );
    }

    if (
        report.habitat.deep_water_m2 !== null
    ) {
        addOverviewValue(
            container,
            "DEEP WATER",
            `${cleanNumber(report.habitat.deep_water_m2)} m²`
        );
    }

    if (
        report.habitat.climb_m2 !== null
    ) {
        addOverviewValue(
            container,
            "CLIMBING",
            `${cleanNumber(report.habitat.climb_m2)} m²`
        );
    }
}

function renderOverviewTerrain(report) {
    const container =
        document.getElementById(
            "overview-terrain"
        );

    container.innerHTML = "";

    const order = [
        "Short Grass",
        "Long Grass",
        "Soil",
        "Rock",
        "Sand",
        "Snow"
    ];

    order.forEach(terrainName => {
        const terrain =
            report.terrain
                .requirements[
                    terrainName
                ];

        const item =
            document.createElement(
                "div"
            );

        item.className =
            "overview-grid-item";

        if (!terrain.viable) {
            item.classList.add(
                "incompatible-box"
            );
        }

        item.innerHTML = `
            <div class="overview-label">
                ${terrainName.toUpperCase()}
            </div>

            <div class="overview-number">
                ${cleanNumber(terrain.min)}% -
                ${cleanNumber(terrain.max)}%
            </div>
        `;

        container.appendChild(item);
    });
}

function renderOverviewBarrier(report) {
    const container =
        document.getElementById(
            "overview-barrier"
        );

    container.innerHTML = "";

    const barrier =
        report.barrier;

    addOverviewValue(
        container,
        "BARRIER GRADE",
        barrier.required_grade === null
            ? "—"
            : barrier.required_grade
    );

    addOverviewValue(
        container,
        "MINIMUM HEIGHT",
        barrier.required_height_m === null
            ? "—"
            : `${cleanNumber(barrier.required_height_m)} m`
    );

    addOverviewValue(
        container,
        "CLIMB-PROOF",
        barrier.climbproof_required
            ? "REQUIRED"
            : "NOT REQUIRED"
    );
}

function renderOverviewGroups(report) {
    const container =
        document.getElementById(
            "overview-groups"
        );

    container.innerHTML = "";

    [...report.group_sizes]
        .sort(
            (a, b) =>
                a.name.localeCompare(
                    b.name
                )
        )
        .forEach(group => {
            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "overview-group-card";

            card.innerHTML = `
                <div class="overview-group-name">
                    ${group.name}
                </div>

                <div>
                    GENERAL:
                    ${displayValue(group.group_min)}
                    THROUGH
                    ${displayValue(group.group_max)}
                    ADULTS
                </div>

                <div>
                    BACHELOR:
                    ♂ ${displayValue(group.bachelor_male_max)}
                    &nbsp;&nbsp;
                    ♀ ${displayValue(group.bachelor_female_max)}
                </div>

                <div>
                    BREEDING:
                    ♂ ${displayValue(group.mixed_male_max)}
                    &nbsp;&nbsp;
                    ♀ ${displayValue(group.mixed_female_max)}
                </div>
            `;

            container.appendChild(card);
        });
}

function renderStep3(report) {
    renderStep3Warnings(report);
    renderStep3Notes(report);
    renderOverviewSpecies(report);
    renderOverviewBiomes(report);
    renderOverviewTemperature(report);
    renderOverviewArea(report);
    renderOverviewTerrain(report);
    renderOverviewBarrier(report);
    renderOverviewGroups(report);
}

document
    .getElementById(
        "step3-go-back-button"
    )
    .addEventListener(
        "click",
        () => {
            renderStep2();

            showScreen(
                step2Screen
            );
        }
    );

document
    .getElementById(
        "start-over-button"
    )
    .addEventListener(
        "click",
        () => {
            const confirmed =
                window.confirm(
                    "Start over? Your current habitat selections will be cleared."
                );

            if (!confirmed) {
                return;
            }

            selectedSpecies.clear();

            currentHabitatReport =
                null;
            clearStoredHabitatReport();

            syncStep1Selections();
            updateSelectedCount();
            renderStep2();

            showScreen(
                launchScreen
            );
        }
    );

async function loadSpecies() {
    try {
        const response =
            await fetch(
                "/api/species"
            );

        if (!response.ok) {
            throw new Error(
                "Unable to load species data."
            );
        }

        speciesData =
            await response.json();

        renderSpecies(
            speciesData
        );
        buildAlphabetRail();
        restoreHabitatSelections();
    } catch (error) {
        console.error(error);

        speciesList.innerHTML =
            '<div class="loading-message">Unable to load species data.</div>';
    }
}

history.replaceState({pzScreen: "launch-screen"}, "", location.pathname);
loadSpecies();

// Credits navigation does not change the habitat selections.
document.getElementById("credits-back-button").addEventListener("click", () => {
    showScreen(launchScreen);
    document.getElementById("credits-button").focus();
});
function filterCredits() {
    const query = document.getElementById("credits-search").value.trim().toLocaleLowerCase();
    const entries = document.querySelectorAll(".credit-entry");
    let visible = 0;
    entries.forEach(entry => {
        entry.hidden = !entry.textContent.toLocaleLowerCase().includes(query);
        if (!entry.hidden) visible++;
    });
    document.getElementById("credits-count").textContent = `${visible} of ${entries.length} entries`;
    document.getElementById("credits-empty").hidden = visible !== 0;
}
document.getElementById("credits-search").addEventListener("input", filterCredits);
