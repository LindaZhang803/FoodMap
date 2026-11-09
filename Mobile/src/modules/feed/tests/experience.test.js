import React from 'react';
import {
  Pressable,
  Text,
  View,
} from 'react-native';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import FeedExperience from '../screens/FeedExperience';

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default
);

const restaurantId = '111111111111111111111111';
const secondId = '222222222222222222222222';
const dishId = '333333333333333333333333';
const losingId = '444444444444444444444444';

const a = {
  userId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  token: 'token-a',
};

const b = {
  userId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  token: 'token-b',
};

const targets = value =>
  Object.fromEntries(
    [
      'spicy',
      'sweet',
      'sour',
      'salty',
      'bitter',
      'umami',
    ].map(key => [key, value])
  );

const restaurant = {
  _id: restaurantId,
  name: 'First place',
  rating: null,
  reviewCount: 0,
};

const second = {
  _id: secondId,
  name: 'No dishes place',
  rating: 4,
  reviewCount: 4,
};

const wireDish = {
  id: dishId,
  restaurantId,
  name: 'First dish',
  averageRating: null,
  reviewCount: 0,
  flavorIntensities: targets(0),
};

const losingDish = {
  ...wireDish,
  id: losingId,
  name: 'Other dish',
  flavorIntensities: targets(5),
};

const saved = (type, target) => ({
  targetType: type,
  targetId:
    type === 'restaurant'
      ? target._id
      : target.dishId,
  createdAt: '2026-11-04T12:00:00.000Z',
  target,
});

const deferred = () => {
  let resolve;
  let reject;

  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return {
    promise,
    resolve,
    reject,
  };
};

