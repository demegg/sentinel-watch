export type HazardCategory =
  | "wildlife"
  | "venom"
  | "crime"
  | "conflict"
  | "terror"
  | "health"
  | "weather"
  | "transport"
  | "cultural"
  | "other";

export type HazardLevel = "low" | "moderate" | "high" | "critical";

export interface RegionHazard {
  id: string;
  category: HazardCategory;
  level: HazardLevel;
  title: string;
  detail: string;
  avoid?: boolean;
}

export const CATEGORY_LABELS: Record<HazardCategory, string> = {
  crime: "Crime & scams",
  venom: "Venomous creatures",
  wildlife: "Wildlife & nature",
  health: "Health & hygiene",
  weather: "Weather & climate",
  conflict: "Conflict & security",
  terror: "Terrorism & security",
  transport: "Transport & roads",
  cultural: "Cultural & legal",
  other: "General awareness",
};

type CountryProfile = Partial<Record<HazardCategory, RegionHazard[]>>;

const BY_COUNTRY: Record<string, CountryProfile> = {
  GE: {
    crime: [
      { id: "ge-taxi", category: "crime", level: "high", title: "Unlicensed taxi overcharging", detail: "At Tbilisi airport and tourist zones, use Bolt/Yandex or pre-booked transfers — negotiate meters before entering unofficial cabs.", avoid: true },
      { id: "ge-pickpocket", category: "crime", level: "moderate", title: "Pickpockets in markets & metro", detail: "Dry Bridge flea market, Didube bus station, and crowded Rustaveli — keep bags in front, phones out of back pockets." },
      { id: "ge-scam-rest", category: "crime", level: "moderate", title: "Restaurant bill inflation", detail: "Check menus for prices before ordering in tourist-heavy Old Town; ask for the bill before paying.", avoid: true },
      { id: "ge-night-atm", category: "crime", level: "moderate", title: "ATM skimming / night theft", detail: "Use ATMs inside banks in daylight; avoid withdrawing large sums on quiet streets after dark." },
    ],
    transport: [
      { id: "ge-mountain-roads", category: "transport", level: "high", title: "Mountain road hazards (Kazbegi, Svaneti)", detail: "Steep passes, landslides, and aggressive overtaking — hire experienced drivers; avoid night drives in winter.", avoid: true },
      { id: "ge-driving", category: "transport", level: "moderate", title: "Aggressive local driving", detail: "Tbilisi traffic is fast and lane discipline varies — pedestrians: use marked crossings; drivers: expect sudden stops." },
      { id: "ge-marshrutka", category: "transport", level: "low", title: "Marshrutka minibuses", detail: "Cheap but cramped; secure bags, know your stop in advance, carry small bills for fare." },
    ],
    health: [
      { id: "ge-water", category: "health", level: "moderate", title: "Tap water in older buildings", detail: "Generally safe in Tbilisi but bottled water is safer in rural guesthouses — avoid untreated spring water in villages." },
      { id: "ge-altitude", category: "health", level: "moderate", title: "Altitude on Caucasus treks", detail: "Gergeti/Kazbegi trails reach 2,500m+ — pace yourself, carry layers, watch for altitude symptoms." },
      { id: "ge-sun", category: "health", level: "moderate", title: "Strong high-altitude sun", detail: "UV is intense in mountains even when cool — sunscreen, hat, and hydration on day hikes." },
    ],
    wildlife: [
      { id: "ge-stray-dogs", category: "wildlife", level: "moderate", title: "Stray dogs in suburbs", detail: "Most are timid but packs can be territorial at night — don't run; carry a stick on evening walks in outskirts.", avoid: true },
      { id: "ge-bear", category: "wildlife", level: "moderate", title: "Brown bears (Tusheti, Borjomi forests)", detail: "Rare on main trails but possible — make noise hiking, store food properly, never approach cubs." },
    ],
    conflict: [
      { id: "ge-border", category: "conflict", level: "high", title: "Occupied territories border zones", detail: "Do not travel to South Ossetia or Abkhazia without understanding current restrictions — land borders with Russia can close without notice.", avoid: true },
    ],
    cultural: [
      { id: "ge-church", category: "cultural", level: "low", title: "Church dress codes", detail: "Cover shoulders and knees at Orthodox churches — women may need headscarves at some monasteries." },
      { id: "ge-toast", category: "cultural", level: "low", title: "Supra toasting culture", detail: "Georgian feasts involve heavy toasting — pace alcohol, eat while drinking, designate a sober return plan." },
      { id: "ge-lgbt", category: "cultural", level: "moderate", title: "LGBTQ+ public discretion", detail: "Society is conservative outside central Tbilisi — public affection may draw hostility in smaller towns." },
    ],
    other: [
      { id: "ge-wine-drive", category: "other", level: "moderate", title: "Wine tourism & driving", detail: "Kakheti winery tours are popular — book a driver or stay overnight; police DUI checks are common.", avoid: true },
    ],
  },
  AU: {
    venom: [
      { id: "au-snakes", category: "venom", level: "high", title: "Venomous snakes", detail: "Eastern brown, taipan, tiger snake — never walk barefoot in bush; seek urgent care for any bite." },
      { id: "au-jellyfish", category: "venom", level: "high", title: "Box jellyfish / Irukandji", detail: "Northern beaches Oct–May — swim only between red/yellow flags; vinegar stations for stings.", avoid: true },
      { id: "au-spider", category: "venom", level: "moderate", title: "Funnel-web & redback spiders", detail: "Shake shoes and gloves left outside; funnel-web bites need antivenom fast." },
    ],
    wildlife: [
      { id: "au-croc", category: "wildlife", level: "critical", title: "Saltwater crocodiles", detail: "NT/QLD/WA tropical rivers — assume every waterway has crocs unless signed safe.", avoid: true },
      { id: "au-shark", category: "wildlife", level: "moderate", title: "Shark risk at surf beaches", detail: "Swim at patrolled beaches; avoid dusk/dawn and murky estuary mouths." },
      { id: "au-kangaroo", category: "wildlife", level: "moderate", title: "Kangaroo road strikes", detail: "Dawn/dusk driving outside cities — roos jump unpredictably; reduce speed on rural highways.", avoid: true },
    ],
    health: [
      { id: "au-sun", category: "health", level: "high", title: "Extreme UV exposure", detail: "Sunburn in under 15 minutes in summer — SPF 50+, hat, reapply after swimming." },
    ],
    crime: [
      { id: "au-theft", category: "crime", level: "moderate", title: "Beach/car break-ins", detail: "Don't leave valuables visible in rental cars at coastal lookouts." },
    ],
  },
  US: {
    wildlife: [
      { id: "us-bear", category: "wildlife", level: "moderate", title: "Bears in national parks", detail: "Use bear boxes, never feed wildlife, hike in groups in grizzly country.", avoid: true },
      { id: "us-gator", category: "wildlife", level: "moderate", title: "Alligators (southeast)", detail: "Stay 10m+ from water edges in FL/LA — gators are fast on land in short bursts.", avoid: true },
      { id: "us-bison", category: "wildlife", level: "high", title: "Bison in Yellowstone", detail: "They look slow but charge at 55 km/h — stay 25+ metres away.", avoid: true },
    ],
    venom: [
      { id: "us-snake", category: "venom", level: "moderate", title: "Rattlesnakes & copperheads", detail: "Watch rocky trails in southwest; step on logs, not over them." },
      { id: "us-scorpion", category: "venom", level: "moderate", title: "Scorpions (southwest deserts)", detail: "Shake out boots and camping gear; check shoes before wearing." },
    ],
    crime: [
      { id: "us-crime", category: "crime", level: "moderate", title: "Neighbourhood crime varies sharply", detail: "Research your district — car theft and robbery hotspots differ block by block in major cities." },
      { id: "us-scam", category: "crime", level: "moderate", title: "Tourist scams (NYC, Vegas, LA)", detail: "Fake tickets, timeshare pitches, CD scams — buy only from official vendors.", avoid: true },
    ],
    weather: [
      { id: "us-tornado", category: "weather", level: "high", title: "Tornado alley (midwest)", detail: "Spring/summer — know shelter locations; siren alerts mean move indoors immediately.", avoid: true },
      { id: "us-hurricane", category: "weather", level: "high", title: "Hurricane coasts (Gulf/Atlantic)", detail: "Jun–Nov season — monitor NHC forecasts; evacuate when ordered.", avoid: true },
    ],
    health: [
      { id: "us-healthcare", category: "health", level: "high", title: "Medical costs without insurance", detail: "ER visits can cost thousands — travel insurance with US coverage is essential." },
    ],
  },
  TH: {
    crime: [
      { id: "th-scam", category: "crime", level: "high", title: "Temple/gem/jet-ski scams", detail: "Anyone saying a site is closed and offering alternatives is likely scamming — use official entrances only.", avoid: true },
      { id: "th-theft", category: "crime", level: "moderate", title: "Pickpockets & bag snatches", detail: "Khao San, BTS stations, night markets — cross-body bag, phone not in back pocket." },
      { id: "th-taxi", category: "crime", level: "moderate", title: "Taxi/tuk-tuk meter refusal", detail: "Insist on meter or use Grab; refuse 'closed today' redirect stories.", avoid: true },
    ],
    wildlife: [
      { id: "th-monkeys", category: "wildlife", level: "moderate", title: "Aggressive monkeys", detail: "Lopburi, Railay, many temples — don't carry visible food; monkeys bite and scratch.", avoid: true },
      { id: "th-dogs", category: "wildlife", level: "moderate", title: "Stray dogs & rabies risk", detail: "Avoid petting street dogs; seek rabies PEP if bitten — not all clinics stock vaccine." },
    ],
    health: [
      { id: "th-dengue", category: "health", level: "high", title: "Dengue fever", detail: "Day-biting mosquitoes year-round — DEET repellent, long sleeves at dusk/dawn." },
      { id: "th-food", category: "health", level: "moderate", title: "Street food hygiene", detail: "Choose busy stalls with high turnover; avoid raw seafood and unpeeled fruit washed in tap water." },
    ],
    cultural: [
      { id: "th-royal", category: "cultural", level: "high", title: "Lèse-majesté laws", detail: "Never insult the monarchy — social media posts about the royal family can lead to prison.", avoid: true },
      { id: "th-temple", category: "cultural", level: "moderate", title: "Temple dress & Buddha images", detail: "Shoulders/knees covered; never point feet at Buddha statues or climb on them for photos.", avoid: true },
    ],
  },
  BR: {
    crime: [
      { id: "br-phone", category: "crime", level: "critical", title: "Phone snatching on motorcycles", detail: "Rio/São Paulo — don't use phone at sidewalk edge; thieves on motos grab and flee.", avoid: true },
      { id: "br-favela", category: "crime", level: "critical", title: "Unauthorised favela tours", detail: "Only enter with licensed community guides — wrong favela or timing risks armed robbery.", avoid: true },
      { id: "br-atm", category: "crime", level: "high", title: "Express kidnapping / ATM coercion", detail: "Withdraw during daylight at mall ATMs; refuse strangers offering help at machines.", avoid: true },
    ],
    venom: [
      { id: "br-snake", category: "venom", level: "high", title: "Jararaca & coral snakes", detail: "Amazon and Atlantic forest — boots on trails; antivenom availability varies by region." },
    ],
    health: [
      { id: "br-water", category: "health", level: "moderate", title: "Tap water outside major cities", detail: "Stick to bottled water in north/northeast; ice in tourist hotels usually filtered." },
      { id: "br-zika", category: "health", level: "moderate", title: "Mosquito-borne diseases", detail: "Dengue, Zika in tropical zones — repellent essential, especially rainy season." },
    ],
  },
  IN: {
    crime: [
      { id: "in-scam", category: "crime", level: "high", title: "Tourist commission scams", detail: "Drivers claiming your hotel burned down or shop closed — verify independently.", avoid: true },
      { id: "in-theft", category: "crime", level: "high", title: "Train/bus station theft", detail: "Chain bags to seats on overnight trains; padlock zips; sleep with valuables inside clothing." },
    ],
    health: [
      { id: "in-delhi-belly", category: "health", level: "high", title: "Food & water contamination", detail: "Bottled water only, peel fruit yourself, avoid ice and salads washed in tap water.", avoid: true },
      { id: "in-air", category: "health", level: "high", title: "Air pollution (Delhi, Mumbai)", detail: "AQI can exceed 400 in winter — N95 masks outdoors, limit exertion on bad days." },
      { id: "in-mosquito", category: "health", level: "moderate", title: "Dengue & malaria (regional)", detail: "Malaria prophylaxis needed in northeast/forests; dengue risk in cities after monsoon." },
    ],
    venom: [
      { id: "in-snake", category: "venom", level: "high", title: "Big Four venomous snakes", detail: "Cobras, kraits, Russell's viper, saw-scaled viper — watch footing in rural areas at night." },
    ],
    cultural: [
      { id: "in-temple", category: "cultural", level: "moderate", title: "Temple & mosque etiquette", detail: "Remove shoes, cover head at gurdwaras/mosques; no leather in some Jain/Hindu temples." },
    ],
  },
  UA: {
    conflict: [
      { id: "ua-conflict", category: "conflict", level: "critical", title: "Active war zone", detail: "Missile/drone strikes nationwide — know shelter locations; curfews and checkpoints vary by oblast.", avoid: true },
      { id: "ua-mines", category: "conflict", level: "critical", title: "Landmines & UXO", detail: "Never enter fields, forests, or beaches in formerly occupied areas without official clearance.", avoid: true },
    ],
    terror: [
      { id: "ua-missile", category: "terror", level: "critical", title: "Air raid alerts", detail: "Install official alert app; move to shelter on siren — strikes can hit far from front line.", avoid: true },
    ],
  },
  GB: {
    crime: [
      { id: "gb-pickpocket", category: "crime", level: "moderate", title: "Pickpockets (Oxford St, Tube)", detail: "Thieves work in teams on escalators — bag zipped in front, wallet not in back pocket." },
      { id: "gb-scooter", category: "crime", level: "moderate", title: "Phone snatch by moped", detail: "Don't use phone while standing at curb edge in central London.", avoid: true },
    ],
    transport: [
      { id: "gb-left", category: "transport", level: "low", title: "Look right when crossing", detail: "Traffic comes from the right — painted crossings help but double-check on one-way streets." },
    ],
  },
  FR: {
    crime: [
      { id: "fr-pickpocket", category: "crime", level: "high", title: "Pickpockets (Metro, Eiffel, Louvre)", detail: "Petition scams, bracelet tricks, distraction teams — ignore approaches, hands on bag.", avoid: true },
      { id: "fr-riot", category: "crime", level: "moderate", title: "Protest zones", detail: "Demonstrations can turn violent — avoid Champs-Élysées/Châtelet during major strike days.", avoid: true },
    ],
  },
  JP: {
    wildlife: [
      { id: "jp-bear", category: "wildlife", level: "moderate", title: "Bears (Hokkaido, Tohoku)", detail: "Bear bells on rural trails Sep–Nov; don't leave food at campsites.", avoid: true },
    ],
    cultural: [
      { id: "jp-shoes", category: "cultural", level: "low", title: "Shoes off indoors", detail: "Remove shoes at ryokan, temples, some restaurants — use provided slippers." },
      { id: "jp-tattoo", category: "cultural", level: "moderate", title: "Tattoos & onsen", detail: "Many baths ban visible tattoos — check rules or book tattoo-friendly onsen.", avoid: true },
    ],
    weather: [
      { id: "jp-typhoon", category: "weather", level: "high", title: "Typhoon season (Aug–Oct)", detail: "Monitor JMA alerts; trains and flights cancel — flexible itinerary essential.", avoid: true },
    ],
  },
  MX: {
    crime: [
      { id: "mx-cartel", category: "crime", level: "critical", title: "Cartel violence (state-dependent)", detail: "Sinaloa, Guerrero, Michoacán have extreme risk — research state-level advisories before booking.", avoid: true },
      { id: "mx-taxi", category: "crime", level: "high", title: "Unofficial taxi kidnappings", detail: "Use Uber/DiDi or sitio taxis from airport counters — never street hailed cabs at night.", avoid: true },
    ],
    venom: [
      { id: "mx-scorpion", category: "venom", level: "moderate", title: "Scorpions in desert/coastal areas", detail: "Shake out shoes and bedding in Baja/Yucatán budget accommodation." },
    ],
  },
  EG: {
    crime: [
      { id: "eg-hassle", category: "crime", level: "moderate", title: "Aggressive touts & baksheesh", detail: "Firm 'la shukran' (no thanks) at pyramids/Khan el-Khalili; agree prices before photos or camel rides.", avoid: true },
      { id: "eg-theft", category: "crime", level: "moderate", title: "Petty theft at tourist sites", detail: "Secure bags at Giza — distraction thefts common near ticket queues." },
    ],
    health: [
      { id: "eg-water", category: "health", level: "high", title: "Tap water & ice", detail: "Bottled water only; avoid ice unless from trusted hotel restaurants.", avoid: true },
    ],
    terror: [
      { id: "eg-sinai", category: "terror", level: "high", title: "Sinai & western desert advisories", detail: "North Sinai is high risk — stick to established Red Sea resort corridors with security.", avoid: true },
    ],
  },
  ZA: {
    crime: [
      { id: "za-carjack", category: "crime", level: "critical", title: "Carjacking hotspots", detail: "Johannesburg/Pretoria — keep doors locked, windows up in traffic; don't stop for 'broken down' cars.", avoid: true },
      { id: "za-hike", category: "crime", level: "high", title: "Table Mountain muggings", detail: "Don't hike alone; go in groups on less-busy trails; avoid isolated paths after 4pm.", avoid: true },
    ],
    wildlife: [
      { id: "za-big5", category: "wildlife", level: "high", title: "Big five on foot", detail: "Never exit vehicle in Kruger unless at designated hides — buffalo and hippo kill more than lions.", avoid: true },
    ],
  },
  TR: {
    crime: [
      { id: "tr-scam", category: "crime", level: "moderate", title: "Shoe shine & restaurant scams", detail: "Free shoe shine leads to demands for payment; check menu prices in Sultanahmet.", avoid: true },
    ],
    cultural: [
      { id: "tr-mosque", category: "cultural", level: "low", title: "Mosque dress code", detail: "Women need headscarf and covered legs/arms; remove shoes at entrance." },
    ],
  },
  KE: {
    crime: [
      { id: "ke-nairobi", category: "crime", level: "high", title: "Nairobi robbery risk", detail: "Don't walk at night in Eastlands; use Uber from malls; 'Nairobi hustle' includes fake police.", avoid: true },
    ],
    wildlife: [
      { id: "ke-hippo", category: "wildlife", level: "critical", title: "Hippos at dusk", detail: "Africa's most lethal large animal — never between hippo and water at lakes/rivers.", avoid: true },
    ],
    health: [
      { id: "ke-malaria", category: "health", level: "high", title: "Malaria (coast & lowlands)", detail: "Prophylaxis recommended for coast and safari lowlands — not needed in Nairobi highlands." },
    ],
  },
};

