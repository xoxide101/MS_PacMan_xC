// Authentic Gauntlet: Dark Legacy (2000 Midway Arcade + PS2/GC/Xbox Console) Data & Dungeon Generator

export type HeroClassId =
  | 'knight'
  | 'valkyrie'
  | 'wizard'
  | 'archer'
  | 'jester'
  | 'dwarf'
  | 'sorceress'
  | 'minotaur'
  | 'sumner'
  | 'medusa'
  | 'jackal'
  | 'ogre';

export type ElementColorId = 'red' | 'blue' | 'yellow' | 'green';

export type RealmId =
  | 'hub'
  | 'mountain'
  | 'castle'
  | 'province'
  | 'forest'
  | 'desert'
  | 'ice'
  | 'sky'
  | 'dream'
  | 'underworld';

export type RelicId =
  | 'anti_death'
  | 'phoenix'
  | 'three_way'
  | 'rapid_fire'
  | 'super_shot'
  | 'reflect_shield'
  | 'growth'
  | 'coin_magnet'
  | 'levitation'
  | 'xray_glasses';

export type CameraMode = 'arcade' | 'action' | 'tactical';

export interface HeroClassDef {
  id: HeroClassId;
  name: string;
  titlePrefix: string;
  weaponName: string;
  turboName: string;
  secret?: boolean;
  unlockRunestones?: number;
  secretCode?: string;
  strength: number; // 40-100
  speed: number; // 50-100
  armor: number; // 40-100
  magic: number; // 40-100
  meleeRange: number;
  rangedSpeed: number;
  accentHex: string;
  desc: string;
}

export interface ElementColorDef {
  id: ElementColorId;
  name: string;
  element: string;
  primaryHex: string;
  glowHex: string;
  darkHex: string;
  statusEffect: 'burn' | 'freeze' | 'shock' | 'poison';
  statusLabel: string;
}

export interface LegendaryWeaponDef {
  id: string;
  name: string;
  realmId: RealmId;
  targetBossName: string;
  colorHex: string;
  effectText: string;
}

export interface RealmDef {
  id: RealmId;
  name: string;
  shortName: string;
  order: number;
  bossName: string;
  bossType:
    | 'plague_fiend'
    | 'dragon'
    | 'lich'
    | 'chimera'
    | 'spider_queen'
    | 'yeti'
    | 'genie'
    | 'shadow_wraith'
    | 'skorne';
  runestoneCount: number;
  requiredRunestones: number;
  legendaryWeapon: LegendaryWeaponDef;
  fogHex: string;
  ambientHex: string;
  floorHex: string;
  floorAccentHex: string;
  wallHex: string;
  wallAccentHex: string;
  hazardType: 'lava' | 'acid' | 'void' | 'ice_chasm';
  hazardHex: string;
  portalHex: string;
  enemyMix: Array<'grunt' | 'skeleton' | 'golem' | 'gargoyle' | 'imp' | 'general'>;
  subtitle: string;
}

export interface RelicDef {
  id: RelicId;
  name: string;
  shortName: string;
  duration: number; // seconds (0 = charges/until used)
  cost: number;
  colorHex: string;
  desc: string;
}

export const ELEMENT_COLORS: Record<ElementColorId, ElementColorDef> = {
  red: {
    id: 'red',
    name: 'Red',
    element: 'Fire',
    primaryHex: '#ef4444',
    glowHex: '#ff7b3b',
    darkHex: '#7f1d1d',
    statusEffect: 'burn',
    statusLabel: 'Ignites foes with Inferno DoT',
  },
  blue: {
    id: 'blue',
    name: 'Blue',
    element: 'Ice',
    primaryHex: '#3b82f6',
    glowHex: '#38bdf8',
    darkHex: '#1e3a8a',
    statusEffect: 'freeze',
    statusLabel: 'Chills & freezes monsters solid',
  },
  yellow: {
    id: 'yellow',
    name: 'Yellow',
    element: 'Lightning',
    primaryHex: '#eab308',
    glowHex: '#fde047',
    darkHex: '#713f12',
    statusEffect: 'shock',
    statusLabel: 'Chains lightning bolts across crowds',
  },
  green: {
    id: 'green',
    name: 'Green',
    element: 'Acid',
    primaryHex: '#22c55e',
    glowHex: '#86efac',
    darkHex: '#14532d',
    statusEffect: 'poison',
    statusLabel: 'Corrodes armor & melts generators',
  },
};

