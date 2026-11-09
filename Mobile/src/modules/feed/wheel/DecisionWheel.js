import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import SegmentedWheelFace from "./SegmentedWheelFace";

import {
  dishChoice,
  EMPTY_FILTERS,
  filterWheelCandidates,
  restaurantChoice,
  uniqueChoices,
} from "./wheelCandidates";

import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../../shared/design/tokens";

import {
  AppInput,
} from "../../../shared/design/UIComponents";

import AppIcon from "../../../shared/components/AppIcon";

const MODES = [
  ["restaurant", "Restaurants"],
  ["dish", "Dishes"],
  ["custom", "Custom"],
];

const MAX_CHOICES = 20;
const BASE_SIZE = 236;

const WHEEL_COLORS = [
  "#FF3654",
  "#FF8A65",
  "#F5B942",
  "#5CB8A6",
  "#7895E8",
  "#B58CE5",
];

const EMPTY = [];

const defaultAnimation = (rotation, config) =>
  Animated.timing(rotation, config);

function Button({
  label,
  onPress,
  disabled = false,
  selected = false,
  primary = false,
  icon,
}) {
  const highlighted = selected || primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{
        disabled: Boolean(disabled),
        selected,
      }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        highlighted && styles.primary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon && (
        <AppIcon
          name={icon}
          size={16}
          color={
            highlighted
              ? colors.white
              : colors.text
          }
        />
      )}

      <Text
        style={[
          styles.buttonText,
          highlighted && styles.primaryText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ResultDetails({
  winner,
  mode,
  resolveImageUrl,
}) {
  const [failed, setFailed] = useState(false);
  const record = winner.record;

  let url = record?.imageUrl;

  try {
    if (resolveImageUrl && url) {
      url = resolveImageUrl(url);
    }
  } catch {
    url = null;
  }

  let usable = false;

  try {
    const parsed =
      typeof url === "string"
        ? new URL(url)
        : null;

    usable =
      parsed !== null &&
      ["http:", "https:"].includes(parsed.protocol) &&
      Boolean(parsed.hostname);
  } catch {
    // Invalid image URLs use the placeholder.
  }

  useEffect(() => {
    setFailed(false);
  }, [winner.id, url]);

  if (mode === "custom") {
    return null;
  }

  const rating =
    mode === "restaurant"
      ? record?.rating
      : record?.averageRating;

  const hasRating =
    typeof rating === "number" &&
    Number.isFinite(rating) &&
    record?.reviewCount > 0;

  const detail =
    mode === "restaurant"
      ? record?.address || "Address unavailable"
      : winner.parentRestaurant?.name ||
        "Parent restaurant unavailable";

  return (
    <View style={styles.resultDetails}>
      {usable && !failed ? (
        <Image
          source={{ uri: url }}
          style={styles.resultPhoto}
          resizeMode="cover"
          accessibilityLabel={`${winner.label} photo`}
          testID="wheel-result-photo"
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={styles.photoPlaceholder}>
          <AppIcon
            name="image"
            size={28}
            color={colors.textMuted}
          />
          <Text style={styles.muted}>
            Photo unavailable
          </Text>
        </View>
      )}

      <View style={styles.resultRatingRow}>
        {hasRating && (
          <AppIcon
            name="starFilled"
            size={18}
            color={colors.primary}
          />
        )}

        <Text style={styles.resultRating}>
          {hasRating
            ? rating.toFixed(1)
            : "No ratings yet"}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <AppIcon
          name="location"
          size={17}
          color={colors.textMuted}
        />

        <Text style={[styles.muted, styles.detailFlex]}>
          {detail}
        </Text>
      </View>
    </View>
  );
}

export default function DecisionWheel({
  restaurants = EMPTY,
  dishes = EMPTY,
  savedPlaces = EMPTY,
  savedDishes = EMPTY,
  onRestaurantPress,
  onDishPress,
  privateSessionKey,
  resolveImageUrl,
  random = Math.random,
  createSpinAnimation = defaultAnimation,
  filterRestaurants,
  userLocation,
  onRequestLocation,
}) {
  const { width } = useWindowDimensions();

  const wheelSize = Math.min(
    BASE_SIZE,
    Math.max(160, width - 64)
  );

  const [mode, setMode] = useState("restaurant");
  const [options, setOptions] = useState({ custom: [] });
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);

  const [savedSelection, setSavedSelection] = useState({
    restaurant: [],
    dish: [],
  });

  const [scope, setScope] = useState(privateSessionKey);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [query, setQuery] = useState("");
  const [filterSelection, setFilterSelection] = useState([]);

  const rotation = useRef(new Animated.Value(0)).current;
  const angle = useRef(0);
  const animation = useRef(null);
  const generation = useRef(0);
  const currentScope = useRef(privateSessionKey);

  currentScope.current = privateSessionKey;

  // Account switch protection.
  if (scope !== privateSessionKey) {
    generation.current += 1;
    setScope(privateSessionKey);

    setOptions((previous) =>
      Object.fromEntries(
        Object.entries(previous).map(([key, values]) => [
          key,
          values.filter((choice) => !choice.private),
        ])
      )
    );

    setSavedSelection({ restaurant: [], dish: [] });
    setWinner(null);
    setSpinning(false);
    setEditing(null);
    setError("");
  }

  useEffect(() => {
    angle.current = 0;
    rotation.setValue(0);

    return () => {
      generation.current += 1;

      const running = animation.current;
      animation.current = null;
      running?.handle.stop();
    };
  }, [privateSessionKey, rotation]);

  const catalog = uniqueChoices(
    mode === "restaurant"
      ? restaurants.map((item) => restaurantChoice(item))
      : dishes.map((item) => dishChoice(item, restaurants))
  );

  const choices =
    options[mode] ?? catalog.slice(0, 6);

  const choiceIds = new Set(
    choices.map((choice) => choice.id)
  );

  const unused =
    mode === "custom"
      ? []
      : catalog.filter((choice) => !choiceIds.has(choice.id));

  const savedCatalog =
    privateSessionKey === null
      ? []
      : uniqueChoices(
          mode === "restaurant"
            ? savedPlaces.map((item) =>
                restaurantChoice(item, true)
              )
            : savedDishes.map((item) =>
                dishChoice(item, restaurants, true)
              )
        );

  const saved = savedCatalog.filter(
    (choice) => !choiceIds.has(choice.id)
  );

  const selectedSaved = saved.filter((choice) =>
    (savedSelection[mode] || []).includes(choice.id)
  );

  const resultHandler =
    mode === "restaurant"
      ? onRestaurantPress
      : mode === "dish" && winner?.restaurantId
        ? onDishPress
        : null;

  const resultAction =
    typeof resultHandler === "function"
      ? resultHandler
      : null;

  const preview =
    mode !== "custom" && filterRestaurants
      ? filterWheelCandidates({
          mode,
          restaurants,
          dishes,
          searchQuery: query,
          filters,
          filterRestaurants,
          userLocation,
        })
      : { choices: [] };

  const previewChoices = preview.choices.filter(
    (choice) => !choiceIds.has(choice.id)
  );

  function resetResult() {
    setWinner(null);
    setError("");
    angle.current = 0;
    rotation.setValue(0);
  }

  function updateChoices(nextChoices) {
    setOptions((previous) => ({
      ...previous,
      [mode]: nextChoices,
    }));

    resetResult();
  }

  function switchMode(nextMode) {
    if (animation.current || mode === nextMode) {
      return;
    }

    setMode(nextMode);
    setDraft("");
    setEditing(null);
    setFilterSelection([]);
    resetResult();
  }

  function addChoices(additions) {
    if (animation.current) return false;

    const unique = uniqueChoices(additions).filter(
      (choice) => !choiceIds.has(choice.id)
    );

    if (choices.length + unique.length > MAX_CHOICES) {
      setError(
        `${unique.length} selected; only ` +
        `${MAX_CHOICES - choices.length} spaces remain. ` +
        `No options were added. ` +
        `The wheel holds up to ${MAX_CHOICES} options.`
      );

      return false;
    }

    updateChoices([...choices, ...unique]);
    return true;
  }

  function saveCustom() {
    if (animation.current) return;

    const label = draft.trim().replace(/\s+/g, " ");
    const id = label.toLowerCase();

    if (!label) {
      setError("Enter an option name.");
      return;
    }

    if (id !== editing && choiceIds.has(id)) {
      setError("That option is already on the wheel.");
      return;
    }

    const choice = { id, label };

    if (editing === null) {
      if (!addChoices([choice])) return;
    } else {
      updateChoices(
        choices.map((current) =>
          current.id === editing ? choice : current
        )
      );
    }

    setDraft("");
    setEditing(null);
  }

  function remove(id) {
    if (animation.current) return;

    updateChoices(
      choices.filter((choice) => choice.id !== id)
    );

    if (id === editing) {
      setEditing(null);
      setDraft("");
    }
  }

  function chooseCatalog(choice) {
    if (animation.current) return;

    if (editing === null) {
      addChoices([choice]);
    } else {
      updateChoices(
        choices.map((current) =>
          current.id === editing ? choice : current
        )
      );
      setEditing(null);
    }
  }

  function spin() {
    if (animation.current || choices.length < 2) return;

    const value = random();

    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value >= 1
    ) {
      setError("The wheel could not spin. Try again.");
      return;
    }

    const snapshot = choices.slice();
    const index = Math.floor(value * snapshot.length);

    const sectorCenter =
      ((index + 0.5) * 360) / snapshot.length;

    const alignment =
      (360 - ((sectorCenter + angle.current) % 360)) % 360;

    const target =
      angle.current + 4 * 360 + alignment;

    const spinScope = privateSessionKey;
    const runId = ++generation.current;

    setOptions((previous) => ({
      ...previous,
      [mode]: snapshot,
    }));

    setWinner(null);
    setError("");
    setSpinning(true);

    const handle = createSpinAnimation(rotation, {
      toValue: target,
      duration: 1500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });

    animation.current = { handle, runId };

    handle.start(({ finished }) => {
      if (
        runId !== generation.current ||
        spinScope !== currentScope.current
      ) {
        return;
      }

      animation.current = null;
      setSpinning(false);

      if (!finished) return;

      angle.current = target % 360;
      rotation.setValue(angle.current);
      setWinner(snapshot[index]);
    });
  }

  function openWinner() {
    if (!winner || !resultAction) return;

    if (mode === "restaurant") {
      resultAction(winner.id);
    } else {
      resultAction(winner.id, winner.restaurantId);
    }
  }

  function toggleSaved(id) {
    setSavedSelection((previous) => {
      const selected = previous[mode] || [];

      return {
        ...previous,
        [mode]: selected.includes(id)
          ? selected.filter((value) => value !== id)
          : [...selected, id],
      };
    });
  }

  function changeFilter(key, value) {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }));
    setFilterSelection([]);
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <AppIcon
            name="wheel"
            size={25}
            color={colors.primary}
          />

          <Text
            accessibilityRole="header"
            style={styles.heading}
          >
            Decision Wheel
          </Text>
        </View>

        <Text style={styles.muted}>
          Pick at least two options and let the wheel choose.
        </Text>
      </View>

      <View style={styles.modeSection}>
        <View style={styles.row}>
          {MODES.map(([value, label]) => (
            <Button
              key={value}
              label={label}
              selected={mode === value}
              disabled={spinning}
              onPress={() => switchMode(value)}
              icon={
                value === "restaurant"
                  ? "restaurant"
                  : value === "dish"
                    ? "cuisine"
                    : "edit"
              }
            />
          ))}
        </View>
      </View>

      <View style={styles.wheelSection}>
        <SegmentedWheelFace
          choices={choices}
          rotation={rotation}
          size={wheelSize}
        />

        <View style={styles.spinButton}>
          <Button
            label={spinning ? "Spinning..." : "Spin the Wheel"}
            primary
            disabled={spinning || choices.length < 2}
            onPress={spin}
            icon="wheel"
          />
        </View>
      </View>

      {winner && (
        <View style={styles.result}>
          <View style={styles.resultTitle}>
            <AppIcon
              name="success"
              size={23}
              color={colors.success}
            />

            <Text
              accessibilityRole="alert"
              style={styles.resultText}
            >
              The wheel picked {winner.label}
            </Text>
          </View>

          <ResultDetails
            winner={winner}
            mode={mode}
            resolveImageUrl={resolveImageUrl}
          />

          {resultAction && (
            <Button
              label="Open Details"
              icon="forward"
              onPress={openWinner}
            />
          )}
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text
            accessibilityRole="header"
            style={styles.subheading}
          >
            Options ({choices.length}/{MAX_CHOICES})
          </Text>

          <Button
            label="Clear All"
            icon="delete"
            disabled={spinning || choices.length === 0}
            onPress={() => {
              if (animation.current) return;
              updateChoices([]);
              setEditing(null);
              setDraft("");
            }}
          />
        </View>

        {choices.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.muted}>
              No options yet. Add at least two choices
              to spin the wheel.
            </Text>
          </View>
        )}

        {choices.map(({ id, label }, index) => (
          <View key={id} style={styles.option}>
            <View style={styles.optionHeading}>
              <View
                style={[
                  styles.optionNumber,
                  {
                    backgroundColor:
                      WHEEL_COLORS[index % WHEEL_COLORS.length],
                  },
                ]}
              >
                <Text style={styles.optionNumberText}>
                  {index + 1}
                </Text>
              </View>

              <Text style={styles.optionLabel}>
                {label}
              </Text>
            </View>

            <View style={styles.row}>
              <Button
                label={
                  mode === "custom"
                    ? `Edit ${label}`
                    : `Replace ${label}`
                }
                icon="edit"
                disabled={spinning}
                onPress={() => {
                  setEditing(id);
                  setDraft(mode === "custom" ? label : "");
                  setError("");
                }}
              />

              <Button
                label={`Remove ${label}`}
                icon="delete"
                disabled={spinning}
                onPress={() => remove(id)}
              />
            </View>
          </View>
        ))}
      </View>

      {mode === "custom" ? (
        <View style={styles.section}>
          <Text style={styles.subheading}>
            Add Custom Option
          </Text>

          <AppInput
            label="Option"
            leftIcon="edit"
            accessibilityLabel="Custom option"
            editable={!spinning}
            maxLength={60}
            onChangeText={setDraft}
            onSubmitEditing={saveCustom}
            placeholder="e.g. Cook at home"
            value={draft}
            containerStyle={styles.inputContainer}
          />

          <Button
            label={editing === null ? "Add" : "Save Edit"}
            icon={editing === null ? "add" : "check"}
            disabled={spinning}
            onPress={saveCustom}
            primary
          />
        </View>
      ) : (
        <>
          {saved.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.subheading}>
                Select Saved{" "}
                {mode === "restaurant"
                  ? "Restaurants"
                  : "Dishes"}
              </Text>

              <View style={styles.row}>
                {saved.map((choice) => (
                  <Button
                    key={choice.id}
                    label={`Select saved ${choice.label}`}
                    icon="bookmark"
                    selected={
                      (savedSelection[mode] || []).includes(
                        choice.id
                      )
                    }
                    disabled={spinning}
                    onPress={() => toggleSaved(choice.id)}
                  />
                ))}
              </View>

              <Button
                label={
                  mode === "restaurant"
                    ? "Import Saved Restaurants"
                    : "Import Saved Dishes"
                }
                icon="add"
                disabled={
                  spinning ||
                  selectedSaved.length === 0
                }
                onPress={() => {
                  if (addChoices(selectedSaved)) {
                    setSavedSelection((previous) => ({
                      ...previous,
                      [mode]: [],
                    }));
                  }
                }}
              />
            </View>
          )}

          {privateSessionKey === null && (
            <View style={styles.notice}>
              <Text style={styles.muted}>
                Sign in to import saved items.
                You can still use the catalog or custom options.
              </Text>
            </View>
          )}

          {unused.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.subheading}>
                {editing === null
                  ? "Add from the Catalog"
                  : "Choose a Replacement"}
              </Text>

              <View style={styles.row}>
                {unused.map((choice) => (
                  <Button
                    key={choice.id}
                    label={choice.label}
                    icon="add"
                    disabled={spinning}
                    onPress={() => chooseCatalog(choice)}
                  />
                ))}
              </View>
            </View>
          )}

          {editing !== null && unused.length === 0 && (
            <Text style={styles.muted}>
              No other catalog choices are available.
            </Text>
          )}

          {catalog.length === 0 && choices.length === 0 && (
            <Text style={styles.muted}>
              No catalog options are available.
            </Text>
          )}

          {filterRestaurants && (
            <View style={styles.section}>
              <View style={styles.titleRow}>
                <AppIcon
                  name="filter"
                  size={21}
                  color={colors.primary}
                />

                <Text
                  accessibilityRole="header"
                  style={styles.subheading}
                >
                  Smart Filtering
                </Text>
              </View>

              {mode === "dish" && (
                <Text style={styles.muted}>
                  Cuisine, price and distance use the
                  parent restaurant. Minimum rating uses
                  the dish rating.
                </Text>
              )}

              <AppInput
                leftIcon="search"
                accessibilityLabel="Filter search"
                containerStyle={styles.inputContainer}
                value={query}
                placeholder={
                  mode === "dish"
                    ? "Dish name"
                    : "Restaurant search"
                }
                editable={!spinning}
                onChangeText={(value) => {
                  setQuery(value);
                  setFilterSelection([]);
                }}
              />

              <Text style={styles.fieldLabel}>
                Cuisine
              </Text>

              <View style={styles.row}>
                {[
                  "",
                  "american",
                  "chinese",
                  "italian",
                  "japanese",
                  "mexican",
                  "other",
                ].map((value) => (
                  <Button
                    key={value}
                    label={value || "Any Cuisine"}
                    selected={filters.cuisine === value}
                    disabled={spinning}
                    onPress={() =>
                      changeFilter("cuisine", value)
                    }
                  />
                ))}
              </View>

              <View style={styles.filterFields}>
                {[
                  ["minPrice", "Minimum price (USD)", "price"],
                  ["maxPrice", "Maximum price (USD)", "price"],
                  [
                    "minRating",
                    mode === "dish"
                      ? "Minimum dish rating"
                      : "Minimum restaurant rating",
                    "star",
                  ],
                  [
                    "customDistance",
                    "Maximum distance (km)",
                    "location",
                  ],
                ].map(([key, label, icon]) => (
                  <AppInput
                    key={key}
                    label={label}
                    leftIcon={icon}
                    accessibilityLabel={label}
                    containerStyle={styles.inputContainer}
                    placeholder={label}
                    keyboardType="decimal-pad"
                    editable={!spinning}
                    value={
                      filters[key] == null
                        ? ""
                        : String(filters[key])
                    }
                    onChangeText={(value) =>
                      changeFilter(
                        key,
                        key === "minRating" &&
                          value.trim() === ""
                          ? null
                          : value
                      )
                    }
                  />
                ))}
              </View>

              <Text style={styles.muted}>
                Taste filtering is unavailable until
                numeric traits and a match rule are supplied.
              </Text>

              {preview.error && (
                <Text
                  accessibilityRole="alert"
                  style={styles.error}
                >
                  {preview.error}
                </Text>
              )}

              {preview.needsLocation &&
                typeof onRequestLocation === "function" && (
                  <Button
                    label="Use My Location"
                    icon="location"
                    disabled={spinning}
                    onPress={onRequestLocation}
                  />
                )}

              {!preview.error && (
                <Text style={styles.muted}>
                  {preview.choices.length === 0
                    ? "No matching candidates."
                    : `${preview.choices.length} matching candidates; ` +
                      `${previewChoices.length} available to add.`}
                </Text>
              )}

              <View style={styles.row}>
                {previewChoices.map((choice) => (
                  <Button
                    key={choice.id}
                    label={`Select candidate ${choice.label}`}
                    icon="add"
                    selected={filterSelection.includes(
                      choice.id
                    )}
                    disabled={spinning}
                    onPress={() =>
                      setFilterSelection((previous) =>
                        previous.includes(choice.id)
                          ? previous.filter(
                              (id) => id !== choice.id
                            )
                          : [...previous, choice.id]
                      )
                    }
                  />
                ))}
              </View>

              <View style={styles.row}>
                <Button
                  label="Add Selected Candidates"
                  icon="add"
                  disabled={
                    spinning ||
                    !previewChoices.some((choice) =>
                      filterSelection.includes(choice.id)
                    )
                  }
                  onPress={() => {
                    if (
                      addChoices(
                        previewChoices.filter((choice) =>
                          filterSelection.includes(choice.id)
                        )
                      )
                    ) {
                      setFilterSelection([]);
                    }
                  }}
                />

                <Button
                  label="Add All Candidates"
                  icon="add"
                  disabled={
                    spinning ||
                    previewChoices.length === 0
                  }
                  onPress={() => {
                    if (addChoices(previewChoices)) {
                      setFilterSelection([]);
                    }
                  }}
                />
              </View>
            </View>
          )}
        </>
      )}

      {editing !== null && (
        <Button
          label="Cancel Edit"
          icon="close"
          disabled={spinning}
          onPress={() => {
            setEditing(null);
            setDraft("");
            setError("");
          }}
        />
      )}

      {error !== "" && (
        <View style={styles.errorRow}>
          <AppIcon
            name="error"
            size={18}
            color={colors.error}
          />

          <Text
            accessibilityRole="alert"
            style={styles.error}
          >
            {error}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  heading: {
    ...typography.title,
    color: colors.text,
  },
  subheading: {
    ...typography.section,
    color: colors.text,
  },
  muted: {
    ...typography.body,
    color: colors.textSecondary,
  },
  section: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  modeSection: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  button: {
    minHeight: 44,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
    flexShrink: 1,
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  primaryText: {
    color: colors.white,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
  wheelSection: {
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.xl,
  },
  spinButton: {
    alignSelf: "stretch",
  },
  result: {
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  resultTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  resultText: {
    ...typography.section,
    color: colors.text,
    textAlign: "center",
    flexShrink: 1,
  },
  resultDetails: {
    gap: spacing.sm,
  },
  resultPhoto: {
    width: "100%",
    height: 170,
    borderRadius: radius.md,
  },
  photoPlaceholder: {
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
  },
  resultRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  resultRating: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  detailFlex: {
    flex: 1,
  },
  option: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  optionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  optionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  optionNumberText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.white,
  },
  optionLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    fontWeight: "600",
  },
  inputContainer: {
    marginBottom: 0,
    width: "100%",
  },
  filterFields: {
    gap: spacing.md,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  notice: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  emptyCard: {
    padding: spacing.xl,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    alignItems: "center",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  error: {
    ...typography.body,
    color: colors.error,
    fontWeight: "600",
    flexShrink: 1,
  },
});