const CITY_OVERLAYS: Record<string, RegionHazard[]> = {
  tbilisi: [
    { id: "tbi-rustaveli", category: "crime", level: "moderate", title: "Rustaveli Ave. phone snatching", detail: "Busy sidewalk near Parliament — don't use phone while walking at curb edge.", avoid: true },
    { id: "tbi-oldtown", category: "crime", level: "moderate", title: "Old Town overcharging", detail: "Restaurants near Meidan may add 15–20% 'service' unlisted — confirm bill line by line.", avoid: true },
    { id: "tbi-narikala", category: "transport", level: "moderate", title: "Narikala cable car queues", detail: "Peak summer lines exceed 45 min — go early morning or walk the fortress path instead." },
    { id: "tbi-sulfur", category: "health", level: "low", title: "Sulfur baths temperature", detail: "Abanotubani baths run very hot — limit soak time, hydrate, exit if dizzy." },
    { id: "tbi-vake", category: "crime", level: "low", title: "Vake/Wine bars card skimming", detail: "Generally safe but watch card at nightlife — prefer contactless or cash at small bars." },
  ],
  london: [
    { id: "lon-tube", category: "crime", level: "moderate", title: "Tube pickpockets (Central line)", detail: "Rush hour between Oxford Circus and Bank — bag in front, don't leave laptop on seat.", avoid: true },
    { id: "lon-scam", category: "crime", level: "moderate", title: "Westminster petition scam", detail: "People with clipboards aren't charities — ignore and keep walking.", avoid: true },
  ],
  "new york": [
    { id: "nyc-subway", category: "crime", level: "moderate", title: "Subway phone snatching", detail: "Don't stand near doors using phone — thieves grab at stops.", avoid: true },
    { id: "nyc-times", category: "crime", level: "moderate", title: "Times Square costume photos", detail: "Elmo/Mickey will demand $20+ after photo — walk past without engaging.", avoid: true },
  ],
  paris: [
    { id: "par-metro", category: "crime", level: "high", title: "Metro Line 1 & 9 pickpockets", detail: "RER B from CDG to Gare du Nord is notorious — bag zipped, strap across chest.", avoid: true },
    { id: "par-bracelet", category: "crime", level: "moderate", title: "Sacré-Cœur bracelet scam", detail: "Someone ties string on your wrist then demands payment — keep hands in pockets uphill.", avoid: true },
  ],
  tokyo: [
    { id: "tok-rush", category: "transport", level: "low", title: "Shibuya crossing & rush hour", detail: "Station pushers at peak — follow flow, don't stop mid-crossing for photos.", avoid: true },
    { id: "tok-ramen", category: "cultural", level: "low", title: "Cash-only small eateries", detail: "Many ramen shops don't take cards — carry ¥10,000+ in cash." },
  ],
};

