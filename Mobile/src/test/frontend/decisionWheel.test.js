import React from "react";

import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";

import DecisionWheel from "../../src/modules/feed/wheel/DecisionWheel";

jest.mock(
  "../../modules/feed/wheel/SegmentedWheelFace",
  () => {
    const React = require("react");
    const { Text } = require("react-native");

    return () => (
      <Text>Wheel face fixture</Text>
    );
  }
);

test("custom mode supports add, edit and remove without touching backend", () => {
  render(
    <DecisionWheel
      restaurants={[]}
      dishes={[]}
      privateSessionKey={null}
    />
  );

  fireEvent.press(
    screen.getByRole("button", {
      name: "Custom",
    })
  );

  const input =
    screen.getByLabelText("Custom option");

  fireEvent.changeText(
    input,
    "Dumplings"
  );

  fireEvent.press(
    screen.getByRole("button", {
      name: "Add",
    })
  );

  expect(
    screen.getByText("Options (1/20)")
  ).toBeTruthy();

  fireEvent.press(
    screen.getByRole("button", {
      name: "Edit Dumplings",
    })
  );

  fireEvent.changeText(
    screen.getByLabelText("Custom option"),
    "Ramen"
  );

  fireEvent.press(
    screen.getByRole("button", {
      name: "Save Edit",
    })
  );

  expect(
    screen.getByText("Ramen")
  ).toBeTruthy();

  fireEvent.press(
    screen.getByRole("button", {
      name: "Remove Ramen",
    })
  );

  expect(
    screen.getByText("Options (0/20)")
  ).toBeTruthy();
});

test("spin is disabled with fewer than two custom options", () => {
  render(
    <DecisionWheel
      restaurants={[]}
      dishes={[]}
      privateSessionKey={null}
    />
  );

  fireEvent.press(
    screen.getByRole("button", {
      name: "Custom",
    })
  );

  const spin =
    screen.getByRole("button", {
      name: "Spin the Wheel",
    });

  expect(
    spin.props.accessibilityState.disabled
  ).toBe(true);
});