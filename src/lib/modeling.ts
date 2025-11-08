// src/lib/modeling.ts
export async function buildProviderProfileModel({ asof, provider, profile }:{
  asof: string; provider: Provider; profile: Profile;
}) {
  const targets = await getTargets(profile); // equity/bond/cash
  const universe = await getProviderUniverseWithScores(provider, asof);

  const coreEquity = pickCore(universe, 'Equity');  // e.g., US Total + Intl Total
  const coreBond   = pickCore(universe, 'Bond');    // e.g., Total Bond
  const cash       = pickCash(universe);

  const satelliteEquity = rankFilter(universe, { asset_class: 'Equity', exclude: coreEquity }).slice(0, 6);
  const satelliteBond   = rankFilter(universe, { asset_class: 'Bond', exclude: coreBond }).slice(0, 4);

  const draft = assembleWithCaps({
    targets, coreEquity, coreBond, cash, satelliteEquity, satelliteBond,
    caps: { perLineMax: 0.15, minLine: 0.05 }
  });

  return draft; // { id, notes, lines: [{symbol, weight, role}, ...] }
}
