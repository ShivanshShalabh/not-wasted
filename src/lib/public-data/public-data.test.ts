import { describe, expect, it } from "vitest";
import { parseGeocode } from "./census";
import { parseGenerators, parseRecipients } from "./epa";
import { areaNeed, parseTract } from "./foodAccess";
import { parseNonprofits } from "./nonprofits";
import { parseProduct } from "./openFoodFacts";
import { allergensIn, parseFoods } from "./usda";
import { classify, parseDay } from "./weather";

// Fixtures are trimmed copies of real responses captured from each public API.

describe("EPA Excess Food Opportunities", () => {
  it("normalizes recipients and generators", () => {
    const [r] = parseRecipients([{ attributes: { OBJECTID: 7752, Name: "Second Harvest Middle TN", Type: "Food Bank", Address: "331 Great Circle Road", City: "Nashville", Zip_Code: "37228", Website: "www.secondharvestmidtn.org", UniqueID: "FB7752" }, geometry: { x: -86.794364, y: 36.198217 } }]);
    expect(r).toMatchObject({ id: "FB7752", type: "Food Bank", website: "https://www.secondharvestmidtn.org", lat: 36.198217 });
    const [g] = parseGenerators([{ attributes: { OBJECTID: 662, Name: "CANE RIDGE HIGH SCHOOL", School_Type: "Public Elementary & Secondary", Address: "12848 Old Hickory BLVD", City: "Antioch", Zip_Code: "37013", ExcessFood_TonYear_LowEst: 0.03, ExcessFood_TonYear_HighEst: 0.13, Latitude: "36.0309", Longitude: "-086.6213" } }]);
    expect(g).toMatchObject({ name: "Cane Ridge High School", excessTonsHigh: 0.13, lat: 36.0309, lng: -86.6213 });
  });
});

describe("Census geocoder + USDA Food Access Atlas", () => {
  it("reads coordinates and tract", () => {
    expect(parseGeocode({ result: { addressMatches: [{ matchedAddress: "5601 NEW YORK AVE, NASHVILLE, TN, 37209", coordinates: { x: -86.8559, y: 36.1651 }, geographies: { "Census Tracts": [{ GEOID: "47037013300" }] } }] } }))
      .toEqual({ lat: 36.1651, lng: -86.8559, matchedAddress: "5601 NEW YORK AVE, NASHVILLE, TN, 37209", tract: "47037013300" });
    expect(parseGeocode({ result: { addressMatches: [] } })).toBeNull();
  });

  it("scores area need from tract flags", () => {
    const t = parseTract({ GEOID: "47037013300", LILATracts: 0, LowIncomeT: 0, PovertyRat: 18.0493, MedianFami: "71250", LATracts1: 0, Urban: 1 });
    expect(t).toMatchObject({ lowIncomeLowAccess: false, povertyRate: 18, medianFamilyIncome: 71250 });
    expect(areaNeed(t)).toBeCloseTo(0.18, 2);
    expect(areaNeed({ ...t, lowIncomeLowAccess: true, lowIncome: true, povertyRate: 40 })).toBe(1);
  });
});

describe("Open-Meteo", () => {
  it("maps forecast codes onto the surplus model's weather factor", () => {
    expect(classify(0, 25, 10)).toBe("Clear");
    expect(classify(63, 18, 80)).toBe("Rain");
    expect(classify(73, -2, 40)).toBe("Snow");
    expect(classify(1, 35, 5)).toBe("Heat");
    const day = parseDay({ daily: { time: ["2026-10-18"], weathercode: [61], temperature_2m_max: [19.4], precipitation_probability_max: [70] } }, "2026-10-18");
    expect(day).toMatchObject({ weather: "Rain", summary: "Light rain, high 19°C, 70% chance of rain" });
  });
});

describe("Open Food Facts, USDA FoodData Central, ProPublica", () => {
  it("maps barcode tags to allergens and diet labels", () => {
    const p = parseProduct("3017624010701", { status: 1, product: { product_name: "Nutella", allergens_tags: ["en:nuts", "en:milk"], labels_tags: ["en:no-gluten"], ingredients_analysis_tags: ["en:vegan-status-unknown"] } });
    expect(p).toMatchObject({ name: "Nutella", allergens: ["Tree nuts", "Dairy"], dietary: ["Gluten-free"] });
    expect(parseProduct("1", { status: 0 })).toBeNull();
  });

  it("finds allergens in USDA ingredient statements", () => {
    const [f] = parseFoods({ foods: [{ fdcId: 1514897, description: "PASTA PRIMAVERA", foodCategory: "Frozen Dinners & Entrees", ingredients: "ENRICHED PASTA PRODUCT [SEMOLINA WHEAT FLOUR], PARMESAN CHEESE [MILK], SOYBEAN OIL" }] });
    expect(f.description).toBe("Pasta Primavera");
    expect(f.allergens).toEqual(["Gluten", "Dairy", "Soy"]);
    expect(allergensIn("water, salt")).toEqual([]);
  });

  it("flags 501(c)(3) status", () => {
    const [n] = parseNonprofits({ organizations: [{ ein: 621049447, strein: "62-1049447", name: "Second Harvest Food Bank Of Middle Tennessee Inc", city: "Nashville", state: "TN", subseccd: 3 }] });
    expect(n).toMatchObject({ ein: "62-1049447", is501c3: true });
  });
});
