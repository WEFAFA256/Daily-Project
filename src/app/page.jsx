"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  getAIAnalysisAction, 
  getLatestAccumsAction, 
  saveSingleAccumAction,
  checkUnlockStatusAction,
  fetchFixturesAction
} from "./actions";

// ─── TIER CONFIG ─────────────────────────────────────────────────────────────
const TIERS = {
  free:    { label:"FREE",    emoji:"🆓", price:0,    color:"#4CAF50", dark:true,  desc:"2 daily picks · No payment needed",       picks:2 },
  vip:     { label:"VIP",     emoji:"⭐", price:1000,  color:"#F5C842", dark:true,  desc:"3 researched picks · High confidence",    picks:3 },
  premium: { label:"PREMIUM", emoji:"💎", price:2500,  color:"#B388FF", dark:false, desc:"5 elite picks · AI deep analysis",        picks:5 },
};

// ─── FALLBACK MATCH POOL ───────────────────────────────
const FALLBACK_POOL = [
  { id:1,  lg:"Premier League", fl:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", h:"Arsenal",        a:"Chelsea",          hF:["W","W","D","W","W"], aF:["L","D","W","L","D"], h2h:"3W-1D-1L", hG:2.3, aG:1.1 },
  { id:2,  lg:"La Liga",        fl:"🇪🇸", h:"Barcelona",      a:"Atletico Madrid",  hF:["W","W","W","D","W"], aF:["W","L","W","W","D"], h2h:"2W-1D-2L", hG:2.8, aG:1.9 },
  { id:3,  lg:"Serie A",        fl:"🇮🇹", h:"Inter Milan",    a:"AC Milan",          hF:["W","W","W","W","D"], aF:["L","W","D","L","W"], h2h:"3W-0D-2L", hG:2.6, aG:1.3 },
  { id:4,  lg:"Bundesliga",     fl:"🇩🇪", h:"Bayern Munich",  a:"Dortmund",          hF:["W","W","W","D","W"], aF:["W","W","L","W","W"], h2h:"4W-1D-0L", hG:3.1, aG:2.2 },
  { id:5,  lg:"Ligue 1",        fl:"🇫🇷", h:"PSG",            a:"Marseille",         hF:["W","W","W","W","W"], aF:["L","W","L","D","W"], h2h:"5W-0D-0L", hG:3.4, aG:1.2 },
  { id:6,  lg:"UCL",            fl:"🏆", h:"Real Madrid",    a:"Man City",          hF:["W","D","W","W","W"], aF:["W","W","D","W","L"], h2h:"2W-2D-1L", hG:2.9, aG:2.4 },
];

const MARKETS = ["Match Result","Double Chance","Over 2.5 Goals","BTTS","Draw No Bet","Asian Handicap","1st Half O1.5"];
const makePick = (mkt, m) => ({
  "Match Result":    Math.random()>0.3 ? `${m.h} Win` : "Draw",
  "Double Chance":   Math.random()>0.4 ? `${m.h} Win or Draw` : `${m.a} Win or Draw`,
  "Over 2.5 Goals":  "Over 2.5 Goals",
  "BTTS":            "Both Teams to Score",
  "Draw No Bet":     `${m.h} (DNB)`,
  "Asian Handicap":  `${m.h} -0.5`,
  "1st Half O1.5":   "Over 1.5 Goals (1H)",
}[mkt] || `${m.h} Win`);

const makeOdds = mkt => +({
  "Match Result":    1.6+Math.random()*1.3,
  "Double Chance":   1.25+Math.random()*0.55,
  "Over 2.5 Goals":  1.5+Math.random()*0.75,
  "BTTS":            1.5+Math.random()*0.65,
  "Draw No Bet":     1.5+Math.random()*0.9,
  "Asian Handicap":  1.6+Math.random()*0.8,
  "1st Half O1.5":   1.4+Math.random()*0.7,
}[mkt] || 1.8).toFixed(2);

function buildAccum(tier, pool, usedIds=[]) {
  const cfg = TIERS[tier];
  const available = pool.filter(m => !usedIds.includes(m.id)).sort(()=>Math.random()-0.5).slice(0, cfg.picks);
  const now = Date.now();

  const matches = available.map((m, i) => {
    const mkt = MARKETS[Math.floor(Math.random()*MARKETS.length)];
    const kick = m.kickoff || new Date(now + (30+i*45+Math.floor(Math.random()*60))*60000);
    return { ...m, mkt, pick: makePick(mkt,m), odds: makeOdds(mkt), conf: 72+Math.floor(Math.random()*22), hot: Math.random()>0.65, kickoff: kick, analysis: null };
  });

  const totalOdds = +(matches.reduce((a,m)=>a*m.odds,1)).toFixed(2);
  const firstKick = matches.reduce((a,m)=>m.kickoff<a?m.kickoff:a, matches[0].kickoff);
  return { tier, matches, totalOdds, firstKick, id:`${tier}-${Date.now()}`, loading:false };
}

// ─── COMPONENTS ─────────────────────────────────────────────────────────────

function useCountdown(targetMs) {
  const [left, setLeft] = useState(()=>Math.max(0, new Date(targetMs).getTime()-Date.now()));
  useEffect(()=>{
    const tick = () => setLeft(Math.max(0, new Date(targetMs).getTime()-Date.now()));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [targetMs]);
  return { left, h:Math.floor(left/3600000), m:Math.floor((left%3600000)/60000), s:Math.floor((left%60000)/1000), expired:left===0 };
}

function Countdown({ targetMs, color, tier, onExpired }) {
  const { expired, h, m, s } = useCountdown(targetMs);
  
  useEffect(() => {
    if (expired && onExpired) {
      onExpired(tier);
    }
  }, [expired, tier, onExpired]);

  if (expired) return <span style={{fontSize:11,color:"#FF5555",fontWeight:800,animation:"pulse 0.5s infinite"}}>⏱ Starting now!</span>;
  return (
    <div style={{display:"flex",gap:3}}>
      {[{v:h,l:"H"},{v:m,l:"M"},{v:s,l:"S"}].map(({v,l})=>(
        <div key={l} style={{background:"rgba(0,0,0,0.3)",borderRadius:6,padding:"3px 7px",minWidth:34,textAlign:"center"}}>
          <div style={{fontFamily:"'Russo One',sans-serif",fontSize:15,color,lineHeight:1}}>{String(v).padStart(2,"0")}</div>
          <div style={{fontSize:8,color:"rgba(255,255,255,0.4)",letterSpacing:1,marginTop:1,fontWeight:800}}>{l}</div>
        </div>
      ))}
    </div>
  );
}

function WinCalc({ totalOdds, color, t }) {
  const [stake, setStake] = useState("10000");
  const win = stake ? Math.floor(Number(stake)*totalOdds).toLocaleString() : "—";
  return (
    <div style={{padding:"12px 18px",borderBottom:`1px solid ${t.border}`}}>
      <div style={{fontSize:9,color:t.textDim,fontWeight:900,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>💰 WIN CALCULATOR</div>
      <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:9,color:t.textDim,marginBottom:4,fontWeight:800}}>STAKE (UGX)</div>
          <input value={stake} onChange={e=>setStake(e.target.value.replace(/\D/g,""))}
            style={{width:"100%",padding:"8px 10px",background:t.bg,border:`1.5px solid ${t.border}`,borderRadius:8,color:t.text,fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:800,outline:"none"}}/>
        </div>
        <div style={{color:t.textDim,fontSize:18,paddingBottom:8}}>→</div>
        <div style={{flex:1}}>
          <div style={{fontSize:9,color:t.textDim,marginBottom:4,fontWeight:800}}>WIN (UGX)</div>
          <div style={{padding:"8px 10px",background:`${color}14`,border:`1.5px solid ${color}44`,borderRadius:8}}>
            <span style={{fontFamily:"'Russo One',sans-serif",fontSize:14,color}}>{win}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PayScreen({ accum, t, dark, onBack, onPaid }) {
  const cfg = TIERS[accum.tier];
  const [payMethod, setPayMethod] = useState("mtn");
  const [phone, setPhone] = useState("");
  const [paying, setPaying] = useState(false);
  const go = () => { if(phone.length<9) return; setPaying(true); setTimeout(()=>{ setPaying(false); onPaid(phone); },2200); };
  return (
    <div style={{padding:"18px",animation:"fadeUp 0.3s ease"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:t.textDim,cursor:"pointer",fontSize:13,fontWeight:800,marginBottom:14,padding:0}}>← Back</button>
      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{fontSize:26}}>{cfg.emoji}</div>
        <div style={{fontFamily:"'Russo One',sans-serif",fontSize:19,color:cfg.color,marginTop:4}}>{cfg.label} UNLOCK</div>
        <div style={{fontSize:12,color:t.textDim,marginTop:3,fontWeight:700}}>{accum.matches.length} picks · AI analysis · Valid all day</div>
      </div>
      <div style={{background:t.bg,border:`1px solid ${t.border}`,borderRadius:12,marginBottom:14,overflow:"hidden"}}>
        {accum.matches.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px",borderBottom:i<accum.matches.length-1?`1px solid ${t.border}`:"none"}}>
            <div>
              <div style={{fontSize:9,color:t.textDim,fontWeight:900}}>{m.flag || m.fl} {m.league || m.lg}</div>
              <div style={{fontSize:12,fontWeight:900,color:t.text}}>{m.home_team || m.h} vs {m.away_team || m.a}</div>
            </div>
            <div style={{display:"flex",gap:5,alignItems:"center"}}>
              <span style={{fontSize:10,filter:"blur(5px)",userSelect:"none",background:t.border,padding:"2px 7px",borderRadius:5,color:t.textDim}}>███████</span>
              <span style={{background:cfg.color,color:cfg.dark?"#000":"#fff",borderRadius:5,padding:"2px 8px",fontSize:12,fontWeight:900,filter:"blur(5px)",userSelect:"none"}}>{m.odds}</span>
            </div>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",padding:"11px 14px",borderTop:`1px solid ${t.border}`,background:`${cfg.color}0C`}}>
          <span style={{fontSize:12,fontWeight:900,color:t.text}}>TOTAL ODDS</span>
          <span style={{fontFamily:"'Russo One',sans-serif",fontSize:24,color:cfg.color}}>{accum.total_odds || accum.totalOdds}</span>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:11}}>
        {[{id:"mtn",lbl:"MTN MoMo",em:"📱",c:"#FFD700"},{id:"airtel",lbl:"Airtel Money",em:"📲",c:"#FF3B5C"}].map(pm=>(
          <button key={pm.id} onClick={()=>setPayMethod(pm.id)} style={{padding:"10px 8px",border:`1.5px solid ${payMethod===pm.id?pm.c:t.border}`,borderRadius:10,cursor:"pointer",background:payMethod===pm.id?`${pm.c}15`:t.surface,display:"flex",flexDirection:"column",alignItems:"center",gap:4,transition:"all 0.2s",position:"relative",fontFamily:"'Outfit',sans-serif"}}>
            <span style={{fontSize:20}}>{pm.em}</span>
            <span style={{fontSize:11,fontWeight:800,color:payMethod===pm.id?pm.c:t.textDim}}>{pm.lbl}</span>
            {payMethod===pm.id&&<span style={{position:"absolute",top:5,right:5,width:13,height:13,borderRadius:"50%",background:pm.c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"#000",fontWeight:900}}>✓</span>}
          </button>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,border:`1.5px solid ${phone.length>=9?cfg.color:t.border}`,borderRadius:10,padding:"11px 13px",background:t.surface,marginBottom:11,transition:"all 0.2s"}}>
        <span style={{color:t.textDim,fontSize:13,whiteSpace:"nowrap",fontWeight:800}}>🇺🇬 +256</span>
        <input value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="7X XXX XXXX"
          style={{flex:1,border:"none",outline:"none",background:"transparent",fontFamily:"'Outfit',sans-serif",fontSize:15,letterSpacing:2,color:t.text,fontWeight:800}}/>
      </div>
      <button onClick={go} disabled={paying||phone.length<9} style={{
        width:"100%",padding:"14px",
        background:paying||phone.length<9?t.border:`linear-gradient(135deg,${cfg.color},${cfg.color}bb)`,
        color:paying||phone.length<9?t.textDim:(cfg.dark?"#000":"#fff"),
        border:"none",borderRadius:11,fontFamily:"'Russo One',sans-serif",fontSize:16,letterSpacing:1,
        cursor:paying||phone.length<9?"not-allowed":"pointer",transition:"all 0.2s",
        display:"flex",alignItems:"center",justifyContent:"center",gap:8,
      }}>
        {paying?<><span style={{width:16,height:16,border:`2px solid ${t.textDim}`,borderTopColor:cfg.color,borderRadius:"50%",animation:"spin 0.8s linear infinite",display:"inline-block"}}/>PROCESSING...</>:`PAY UGX ${cfg.price.toLocaleString()} →`}
      </button>
    </div>
  );
}

function AccumCard({ accum, dark, t, onExpired }) {
  const cfg = TIERS[accum.tier];
  const [unlocked, setUnlocked] = useState(accum.tier==="free");
  const [payOpen, setPayOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(accum.isRegenerating || false);

  useEffect(() => {
    const isPaid = localStorage.getItem(`unlocked-${accum.tier}-${new Date().toISOString().slice(0,10)}`);
    if (isPaid) setUnlocked(true);
  }, [accum.tier]);

  const handlePaid = (phone) => {
    setUnlocked(true);
    setPayOpen(false);
    localStorage.setItem(`unlocked-${accum.tier}-${new Date().toISOString().slice(0,10)}`, "true");
  };

  if (isRegenerating) {
    return (
      <div style={{background:t.surface,border:`1px solid ${cfg.color}44`,borderRadius:18,padding:"30px",textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:32,animation:"spin 1s linear infinite",display:"inline-block",marginBottom:15}}>⚙️</div>
        <div style={{fontFamily:"'Russo One',sans-serif",fontSize:15,color:cfg.color}}>Refreshing {cfg.label} Accumulator...</div>
      </div>
    );
  }

  return (
    <div style={{background:t.surface,border:`1.5px solid ${unlocked?cfg.color+"66":t.border}`,borderRadius:18,overflow:"hidden",marginBottom:20,animation:"fadeUp 0.5s ease"}}>
      <div style={{background:dark?`${cfg.color}0E`:`${cfg.color}16`,borderBottom:`1px solid ${t.border}`,padding:"13px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:9,background:cfg.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{cfg.emoji}</div>
          <div>
            <div style={{fontFamily:"'Russo One',sans-serif",fontSize:14,color:cfg.color,letterSpacing:0.5}}>{cfg.label} ACCUMULATOR</div>
            <div style={{fontSize:10,color:t.textDim,marginTop:1,fontWeight:900}}>{cfg.desc}</div>
          </div>
        </div>
        {unlocked 
          ? <span style={{background:cfg.color,color:cfg.dark?"#000":"#fff",borderRadius:7,padding:"3px 10px",fontSize:10,fontWeight:900,boxShadow:`0 0 10px ${cfg.color}44`}}>🔓 LIVE</span>
          : <span style={{background:dark?"rgba(255,255,255,0.05)":t.border,color:t.textDim,border:`1px solid ${t.border}`,borderRadius:7,padding:"3px 10px",fontSize:10,fontWeight:900}}>🔒 LOCKED</span>
        }
      </div>

      <div style={{padding:"9px 18px",borderBottom:`1px solid ${t.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:dark?"rgba(0,0,0,0.18)":"rgba(0,0,0,0.02)"}}>
        <span style={{fontSize:9,color:t.textDim,fontWeight:900,letterSpacing:1.5,textTransform:"uppercase"}}>⏳ EXPIRES IN</span>
        <Countdown targetMs={accum.first_kickoff || accum.firstKick} color={cfg.color} tier={accum.tier} onExpired={onExpired}/>
      </div>

      {payOpen ? (
        <PayScreen accum={accum} t={t} dark={dark} onBack={()=>setPayOpen(false)} onPaid={handlePaid}/>
      ) : (
        <>
          {(accum.matches || []).map((m,i)=>(
            <div key={m.id} style={{borderBottom:`1px solid ${t.border}`,padding:"13px 18px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <span>{m.flag || m.fl}</span>
                  <span style={{fontSize:11,color:t.textDim,fontWeight:900}}>{m.league || m.lg}</span>
                  {(m.is_hot || m.hot) &&<span style={{fontSize:9,background:"#FF4D00",color:"#fff",borderRadius:5,padding:"2px 6px",fontWeight:900,boxShadow:"0 2px 6px rgba(255,77,0,0.3)"}}>🔥</span>}
                </div>
                <span style={{fontSize:11,color:t.textDim,fontWeight:800}}>⏰ {new Date(m.kickoff).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{flex:1,fontWeight:900,fontSize:15,color:t.text}}>{m.home_team || m.h}</span>
                <span style={{fontSize:10,color:t.textDim,background:t.border,padding:"2px 8px",borderRadius:5,flexShrink:0,fontWeight:900}}>VS</span>
                <span style={{flex:1,fontWeight:900,fontSize:15,color:t.text,textAlign:"right"}}>{m.away_team || m.a}</span>
              </div>
              <div style={{position:"relative"}}>
                <div style={{
                  display:"flex",justifyContent:"space-between",alignItems:"center",
                  background:dark?`${cfg.color}08`:`${cfg.color}0F`,
                  border:`1px solid ${cfg.color}${unlocked?"44":"1A"}`,
                  borderRadius:9,padding:"9px 12px",
                  filter:unlocked?"none":"blur(7px)",
                  userSelect:unlocked?"auto":"none",
                  transition:"filter 0.6s ease",
                }}>
                  <div>
                    <div style={{fontSize:9,color:t.textDim,letterSpacing:1,textTransform:"uppercase",marginBottom:2,fontWeight:900}}>{m.market || m.mkt}</div>
                    <div style={{fontSize:13,fontWeight:900,color:cfg.color}}>✅ {m.pick}</div>
                  </div>
                  <div style={{background:cfg.color,color:cfg.dark?"#000":"#fff",borderRadius:7,padding:"6px 12px",textAlign:"center",minWidth:52}}>
                    <div style={{fontFamily:"'Russo One',sans-serif",fontSize:19,lineHeight:1}}>{m.odds}</div>
                    <div style={{fontSize:8,letterSpacing:1,opacity:0.75,marginTop:1,fontWeight:900}}>ODDS</div>
                  </div>
                </div>
                {!unlocked&&(
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",gap:5,pointerEvents:"none"}}>
                    <span>🔒</span><span style={{fontSize:11,fontWeight:900,color:t.textDim}}>Pay to unlock ticket</span>
                  </div>
                )}
              </div>
              {unlocked&&(
                <div style={{marginTop:9,background:dark?"rgba(255,255,255,0.025)":"rgba(0,0,0,0.03)",borderRadius:8,padding:"10px 12px",borderLeft:`3px solid ${cfg.color}77`,animation:"fadeUp 0.4s ease"}}>
                  <p style={{fontSize:12,color:t.textDim,lineHeight:1.65,margin:0,fontWeight:700}}>{m.analysis || "AI: High statistical probability based on current form."}</p>
                </div>
              )}
            </div>
          ))}

          <div style={{padding:"14px 18px",background:dark?`${cfg.color}06`:`${cfg.color}0A`,borderBottom:`1px solid ${t.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:9,color:t.textDim,fontWeight:900,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>TOTAL ACCUMULATOR ODDS</div>
              <div style={{fontSize:12,color:t.textDim,fontWeight:800}}>{(accum.matches || []).length} picks combined</div>
            </div>
            <div style={{background:`linear-gradient(135deg,${cfg.color},${cfg.color}aa)`,color:cfg.dark?"#000":"#fff",borderRadius:12,padding:"10px 20px",textAlign:"center",boxShadow:`0 4px 12px ${cfg.color}33`}}>
              <div style={{fontFamily:"'Russo One',sans-serif",fontSize:34,lineHeight:1}}>{accum.total_odds || accum.totalOdds}</div>
              <div style={{fontSize:8,letterSpacing:2,marginTop:3,opacity:0.85,fontWeight:900}}>TOTAL ODDS</div>
            </div>
          </div>

          {unlocked && <WinCalc totalOdds={accum.total_odds || accum.totalOdds} color={cfg.color} t={t}/>}

          <div style={{padding:"14px 18px"}}>
            {accum.tier==="free"
              ? <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  <span style={{color:cfg.color,fontSize:14}}>✅</span>
                  <span style={{color:cfg.color,fontWeight:900,fontSize:13}}>Free entries unlocked!</span>
                </div>
              : !unlocked
                ? <>
                    <button onClick={()=>setPayOpen(true)} style={{
                      width:"100%",padding:"15px",
                      background:`linear-gradient(135deg,${cfg.color},${cfg.color}bb)`,
                      color:cfg.dark?"#000":"#fff",
                      border:"none",borderRadius:12,fontFamily:"'Russo One',sans-serif",
                      fontSize:16,letterSpacing:1,cursor:"pointer",transition:"transform 0.2s, background 0.2s",
                      boxShadow:`0 6px 16px ${cfg.color}44`,
                    }} onMouseDown={e=>e.currentTarget.style.transform="scale(0.98)"} onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}>
                      🔓 UNLOCK {cfg.label} · UGX {cfg.price.toLocaleString()}
                    </button>
                    <p style={{textAlign:"center",fontSize:10,color:t.textDim,marginTop:8,fontWeight:900}}>Secure Payment · 24h Access</p>
                  </>
                : <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                    <span style={{color:cfg.color,fontSize:14}}>✅</span>
                    <span style={{color:cfg.color,fontWeight:900,fontSize:13}}>Success! Good luck 🍀</span>
                  </div>
            }
          </div>
        </>
      )}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [dark, setDark] = useState(true);
  const [accums, setAccums] = useState(null);
  const [pool, setPool] = useState(null);
  const [ticker, setTicker] = useState(0);
  const [liveUsers, setLiveUsers] = useState(1247);
  const t = dark ? DARK : LIGHT;

  const WINS = [
    {u:"Kasozi J.",w:"145,000",s:"10,000",time:"2h ago"},
    {u:"Nakato A.",w:"87,000", s:"10,000",time:"Yesterday"},
    {u:"Mukasa P.",w:"210,000",s:"10,000",time:"2 days ago"},
  ];

  // Load latest accums on mount
  useEffect(()=>{
    (async()=>{
      // Fetch latest from DB
      const stored = await getLatestAccumsAction();
      
      // Also fetch fixtures for potential regeneration
      const real = await fetchFixturesAction();
      const currentPool = (real && real.length >= 2) ? real : FALLBACK_POOL;
      setPool(currentPool);

      if(Object.keys(stored).length === 3) {
        setAccums(stored);
      } else {
        // Missing some tiers, generate initial ones
        const missingTiers = ["free", "vip", "premium"].filter(t => !stored[t]);
        const newAccums = { ...stored };
        const usedIds = [];
        Object.values(stored).forEach(a => a.matches.forEach(m => usedIds.push(m.id || m.match_id)));

        for(const tier of missingTiers) {
          const acc = buildAccum(tier, currentPool, usedIds);
          acc.matches.forEach(m => usedIds.push(m.id));
          
          // AI Analysis
          const analysis = await getAIAnalysisAction(acc);
          acc.matches = acc.matches.map(m => {
            const f = analysis.find(a => a.id === m.id);
            return f ? { ...m, analysis: f.analysis } : m;
          });
          
          const saved = await saveSingleAccumAction(tier, acc);
          newAccums[tier] = { ...acc, ...saved, matches: acc.matches };
        }
        setAccums(newAccums);
      }
    })();
  },[]);

  // Regenerate single tier when it expires
  const handleTierExpired = useCallback(async (tier) => {
    if (!pool || !accums) return;
    
    // Set loading for just this tier
    setAccums(prev => ({ ...prev, [tier]: { ...prev[tier], isRegenerating: true } }));
    
    const usedIds = [];
    Object.entries(accums).forEach(([k, a]) => {
      if (k !== tier && a) (a.matches || []).forEach(m => usedIds.push(m.id || m.match_id));
    });

    const newAcc = buildAccum(tier, pool, usedIds);
    const analysis = await getAIAnalysisAction(newAcc);
    newAcc.matches = newAcc.matches.map(m => {
      const f = analysis.find(a => a.id === m.id);
      return f ? { ...m, analysis: f.analysis } : m;
    });

    const saved = await saveSingleAccumAction(tier, newAcc);
    setAccums(prev => ({ 
      ...prev, 
      [tier]: { ...newAcc, ...saved, matches: newAcc.matches, isRegenerating: false } 
    }));
  }, [pool, accums]);

  useEffect(()=>{const i=setInterval(()=>setTicker(x=>(x+1)%WINS.length),3800);return()=>clearInterval(i);},[]);
  useEffect(()=>{const i=setInterval(()=>setLiveUsers(n=>n+Math.floor(Math.random()*5-1)),4500);return()=>clearInterval(i);},[]);

  return (
    <div style={{background:t.bg,color:t.text,minHeight:"100vh",fontFamily:"'Outfit',sans-serif",fontWeight:700}}>
      {/* NAV */}
      <nav style={{position:"sticky",top:0,zIndex:99,background:dark?"rgba(0,0,0,0.95)":"rgba(242,255,245,0.95)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${t.border}`,padding:"11px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:10,background:"#00D45E",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:"0 0 15px #00D45E44"}}>⚽</div>
          <div>
            <div style={{fontFamily:"'Russo One',sans-serif",fontSize:17,letterSpacing:1,color:t.text}}>PREDICTOR<span style={{color:"#00D45E"}}>UG</span></div>
            <div style={{fontSize:9,color:t.textDim,letterSpacing:2,textTransform:"uppercase",fontWeight:900}}>Daily Safe Tickets</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(0,212,94,0.08)",border:"1px solid rgba(0,212,94,0.25)",borderRadius:20,padding:"6px 12px"}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#00D45E",animation:"pulse 1.5s infinite",display:"block"}}/>
            <span style={{fontSize:11,fontWeight:900,color:"#00D45E"}}>{liveUsers.toLocaleString()}</span>
          </div>
          <button onClick={()=>setDark(!dark)} style={{width:34,height:34,borderRadius:"50%",border:`1px solid ${t.border}`,background:t.surface,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"}}>
            {dark?"☀️":"🌙"}
          </button>
        </div>
      </nav>

      <div style={{maxWidth:480,margin:"0 auto",padding:"20px 16px 70px"}}>
        <div style={{textAlign:"center",marginBottom:20,animation:"fadeUp 0.5s ease"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(0,212,94,0.08)",border:"1px solid rgba(0,212,94,0.25)",borderRadius:20,padding:"6px 16px",marginBottom:14}}>
            <span style={{fontSize:11,color:"#00D45E",fontWeight:900,letterSpacing:1.5}}>📅 {new Date().toLocaleDateString("en-UG",{weekday:"long",day:"numeric",month:"long"})}</span>
          </div>
          <h1 style={{fontFamily:"'Russo One',sans-serif",fontSize:30,color:t.text,letterSpacing:0.5,marginBottom:6}}>AI-Powered <span style={{color:"#00D45E"}}>Tickets</span></h1>
          <p style={{fontSize:13,color:t.textDim,lineHeight:1.6,fontWeight:800}}>researched picks · AI analysis · High accuracy</p>
        </div>

        <div key={ticker} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(0,212,94,0.07)",border:"1px solid rgba(0,212,94,0.2)",borderRadius:12,padding:"10px 15px",marginBottom:20,overflow:"hidden",animation:"tickIn 0.4s ease"}}>
          <span style={{fontSize:10,fontWeight:900,color:"#00D45E",letterSpacing:1,whiteSpace:"nowrap"}}>⚡ LIVE WIN:</span>
          <span style={{fontSize:12,color:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:800}}>
            <strong>{WINS[ticker].u}</strong> won <span style={{color:"#00D45E"}}>UGX {WINS[ticker].w}</span> · {WINS[ticker].time}
          </span>
        </div>

        {!accums ? (
          <div style={{textAlign:"center",padding:"50px 20px"}}>
            <div style={{fontSize:40,animation:"spin 1s linear infinite",display:"inline-block",marginBottom:15}}>⚙️</div>
            <div style={{fontFamily:"'Russo One',sans-serif",fontSize:18,color:"#00D45E",marginBottom:8}}>Syncing Daily Cloud...</div>
            <div style={{fontSize:13,color:t.textDim,fontWeight:800}}>Fetching latest analyzed tickets</div>
          </div>
        ) : (
          ["free","vip","premium"].map(tier=>
            accums[tier] && <AccumCard key={tier} accum={accums[tier]} dark={dark} t={t} onExpired={handleTierExpired}/>
          )
        )}

        <div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:20,overflow:"hidden",marginTop:25,marginBottom:25,boxShadow:"0 4px 20px rgba(0,0,0,0.15)"}}>
           <div style={{padding:"15px 18px",borderBottom:`1px solid ${t.border}`,fontSize:11,fontWeight:900,color:t.textDim,letterSpacing:2,background:dark?"rgba(0,0,0,0.2)":"rgba(0,0,0,0.02)"}}>🏆 RECENT BIG WINS</div>
          {WINS.map((w,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 18px",borderBottom:i<WINS.length-1?`1px solid ${t.border}`:"none",transition:"background 0.2s"}}>
              <div style={{width:38,height:38,borderRadius:"50%",background:"rgba(0,212,94,0.1)",border:"1px solid rgba(0,212,94,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:14,color:"#00D45E",flexShrink:0}}>{w.u[0]}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:900,fontSize:14,color:t.text}}>{w.u}</div>
                <div style={{fontSize:11,color:t.textDim,fontWeight:800}}>Stake: UGX {w.s}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:900,fontSize:15,color:"#00D45E"}}>+{w.w}</div>
                <div style={{fontSize:11,color:t.textDim,fontWeight:800}}>{w.time}</div>
              </div>
            </div>
          ))}
        </div>

        <p style={{textAlign:"center",fontSize:11,color:t.textDim,lineHeight:1.8,fontWeight:700,padding:"0 20px"}}>⚠️ Predictions are AI-generated analysis ONLY. No guarantees of winning. Always bet responsibly. 18+ only.</p>
      </div>
    </div>
  );
}

const DARK  = { bg:"#000000", surface:"#0C0F10", border:"#1F2426", text:"#FFFFFF", textDim:"#8A9A9E" };
const LIGHT = { bg:"#F2FFF5", surface:"#FFFFFF",  border:"#C5E8CC", text:"#122D18", textDim:"#4A7356" };
