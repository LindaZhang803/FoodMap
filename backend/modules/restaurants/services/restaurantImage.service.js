const COMMONS_API =
  "https://commons.wikimedia.org/w/api.php";

async function searchRestaurantImages(restaurantName, city) {

  const query = `${restaurantName} ${city}`;

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: "10",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "400",
    origin: "*"
  });

  const response = await fetch(
    `${COMMONS_API}?${params}`,
    {
      headers: {
        "User-Agent": "FoodMapStudentProject/1.0 (educational image research)"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Wikimedia API error: ${response.status}`);
  }

  const data = await response.json();

  const pages = Object.values(data.query?.pages || {});

  return pages
    .filter(page => page.imageinfo?.length)
    .map(page => {

      const info = page.imageinfo[0];
      const metadata = info.extmetadata || {};

      return {
        title: page.title,

        imageUrl: info.thumburl || info.url,

        sourceUrl:
          `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,

        author: metadata.Artist?.value || "Unknown",

        license:
          metadata.LicenseShortName?.value || "Unknown",

        licenseUrl:
          metadata.LicenseUrl?.value || null
      };
    });
}

module.exports = {
  searchRestaurantImages
};