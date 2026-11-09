import React, { useEffect, useState } from "react";

import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
} from "react-native";

import { DEFAULT_FILTERS } from "../utils/restaurantFilters";

const OPTIONS = {
  cuisine: [
    ["All", ""],
    ["American", "american"],
    ["Chinese", "chinese"],
    ["Italian", "italian"],
    ["Japanese", "japanese"],
    ["Mexican", "mexican"],
    ["Other", "other"],
  ],

  price: [
    ["Any", ""],
    ["$", "$"],
	["$$", "$$"],
	["$$$", "$$$"],
	["$$$$", "$$$$"],
  ],

  minRating: [
    ["Any", null],
    ["3.0+", 3],
    ["4.0+", 4],
    ["4.5+", 4.5],
  ],

  distance: [
    ["Any", null],
    ["1 km", 1],
    ["5 km", 5],
    ["10 km", 10],
    ["20 km", 20],
  ],
};

export default function RestaurantFilter({
  visible,
  filters,
  onApply,
  onClose,
}) {
  const [draft, setDraft] = useState({ ...filters });

  useEffect(() => {
    if (visible) {
      setDraft({ ...filters });
    }
  }, [visible, filters]);

  function renderOptions(title, field) {
    return (
      <View style={styles.section}>
        <Text style={styles.heading}>{title}</Text>

        <View style={styles.options}>
          {OPTIONS[field].map(([label, value]) => {
            const selected = draft[field] === value;

            return (
              <Pressable
                key={label}
                style={[
                  styles.option,
                  selected && styles.selectedOption,
                ]}
                onPress={() =>
                  setDraft((previous) => ({
                    ...previous,
                    [field]: value,
                  }))
                }
              >
                <Text
                  style={[
                    styles.optionText,
                    selected && styles.selectedText,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Filters</Text>

          <Pressable onPress={onClose}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {renderOptions("Cuisine Type", "cuisine")}

			{/* Price Range */}
			<View style={styles.section}>
			<Text style={styles.heading}>Price Range ($)</Text>

			<View style={styles.inputRow}>
				<View style={styles.inputGroup}>
				<Text style={styles.label}>Minimum Price</Text>

				<TextInput
					style={styles.numberInput}
					placeholder="e.g. 10"
					keyboardType="decimal-pad"
					value={draft.minPrice}
					onChangeText={(value) =>
					setDraft((previous) => ({
						...previous,
						minPrice: value,
					}))
					}
				/>
				</View>

				<View style={styles.inputGroup}>
				<Text style={styles.label}>Maximum Price</Text>

				<TextInput
					style={styles.numberInput}
					placeholder="e.g. 50"
					keyboardType="decimal-pad"
					value={draft.maxPrice}
					onChangeText={(value) =>
					setDraft((previous) => ({
						...previous,
						maxPrice: value,
					}))
					}
				/>
				</View>
			</View>
			</View>

			{renderOptions("Minimum Rating", "minRating")}

			{/* Distance */}
			<View style={styles.section}>
			<Text style={styles.heading}>Maximum Distance (km)</Text>

			<View style={styles.options}>
				{OPTIONS.distance.map(([label, value]) => {
				const selected = draft.distance === value;

				return (
					<Pressable
					key={label}
					style={[
						styles.option,
						selected && styles.selectedOption,
					]}
					onPress={() =>
						setDraft((previous) => ({
						...previous,
						distance: value,
						customDistance: "",
						}))
					}
					>
					<Text
						style={[
						styles.optionText,
						selected && styles.selectedText,
						]}
					>
						{label}
					</Text>
					</Pressable>
				);
				})}
			</View>

			<Text style={styles.label}>Custom Distance</Text>

			<TextInput
				style={styles.numberInput}
				placeholder="Enter distance in km"
				keyboardType="decimal-pad"
				value={draft.customDistance}
				onChangeText={(value) =>
				setDraft((previous) => ({
					...previous,
					customDistance: value,
					distance: null,
				}))
				}
			/>
			</View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={styles.clearButton}
            onPress={() => {
              setDraft({ ...DEFAULT_FILTERS });
              onApply({ ...DEFAULT_FILTERS });
            }}
          >
            <Text style={styles.clearText}>Clear Filters</Text>
          </Pressable>

          <Pressable
            style={styles.applyButton}
            onPress={() => onApply(draft)}
          >
            <Text style={styles.applyText}>Show Results</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  title: {
    fontSize: 22,
    fontWeight: "bold",
  },

  close: {
    fontSize: 22,
    color: "#666",
  },

  content: {
    padding: 20,
  },

  section: {
    marginBottom: 28,
  },

  heading: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 12,
  },

  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  option: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },

  selectedOption: {
    backgroundColor: "#2563eb",
  },

  optionText: {
    color: "#333",
  },

  selectedText: {
    color: "#fff",
  },

  footer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },

  clearButton: {
    flex: 1,
    padding: 14,
    backgroundColor: "#eee",
    borderRadius: 10,
    alignItems: "center",
  },

  clearText: {
    fontWeight: "600",
  },

  applyButton: {
    flex: 1,
    padding: 14,
    backgroundColor: "#2563eb",
    borderRadius: 10,
    alignItems: "center",
  },

  applyText: {
    color: "#fff",
    fontWeight: "600",
  },

  inputRow: {
	flexDirection: "row",
	gap: 12,
	},

	inputGroup: {
	flex: 1,
	},

	label: {
	fontSize: 14,
	color: "#666",
	marginBottom: 8,
	marginTop: 12,
	},

	numberInput: {
	borderWidth: 1,
	borderColor: "#ddd",
	backgroundColor: "#fff",
	borderRadius: 10,
	paddingHorizontal: 14,
	height: 46,
	fontSize: 16,
	},
});