export const HERO_CLASSES: HeroClassDef[] = [
  {
    id: 'knight',
    name: 'Knight',
    titlePrefix: 'Paladin',
    weaponName: 'Templar Broadsword',
    turboName: 'Whirlwind Blade',
    strength: 86,
    speed: 68,
    armor: 88,
    magic: 52,
    meleeRange: 2.55,
    rangedSpeed: 16.5,
    accentHex: '#cbd5e1',
    desc: 'Heavy steel broadsword, armored shield block, and devastating 3-hit melee cleaves.',
  },
  {
    id: 'valkyrie',
    name: 'Valkyrie',
    titlePrefix: 'Shieldmaiden',
    weaponName: 'Winged Halberd',
    turboName: 'Valkyrie Lance',
    strength: 76,
    speed: 78,
    armor: 82,
    magic: 62,
    meleeRange: 2.8,
    rangedSpeed: 18,
    accentHex: '#f8fafc',
    desc: 'Balanced Nordic warrior with long-reach halberd sweeps and agile shield defense.',
  },
  {
    id: 'wizard',
    name: 'Wizard',
    titlePrefix: 'Archmage',
    weaponName: 'Runed Arcane Staff',
    turboName: 'Astral Nova',
    strength: 48,
    speed: 68,
    armor: 48,
    magic: 96,
    meleeRange: 2.1,
    rangedSpeed: 20,
    accentHex: '#a855f7',
    desc: 'Master of elemental magic whose ranged bolts and potion blasts obliterate generators.',
  },
  {
    id: 'archer',
    name: 'Archer',
    titlePrefix: 'Ranger',
    weaponName: 'Elven Longbow',
    turboName: 'Starfall Volley',
    strength: 62,
    speed: 92,
    armor: 56,
    magic: 66,
    meleeRange: 2.1,
    rangedSpeed: 23,
    accentHex: '#34d399',
    desc: 'Blazing-fast movement and rapid piercing arrows that snipe enemies from afar.',
  },
  {
    id: 'jester',
    name: 'Jester',
    titlePrefix: 'Trickster',
    weaponName: 'Arcane Trick Bombs',
    turboName: 'Chaos Juggle',
    strength: 58,
    speed: 95,
    armor: 52,
    magic: 82,
    meleeRange: 2.25,
    rangedSpeed: 19,
    accentHex: '#f472b6',
    desc: 'Fastest hero in the realm—hurls explosive trick bombs and finds extra treasure.',
  },
  {
    id: 'dwarf',
    name: 'Dwarf',
    titlePrefix: 'Ironbreaker',
    weaponName: 'Runed Warhammer',
    turboName: 'Seismic Tremor',
    strength: 92,
    speed: 62,
    armor: 90,
    magic: 46,
    meleeRange: 2.45,
    rangedSpeed: 15.5,
    accentHex: '#d97706',
    desc: 'Ironclad bruiser whose hammer slams crush Stone Golems and shatter Steel Generators.',
  },
  {
    id: 'sorceress',
    name: 'Sorceress',
    titlePrefix: 'Enchantress',
    weaponName: 'Twin Astral Orbs',
    turboName: 'Tempest Surge',
    strength: 52,
    speed: 78,
    armor: 56,
    magic: 92,
    meleeRange: 2.2,
    rangedSpeed: 21,
    accentHex: '#c084fc',
    desc: 'Swift spellcaster channeling twin orbiting elemental orbs with high magic speed.',
  },
  {
    id: 'minotaur',
    name: 'Minotaur',
    titlePrefix: 'Warlord',
    weaponName: 'Twin-Blade Greataxe',
    turboName: 'Berserk Charge',
    strength: 96,
    speed: 66,
    armor: 84,
    magic: 44,
    meleeRange: 2.9,
    rangedSpeed: 16,
    accentHex: '#f97316',
    desc: 'Colossal horned juggernaut with unmatched melee strength and sweeping greataxe arcs.',
  },
  // Secret Unlockable Console/Arcade Heroes
  {
    id: 'sumner',
    name: 'Sumner',
    titlePrefix: 'Grand Sage',
    weaponName: 'Staff of the Tower',
    turboName: 'Runestone Ray',
    secret: true,
    unlockRunestones: 3,
    secretCode: 'SUMNER',
    strength: 72,
    speed: 78,
    armor: 74,
    magic: 100,
    meleeRange: 2.5,
    rangedSpeed: 22,
    accentHex: '#fbbf24',
    desc: 'Secret Hero! The ancient wizard of the Tower wielding supreme runic lightning.',
  },
  {
    id: 'medusa',
    name: 'Medusa',
    titlePrefix: 'Gorgon Queen',
    weaponName: 'Serpent Bow',
    turboName: 'Petrifying Gaze',
    secret: true,
    unlockRunestones: 5,
    secretCode: 'MEDUSA',
    strength: 70,
    speed: 88,
    armor: 68,
    magic: 90,
    meleeRange: 2.4,
    rangedSpeed: 23,
    accentHex: '#4ade80',
    desc: 'Secret Hero! Hurls venomous serpent bolts and turns hordes to stone with Turbo.',
  },
  {
    id: 'jackal',
    name: 'Jackal',
    titlePrefix: 'Anubis Guard',
    weaponName: 'Solar Twin Blades',
    turboName: 'Sandstorm Fang',
    secret: true,
    unlockRunestones: 7,
    secretCode: 'JACKAL',
    strength: 86,
    speed: 92,
    armor: 76,
    magic: 76,
    meleeRange: 2.75,
    rangedSpeed: 21,
    accentHex: '#facc15',
    desc: 'Secret Hero! Swift golden desert guardian combining razor speed with fierce blades.',
  },
  {
    id: 'ogre',
    name: 'Ogre',
    titlePrefix: 'Titan',
    weaponName: 'Spiked Greatclub',
    turboName: 'Earthshaker',
    secret: true,
    unlockRunestones: 9,
    secretCode: 'OGRE',
    strength: 100,
    speed: 68,
    armor: 95,
    magic: 55,
    meleeRange: 3.1,
    rangedSpeed: 17,
    accentHex: '#a3e635',
    desc: 'Secret Hero! Towering colossus with maximum strength and bone-shattering club slams.',
  },
];

