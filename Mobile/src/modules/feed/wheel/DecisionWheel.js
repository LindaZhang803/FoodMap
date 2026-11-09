import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { dishChoice, EMPTY_FILTERS, filterWheelCandidates, restaurantChoice, uniqueChoices } from './wheelCandidates';

const MODES = [['restaurant', 'Restaurants'], ['dish', 'Dishes'], ['custom', 'Custom']];
const MAX_CHOICES = 20;
const SIZE = 236;
const CENTER = SIZE / 2;
const MARKER_RADIUS = 92;
const COLORS = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#dc2626'];
const EMPTY = [];
const defaultAnimation = (rotation, config) => Animated.timing(rotation, config);

function Button({ label, onPress, disabled, selected, primary }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), selected }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, (selected || primary) && styles.primary, disabled && styles.disabled]}
    >
      <Text style={[styles.buttonText, (selected || primary) && styles.primaryText]}>{label}</Text>
    </Pressable>
  );
}

function WheelFace({ choices, rotation }) {
  const transform = rotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.wheelWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.wheel, { transform: [{ rotate: transform }] }]}>
        {choices.map(({ id }, index) => {
          const degrees = 360 / choices.length;
          const angle = ((index + 0.5) * degrees * Math.PI) / 180;
          return (
            <React.Fragment key={id}>
              {choices.length > 1 && (
                <View style={[styles.spoke, { transform: [{ rotate: `${index * degrees}deg` }] }]}>
                  <View style={styles.line} />
                </View>
              )}
              <View
                style={[
                  styles.marker,
                  {
                    backgroundColor: COLORS[index % COLORS.length],
                    left: CENTER - 12 + MARKER_RADIUS * Math.sin(angle),
                    top: CENTER - 12 - MARKER_RADIUS * Math.cos(angle),
                  },
                ]}
              >
                <Text style={styles.markerText}>{index + 1}</Text>
              </View>
            </React.Fragment>
          );
        })}
        <View style={styles.hub} />
      </Animated.View>
      <View style={styles.pointer} />
    </View>
  );
}

function ResultDetails({ winner, mode, resolveImageUrl }) {
  const [failed, setFailed] = useState(false);
  const record = winner.record;
  let url = record?.imageUrl;
  try { if (resolveImageUrl && url) url = resolveImageUrl(url); } catch { url = null; }
  let usable = false;
  try {
    const parsed = typeof url === 'string' ? new URL(url) : null;
    usable = parsed !== null && ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.hostname);
  } catch { /* Missing and invalid images use the same placeholder. */ }
  useEffect(() => setFailed(false), [winner.id, url]);
  if (mode === 'custom') return null;
  const rating = mode === 'restaurant' ? record?.rating : record?.averageRating;
  return <>
    {usable && !failed
      ? <Image source={{ uri: url }} style={styles.resultPhoto} resizeMode="cover"
          accessibilityLabel={`${winner.label} photo`} testID="wheel-result-photo" onError={() => setFailed(true)} />
      : <Text style={styles.muted}>Photo unavailable</Text>}
    <Text>{typeof rating === 'number' && Number.isFinite(rating) && record?.reviewCount > 0
      ? `${mode === 'dish' ? 'Dish rating' : 'Rating'} ${rating.toFixed(1)}` : 'No ratings yet'}</Text>
    <Text>{mode === 'restaurant' ? record?.address || 'Address unavailable'
      : winner.parentRestaurant?.name || 'Parent restaurant unavailable'}</Text>
  </>;
}

/**
 * privateSessionKey is a stable opaque host value for account + token + origin.
 * null disables saved imports; undefined preserves the standalone demo API.
 * Public choices survive account changes; imported choices and spin results do not.
 */
