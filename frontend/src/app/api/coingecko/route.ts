import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy for CoinGecko API calls to avoid CORS issues.
 * Usage: /api/coingecko?path=/coins/markets&vs_currency=usd&...
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") || "/simple/price";
  
  // Build CoinGecko URL with all query params except "path"
  const params = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== "path") params.set(key, value);
  });

  const url = `https://api.coingecko.com/api/v3${path}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 30 }, // cache for 30s
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "CoinGecko fetch failed" }, { status: 502 });
  }
}