export const HERO_MAP: Record<HeroClassId, HeroClassDef> = Object.fromEntries(
  HERO_CLASSES.map((h) => [h.id, h])
) as Record<HeroClassId, HeroClassDef>;

export const REALM_LIST: RealmDef[] = [
  {
    id: 'mountain',
    name: 'Mountain Kingdom',
    shortName: 'Mountain',
    order: 1,
    bossName: 'Plague Fiend',
    bossType: 'plague_fiend',
    runestoneCount: 2,
    requiredRunestones: 0,
    legendaryWeapon: {
      id: 'javelin_blinding',
      name: 'Javelin of Blinding',
      realmId: 'mountain',
      targetBossName: 'Plague Fiend',
      colorHex: '#fde047',
      effectText: 'Blinds the Plague Fiend, disrupting poison bursts & dealing 2.5x damage!',
    },
    fogHex: '#251a18',
    ambientHex: '#6b4a3a',
    floorHex: '#4f4038',
    floorAccentHex: '#635147',
    wallHex: '#5c493e',
    wallAccentHex: '#8a6d56',
    hazardType: 'lava',
    hazardHex: '#f97316',
    portalHex: '#f59e0b',
    enemyMix: ['grunt', 'imp', 'golem', 'general'],
    subtitle: 'Volcanic Crags · Poison Caverns · Boss: Plague Fiend',
  },
  {
    id: 'castle',
    name: 'Castle Stronghold',
    shortName: 'Castle',
    order: 2,
    bossName: 'Crimson Dragon',
    bossType: 'dragon',
    runestoneCount: 2,
    requiredRunestones: 0,
    legendaryWeapon: {
      id: 'ice_axe',
      name: 'Ice Axe',
      realmId: 'castle',
      targetBossName: 'Crimson Dragon',
      colorHex: '#38bdf8',
      effectText: 'Freezes the Dragon’s fiery breath & shatters molten scales for 2.5x damage!',
    },
    fogHex: '#181826',
    ambientHex: '#53587a',
    floorHex: '#3f4454',
    floorAccentHex: '#7f1d1d',
    wallHex: '#4c5266',
    wallAccentHex: '#737c96',
    hazardType: 'lava',
    hazardHex: '#ef4444',
    portalHex: '#ef4444',
    enemyMix: ['grunt', 'gargoyle', 'skeleton', 'general'],
    subtitle: 'Iron Ramparts · Royal Armory · Boss: Crimson Dragon',
  },
  {
    id: 'province',
    name: 'Forsaken Province',
    shortName: 'Province',
    order: 3,
    bossName: 'Lich Lord',
    bossType: 'lich',
    runestoneCount: 2,
    requiredRunestones: 0,
    legendaryWeapon: {
      id: 'book_protection',
      name: 'Book of Protection',
      realmId: 'province',
      targetBossName: 'Lich Lord',
      colorHex: '#a78bfa',
      effectText: 'Wards off necrotic skulls & burns the Lich’s dark aura for 2.5x damage!',
    },
    fogHex: '#101d24',
    ambientHex: '#365c69',
    floorHex: '#2c3d45',
    floorAccentHex: '#3a5059',
    wallHex: '#32444d',
    wallAccentHex: '#4e6975',
    hazardType: 'acid',
    hazardHex: '#22c55e',
    portalHex: '#14b8a6',
    enemyMix: ['skeleton', 'gargoyle', 'imp', 'general'],
    subtitle: 'Haunted Crypts · Cursed Catacombs · Boss: Lich Lord',
  },
  {
    id: 'forest',
    name: 'Forest Realm',
    shortName: 'Forest',
    order: 4,
    bossName: 'Chimera',
    bossType: 'chimera',
    runestoneCount: 2,
    requiredRunestones: 0,
    legendaryWeapon: {
      id: 'scimitar_decapitation',
      name: 'Scimitar of Decapitation',
      realmId: 'forest',
      targetBossName: 'Chimera',
      colorHex: '#34d399',
      effectText: 'Cleaves the Chimera’s fierce heads & cripples its lunge for 2.5x damage!',
    },
    fogHex: '#12241a',
    ambientHex: '#3a6b48',
    floorHex: '#334d39',
    floorAccentHex: '#4b6b49',
    wallHex: '#3d5239',
    wallAccentHex: '#637a52',
    hazardType: 'acid',
    hazardHex: '#84cc16',
    portalHex: '#22c55e',
    enemyMix: ['grunt', 'golem', 'imp', 'general'],
    subtitle: 'Ancient Druid Ruins · Canopy Shrine · Boss: Chimera',
  },
  {
    id: 'desert',
    name: 'Desert Lands',
    shortName: 'Desert',
    order: 5,
    bossName: 'Spider Queen',
    bossType: 'spider_queen',
    runestoneCount: 1,
    requiredRunestones: 2,
    legendaryWeapon: {
      id: 'toxic_bellows',
      name: 'Toxic Bellows',
      realmId: 'desert',
      targetBossName: 'Spider Queen',
      colorHex: '#a3e635',
      effectText: 'Dissolves silk webs & suffocates the Spider Queen for 2.5x damage!',
    },
    fogHex: '#2b2012',
    ambientHex: '#8f6c3e',
    floorHex: '#7d623b',
    floorAccentHex: '#9c7c49',
    wallHex: '#8f6e40',
    wallAccentHex: '#b89458',
    hazardType: 'acid',
    hazardHex: '#65a30d',
    portalHex: '#eab308',
    enemyMix: ['skeleton', 'golem', 'imp', 'general'],
    subtitle: 'Sunken Pyramids · Silk Vaults · Boss: Spider Queen',
  },
  {
    id: 'ice',
    name: 'Ice Domain',
    shortName: 'Ice Domain',
    order: 6,
    bossName: 'Frost Yeti',
    bossType: 'yeti',
    runestoneCount: 1,
    requiredRunestones: 3,
    legendaryWeapon: {
      id: 'parchment_fire',
      name: 'Parchment of Fire',
      realmId: 'ice',
      targetBossName: 'Frost Yeti',
      colorHex: '#fb923c',
      effectText: 'Melts glacial armor & sears the Frost Yeti for 2.5x damage!',
    },
    fogHex: '#132233',
    ambientHex: '#5280a8',
    floorHex: '#466c8c',
    floorAccentHex: '#6799bf',
    wallHex: '#567fa3',
    wallAccentHex: '#89bce3',
    hazardType: 'ice_chasm',
    hazardHex: '#0ea5e9',
    portalHex: '#38bdf8',
    enemyMix: ['golem', 'gargoyle', 'grunt', 'general'],
    subtitle: 'Crystal Glaciers · Frozen Fjord · Boss: Frost Yeti',
  },
  {
    id: 'sky',
    name: 'Sky Dominion',
    shortName: 'Sky',
    order: 7,
    bossName: 'Storm Genie',
    bossType: 'genie',
    runestoneCount: 1,
    requiredRunestones: 4,
    legendaryWeapon: {
      id: 'lamp_obstruction',
      name: 'Lamp of Dark Obstruction',
      realmId: 'sky',
      targetBossName: 'Storm Genie',
      colorHex: '#60a5fa',
      effectText: 'Binds the Genie’s tempest magic & strips immunity for 2.5x damage!',
    },
    fogHex: '#1d2742',
    ambientHex: '#6d7fb5',
    floorHex: '#667191',
    floorAccentHex: '#9ca8cc',
    wallHex: '#7d88a8',
    wallAccentHex: '#cbd5f5',
    hazardType: 'void',
    hazardHex: '#6366f1',
    portalHex: '#60a5fa',
    enemyMix: ['gargoyle', 'imp', 'golem', 'general'],
    subtitle: 'Alabaster Cloud Citadels · Boss: Storm Genie',
  },
  {
    id: 'dream',
    name: 'Dream World',
    shortName: 'Dream',
    order: 8,
    bossName: 'Shadow Wraith',
    bossType: 'shadow_wraith',
    runestoneCount: 1,
    requiredRunestones: 5,
    legendaryWeapon: {
      id: 'lantern_revelation',
      name: 'Lantern of Revelation',
      realmId: 'dream',
      targetBossName: 'Shadow Wraith',
      colorHex: '#f472b6',
      effectText: 'Exposes the Wraith’s phantom cloak & sears illusions for 2.5x damage!',
    },
    fogHex: '#241333',
    ambientHex: '#76439e',
    floorHex: '#4f2c6b',
    floorAccentHex: '#783c99',
    wallHex: '#5e357d',
    wallAccentHex: '#9d59c9',
    hazardType: 'void',
    hazardHex: '#c026d3',
    portalHex: '#e879f9',
    enemyMix: ['skeleton', 'gargoyle', 'imp', 'general'],
    subtitle: 'Twilight Labyrinth · Nightmare Spire · Boss: Shadow Wraith',
  },
  {
    id: 'underworld',
    name: 'Desecrated Temple',
    shortName: 'Underworld',
    order: 9,
    bossName: 'Skorne',
    bossType: 'skorne',
    runestoneCount: 1,
    requiredRunestones: 6,
    legendaryWeapon: {
      id: 'soul_savior',
      name: 'Soul Savior',
      realmId: 'underworld',
      targetBossName: 'Skorne',
      colorHex: '#fbbf24',
      effectText: 'Shatters Skorne & True Skorne’s demonic barrier for 2.5x radiant damage!',
    },
    fogHex: '#260c0e',
    ambientHex: '#7d2828',
    floorHex: '#3b1e20',
    floorAccentHex: '#592323',
    wallHex: '#472124',
    wallAccentHex: '#8a3529',
    hazardType: 'lava',
    hazardHex: '#ff4500',
    portalHex: '#dc2626',
    enemyMix: ['golem', 'gargoyle', 'imp', 'general'],
    subtitle: 'Final Underworld Sanctum · 2-Phase Final Boss: Skorne → True Skorne',
  },
];

