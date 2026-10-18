import { NextResponse } from "next/server";
import { epaFoodRecipients, epaSchoolGenerators, epaSchoolTotals } from "@/lib/public-data/epa";
import { attempt } from "@/lib/public-data/http";

/** Real Nashville food recipients and school food-waste generators from the EPA Excess Food Opportunities Map. */
export async function GET() {
  const [recipients, schools, totals] = await Promise.all([
    attempt("EPA Excess Food Opportunities Map", epaFoodRecipients),
    attempt("EPA Excess Food Opportunities Map", () => epaSchoolGenerators(25)),
    attempt("EPA Excess Food Opportunities Map", epaSchoolTotals),
  ]);
  return NextResponse.json({ recipients, schools, totals });
}
