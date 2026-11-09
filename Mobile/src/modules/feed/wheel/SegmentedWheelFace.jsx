import React from "react";

import {
  Animated,
  StyleSheet,
  View,
} from "react-native";

import Svg, {
  Circle,
  G,
  Path,
  Text as SvgText,
} from "react-native-svg";

import {
  colors,
} from "../../../shared/design/tokens";

const BASE_SIZE = 236;

const WHEEL_COLORS = [
  "#FF3654",
  "#FF8A65",
  "#F5B942",
  "#5CB8A6",
  "#7895E8",
  "#B58CE5",
];

function polarPoint(center, radius, angle) {
  const radians = ((angle - 90) * Math.PI) / 180;

  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  };
}

function createSectorPath(
  center,
  radius,
  startAngle,
  endAngle
) {
  const start = polarPoint(
    center,
    radius,
    startAngle
  );

  const end = polarPoint(
    center,
    radius,
    endAngle
  );

  const angle = endAngle - startAngle;

  const largeArcFlag = angle > 180 ? 1 : 0;

  return [
    `M ${center} ${center}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius}`,
    `0 ${largeArcFlag} 1`,
    `${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

export default function SegmentedWheelFace({
  choices = [],
  rotation,
  size = BASE_SIZE,
}) {
  const center = size / 2;

  const radius = center - 3;

  const count = choices.length;

  const transform = rotation.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  const sectorAngle =
    count > 0 ? 360 / count : 0;

  const numberRadius = radius * 0.67;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size + 8,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        style={[
          styles.wheel,
          {
            width: size,
            height: size,
            borderRadius: center,
            transform: [
              { rotate: transform },
            ],
          },
        ]}
      >
        <Svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Empty wheel */}
          {count === 0 && (
            <Circle
              cx={center}
              cy={center}
              r={radius}
              fill={colors.primaryLight}
            />
          )}

          {/* Single choice */}
          {count === 1 && (
            <Circle
              cx={center}
              cy={center}
              r={radius}
              fill={WHEEL_COLORS[0]}
            />
          )}

          {/* Multiple sectors */}
          {count > 1 &&
            choices.map((choice, index) => {
              const startAngle =
                index * sectorAngle;

              const endAngle =
                (index + 1) * sectorAngle;

              return (
                <Path
                  key={choice.id}
                  d={createSectorPath(
                    center,
                    radius,
                    startAngle,
                    endAngle
                  )}
                  fill={
                    WHEEL_COLORS[
                      index % WHEEL_COLORS.length
                    ]
                  }
                  stroke={colors.white}
                  strokeWidth={2}
                />
              );
            })}

          {/* Option numbers */}
          {choices.map((choice, index) => {
            const angle =
              (index + 0.5) * sectorAngle;

            const position = polarPoint(
              center,
              numberRadius,
              angle
            );

            return (
              <G key={`label-${choice.id}`}>
                <Circle
                  cx={position.x}
                  cy={position.y}
                  r={size * 0.068}
                  fill="rgba(255,255,255,0.93)"
                />

                <SvgText
                  x={position.x}
                  y={position.y}
                  fill={colors.text}
                  fontSize={
                    count > 12 ? 10 : 12
                  }
                  fontWeight="700"
                  textAnchor="middle"
                  alignmentBaseline="central"
                >
                  {index + 1}
                </SvgText>
              </G>
            );
          })}

          {/* Center hub */}
          <Circle
            cx={center}
            cy={center}
            r={16}
            fill={colors.white}
          />

          <Circle
            cx={center}
            cy={center}
            r={12}
            fill={colors.primary}
          />

          {/* Outer border */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={colors.border}
            strokeWidth={3}
          />
        </Svg>
      </Animated.View>

      {/* Fixed pointer */}
      <View
        style={[
          styles.pointer,
          {
            left: center - 11,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignSelf: "center",
    paddingTop: 8,
  },

  wheel: {
    overflow: "hidden",
    backgroundColor: colors.primaryLight,
  },

  pointer: {
    position: "absolute",
    top: 0,

    width: 0,
    height: 0,

    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderTopWidth: 23,

    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: colors.text,

    zIndex: 5,
  },
});