export const REALM_MAP: Record<RealmId, RealmDef> = Object.fromEntries(
  REALM_LIST.map((r) => [r.id, r])
) as Record<RealmId, RealmDef>;

export const RELIC_DEFS: Record<RelicId, RelicDef> = {
  anti_death: {
    id: 'anti_death',
    name: 'Anti-Death Halo',
    shortName: 'Anti-Death',
    duration: 28,
    cost: 450,
    colorHex: '#fde047',
    desc: 'Golden halo that banishes Red Death on contact for huge XP & Gold!',
  },
  phoenix: {
    id: 'phoenix',
    name: 'Phoenix Familiar',
    shortName: 'Phoenix',
    duration: 30,
    cost: 500,
    colorHex: '#fb923c',
    desc: 'Summons an orbiting 3D firebird that fires homing fireballs at foes.',
  },
  three_way: {
    id: 'three_way',
    name: '3-Way Shot',
    shortName: '3-Way',
    duration: 26,
    cost: 350,
    colorHex: '#38bdf8',
    desc: 'Splits ranged attacks into a sweeping 3-projectile spread.',
  },
  rapid_fire: {
    id: 'rapid_fire',
    name: 'Rapid Fire',
    shortName: 'Rapid',
    duration: 24,
    cost: 320,
    colorHex: '#f43f5e',
    desc: 'Doubles melee combo and ranged firing cadence.',
  },
  super_shot: {
    id: 'super_shot',
    name: 'Super Shot',
    shortName: 'Super Shot',
    duration: 22,
    cost: 420,
    colorHex: '#c084fc',
    desc: 'Supercharged piercing bolts that cleave straight through monster lines.',
  },
  reflect_shield: {
    id: 'reflect_shield',
    name: 'Reflect Shield',
    shortName: 'Shield',
    duration: 18,
    cost: 480,
    colorHex: '#60a5fa',
    desc: 'Radiant dome granting invulnerability & reflecting enemy projectiles.',
  },
  growth: {
    id: 'growth',
    name: 'Growth Potion',
    shortName: 'Giant',
    duration: 22,
    cost: 460,
    colorHex: '#4ade80',
    desc: 'Doubles Hero size & +65% Strength—tramples lesser monsters underfoot!',
  },
  coin_magnet: {
    id: 'coin_magnet',
    name: 'Coin Magnet',
    shortName: 'Magnet',
    duration: 35,
    cost: 260,
    colorHex: '#facc15',
    desc: 'Draws nearby Gold Coins, Food, Keys, & Gems directly to your Hero.',
  },
  levitation: {
    id: 'levitation',
    name: 'Levitation Boots',
    shortName: 'Levitate',
    duration: 28,
    cost: 300,
    colorHex: '#2dd4bf',
    desc: 'Float cleanly over Lava, Acid Pools, and Chasms with zero damage!',
  },
  xray_glasses: {
    id: 'xray_glasses',
    name: 'X-Ray Glasses',
    shortName: 'X-Ray',
    duration: 35,
    cost: 280,
    colorHex: '#e879f9',
    desc: 'Reveals hidden Cracked Secret Walls & exposes disguised Poison Food.',
  },
};

