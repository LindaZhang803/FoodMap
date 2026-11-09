import React from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import FeedRestaurantItem from '../components/FeedRestaurantItem';
import RestaurantCard from '../components/RestaurantCard';
import FeedStatus from '../components/FeedStatus';
import HomeFeedScreen from '../screens/HomeFeedScreen';
import SavedPlacesScreen from '../favorites/SavedPlacesScreen';
import { rankCandidates } from '../ranking/PreferenceRanker';

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default);

const targets = { spicy: 0, sweet: 0, sour: 0, salty: 0, bitter: 0, umami: 0 };
const restaurant = (id, count) => ({
  _id: id,
  name: `Place ${id}`,
  rating: 4,
  reviewCount: count,
});
const dish = (restaurantId, dishId) => ({
  dishId,
  restaurantId,
  name: `Dish ${dishId}`,
  averageRating: 4.5,
  reviewCount: 8,
  flavorIntensities: targets,
});
const candidates = [
  { restaurantId: 'a', restaurant: restaurant('a', 1), dishes: [dish('a', 'a1')] },
  { restaurantId: 'b', restaurant: restaurant('b', 4), dishes: [dish('b', 'b1')] },
];

it('loads the default home feed with integrated dish picks and opens the selected restaurant', async () => {
  const feedRepository = {
    getCandidates: jest.fn().mockResolvedValue({
      candidates,
      coverage: { scope: 'candidate-pool', complete: true },
      diagnostics: [],
      dishError: null,
    }),
  };
  const preferenceRepository = {
    getSnapshot: jest.fn().mockResolvedValue({
      userId: 'user-a',
      status: 'ready',
      flavorTargets: targets,
      error: null,
    }),
  };
  const onRestaurantPress = jest.fn();
  const result = render(
    <HomeFeedScreen
      feedRepository={feedRepository}
      preferenceRepository={preferenceRepository}
      userId="user-a"
      onRestaurantPress={onRestaurantPress}
    />,
  );

  await result.findByText('100% taste similarity · Dish b1');
  expect(result.getAllByTestId(/^feed-item:/).map(item => item.props.testID))
    .toEqual(['feed-item:b', 'feed-item:a']);
  expect(result.queryByText('Find your next favorite')).toBeNull();
  fireEvent.press(result.getByRole('button', { name: 'Open restaurant Place b' }));
  expect(onRestaurantPress).toHaveBeenCalledWith('b');
});

it('passes the recommendation to an injected card and keeps restaurant actions separate', () => {
  const [entry] = rankCandidates(candidates, { status: 'ready', flavorTargets: targets });
  const onRestaurantPress = jest.fn();
  const saveRestaurant = jest.fn();

  function CustomCard({ restaurant: place, recommendedDish, preferenceScore, onPress }) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Text>{place.name} · {recommendedDish.name} · {preferenceScore}%</Text>
      </Pressable>
    );
  }

  const result = render(
    <FeedRestaurantItem
      entry={entry}
      RestaurantCardComponent={CustomCard}
      onRestaurantPress={onRestaurantPress}
      renderRestaurantActions={place => (
        <Pressable accessibilityRole="button" onPress={() => saveRestaurant(place)}>
          <Text>Save restaurant</Text>
        </Pressable>
      )}
    />,
  );

  fireEvent.press(result.getByText('Place b · Dish b1 · 100%'));
  expect(onRestaurantPress).toHaveBeenCalledWith('b');
  fireEvent.press(result.getByText('Save restaurant'));
  expect(saveRestaurant).toHaveBeenCalledWith(entry.restaurant);
  expect(onRestaurantPress).toHaveBeenCalledTimes(1);
});

it('keeps a restaurant browsable when its dish recommendation is unavailable', () => {
  const [entry] = rankCandidates([{ ...candidates[0], dishes: [] }], { status: 'empty' });
  const onRestaurantPress = jest.fn();
  const result = render(
    <FeedRestaurantItem entry={entry} onRestaurantPress={onRestaurantPress} />,
  );

  expect(result.getByText('Dish recommendation unavailable')).toBeTruthy();
  expect(result.getByLabelText('Dish photo unavailable')).toBeTruthy();
  expect(result.getAllByRole('button')).toHaveLength(1);
  fireEvent.press(result.getByRole('button', { name: 'Open restaurant Place a' }));
  expect(onRestaurantPress).toHaveBeenCalledWith('a');
});

