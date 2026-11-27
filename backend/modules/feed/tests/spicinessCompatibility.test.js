const { getSpicinessCompatibility } = require('../../accounts/services/spicinessCompatibility');

const answers = { preferredSpiciness: 2, maximumSpiciness: 4 };

test.each([
  ['null answers', null, 3, 1],
  ['missing answers', undefined, 3, 1],
  ['fractional preferred heat', { ...answers, preferredSpiciness: 2.5 }, 3, 1],
  ['null median', answers, null, 1],
  ['missing median', answers, undefined, 1],
  ['non-finite median', answers, NaN, 1],
  ['out-of-range median', answers, 6, 1],
  ['no samples', answers, 3, 0],
  ['fractional sample count', answers, 3, 1.5],
  ['non-finite sample count', answers, 3, Infinity]
])('returns Unknown for %s', (_description, userAnswers, median, count) => {
  expect(getSpicinessCompatibility(userAnswers, median, count)).toBe('Unknown');
});

test.each([
  ['matching the preferred heat', answers, 2, 'Within Preference'],
  ['below the preferred heat', { ...answers, maximumSpiciness: 3 }, 1, 'Within Preference'],
  ['matching the maximum heat', answers, 4, 'Above Preference'],
  ['a half-step median', answers, 2.5, 'Above Preference'],
  ['above the maximum heat', answers, 5, 'Above Preference'],
  ['a lower maximum', { ...answers, maximumSpiciness: 2 }, 3, 'Above Preference'],
  ['a missing maximum', { preferredSpiciness: 2 }, 3, 'Above Preference'],
  ['an invalid maximum', { ...answers, maximumSpiciness: 4.5 }, 3, 'Above Preference']
])('classifies %s with one sample', (_description, userAnswers, median, label) => {
  expect(getSpicinessCompatibility(userAnswers, median, 1)).toBe(label);
});
