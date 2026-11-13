import React from "react";

import {
  act,
  renderHook,
  waitFor,
} from "@testing-library/react-native";

import useLiveSavedPlaces from "../../src/modules/feed/favorites/useLiveSavedPlaces";

const saved = {
  targetType: "restaurant",
  targetId: "111111111111111111111111",
  target: {
    _id: "111111111111111111111111",
    name: "Sushi One",
  },
  createdAt: "2026-11-13T10:00:00.000Z",
};

const mockClient = {
  list: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

beforeEach(() => {
  mockClient.list
    .mockReset()
    .mockResolvedValue([]);

  mockClient.save
    .mockReset()
    .mockResolvedValue(saved);

  mockClient.remove
    .mockReset()
    .mockResolvedValue(null);
});

test("signed-in favorites loads and toggles save/remove", async () => {
  const { result } = renderHook(() =>
    useLiveSavedPlaces({
      session: {
        userId: "user-1",
        token: "token",
      },
      origin: "https://example.test",
      client: mockClient,
    })
  );

  await waitFor(() =>
    expect(result.current.status).toBe("ready")
  );

  const restaurant = {
    _id: saved.targetId,
    name: "Sushi One",
  };

  await act(async () => {
    await result.current.toggleFavorite(
      restaurant
    );
  });

  expect(
    mockClient.save
  ).toHaveBeenCalledWith(
    expect.objectContaining({
      token: "token",
      targetType: "restaurant",
      targetId: saved.targetId,
    })
  );

  expect(
    result.current.isSaved(
      "restaurant",
      saved.targetId
    )
  ).toBe(true);

  await act(async () => {
    await result.current.toggleFavorite(
      restaurant
    );
  });

  expect(
    mockClient.remove
  ).toHaveBeenCalledWith(
    expect.objectContaining({
      targetType: "restaurant",
      targetId: saved.targetId,
    })
  );

  expect(
    result.current.isSaved(
      "restaurant",
      saved.targetId
    )
  ).toBe(false);
});

test("guest favorites do not request private saved list", () => {
  const { result } = renderHook(() =>
    useLiveSavedPlaces({
      session: {
        userId: null,
        token: null,
      },
      origin: "https://example.test",
      client: mockClient,
    })
  );

  expect(
    result.current.status
  ).toBe("signed-out");

  expect(
    mockClient.list
  ).not.toHaveBeenCalled();
});