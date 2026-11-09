import React from 'react';
import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';

import FeedPreviewScreen from '../dev/FeedPreviewScreen';

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default
);

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

const pressButton = label => {
  const escaped = label.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );

  fireEvent.press(
    screen.getByRole('button', {
      name: new RegExp(`^${escaped}$`, 'i'),
    })
  );
};

it('opens Discover with the demo profile already personalized', async () => {
  render(<FeedPreviewScreen />);

  await screen.findByText('100% Taste Similarity');

  expect(
    screen.getByText('Pepper Noodles')
  ).toBeTruthy();

  expect(
    screen.getAllByTestId(/^feed-item:/)[0].props.testID
  ).toBe('feed-item:demo-restaurant-noodles');
});

it('saves and reopens both item types and imports the saved restaurant into the wheel', async () => {
  render(<FeedPreviewScreen />);

  await screen.findByText('100% Taste Similarity');

  expect(
    screen.getByText('Pepper Noodles')
  ).toBeTruthy();

  pressButton('Open restaurant Pepper Noodle House');

  expect(
    screen.getByRole('header', {
      name: 'Pepper Noodle House',
    })
  ).toBeTruthy();

  pressButton('Save Pepper Noodle House to Want to Try');
  pressButton('Pepper Noodles ›');
  pressButton('Save Pepper Noodles to Want to Try');

  pressButton('Want to Try');

  expect(
    screen.getByRole('header', {
      name: 'Want to Try',
    })
  ).toBeTruthy();

  expect(
    screen.getByRole('button', {
      name: 'Open restaurant Pepper Noodle House',
    })
  ).toBeTruthy();

  fireEvent.press(
    screen.getByRole('tab', {
      name: 'Saved Dishes',
    })
  );

  pressButton('View dish Pepper Noodles');

  expect(
    screen.getByRole('header', {
      name: 'Pepper Noodles',
    })
  ).toBeTruthy();

  pressButton('Wheel');
  pressButton('Clear All');
  pressButton('Select saved Pepper Noodle House');
  pressButton('Import Saved Restaurants');

  expect(
    screen.getByRole('button', {
      name: 'Remove Pepper Noodle House',
    })
  ).toBeTruthy();
});