const TOURIST_UNIVERSAL: RegionHazard[] = [
  { id: "uni-insurance", category: "health", level: "moderate", title: "Travel insurance with medical cover", detail: "Hospital bills abroad can be catastrophic — ensure policy covers evacuation and adventure activities you plan." },
  { id: "uni-embassy", category: "other", level: "low", title: "Register with your embassy", detail: "Enroll in STEP (US), LOCATE (UK), or equivalent — helps in natural disasters or civil unrest." },
  { id: "uni-copies", category: "other", level: "low", title: "Document copies offline", detail: "Photo passport, visa, and insurance; store encrypted in cloud and keep paper copies separate from originals." },
  { id: "uni-emergency", category: "other", level: "low", title: "Know local emergency numbers", detail: "112 works in much of Europe; elsewhere save police, ambulance, and tourist police hotlines on arrival." },
  { id: "uni-sim", category: "other", level: "low", title: "Local SIM or eSIM on arrival", detail: "Maps and ride-hail apps need data — airport SIM kiosks often overcharge; compare eSIM options before landing." },
];

const GLOBAL_DEFAULTS: RegionHazard[] = [
  { id: "global-theft", category: "crime", level: "moderate", title: "Petty theft in crowded areas", detail: "Markets, festivals, and public transport — bag in front, zip pockets, no back-pocket wallet." },
  { id: "global-traffic", category: "transport", level: "moderate", title: "Unfamiliar traffic patterns", detail: "Look both ways — driving side, scooter culture, and pedestrian right-of-way vary widely." },
  { id: "global-night", category: "crime", level: "moderate", title: "Unlit or unfamiliar areas at night", detail: "Stick to main streets after dark until you know the neighbourhood — ask hotel staff about local no-go zones.", avoid: true },
];

