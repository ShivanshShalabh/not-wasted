# Public data sources

Not Wasted uses seven public datasets and APIs. All of them are free, and none needs an account except USDA FoodData Central, which works on a shared demo key and accepts a free key for higher limits.

Every call goes through the server (`src/lib/public-data/`). Responses are cached in memory and the requests time out after 12–15 seconds. A failed source never breaks a page: each API route returns `{ ok: false, error, source }` and the UI says which source is unavailable.

| Dataset | Publisher | What we use it for | Where in the app | Key? |
|---|---|---|---|---|
| [Excess Food Opportunities Map](https://www.epa.gov/sustainable-management-food/excess-food-opportunities-map) | U.S. EPA | Real Nashville food banks, pantries and soup kitchens; county total of estimated excess food from schools and universities (tons/year) | Network impact → Nashville at a glance; Outreach agent prospects | No |
| [Food Access Research Atlas](https://www.ers.usda.gov/data-products/food-access-research-atlas/) (2019) | USDA Economic Research Service | Whether a recipient's census tract is low-income / low-access, and its poverty rate | Stored with each recipient's location; not used for matching or shown in the app | No |
| [Census Geocoder](https://geocoding.geo.census.gov/geocoder/) | U.S. Census Bureau | Address → coordinates and census tract | Registration; area need; geocoding event venues | No |
| [Open-Meteo Forecast API](https://open-meteo.com/) | Open-Meteo | Event-day weather, which adjusts the leftover forecast | Register event form; Outreach agent forecasts | No |
| [Open Food Facts](https://world.openfoodfacts.org/) | Open Food Facts | Barcode → product name, allergens, diet labels | Post surplus → barcode | No |
| [FoodData Central](https://fdc.nal.usda.gov/) | USDA Agricultural Research Service | Typical ingredients for a dish → likely allergens | Post surplus review → "Check ingredients with USDA" | `FDC_API_KEY` optional |
| [Nonprofit Explorer API](https://projects.propublica.org/nonprofits/api) | ProPublica (IRS exempt-organization data) | Find a recipient's EIN and 501(c)(3) status | Registration → verify nonprofit | No |

## Details

### EPA Excess Food Opportunities Map
- **Endpoint:** ArcGIS FeatureServer `services3.arcgis.com/g6eV2CrSSwCZj8Mc/arcgis/rest/services/EPA_ExcessFoodOpportunities/FeatureServer`.
  - Layer 7 holds food banks, food pantries and soup kitchens.
  - Layer 4 holds educational institutions, with `ExcessFood_TonYear_LowEst` and `ExcessFood_TonYear_HighEst`.
- **Query:** a bounding box around Davidson County (`NASHVILLE_BBOX` in `http.ts`). County totals come from an ArcGIS statistics query.
- **Caveat:** this FeatureServer is a public ArcGIS Online copy of EPA's map data, not an EPA-owned service. The excess-food figures are EPA's modeled estimates, not measurements.
- **Code:** `src/lib/public-data/epa.ts` and `GET /api/data/directory`.

### USDA Food Access Research Atlas
- **Endpoint:** ArcGIS FeatureServer `services2.arcgis.com/YFcshSieCVlb6AgV/arcgis/rest/services/FoodAccessResearchAtlasData2019/FeatureServer/0`. It is a public mirror of the ERS 2019 atlas data.
- **Fields used:**
  - `LILATracts`: low-income and low-access.
  - `LowIncomeT`: low-income.
  - `LATracts1`: low access at 1 mile.
  - `PovertyRat`, `MedianFami`, `Urban`.
- **Area need (0–1):**
  - +0.5 when the tract is low-income and low-access.
  - +0.2 when it is low-income.
  - Plus up to 0.3 from the poverty rate.
- **Effect on matching:** none. Ranking on neighborhood poverty gave some recipients an advantage over others, so matching uses only capacity, distance, needs, handling and dietary fit.
- **Code:** `src/lib/public-data/foodAccess.ts`, `GET /api/data/locate`, and `src/components/useAreaNeeds.ts`.

### U.S. Census Geocoder
- **Endpoint:** `geographies/onelineaddress`, using benchmark `Public_AR_Current` and vintage `Current_Current`.
- **Returns:** coordinates plus the 11-digit census tract GEOID, which keys the Food Access Atlas.
- **Venues it can't match:** the outreach agent falls back to the city center for weather.
- **Code:** `src/lib/public-data/census.ts`.

### Open-Meteo
- **Request:** a daily forecast covering 16 days, asking for `weathercode`, `temperature_2m_max` and `precipitation_probability_max`.
- **Mapping:** results map onto the surplus model's weather factor (`src/lib/forecast.ts`):
  - Snow codes → Snow.
  - Rain codes, or a rain chance of 60% or more → Rain.
  - A high of 33 °C or more → Heat.
  - Anything else → Clear.
- **License:** CC BY 4.0. Attribution is shown next to the forecast.
- **Code:** `src/lib/public-data/weather.ts`, `GET /api/data/weather`, and `GET /api/agent/scout`.

### Open Food Facts
- **Endpoint:** `GET /api/v2/product/{barcode}.json`.
- **Mapping:** `allergens_tags` → allergens, e.g. `en:milk` → Dairy and `en:nuts` → Tree nuts. `labels_tags` and `ingredients_analysis_tags` → diet labels (Vegan, Vegetarian, Halal, Kosher, Gluten-free).
- **License:** ODbL, with attribution shown in the form.
- **Note:** the full-text search endpoint was unavailable during development, so only barcode lookup is used.
- **Code:** `src/lib/public-data/openFoodFacts.ts` and `GET /api/data/barcode`.

### USDA FoodData Central
- **Endpoint:** `foods/search` across all data types.
- **Processing:** ingredient statements are scanned for the nine major US allergens.
- **License:** public domain.
- **API key:** set `FDC_API_KEY`, a free key from api.data.gov. Without it the shared `DEMO_KEY` is used, which has tight hourly limits.
- **Code:** `src/lib/public-data/usda.ts` and `GET /api/data/ingredients`.

### ProPublica Nonprofit Explorer
- **Endpoint:** `api/v2/search.json`, filtered by state.
- **501(c)(3) check:** `subseccd === 3` is treated as 501(c)(3).
- **Data:** the underlying data comes from the IRS Exempt Organizations Business Master File and Form 990 filings.
- **Code:** `src/lib/public-data/nonprofits.ts` and `GET /api/data/nonprofit`.

## Not from a dataset
- **Event feed:** the Outreach agent's event feed is simulated (`src/lib/scout.ts`). Eventbrite, Ticketmaster and PredictHQ all need accounts or keys, and Nashville's open-data portal has no special-event permit dataset. The weather and venue geocoding on each event are real.
- **Impact figures:** pounds per unit, kg CO2e per pound, and dollar value per unit (`src/lib/categories.ts`) are app-level estimates for the demo. They don't come from a cited dataset.
- **Recipients:** the seed organizations are demo data. Real Nashville food banks appear separately under Network impact → Nashville at a glance.

## Tried but not used
- **OpenStreetMap Overpass:** queries for food banks, soup kitchens and shelters. All three public endpoints returned errors (502, 500 or a timeout) during development.
- **CDC PLACES:** checked for tract-level food insecurity. That measure is missing from the census-tract release we queried.
- **Nashville Open Data (ArcGIS Hub):** no dataset for events or food assistance turned up. The catalog is mostly permits and 311 requests.

## Testing
`src/lib/public-data/public-data.test.ts` runs each parser against trimmed copies of real responses, with no network calls. Run it with `npx vitest run`.