export default function DecisionWheel({
  restaurants = EMPTY, dishes = EMPTY, savedPlaces = EMPTY, savedDishes = EMPTY,
  onRestaurantPress, onDishPress, privateSessionKey, resolveImageUrl,
  random = Math.random, createSpinAnimation = defaultAnimation,
  filterRestaurants, userLocation, onRequestLocation,
}) {
  const [mode, setMode] = useState('restaurant');
  const [options, setOptions] = useState({ custom: [] });
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const [savedSelection, setSavedSelection] = useState({ restaurant: [], dish: [] });
  const [scope, setScope] = useState(privateSessionKey);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [query, setQuery] = useState('');
  const [filterSelection, setFilterSelection] = useState([]);
  const rotation = useRef(new Animated.Value(0)).current;
  const angle = useRef(0);
  const animation = useRef(null);
  const generation = useRef(0);
  const currentScope = useRef(privateSessionKey);
  currentScope.current = privateSessionKey;

  // Reset before rendering so previous-account selections never flash on screen.
  if (scope !== privateSessionKey) {
    generation.current += 1;
    setScope(privateSessionKey);
    setOptions(previous => Object.fromEntries(Object.entries(previous)
      .map(([key, values]) => [key, values.filter(choice => !choice.private)])));
    setSavedSelection({ restaurant: [], dish: [] });
    setWinner(null);
    setSpinning(false);
    setEditing(null);
    setError('');
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

  const catalog = uniqueChoices(mode === 'restaurant'
    ? restaurants.map(item => restaurantChoice(item))
    : dishes.map(item => dishChoice(item, restaurants)));
  const choices = options[mode] ?? catalog.slice(0, 6);
  const choiceIds = new Set(choices.map(choice => choice.id));
  const unused = mode === 'custom' ? [] : catalog.filter(choice => !choiceIds.has(choice.id));
  const savedCatalog = privateSessionKey === null ? [] : uniqueChoices(mode === 'restaurant'
    ? savedPlaces.map(item => restaurantChoice(item, true))
    : savedDishes.map(item => dishChoice(item, restaurants, true)));
  const saved = savedCatalog.filter(choice => !choiceIds.has(choice.id));
  const selectedSaved = saved.filter(choice => (savedSelection[mode] || []).includes(choice.id));
  const resultHandler = mode === 'restaurant' ? onRestaurantPress
    : mode === 'dish' && winner?.restaurantId ? onDishPress : null;
  const resultAction = typeof resultHandler === 'function' ? resultHandler : null;
  const preview = mode !== 'custom' && filterRestaurants
    ? filterWheelCandidates({ mode, restaurants, dishes, searchQuery: query, filters, filterRestaurants, userLocation })
    : { choices: [] };
  const previewChoices = preview.choices.filter(choice => !choiceIds.has(choice.id));

  function resetResult() {
    setWinner(null);
    setError('');
    angle.current = 0;
    rotation.setValue(0);
  }

  function updateChoices(nextChoices) {
    setOptions(previous => ({ ...previous, [mode]: nextChoices }));
    resetResult();
  }

  function switchMode(nextMode) {
    if (animation.current || mode === nextMode) return;
    setMode(nextMode);
    setDraft('');
    setEditing(null);
    setFilterSelection([]);
    resetResult();
  }

  function addChoices(additions) {
    if (animation.current) return false;
    const unique = uniqueChoices(additions).filter(choice => !choiceIds.has(choice.id));
    if (choices.length + unique.length > MAX_CHOICES) {
      setError(`${unique.length} selected; only ${MAX_CHOICES - choices.length} spaces remain. No options were added. The wheel holds up to ${MAX_CHOICES} options.`);
      return false;
    }
    updateChoices([...choices, ...unique]);
    return true;
  }

  function saveCustom() {
    if (animation.current) return;
    const label = draft.trim().replace(/\s+/g, ' ');
    const id = label.toLowerCase();
    if (!label) { setError('Enter an option name.'); return; }
    if (id !== editing && choiceIds.has(id)) { setError('That option is already on the wheel.'); return; }
    const choice = { id, label };
    if (editing === null) {
      if (!addChoices([choice])) return;
    } else updateChoices(choices.map(current => current.id === editing ? choice : current));
    setDraft('');
    setEditing(null);
  }

  function remove(id) {
    if (animation.current) return;
    updateChoices(choices.filter(choice => choice.id !== id));
    if (id === editing) { setEditing(null); setDraft(''); }
  }

  function chooseCatalog(choice) {
    if (animation.current) return;
    if (editing === null) addChoices([choice]);
    else {
      updateChoices(choices.map(current => current.id === editing ? choice : current));
      setEditing(null);
    }
  }

  function spin() {
    if (animation.current || choices.length < 2) return;
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      setError('The wheel could not spin. Try again.'); return;
    }
    const snapshot = choices.slice();
    const index = Math.floor(value * snapshot.length);
    const sectorCenter = (index + 0.5) * 360 / snapshot.length;
    const alignment = (360 - (sectorCenter + angle.current) % 360) % 360;
    const target = angle.current + 4 * 360 + alignment;
    const spinScope = privateSessionKey;
    const runId = ++generation.current;
    setOptions(previous => ({ ...previous, [mode]: snapshot }));
    setWinner(null);
    setError('');
    setSpinning(true);
    const handle = createSpinAnimation(rotation, { toValue: target, duration: 1500,
      easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.current = { handle, runId };
    handle.start(({ finished }) => {
      if (runId !== generation.current || spinScope !== currentScope.current) return;
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
    if (mode === 'restaurant') resultAction(winner.id);
    else resultAction(winner.id, winner.restaurantId);
  }

  function toggleSaved(id) {
    setSavedSelection(previous => {
      const selected = previous[mode] || [];
      return { ...previous, [mode]: selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id] };
    });
  }

  function changeFilter(key, value) {
    setFilters(previous => ({ ...previous, [key]: value }));
    setFilterSelection([]);
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>Decision wheel</Text>
      <Text style={styles.muted}>Pick at least two options and let the wheel choose.</Text>
      <View style={styles.row}>
        {MODES.map(([value, label]) => <Button key={value} label={label} selected={mode === value}
          disabled={spinning} onPress={() => switchMode(value)} />)}
      </View>
      <WheelFace choices={choices} rotation={rotation} />
      <Button label={spinning ? 'Spinning…' : 'Spin the wheel'} primary disabled={spinning || choices.length < 2} onPress={spin} />
      {winner && <View style={styles.result}>
        <Text accessibilityRole="alert" style={styles.resultText}>The wheel picked {winner.label}</Text>
        <ResultDetails winner={winner} mode={mode} resolveImageUrl={resolveImageUrl} />
        {resultAction && <Button label="Open details" onPress={openWinner} />}
      </View>}
      <View style={styles.row}>
        <Text accessibilityRole="header" style={styles.subheading}>Options ({choices.length}/{MAX_CHOICES})</Text>
        <Button label="Clear all" disabled={spinning || choices.length === 0} onPress={() => {
          if (animation.current) return;
          updateChoices([]); setEditing(null); setDraft('');
        }} />
      </View>
      {choices.map(({ id, label }, index) => <View key={id} style={styles.option}>
        <Text style={styles.optionLabel}><Text style={{ color: COLORS[index % COLORS.length], fontWeight: '700' }}>{index + 1}. </Text>{label}</Text>
        <Button label={`${mode === 'custom' ? 'Edit' : 'Replace'} ${label}`} disabled={spinning} onPress={() => {
          setEditing(id); setDraft(mode === 'custom' ? label : ''); setError('');
        }} />
        <Button label={`Remove ${label}`} disabled={spinning} onPress={() => remove(id)} />
      </View>)}
      {mode === 'custom' ? <View style={styles.row}>
        <TextInput accessibilityLabel="Custom option" editable={!spinning} maxLength={60} onChangeText={setDraft}
          onSubmitEditing={saveCustom} placeholder="e.g. Cook at home" style={styles.input} value={draft} />
        <Button label={editing === null ? 'Add' : 'Save edit'} disabled={spinning} onPress={saveCustom} />
      </View> : <>
        {saved.length > 0 && <View style={{ gap: 8 }}>
          <Text style={styles.subheading}>Select saved {mode === 'restaurant' ? 'restaurants' : 'dishes'}</Text>
          <View style={styles.row}>{saved.map(choice => <Button key={choice.id}
            label={`Select saved ${choice.label}`} selected={(savedSelection[mode] || []).includes(choice.id)}
            disabled={spinning} onPress={() => toggleSaved(choice.id)} />)}</View>
          <Button label={mode === 'restaurant' ? 'Import saved restaurants' : 'Import saved dishes'}
            disabled={spinning || selectedSaved.length === 0} onPress={() => {
              if (addChoices(selectedSaved)) setSavedSelection(previous => ({ ...previous, [mode]: [] }));
            }} />
        </View>}
        {privateSessionKey === null && <Text style={styles.muted}>Sign in to import saved items. You can still use the catalog or custom options.</Text>}
        {unused.length > 0 && <>
          <Text style={styles.subheading}>{editing === null ? 'Add from the catalog' : 'Choose a replacement from the catalog'}</Text>
          <View style={styles.row}>{unused.map(choice => <Button key={choice.id} label={choice.label}
            disabled={spinning} onPress={() => chooseCatalog(choice)} />)}</View>
        </>}
        {editing !== null && unused.length === 0 && <Text style={styles.muted}>No other catalog choices are available.</Text>}
        {catalog.length === 0 && choices.length === 0 && <Text style={styles.muted}>No catalog options are available.</Text>}
        {filterRestaurants && <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={styles.subheading}>Smart filtering</Text>
          {mode === 'dish' && <Text style={styles.muted}>Cuisine, price and distance use the parent restaurant. Minimum rating uses the dish rating.</Text>}
          <TextInput accessibilityLabel="Filter search" style={styles.input} value={query}
            placeholder={mode === 'dish' ? 'Dish name' : 'Restaurant search'} editable={!spinning}
            onChangeText={value => { setQuery(value); setFilterSelection([]); }} />
          <Text style={styles.muted}>Cuisine</Text>
          <View style={styles.row}>{['', 'american', 'chinese', 'italian', 'japanese', 'mexican', 'other'].map(value =>
            <Button key={value} label={value || 'Any cuisine'} selected={filters.cuisine === value}
              disabled={spinning} onPress={() => changeFilter('cuisine', value)} />)}</View>
          <View style={styles.row}>{[['minPrice', 'Minimum price (USD)'], ['maxPrice', 'Maximum price (USD)'],
            ['minRating', mode === 'dish' ? 'Minimum dish rating' : 'Minimum restaurant rating'],
            ['customDistance', 'Maximum distance (km)']].map(([key, label]) =>
              <TextInput key={key} accessibilityLabel={label} placeholder={label} style={styles.input}
                keyboardType="decimal-pad" editable={!spinning} value={filters[key] == null ? '' : String(filters[key])}
                onChangeText={value => changeFilter(key, key === 'minRating' && value.trim() === '' ? null : value)} />)}</View>
          <Text style={styles.muted}>Taste filtering is unavailable until numeric traits and a match rule are supplied.</Text>
          {preview.error && <Text accessibilityRole="alert" style={styles.error}>{preview.error}</Text>}
          {preview.needsLocation && typeof onRequestLocation === 'function' && <Button label="Use my location for distance" disabled={spinning} onPress={onRequestLocation} />}
          {!preview.error && <Text style={styles.muted}>{preview.choices.length === 0 ? 'No matching candidates.'
            : `${preview.choices.length} matching candidates; ${previewChoices.length} available to add.`}</Text>}
          <View style={styles.row}>{previewChoices.map(choice => <Button key={choice.id} label={`Select candidate ${choice.label}`}
            selected={filterSelection.includes(choice.id)} disabled={spinning} onPress={() => setFilterSelection(previous =>
              previous.includes(choice.id) ? previous.filter(id => id !== choice.id) : [...previous, choice.id])} />)}</View>
          <View style={styles.row}>
            <Button label="Add selected candidates" disabled={spinning || !previewChoices.some(choice => filterSelection.includes(choice.id))}
              onPress={() => { if (addChoices(previewChoices.filter(choice => filterSelection.includes(choice.id)))) setFilterSelection([]); }} />
            <Button label="Add all candidates" disabled={spinning || previewChoices.length === 0}
              onPress={() => { if (addChoices(previewChoices)) setFilterSelection([]); }} />
          </View>
        </View>}
      </>}
      {editing !== null && <Button label="Cancel edit" disabled={spinning} onPress={() => {
        setEditing(null); setDraft(''); setError('');
      }} />}
      {error !== '' && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 30, gap: 12, backgroundColor: '#f5f5f5' },
  heading: { fontSize: 24, fontWeight: 'bold', color: '#222' },
  subheading: { fontSize: 18, fontWeight: 'bold', color: '#222' },
  muted: { color: '#666', fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  button: { minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e8eefc', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  buttonText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
  primary: { backgroundColor: '#2563eb' },
  primaryText: { color: '#fff' },
  disabled: { opacity: 0.5 },
  wheelWrap: { alignSelf: 'center', position: 'relative', paddingTop: 7 },
  wheel: { width: SIZE, height: SIZE, borderRadius: CENTER, backgroundColor: '#eaf0ff', overflow: 'hidden' },
  spoke: { ...StyleSheet.absoluteFillObject, alignItems: 'center' },
  line: { width: 1, height: CENTER, backgroundColor: '#cbd5e1' },
  marker: { position: 'absolute', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  markerText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  hub: { width: 30, height: 30, position: 'absolute', top: CENTER - 15, left: CENTER - 15, borderRadius: 15, backgroundColor: '#2563eb' },
  pointer: {
    position: 'absolute',
    top: 0,
    left: CENTER - 10,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#222',
  },
  result: { padding: 16, gap: 8, borderRadius: 12, backgroundColor: '#fff', elevation: 3 },
  resultPhoto: { width: '100%', height: 170, borderRadius: 8 },
  resultText: { color: '#222', fontSize: 18, fontWeight: 'bold' },
  option: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#fff', borderRadius: 12 },
  optionLabel: { flexGrow: 1, color: '#222', fontSize: 14 },
  input: { flexGrow: 1, minWidth: 145, minHeight: 46, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, backgroundColor: '#fff', color: '#222', fontSize: 15 },
  error: { color: '#dc2626', fontSize: 14, fontWeight: '600' },
});