it('shows a popular dish and renders no button when navigation is unavailable', () => {
  const result = render(
    <RestaurantCard
      restaurant={restaurant('a', 1)}
      recommendedDish={dish('a', 'd')}
      preferenceScore={null}
    />,
  );

  expect(result.getByText('Popular dish · Dish d')).toBeTruthy();
  expect(result.queryAllByRole('button')).toHaveLength(0);
});

it('preserves zero similarity and retries a failed photo when its URL changes', () => {
  const place = restaurant('a', 1);
  const recommendedDish = { ...dish('a', 'd'), imageUrl: 'https://example.com/first.jpg' };
  const result = render(
    <RestaurantCard restaurant={place} recommendedDish={recommendedDish} preferenceScore={0} />,
  );

  expect(result.getByText('0% taste similarity · Dish d')).toBeTruthy();
  fireEvent(result.getByTestId('dish-image:d'), 'error');
  expect(result.getByLabelText('Dish photo unavailable')).toBeTruthy();
  expect(result.queryByTestId('dish-image:d')).toBeNull();

  result.rerender(
    <RestaurantCard
      restaurant={place}
      recommendedDish={{ ...recommendedDish, imageUrl: 'https://example.com/replacement.jpg' }}
      preferenceScore={0}
    />,
  );
  expect(result.getByTestId('dish-image:d').props.source)
    .toEqual({ uri: 'https://example.com/replacement.jpg' });
  expect(result.queryByLabelText('Dish photo unavailable')).toBeNull();
});

it('retries a failed photo when the supplied demo image changes', () => {
  const place = restaurant('a', 1);
  const recommendedDish = dish('a', 'd');
  const result = render(
    <RestaurantCard restaurant={place} recommendedDish={recommendedDish} dishImageSource={1} />,
  );

  fireEvent(result.getByTestId('dish-image:d'), 'error');
  expect(result.getByLabelText('Dish photo unavailable')).toBeTruthy();
  result.rerender(
    <RestaurantCard restaurant={place} recommendedDish={recommendedDish} dishImageSource={2} />,
  );
  expect(result.getByTestId('dish-image:d').props.source).toBe(2);
  expect(result.queryByLabelText('Dish photo unavailable')).toBeNull();
});

it('uses the default card for saved restaurants and retains saved dish navigation', () => {
  const savedPlaces = {
    favorites: [restaurant('a', 1)],
    favoriteDishes: [dish('a', 'd')],
    toggleFavorite: jest.fn(),
    toggleFavoriteDish: jest.fn(),
  };
  const onRestaurantPress = jest.fn();
  const onDishPress = jest.fn();
  const result = render(
    <SavedPlacesScreen
      savedPlaces={savedPlaces}
      onRestaurantPress={onRestaurantPress}
      onDishPress={onDishPress}
    />,
  );

  expect(result.queryByText('Dish recommendation unavailable')).toBeNull();
  expect(result.queryByLabelText('Dish photo unavailable')).toBeNull();
  fireEvent.press(result.getByRole('button', { name: 'Open restaurant Place a' }));
  expect(onRestaurantPress).toHaveBeenCalledWith('a');

  fireEvent.press(result.getByRole('tab', { name: 'Saved Dishes' }));
  fireEvent.press(result.getByRole('button', { name: 'View dish Dish d' }));
  expect(onDishPress).toHaveBeenCalledWith('d', 'a');
});

it('shows independent resource failure, degraded recommendation retry, and loading states', () => {
  const onRetry = jest.fn();
  const result = render(<FeedStatus entries={[]} loading onRetry={onRetry} />);
  expect(result.getByText('Finding places to try…')).toBeTruthy();
  result.rerender(<FeedStatus entries={[]} resourceError={new Error('private diagnostic')} onRetry={onRetry} />);
  fireEvent.press(result.getByText('Try again'));
  expect(onRetry).toHaveBeenCalledTimes(1);
  expect(result.queryByText('private diagnostic')).toBeNull();
  result.rerender(<FeedStatus entries={[]} preferenceStatus="unavailable" onRetry={onRetry} />);
  expect(result.getByText('Showing popular places while recommendations are unavailable.')).toBeTruthy();
  fireEvent.press(result.getByText('Retry recommendations'));
  expect(onRetry).toHaveBeenCalledTimes(2);
});