const LEVEL_RANK: Record<HazardLevel, number> = { low: 0, moderate: 1, high: 2, critical: 3 };

export function buildRegionHazards(opts: {
  countryCode?: string;
  placeName: string;
  full?: boolean;
}): RegionHazard[] {
  const { countryCode, placeName, full } = opts;
  const hazards: RegionHazard[] = [];
  const seen = new Set<string>();

  const push = (list?: RegionHazard[]) => {
    if (!list) return;
    for (const h of list) {
      if (seen.has(h.id)) continue;
      seen.add(h.id);
      hazards.push(h);
    }
  };

  const profile = countryCode ? BY_COUNTRY[countryCode] : undefined;
  if (profile) {
    for (const list of Object.values(profile)) push(list);
  }

  const cityKey = placeName.trim().toLowerCase();
  const cityToken = cityKey.split(/[\s,]+/)[0];
  push(CITY_OVERLAYS[cityKey] ?? CITY_OVERLAYS[cityToken]);

  if (hazards.filter((h) => h.category === "crime").length === 0) {
    push([GLOBAL_DEFAULTS[0]]);
  }
  push([GLOBAL_DEFAULTS[1]]);

  if (full) {
    push(TOURIST_UNIVERSAL);
    push([GLOBAL_DEFAULTS[2]]);
  } else if (!profile) {
    push([GLOBAL_DEFAULTS[2]]);
  }

  hazards.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level]);
  return full ? hazards : hazards.slice(0, 8);
}

