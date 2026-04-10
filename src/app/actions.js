"use server";

import { supabase } from "../lib/supabaseClient";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;

export async function getAIAnalysisAction(accum) {
  if (!GEMINI_API_KEY) {
    return (accum.matches || []).map(m => ({
      id: m.id || m.match_id,
      analysis: `${m.h || m.home_team} showed strong potential in their last outing. With ${m.mkt || m.market} being a consistent trend, this is a solid pick for today's ticket.`
    }));
  }

  const body = (accum.matches || []).map(m =>
    `Match: ${m.h || m.home_team} vs ${m.a || m.away_team} (${m.lg || m.league}). Pick:"${m.pick}" (${m.mkt || m.market}) @${m.odds}.`
  ).join("\n");

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a sharp football analyst for PredictorUG. For each match below, write a PUNCHY 1-2 sentence analysis explaining WHY the pick is most likely correct. Be confident and use a high-energy betting style. RETURN ONLY A JSON ARRAY like this: [{"id":"match_id_here", "analysis": "..."}] -- absolutely no other text.\n\n${body}`
          }]
        }]
      })
    });

    const data = await res.json();
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    return JSON.parse(txt.replace(/```json|```/g, "").trim());
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return [];
  }
}

export async function fetchFixturesAction() {
  if (!API_FOOTBALL_KEY) return null;
  const today = new Date().toISOString().slice(0, 10);
  const TOP_LEAGUES = [39, 140, 135, 78, 61, 2, 3];
  
  try {
    const results = await Promise.allSettled(
      TOP_LEAGUES.map(lid =>
        fetch(`https://v3.football.api-sports.io/fixtures?league=${lid}&date=${today}&season=2024`, {
          headers: { "x-apisports-key": API_FOOTBALL_KEY }
        }).then(r => r.json())
      )
    );

    const matches = [];
    results.forEach((res) => {
      if (res.status === "fulfilled" && res.value.response) {
        res.value.response.forEach(fix => {
          matches.push({
            id: fix.fixture.id,
            h: fix.teams.home.name,
            a: fix.teams.away.name,
            lg: fix.league.name,
            fl: "⚽",
            kickoff: fix.fixture.date,
            hF: ["W","W","D","W","L"],
            aF: ["L","D","W","W","W"],
            hG: 1.5, aG: 1.2
          });
        });
      }
    });

    const uniqueMatches = Array.from(new Map(matches.map(m => [m.id, m])).values());
    return uniqueMatches.length >= 2 ? uniqueMatches : null;
  } catch (error) {
    console.error("Fetch Fixtures Error:", error);
    return null;
  }
}

export async function saveSingleAccumAction(tier, acc) {
  const { data: accumData, error: accumError } = await supabase
    .from('daily_accums')
    .insert({ 
        tier, 
        total_odds: acc.totalOdds, 
        date: new Date().toISOString().slice(0, 10), 
        first_kickoff: acc.firstKick 
    })
    .select()
    .single();

  if (accumError) return null;

  const matchesToInsert = acc.matches.map(m => ({
    accum_id: accumData.id,
    home_team: m.h,
    away_team: m.a,
    league: m.lg,
    flag: m.fl,
    kickoff: m.kickoff,
    market: m.mkt,
    pick: m.pick,
    odds: m.odds,
    confidence: m.conf,
    analysis: m.analysis,
    is_hot: m.hot
  }));

  await supabase.from('match_details').insert(matchesToInsert);
  return accumData;
}

export async function getLatestAccumsAction() {
  const tiers = ["free", "vip", "premium"];
  const results = {};

  for (const tier of tiers) {
    const { data, error } = await supabase
      .from('daily_accums')
      .select(`
        *,
        matches:match_details(*)
      `)
      .eq('tier', tier)
      .eq('date', new Date().toISOString().slice(0, 10))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(); // Use maybeSingle to avoid 406 errors

    if (!error && data) {
      // Map DB fields to UI fields
      data.matches = data.matches.map(m => ({
        id: m.id,
        h: m.home_team,
        a: m.away_team,
        lg: m.league,
        fl: m.flag,
        kickoff: m.kickoff,
        mkt: m.market,
        pick: m.pick,
        odds: m.odds,
        conf: m.confidence,
        analysis: m.analysis,
        hot: m.is_hot
      }));
      results[tier] = data;
    }
  }

  return results;
}

export async function checkUnlockStatusAction(phoneNumber, tier) {
    const { data } = await supabase
        .from('unlocked_tickets')
        .select('*')
        .eq('phone_number', phoneNumber)
        .eq('tier', tier)
        .eq('date', new Date().toISOString().slice(0, 10))
        .maybeSingle();
    
    return !!data;
}