export const RELIC_LIST: RelicDef[] = Object.values(RELIC_DEFS);

export function getLegendRankTitle(level: number, heroName: string): string {
  if (level >= 25) return `Immortal ${heroName}`;
  if (level >= 18) return `Dark Legend ${heroName}`;
  if (level >= 12) return `Grand Champion ${heroName}`;
  if (level >= 8) return `Champion ${heroName}`;
  if (level >= 5) return `Veteran ${heroName}`;
  if (level >= 3) return `Adventurer ${heroName}`;
  return heroName;
}

// Tile codes for procedural 3D dungeon layouts
// 0 = Floor, 1 = Solid Wall, 2 = Pillar, 3 = Hazard (Lava/Acid/Void), 4 = Locked Gate, 5 = Cracked Secret Wall, 6 = Bridge/Switch Floor
export type TileCode = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface SpawnPoint {
  x: number;
  z: number;
  kind:
    | 'generator_wood'
    | 'generator_stone'
    | 'generator_steel'
    | 'chest'
    | 'barrel'
    | 'food_turkey'
    | 'food_ham'
    | 'food_apple'
    | 'poison_cider'
    | 'key'
    | 'potion'
    | 'gold_pile'
    | 'runestone'
    | 'legendary_weapon'
    | 'relic'
    | 'switch'
    | 'brazier'
    | 'boss_portal'
    | 'return_portal'
    | 'death_spawn';
  relicId?: RelicId;
  runestoneIndex?: number;
}