export function groupHazardsByCategory(hazards: RegionHazard[]) {
  const groups = new Map<HazardCategory, RegionHazard[]>();
  for (const h of hazards) {
    const list = groups.get(h.category) ?? [];
    list.push(h);
    groups.set(h.category, list);
  }
  const order: HazardCategory[] = [
    "conflict", "terror", "crime", "health", "wildlife", "venom",
    "weather", "transport", "cultural", "other",
  ];
  return order
    .filter((cat) => groups.has(cat))
    .map((cat) => ({ category: cat, label: CATEGORY_LABELS[cat], hazards: groups.get(cat)! }));
}

export function buildTouristSummary(placeName: string, hazards: RegionHazard[]) {
  const critical = hazards.filter((h) => h.level === "critical").length;
  const high = hazards.filter((h) => h.level === "high").length;
  const avoid = hazards.filter((h) => h.avoid).length;

  if (critical > 0) {
    return `Visiting ${placeName}: ${critical} critical alert${critical > 1 ? "s" : ""} and ${high} high-risk items — read carefully before exploring. ${avoid} specific things to avoid listed below.`;
  }
  if (high >= 3) {
    return `As a tourist in ${placeName}, stay alert — ${high} high-priority risks and ${avoid} specific things to avoid. Standard precautions apply everywhere else.`;
  }
  return `Welcome to ${placeName}. Mostly routine travel awareness — review ${hazards.length} local tips including ${avoid} things tourists should avoid.`;
}