function setup() {
  const getRestaurants = jest.fn()
    .mockResolvedValue([restaurant, second]);

  const getDishes = jest.fn()
    .mockResolvedValue([wireDish, losingDish]);

  const readSelfProfile = jest.fn(({ token }) =>
    Promise.resolve({
      userId:
        token === a.token
          ? a.userId
          : b.userId,

      flavorTargets: targets(
        token === a.token ? 0 : 5
      ),
    })
  );

  const favoritesClient = {
    list: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockResolvedValue(
      saved('restaurant', restaurant)
    ),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  let latest;

  const props = {
    getRestaurants,
    getDishes,
    readSelfProfile,
    favoritesClient,
    origin: 'https://food.example',
    renderDetail: value => {
      latest = value;
      return null;
    },
  };

  return {
    props,
    get latest() {
      return latest;
    },
  };
}

test('one full public pool survives tab switches, save mutations, and preference refreshes', async () => {
  const ctx = setup();

  const view = render(
    <FeedExperience
      {...ctx.props}
      session={a}
    />
  );

  await waitFor(() =>
    expect(ctx.latest.feed.preferenceStatus)
      .toBe('ready')
  );

  await waitFor(() =>
    expect(ctx.latest.savedPlaces.status)
      .toBe('ready')
  );

  expect(
    ctx.latest.feed.entries[0].recommendedDish.dishId
  ).toBe(dishId);

  expect(
    ctx.latest.feed.candidates[0].dishes
      .map(d => d.dishId)
  ).toEqual([
    dishId,
    losingId,
  ]);

  fireEvent.press(
    screen.getByRole('tab', { name: 'Wheel' })
  );

  fireEvent.press(
    screen.getByRole('tab', { name: 'Want to Try' })
  );

  fireEvent.press(
    screen.getByRole('tab', { name: 'Discover' })
  );

  await act(async () => {
    await ctx.latest.savedPlaces.toggleFavorite(
      restaurant
    );
  });

  expect(
    ctx.latest.savedPlaces.favorites[0]._id
  ).toBe(restaurantId);

  view.rerender(
    <FeedExperience
      {...ctx.props}
      session={{
        ...a,
        preferenceRevision: 1,
      }}
    />
  );

  await waitFor(() =>
    expect(ctx.props.readSelfProfile)
      .toHaveBeenCalledTimes(2)
  );

  act(() =>
    ctx.latest.feed.refreshPreferences()
  );

  await waitFor(() =>
    expect(ctx.props.readSelfProfile)
      .toHaveBeenCalledTimes(3)
  );

  expect(
    ctx.props.getRestaurants
  ).toHaveBeenCalledTimes(1);

  expect(
    ctx.props.getDishes
  ).toHaveBeenCalledTimes(1);

  expect(
    ctx.props.favoritesClient.list
  ).toHaveBeenCalledTimes(1);

  act(() =>
    ctx.latest.feed.refresh()
  );

  await waitFor(() =>
    expect(ctx.props.getRestaurants)
      .toHaveBeenCalledTimes(2)
  );

  expect(
    ctx.props.getDishes
  ).toHaveBeenCalledTimes(2);
});

test('guests make zero account/Favorites calls and sign-in actions delegate to host', async () => {
  const ctx = setup();
  const onLoginRequired = jest.fn();

  render(
    <FeedExperience
      {...ctx.props}
      onLoginRequired={onLoginRequired}
    />
  );

  await waitFor(() =>
    expect(ctx.latest.feed.entries)
      .toHaveLength(2)
  );

  expect(
    ctx.latest.feed.preferenceStatus
  ).toBe('signed-out');

  expect(
    ctx.props.readSelfProfile
  ).not.toHaveBeenCalled();

  expect(
    ctx.props.favoritesClient.list
  ).not.toHaveBeenCalled();

  fireEvent.press(
    screen.getByRole('button', {
      name: 'Sign in to save First place',
    })
  );

  expect(
    onLoginRequired
  ).toHaveBeenCalledTimes(1);

  expect(
    ctx.props.favoritesClient.save
  ).not.toHaveBeenCalled();

  fireEvent.press(
    screen.getByRole('tab', {
      name: 'Wheel',
    })
  );

  expect(
    screen.getByRole('header', {
      name: 'Decision Wheel',
    })
  ).toBeTruthy();
});

test('session switch reranks own profile, clears private data immediately, and ignores old 401', async () => {
  const ctx = setup();
  const pendingA = deferred();
  const onSessionExpired = jest.fn();

  ctx.props.readSelfProfile.mockImplementationOnce(
    () => pendingA.promise
  );

  ctx.props.favoritesClient.list
    .mockResolvedValueOnce([
      saved('restaurant', restaurant),
    ]);

  const view = render(
    <FeedExperience
      {...ctx.props}
      session={a}
      onSessionExpired={onSessionExpired}
    />
  );

  await waitFor(() =>
    expect(ctx.latest.savedPlaces.favorites)
      .toHaveLength(1)
  );

  view.rerender(
    <FeedExperience
      {...ctx.props}
      session={b}
      onSessionExpired={onSessionExpired}
    />
  );

  expect(
    ctx.latest.savedPlaces.favorites
  ).toEqual([]);

  await waitFor(() =>
    expect(ctx.latest.feed.preferenceStatus)
      .toBe('ready')
  );

  expect(
    ctx.latest.feed.entries[0].recommendedDish.dishId
  ).toBe(losingId);

  await act(async () => {
    pendingA.reject(
      Object.assign(
        new Error('Expired A'),
        { status: 401 }
      )
    );
  });

  expect(
    onSessionExpired
  ).not.toHaveBeenCalled();

  expect(
    ctx.latest.savedPlaces.error
  ).toBeNull();

  expect(
    ctx.latest.feed.entries[0].recommendedDish.dishId
  ).toBe(losingId);

  expect(
    ctx.props.getRestaurants
  ).toHaveBeenCalledTimes(1);

  expect(
    ctx.props.getDishes
  ).toHaveBeenCalledTimes(1);
});

test('Discover and Want to Try pass exact owner navigation IDs; unavailable dish navigation has no action', async () => {
  const ctx = setup();

  const dish = {
    ...wireDish,
    dishId,
    imageUrl: null,
  };

  ctx.props.favoritesClient.list
    .mockResolvedValue([
      saved('dish', dish),
    ]);

  const onRestaurantPress = jest.fn();
  const onDishPress = jest.fn();

  const view = render(
    <FeedExperience
      {...ctx.props}
      session={a}
      onRestaurantPress={onRestaurantPress}
      onDishPress={onDishPress}
    />
  );

  fireEvent.press(
    await screen.findByRole('button', {
      name: 'Open restaurant First place',
    })
  );

  expect(
    onRestaurantPress
  ).toHaveBeenCalledWith(restaurantId);

  await waitFor(() =>
    expect(ctx.latest.savedPlaces.status)
      .toBe('ready')
  );

  fireEvent.press(
    screen.getByRole('tab', {
      name: 'Want to Try',
    })
  );

  fireEvent.press(
    screen.getByRole('tab', {
      name: 'Saved Dishes',
    })
  );

  fireEvent.press(
    screen.getByRole('button', {
      name: 'View dish First dish',
    })
  );

  expect(
    onDishPress
  ).toHaveBeenCalledWith(
    dishId,
    restaurantId
  );

  view.rerender(
    <FeedExperience
      {...ctx.props}
      session={a}
      onRestaurantPress={onRestaurantPress}
    />
  );

  expect(
    screen.queryByRole('button', {
      name: 'View dish First dish',
    })
  ).toBeNull();
});

test('host detail Back restores the selected tabs and confirmed saves without refetching', async () => {
  const ctx = setup();

  const dish = {
    ...wireDish,
    dishId,
    imageUrl: null,
  };

  ctx.props.favoritesClient.list
    .mockResolvedValue([
      saved('dish', dish),
    ]);

  function Host() {
    const [showDetail, setShowDetail] =
      React.useState(false);

    return (
      <FeedExperience
        {...ctx.props}
        session={a}
        onDishPress={() => setShowDetail(true)}
        renderDetail={experience => {
          ctx.props.renderDetail(experience);

          return showDetail ? (
            <View>
              <Text>Host dish details</Text>

              {experience.renderRestaurantActions(
                restaurant
              )}

              <Pressable
                accessibilityRole="button"
                onPress={() => setShowDetail(false)}
              >
                <Text>Back</Text>
              </Pressable>
            </View>
          ) : null;
        }}
      />
    );
  }

  render(<Host />);

  await waitFor(() =>
    expect(ctx.latest.savedPlaces.status)
      .toBe('ready')
  );

  await waitFor(() =>
    expect(ctx.latest.feed.preferenceStatus)
      .toBe('ready')
  );

  fireEvent.press(
    screen.getByRole('tab', {
      name: 'Want to Try',
    })
  );

  fireEvent.press(
    screen.getByRole('tab', {
      name: 'Saved Dishes',
    })
  );

  fireEvent.press(
    screen.getByRole('button', {
      name: 'View dish First dish',
    })
  );

  expect(
    screen.getByText('Host dish details')
  ).toBeTruthy();

  for (const name of [
    'Discover',
    'Want to Try',
    'Wheel',
  ]) {
    expect(
      screen.queryByRole('tab', { name })
    ).toBeNull();
  }

  fireEvent.press(
    screen.getByRole('button', {
      name: 'Save First place to Want to Try',
    })
  );

  await waitFor(() =>
    expect(ctx.latest.savedPlaces.favorites)
      .toHaveLength(1)
  );

  fireEvent.press(
    screen.getByRole('button', {
      name: 'Back',
    })
  );

  expect(
    screen.queryByText('Host dish details')
  ).toBeNull();

  expect(
    screen.getByRole('tab', {
      name: 'Want to Try',
    }).props.accessibilityState.selected
  ).toBe(true);

  expect(
    screen.getByRole('tab', {
      name: 'Saved Dishes',
    }).props.accessibilityState.selected
  ).toBe(true);

  expect(
    screen.getByRole('button', {
      name: 'View dish First dish',
    })
  ).toBeTruthy();

  fireEvent.press(
    screen.getByRole('tab', {
      name: 'Saved Restaurants',
    })
  );

  expect(
    screen.getByText('First place')
  ).toBeTruthy();

  expect(
    ctx.props.getRestaurants
  ).toHaveBeenCalledTimes(1);

  expect(
    ctx.props.getDishes
  ).toHaveBeenCalledTimes(1);

  expect(
    ctx.props.readSelfProfile
  ).toHaveBeenCalledTimes(1);

  expect(
    ctx.props.favoritesClient.list
  ).toHaveBeenCalledTimes(1);
});

test('missing numeric source uses public fallback and dish failure retains all restaurants', async () => {
  const ctx = setup();

  ctx.props.getDishes.mockRejectedValue(
    new Error('Dish read unavailable')
  );

  render(
    <FeedExperience
      {...ctx.props}
      readSelfProfile={undefined}
      session={a}
    />
  );

  await waitFor(() =>
    expect(ctx.latest.feed.preferenceStatus)
      .toBe('unavailable')
  );

  await waitFor(() =>
    expect(ctx.latest.feed.entries)
      .toHaveLength(2)
  );

  expect(
    ctx.latest.feed.entries.every(
      entry => entry.recommendedDish === null
    )
  ).toBe(true);

  expect(
    ctx.latest.feed.dishError
  ).toBeInstanceOf(Error);

  expect(
    ctx.latest.feed.candidates.every(
      candidate => candidate.dishes.length === 0
    )
  ).toBe(true);
});

test('unmount before queued work starts makes no catalog/profile reads or late expiry callbacks', async () => {
  const ctx = setup();
  const onSessionExpired = jest.fn();

  ctx.props.readSelfProfile.mockRejectedValue(
    Object.assign(
      new Error('Expired'),
      { status: 401 }
    )
  );

  const view = render(
    <FeedExperience
      {...ctx.props}
      session={a}
      onSessionExpired={onSessionExpired}
    />
  );

  view.unmount();

  await act(async () => {});

  expect(
    ctx.props.getRestaurants
  ).not.toHaveBeenCalled();

  expect(
    ctx.props.getDishes
  ).not.toHaveBeenCalled();

  expect(
    ctx.props.readSelfProfile
  ).not.toHaveBeenCalled();

  expect(
    onSessionExpired
  ).not.toHaveBeenCalled();
});

test('an already pending profile read is aborted and cannot expire an unmounted experience', async () => {
  const ctx = setup();
  const pending = deferred();

  ctx.props.readSelfProfile.mockImplementation(
    () => pending.promise
  );

  const onSessionExpired = jest.fn();

  const view = render(
    <FeedExperience
      {...ctx.props}
      session={a}
      onSessionExpired={onSessionExpired}
    />
  );

  await waitFor(() =>
    expect(ctx.props.readSelfProfile)
      .toHaveBeenCalledTimes(1)
  );

  const signal =
    ctx.props.readSelfProfile.mock.calls[0][0].signal;

  view.unmount();

  expect(signal.aborted).toBe(true);

  await act(async () => {
    pending.reject(
      Object.assign(
        new Error('Expired'),
        { status: 401 }
      )
    );
  });

  expect(
    onSessionExpired
  ).not.toHaveBeenCalled();
});

test('StrictMode cleanup does not duplicate public reads or disable the current profile source', async () => {
  const ctx = setup();

  render(
    <React.StrictMode>
      <FeedExperience
        {...ctx.props}
        session={a}
      />
    </React.StrictMode>
  );

  await waitFor(() =>
    expect(ctx.latest.feed.preferenceStatus)
      .toBe('ready')
  );

  expect(
    ctx.props.getRestaurants
  ).toHaveBeenCalledTimes(1);

  expect(
    ctx.props.getDishes
  ).toHaveBeenCalledTimes(1);

  expect(
    ctx.props.readSelfProfile
  ).toHaveBeenCalledTimes(1);
});