export interface DungeonLayout {
  width: number;
  height: number;
  tileSize: number;
  tiles: TileCode[][];
  playerStart: { x: number; z: number };
  spawns: SpawnPoint[];
  isBossArena: boolean;
  isHub: boolean;
}

// Deterministic hash PRNG so each realm has a distinctive, memorable handcrafted-feeling layout
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateRealmDungeon(realmId: RealmId, isBossArena: boolean): DungeonLayout {
  const tileSize = 2.6;

  // 1. SUMNER'S TOWER 3D CENTRAL HUB (Circular Grand Sanctum)
  if (realmId === 'hub') {
    const W = 21;
    const H = 21;
    const cx = 10;
    const cz = 10;
    const tiles: TileCode[][] = Array.from({ length: H }, () => Array<TileCode>(W).fill(1));
    for (let z = 0; z < H; z++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - cx, z - cz);
        if (d <= 8.6) tiles[z][x] = 0;
      }
    }
    // Decorative ring pillars around Sumner's Tower
    const pillarAngles = 8;
    for (let i = 0; i < pillarAngles; i++) {
      const a = (i / pillarAngles) * Math.PI * 2 + Math.PI / 8;
      const px = Math.round(cx + Math.cos(a) * 5.2);
      const pz = Math.round(cz + Math.sin(a) * 5.2);
      if (tiles[pz]?.[px] === 0) tiles[pz][px] = 2;
    }
    const spawns: SpawnPoint[] = [
      { x: cx - 3, z: cz - 3, kind: 'brazier' },
      { x: cx + 3, z: cz - 3, kind: 'brazier' },
      { x: cx - 3, z: cz + 3, kind: 'brazier' },
      { x: cx + 3, z: cz + 3, kind: 'brazier' },
    ];
    return {
      width: W,
      height: H,
      tileSize,
      tiles,
      playerStart: { x: cx, z: cz + 3.2 },
      spawns,
      isBossArena: false,
      isHub: true,
    };
  }

  // 2. TOWERING 3D BOSS SANCTUM ARENA
  if (isBossArena) {
    const W = 19;
    const H = 19;
    const cx = 9;
    const cz = 9;
    const tiles: TileCode[][] = Array.from({ length: H }, () => Array<TileCode>(W).fill(1));
    for (let z = 1; z < H - 1; z++) {
      for (let x = 1; x < W - 1; x++) {
        const d = Math.hypot(x - cx, z - cz);
        if (d <= 7.8) tiles[z][x] = 0;
      }
    }
    // 4 Tactical cover pillars & corner braziers + explosive barrels & food caches
    const pillars = [
      [cx - 4, cz - 4],
      [cx + 4, cz - 4],
      [cx - 4, cz + 4],
      [cx + 4, cz + 4],
    ];
    for (const [px, pz] of pillars) {
      tiles[pz][px] = 2;
    }
    const spawns: SpawnPoint[] = [
      { x: cx - 5.5, z: cz, kind: 'food_turkey' },
      { x: cx + 5.5, z: cz, kind: 'potion' },
      { x: cx - 3, z: cz - 2, kind: 'barrel' },
      { x: cx + 3, z: cz - 2, kind: 'barrel' },
      { x: cx - 3, z: cz + 2, kind: 'barrel' },
      { x: cx + 3, z: cz + 2, kind: 'barrel' },
      { x: cx - 5, z: cz - 5, kind: 'brazier' },
      { x: cx + 5, z: cz - 5, kind: 'brazier' },
      { x: cx - 5, z: cz + 5, kind: 'brazier' },
      { x: cx + 5, z: cz + 5, kind: 'brazier' },
    ];
    return {
      width: W,
      height: H,
      tileSize,
      tiles,
      playerStart: { x: cx, z: cz + 5.4 },
      spawns,
      isBossArena: true,
      isHub: false,
    };
  }

  // 3. MULTI-WING AUTHENTIC 3D REALM DUNGEON (27 x 27 grid -> ~70m x 70m world!)
  const realm = REALM_MAP[realmId];
  const rand = mulberry32(realm.order * 9187 + 1337);
  const W = 27;
  const H = 27;
  const tiles: TileCode[][] = Array.from({ length: H }, () => Array<TileCode>(W).fill(1));

  const carve = (x0: number, z0: number, w: number, h: number, code: TileCode = 0) => {
    for (let z = z0; z < z0 + h; z++) {
      for (let x = x0; x < x0 + w; x++) {
        if (x > 0 && x < W - 1 && z > 0 && z < H - 1) {
          tiles[z][x] = code;
        }
      }
    }
  };

  // South Entry Hall
  carve(10, 20, 7, 5, 0);
  // Wide Main Central Courtyard
  carve(8, 10, 11, 8, 0);
  // Corridor South -> Center
  carve(12, 17, 3, 4, 0);
  // West Wing (Treasure & Secret Runestone Vault)
  carve(2, 9, 5, 9, 0);
  carve(6, 12, 3, 3, 0);
  // West Secret Alcove hidden behind Cracked Secret Wall
  carve(1, 2, 5, 5, 0);
  carve(3, 6, 2, 4, 0);
  tiles[8][3] = 5;
  tiles[8][4] = 5;

  // East Wing (Locked Gate -> Legendary Boss-Weakening Weapon Shrine!)
  carve(20, 9, 5, 9, 0);
  carve(18, 12, 3, 3, 0);
  // Bronze/Gold Locked Gate guarding the Legendary Weapon Shrine
  tiles[12][19] = 4;
  tiles[13][19] = 4;
  tiles[14][19] = 4;

  // East North Runestone Gallery (connected via Hazard Chasm with Switch Bridge!)
  carve(20, 2, 5, 6, 0);
  carve(21, 7, 3, 3, 3); // Lava/Acid/Void chasm!
  // Switch opens bridge on tile (22, 7..9) OR Levitation Boots floats straight across!

  // North Boss Gate Hall
  carve(9, 2, 9, 6, 0);
  carve(12, 7, 3, 4, 0);

  // Decorative architectural pillars in Central Courtyard & North Hall
  tiles[11][10] = 2;
  tiles[11][16] = 2;
  tiles[16][10] = 2;
  tiles[16][16] = 2;
  tiles[4][10] = 2;
  tiles[4][16] = 2;

  // Small thematic hazard pools on courtyard flanks
  tiles[13][9] = 3;
  tiles[14][9] = 3;
  tiles[13][17] = 3;
  tiles[14][17] = 3;

  const relicPool: RelicId[] = [
    'phoenix',
    'three_way',
    'rapid_fire',
    'super_shot',
    'anti_death',
    'reflect_shield',
    'growth',
    'coin_magnet',
    'levitation',
    'xray_glasses',
  ];
  const pickRelic = (idx: number): RelicId => relicPool[(realm.order * 2 + idx) % relicPool.length];

  const spawns: SpawnPoint[] = [
    // Return to Sumner's Tower portal near entrance
    { x: 13, z: 23.8, kind: 'return_portal' },
    // Entrance braziers & starter key + food
    { x: 10.6, z: 21.2, kind: 'brazier' },
    { x: 15.4, z: 21.2, kind: 'brazier' },
    { x: 11.2, z: 22.5, kind: 'key' },
    { x: 15.2, z: 22.5, kind: 'food_apple' },

    // Central Courtyard — 3-tier Generators, Explosive Powder Kegs, Gold, Potions
    { x: 11, z: 14.5, kind: 'generator_wood' },
    { x: 15, z: 14.5, kind: 'generator_stone' },
    { x: 13, z: 11.2, kind: 'generator_steel' },
    { x: 12.2, z: 14.4, kind: 'barrel' },
    { x: 14.4, z: 12.2, kind: 'barrel' },
    { x: 13, z: 15.8, kind: 'gold_pile' },
    { x: 10, z: 12, kind: 'potion' },
    { x: 16, z: 15, kind: 'poison_cider' }, // Classic Gauntlet trap: shoot from afar!
    { x: 10.5, z: 16.2, kind: 'food_ham' },
    { x: 16.2, z: 12.2, kind: 'key' },

    // West Wing — Generators, Chest, Switch for East Bridge, Relic
    { x: 4, z: 15, kind: 'generator_stone' },
    { x: 3.5, z: 11, kind: 'chest' },
    { x: 5.2, z: 15.2, kind: 'barrel' },
    { x: 3.2, z: 13.5, kind: 'switch' }, // Lowers bridge across East Hazard Chasm!
    { x: 5.2, z: 10.8, kind: 'relic', relicId: pickRelic(0) },
    { x: 2.8, z: 16.2, kind: 'food_turkey' },

    // Secret North-West Vault (behind Cracked Secret Wall!) -> Runestone #1 + Gold + Chest
    { x: 3.2, z: 4, kind: 'runestone', runestoneIndex: 0 },
    { x: 2.2, z: 3, kind: 'chest' },
    { x: 4.5, z: 3.2, kind: 'gold_pile' },
    { x: 4.5, z: 5.2, kind: 'relic', relicId: 'xray_glasses' },

    // East Wing (behind Locked Gate!) -> Authentic Legendary Boss-Weakening Weapon!
    { x: 22.5, z: 13.5, kind: 'legendary_weapon' },
    { x: 21.2, z: 15.5, kind: 'generator_stone' },
    { x: 23.6, z: 15.5, kind: 'chest' },
    { x: 21.2, z: 11.2, kind: 'brazier' },
    { x: 23.8, z: 11.2, kind: 'brazier' },
    { x: 22.5, z: 16.4, kind: 'potion' },

    // North-East Gallery (across Chasm/Bridge) -> Runestone #2 (if realm has 2) or Rare Relic + Chest!
    {
      x: 22.5,
      z: 4.5,
      kind: realm.runestoneCount >= 2 ? 'runestone' : 'relic',
      runestoneIndex: 1,
      relicId: 'anti_death',
    },
    { x: 21.2, z: 3.5, kind: 'chest' },
    { x: 23.8, z: 3.5, kind: 'gold_pile' },

    // North Boss Gate Hall — Steel Generator, Red Death ambush, Food, Boss Sanctum Portal!
    { x: 11.2, z: 5.5, kind: 'generator_steel' },
    { x: 14.8, z: 5.5, kind: 'generator_steel' },
    { x: 12.2, z: 5.5, kind: 'barrel' },
    { x: 13, z: 6.4, kind: 'death_spawn' },
    { x: 10.2, z: 3.2, kind: 'food_turkey' },
    { x: 15.8, z: 3.2, kind: 'relic', relicId: pickRelic(1) },
    { x: 10.6, z: 2.8, kind: 'brazier' },
    { x: 15.4, z: 2.8, kind: 'brazier' },
    { x: 13, z: 3.1, kind: 'boss_portal' },
  ];

  // Add 2 extra randomized gold piles or apples per realm for rich looting
  if (rand() > 0.3) {
    spawns.push({ x: 11.2, z: 10.8, kind: 'gold_pile' });
    spawns.push({ x: 15.2, z: 16.4, kind: 'food_apple' });
  }

  return {
    width: W,
    height: H,
    tileSize,
    tiles,
    playerStart: { x: 13, z: 22.2 },
    spawns,
    isBossArena: false,
    isHub: false,
  };
}
