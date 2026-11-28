const DISH_IMAGES = {
  "local:tonkotsu-ramen": require("./Tonkostsu-Ramen-sushi-house.png"),

  "local:honey-walnut-shrimp": require("./Honey-Walnut-shrimp-sushi-house.png"),

  "local:volcano-roll": require("./Volcano-Roll-sushi-house.png"),

  "local:salmon-skin-roll": require("./Salmon-kin-Roll-sushi-house.png"),

  "local:pork-katsu-curry-ramen": require("./Pork-Katsu-Curry-Ramen-sushi-house.png"),

  "local:detroit-tomato-pie": require("./Detroit-tomato-pie-pizza-palace.png"),

  "local:combo-americano": require("./combo-americano-pizza-palace.png"),

  "local:hot-honey": require("./hot-honey-pizza-palace.png"),

  "local:wiseguy": require("./wiseguy-pizza-palace.png"),
};

export function getDishImageSource(imageUrl, apiOrigin, resolveImageUrl) {
  if (!imageUrl) {
    return null;
  }

  // Local images
  if (DISH_IMAGES[imageUrl]) {
    return DISH_IMAGES[imageUrl];
  }

  // Remote images
  const resolvedUrl =
    typeof resolveImageUrl === "function"
      ? resolveImageUrl(imageUrl, apiOrigin)
      : imageUrl;

  if (!resolvedUrl) {
    return null;
  }

  return { uri: resolvedUrl };
}