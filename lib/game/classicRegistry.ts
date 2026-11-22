import { ClassicArcadeGameId } from './arcadeTypes';
import { BerzerkGame } from './berzerkGame';
import { BoulderDashGame } from './boulderdashGame';
import { BreakerArcadeGame } from './breakerGame';
import { Breakout2016EvoGame } from './breakout2016EvoGame';
import { CentipedeGame } from './centipedeGame';
import { MrDoArcadeGame, MrDosCastleGame } from './mrDoGame';
import { DragonsLairArcadeGame } from './classicActionPack2';
import { CrystalCastlesGame } from './crystalCastlesGame';
import { JoustGame } from './joustGame';
import { PuzzleBobbleGame } from './puzzleBobbleGame';
import { ArcadeGameInstance } from './classicArcadeInterface';
import { DefenderGame } from './defenderGame';
import { DigDugGame } from './digdugGame';
import { DonkeyKongGame } from './donkeyKongGame';
import { FoodFightGame } from './foodfightGame';
import { FroggerArcadeGame } from './froggerGame';
import { GalaxianShooterGame } from './galaxianShooterGame';
import { GauntletDarkLegacyGame } from './gauntletDarkLegacyGame';
import { GauntletGame } from './gauntletGame';
import { SpaceInvaders2Game } from './invaders2Game';
import { SpaceInvadersDxGame } from './invadersDxGame';
import { SpaceInvadersGame } from './invadersGame';
import { MappyGame } from './mappyGame';
import { MarioBrosGame } from './marioBrosGame';
import { MarioWorldGame } from './marioWorldGame';
import { MillipedeGame } from './millipedeGame';
import { MissileCommandGame } from './missileQixGame';
import { MuleEvoArcadeGame } from './muleEvoGame';
import { MuleArcadeGame } from './muleGame';
import { PengoArcadeGame } from './pengoGame';
import { PolePositionGame } from './polePositionGame';
import { PopeyeArcadeGame } from './popeyeGame';
import { QixArcadeGame } from './qixArcadeGame';
import { RampageArcadeGame } from './rampageGame';
import { RobotronEvoGame } from './robotronEvoGame';
import { RobotronArcadeGame } from './robotronGame';
import { ScrambleArcadeGame } from './scrambleGame';
import { ScrollingShooterGame } from './scrollingShooterGame';
import { SonicGame } from './sonicGame';
import { SprintGame } from './sprintGame';
import { SpyHunter2ArcadeGame } from './spyHunter2Game';
import { SpyHunterArcadeGame } from './spyHunterGame';
import { StarWars1983Game } from './starWars1983Game';
import { StarWarsEsbGame } from './starWarsEsbGame';
import { StarWarsRotjGame } from './starWarsRotjGame';
import { SuperMarioGame } from './superMarioGame';
import { TapperArcadeGame } from './tapperGame';
import { Tempest1981Game } from './tempest1981Game';
import { Tempest2000Game } from './tempest2000Game';
import { Tempest3000Game } from './tempest3000Game';
import { TimePilotArcadeGame } from './timePilotGame';
import { VectorSpaceGame } from './vectorSpaceGame';
import { Ww1942Game } from './ww1942Game';
import { Ww1943Game } from './ww1943Game';
import { YsBookRpgGame } from './ysBookRpgGame';

export interface ClassicCabinetSpec {
  id: ClassicArcadeGameId;
  title: string;
  year: number;
  publisher: string;
  accentTextClass: string;
  accentButtonClass: string;
  borderHoverClass: string;
  subtitle: string;
  controls: Array<{ key: string; desc: string }>;
  tips: string[];
}

export const CLASSIC_CABINET_SPECS: Record<ClassicArcadeGameId, ClassicCabinetSpec> = {
  centipede: {
    id: 'centipede',
    title: 'Centipede',
    year: 1981,
    publisher: 'Atari',
    accentTextClass: 'text-lime-400',
    accentButtonClass: 'bg-lime-400 hover:bg-lime-300 text-slate-950 focus-visible:ring-lime-200',
    borderHoverClass: 'hover:border-lime-400/50',
    subtitle: '1981 · Neon Mushroom Garden · Precision Aim · Spiders, Fleas & Poisoning Scorpions',
    controls: [
      { key: 'Arrows / WASD / Mouse / Tilt', desc: 'Precision-damped movement (cycle 55%/78%/100% Speed)' },
      { key: 'Space / Click', desc: 'Rapid-fire plasma darts along laser sightline' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Use the top-bar Speed (55% Fine / 78% Smooth) or Tilt button for authentic Atari trackball accuracy.',
      'Poisoned magenta mushrooms trigger vertical dives—blast Scorpions early (+1,000) and clear poison caps fast.',
      'Intercept bouncing Spiders at close range for 900 CLOSE! bonus popups.',
    ],
  },
  millipede: {
    id: 'millipede',
    title: 'Millipede',
    year: 1982,
    publisher: 'Atari',
    accentTextClass: 'text-orange-400',
    accentButtonClass: 'bg-orange-500 hover:bg-orange-400 text-slate-950 focus-visible:ring-orange-200',
    borderHoverClass: 'hover:border-orange-400/50',
    subtitle: '1982 · Sunset Swarm Overdrive · 3× DDT Chains · Inchworm Slow-Mo & Dragonflies',
    controls: [
      { key: 'Arrows / WASD / Mouse / Tilt', desc: 'Precision-tuned blaster control (55%/78%/100% Speed)' },
      { key: 'Space / Click', desc: 'Fire cyan energy bolts & detonate DDT canisters' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Detonate red DDT canisters as millipedes or swarms pass for 3× chain-reaction blasts and screen shake!',
      'Shoot green Inchworms for 4.5s Icy Slow-Mo, and intercept zig-zagging Dragonflies (500 pts) on Wave 2+.',
      'Watch out for Beetles turning mushrooms into diving flowers and Mosquitoes scrolling the whole garden down!',
    ],
  },
  digdug: {
    id: 'digdug',
    title: 'Dig Dug',
    year: 1982,
    publisher: 'Namco',
    accentTextClass: 'text-sky-400',
    accentButtonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    subtitle: '1982 · Modern 2.5D Diorama · Organic Tunnel Carving · 4 Worlds · Fossils & Veggies',
    controls: [
      { key: 'Arrows / WASD', desc: 'Smoothly carve subterranean burrows across 4 depth bands' },
      { key: 'Space / Z', desc: 'Fire coiled harpoon & tap rapidly to inflate Pooka / Fygar' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Tap Space 4 times while tethered to pop monsters—side-pumping Fygar awards 2× depth points!',
      'Watch Fygar’s glowing inhale charge before it breathes plasma fire, and lure monsters beneath wobbling rocks for 1,000–10,000 pt crushes.',
      'Drop two boulders in a round to spawn bonus Namco veggies & Galaxian treasures at center chamber!',
    ],
  },
  boulderdash: {
    id: 'boulderdash',
    title: 'Boulder Dash',
    year: 1984,
    publisher: 'First Star',
    accentTextClass: 'text-purple-400',
    accentButtonClass: 'bg-purple-500 hover:bg-purple-400 text-white focus-visible:ring-purple-300',
    borderHoverClass: 'hover:border-purple-400/50',
    subtitle: '1984 · Modern 2.5D Cavern Engine · 8 Biomes · Magic Walls · Amoeba & Smooth Physics',
    controls: [
      { key: 'Arrows / WASD', desc: 'Smoothly dig earth, push boulders & collect diamonds' },
      { key: 'Hold Space + Dir', desc: 'Swing Pickaxe to Snap-Dig adjacent dirt/gem without stepping' },
      { key: 'R', desc: 'Restart current cave if trapped' },
    ],
    tips: [
      'Drop boulders through shimmering Magic Walls to transmute rocks into cascading Diamonds!',
      'Enclose the bubbling Green Amoeba completely to crystallize the entire colony into Diamonds—or drop rocks on Butterflies for 3×3 gem bursts.',
      'Chain diamond pickups quickly for rising musical chime combos & unlock the glowing emerald Exit Portal!',
    ],
  },
  invaders: {
    id: 'invaders',
    title: 'Space Invaders',
    year: 1978,
    publisher: 'Taito',
    accentTextClass: 'text-green-400',
    accentButtonClass: 'bg-green-500 hover:bg-green-400 text-slate-950 focus-visible:ring-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    subtitle: '1978 · Lunar Cabinet HD · Authentic Ripple March · Molten Voxel Bunkers · 300pt UFO',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Slide laser cannon' },
      { key: 'Space / Up', desc: 'Fire plasma laser bolt' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Authentic 1978 shot-count table: nail the Red UFO on shot #23 (and every 15th shot after) for 300 pts!',
      'Watch the 3 distinct enemy bolts: Rolling tracks your cannon, Plunger cycles columns, and Squiggly pauses during UFOs.',
      'Carve thin sniper slits through the molten-rim bunkers and intercept incoming bolts mid-air.',
    ],
  },
  invaders2: {
    id: 'invaders2',
    title: 'Space Invaders II',
    year: 1979,
    publisher: 'Taito',
    accentTextClass: 'text-cyan-400',
    accentButtonClass: 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 focus-visible:ring-cyan-200',
    borderHoverClass: 'hover:border-cyan-400/50',
    subtitle: '1979 · Lunar Colony Deluxe · Fission Splitters · Dropship Pods · S.O.S. & Rainbow Bonus',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Slide deluxe plasma cannon' },
      { key: 'Space / Up', desc: 'Fire laser bolt' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Top-row crimson Command Invaders split with an electric fission arc into two weaving Mini-Invaders.',
      'Shoot down the Golden Dropship UFO (or intercept its descending Warp Pods!) before it reinforces top rows.',
      'Snipe the Magenta Cloak UFO during its shimmer cloak for a 500pt bonus, and leave an Octopus last for the Rainbow Arc!',
    ],
  },
  invadersdx: {
    id: 'invadersdx',
    title: 'Space Invaders DX',
    year: 1994,
    publisher: 'Taito',
    accentTextClass: 'text-amber-300',
    accentButtonClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950 focus-visible:ring-amber-200',
    borderHoverClass: 'hover:border-amber-400/50',
    subtitle: '1994 · Taito F2 16-Bit HD · 5 Parody Worlds · Power Capsules · DX Hyper Beam',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Pilot 16-bit themed starfighter' },
      { key: 'Space / Up', desc: 'Fire DX plasma / upgraded weapon' },
      { key: 'Shift / X', desc: 'Unleash DX Hyper Beam at 100% charge' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Cycle through 5 iconic Taito Parody Worlds: Space Invaders 94 DX, Arkanoid, Darius, Bubble Bobble, and Neo-Tokyo Citadel!',
      'Shoot glowing gold-ringed Power Carriers and Theme UFOs for Twin, 3-Way Spread, Piercing Rail, Shield Repair, and Hyper Capsules.',
      'Fill the bottom DX Hyper Gauge to 100% and hit Shift / X to vaporize whole columns with a volumetric Hyper Beam!',
    ],
  },
  foodfight: {
    id: 'foodfight',
    title: 'Food Fight',
    year: 1983,
    publisher: 'Atari',
    accentTextClass: 'text-rose-400',
    accentButtonClass: 'bg-rose-500 hover:bg-rose-400 text-white focus-visible:ring-rose-300',
    borderHoverClass: 'hover:border-rose-400/50',
    subtitle: '1983 · 2.5D Patio Bistro Engine · 4 Venues · 6 Tactical Foods · Recorded Instant Replay',
    controls: [
      { key: 'Arrows / WASD', desc: 'Sprint Charley Chuck across the 2.5D bistro patio' },
      { key: 'Space / Z / Click', desc: 'Grab & hurl food (with optional mouse aim)' },
      { key: 'Shift / X', desc: 'Dive-Roll Dodge through flying food & chefs' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Watermelons pierce through multiple chefs and smash incoming enemy throws mid-air!',
      'Cream Pies splatter wide areas, Peas fire a 3-shot burst, and Bananas curve around tables.',
      'Time Shift / X Dive-Rolls to evade Oscar, Angelo, Jacques, and Zorba before the giant cone melts.',
      'Clear a thrilling stage with 3+ chef splats or a photo-finish melt to trigger a sepia Instant Replay!',
    ],
  },

  // --- 14 Newly Added Classic Arcade Cabinets ---
  gauntlet: {
    id: 'gauntlet',
    title: 'Gauntlet',
    year: 1985,
    publisher: 'Atari Games',
    accentTextClass: 'text-amber-400',
    accentButtonClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950 focus-visible:ring-amber-200',
    borderHoverClass: 'hover:border-amber-400/50',
    subtitle: '1985 · Red Thor · Blue Thyra · Yellow Merlin · Green Questor · 8 Atari Dungeons',
    controls: [
      { key: 'Arrows / WASD / Click', desc: 'Pick Red/Blue/Yellow/Green Hero & move 8-way' },
      { key: 'Space / Z / Click', desc: 'Throw Axe / Sword / Fireball / Arrows' },
      { key: 'Shift / X', desc: 'Use Magic Potion (clears onscreen foes & Death)' },
      { key: 'R', desc: 'Open Hero Select to swap class' },
    ],
    tips: [
      'Choose Red Thor (Warrior), Blue Thyra (Valkyrie), Yellow Merlin (Wizard), or Green Questor (Elf) on the start screen!',
      'Watch out for Lobbers throwing boulders over walls, vanishing Sorcerers, loot-stealing Thieves, and invincible Death.',
      'Health drains constantly—eat roast meat & cider (never shoot food!), and shoot cracked walls to reveal secret vaults.',
    ],
  },
  gauntlet2: {
    id: 'gauntlet2',
    title: 'Gauntlet II',
    year: 1986,
    publisher: 'Atari Games',
    accentTextClass: 'text-red-400',
    accentButtonClass: 'bg-red-500 hover:bg-red-400 text-white focus-visible:ring-red-300',
    borderHoverClass: 'hover:border-red-400/50',
    subtitle: '1986 · Mix-and-Match 4 Colors × 4 Heroes · Dragons · “It” · Acid · Ricochet Shots',
    controls: [
      { key: 'Arrows / WASD / Click', desc: 'Choose Class + Red/Blue/Yellow/Green Color & move 8-way' },
      { key: 'Space / Z / Click', desc: 'Fire wall-ricocheting shots & destroy Poison Cider' },
      { key: 'Shift / X', desc: 'Unleash Magic Potion screen blast' },
      { key: 'R', desc: 'Return to Hero & Color Select' },
    ],
    tips: [
      'Pick any hero class in any cabinet color—play as Red Valkyrie, Green Wizard, Blue Warrior, or Yellow Elf!',
      'Bank ricochet shots around stone corners, dodge Acid Puddles & Stun Traps, and avoid the “It” tagger that makes monsters swarm.',
      'Blast Fire-Breathing Dragons, shoot Purple Poison Cider safely from afar, and hunt cracked secret walls & teleport pads.',
    ],
  },
  gauntletdl: {
    id: 'gauntletdl',
    title: 'Gauntlet: Dark Legacy',
    year: 2000,
    publisher: 'Midway Games',
    accentTextClass: 'text-amber-400',
    accentButtonClass: 'bg-amber-600 hover:bg-amber-500 text-white focus-visible:ring-amber-300',
    borderHoverClass: 'hover:border-amber-500/50',
    subtitle: '2000 · Authentic Midway Gothic 3D · Torchlit Stonework · Sumner’s Tower · 9 Bosses & 10 Relics',
    controls: [
      { key: 'WASD / Arrows / Thumbstick', desc: 'Explore Sumner’s Tower & 9 Realms in full 3D (V cycles camera)' },
      { key: 'Space / Z / Left-Click', desc: '3-Hit Melee Combo up close · Elemental Ranged Shot at distance' },
      { key: 'Shift / X / Right-Click', desc: 'Heavy 360° Fighting Attack · Ctrl/C to Block' },
      { key: 'T (Turbo) · Q (Potion) · 1–5', desc: 'Elemental Turbo Special · Screen-Clear Potion · Activate Console Relics' },
    ],
    tips: [
      'Explore torchlit stone sanctuaries across all 9 Realms to collect 13 Runestones & 9 Boss-Weakening Legendary Weapons!',
      'Find or buy 10 Console Inventory Relics at Sumner’s Armory: Anti-Death Halo, Phoenix Familiar, 3-Way Shot, Super Shot, Reflect Shield, Growth, Levitation & X-Ray Glasses.',
      'Enter secret console codes (SUMNER, MEDUSA, JACKAL, OGRE, LEGEND) at Sumner’s Hero Pedestal or unlock them by collecting Runestones!',
    ],
  },
  polepos: {
    id: 'polepos',
    title: 'Pole Position',
    year: 1982,
    publisher: 'Namco / Atari',
    accentTextClass: 'text-red-400',
    accentButtonClass: 'bg-red-500 hover:bg-red-400 text-white focus-visible:ring-red-300',
    borderHoverClass: 'hover:border-red-400/50',
    subtitle: '1982 · 3D Fuji Speedway · Qualifying & Grand Prix · LO/HI 2-Speed Gearbox',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Steer Formula-1 racer around curves' },
      { key: 'Up / Space', desc: 'Accelerate throttle' },
      { key: 'Down / S', desc: 'Brake before sharp hairpins' },
      { key: 'Shift / X', desc: 'Shift LO / HI gear' },
    ],
    tips: [
      'Accelerate in LO gear up to 170 km/h, then shift into HI gear for 330+ km/h.',
      'Ease off the throttle slightly or tap brake on sweeping corners so you do not clip signs.',
      'Pass rival F1 cars cleanly for overtaking bonuses and beat the lap timer for extensions.',
    ],
  },
  polepos2: {
    id: 'polepos2',
    title: 'Pole Position II',
    year: 1983,
    publisher: 'Namco / Atari',
    accentTextClass: 'text-sky-400',
    accentButtonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    subtitle: '1983 · 4 Grand Prix Circuits · Fuji, Test, Seaside & Suzuka',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Precision F1 steering' },
      { key: 'Up / Space', desc: 'Full throttle' },
      { key: 'Down / S', desc: 'Brake into tight chicanes' },
      { key: 'Shift / X', desc: 'Shift LO / HI gear' },
    ],
    tips: [
      'Complete laps across Seaside, Fuji, Test Oval, and technical Suzuka circuits.',
      'Watch the glowing corner arrows ahead to set up your apex early.',
      'Stay off the gravel verge to preserve top HI-gear momentum.',
    ],
  },
  sprint1: {
    id: 'sprint1',
    title: 'Sprint 1',
    year: 1978,
    publisher: 'Atari / Kee Games',
    accentTextClass: 'text-emerald-300',
    accentButtonClass: 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 focus-visible:ring-emerald-200',
    borderHoverClass: 'hover:border-emerald-300/50',
    subtitle: '1978 · HD 1280×960 · 8 Authentic Kee Games Circuits · 4-Speed Phosphor-Green Racer',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Steer & counter-steer drift coupe' },
      { key: 'Up / Space', desc: 'Throttle through 4-speed gearbox' },
      { key: 'Down / S', desc: 'Brake into hairpins' },
      { key: 'Shift / X', desc: 'Downshift Turbo Drift Surge' },
    ],
    tips: [
      'Master 8 authentic Kee Games circuits from Easy Oval & Figure-8 Cross to Pro Grand Prix & Super Serpent!',
      'Watch the live 4-Speed RPM Tachometer on the top bar and feather turns to keep cornering speed.',
      'Oil slicks trigger a realistic momentum slide-spin so you glide cleanly off the slick without getting stuck.',
    ],
  },
  sprint: {
    id: 'sprint',
    title: 'Sprint 2',
    year: 1976,
    publisher: 'Atari / Kee Games',
    accentTextClass: 'text-slate-200',
    accentButtonClass: 'bg-slate-200 hover:bg-white text-slate-950 focus-visible:ring-slate-300',
    borderHoverClass: 'hover:border-slate-300/50',
    subtitle: '1976 · HD 1280×960 · 8 Classic Kee Games Tracks · 4-Speed Gearbox & Skidmarks',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Rotate & power-slide stock racer' },
      { key: 'Up / Space', desc: 'Throttle accelerator (4-speed)' },
      { key: 'Down / S', desc: 'Brake / reverse' },
      { key: 'Shift / X', desc: 'Downshift Drift Boost' },
    ],
    tips: [
      'Paint twin rubber skidmarks across all 8 expanded Kee Games tracks from Track 1 Classic Oval to Track 8 Expert!',
      'Oil slicks cause a controlled momentum spinout so you slide cleanly past them.',
      'Beat the Black Car and Drone rivals across 3 laps to advance through all 8 circuits.',
    ],
  },
  sprint4: {
    id: 'sprint4',
    title: 'Sprint 4',
    year: 1977,
    publisher: 'Atari',
    accentTextClass: 'text-orange-400',
    accentButtonClass: 'bg-orange-400 hover:bg-orange-300 text-slate-950 focus-visible:ring-orange-200',
    borderHoverClass: 'hover:border-orange-400/50',
    subtitle: '1977 · HD 1280×960 · First Color Overhead Sprint · 6 Classic Circuits · 4-Speed',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Steer red/blue/yellow/green stock car' },
      { key: 'Up / Space', desc: 'Throttle accelerator (4-speed gearbox)' },
      { key: 'Down / S', desc: 'Brake before hairpins' },
      { key: 'Shift / X', desc: 'Downshift Drift Surge' },
    ],
    tips: [
      'Atari’s first full-color Sprint cabinet—battle 3 vivid color rivals across 6 classic pylon-lined tracks!',
      'Cross the Figure-8 Speedway bridge cleanly and manage your 4-speed gearbox through Cloverleaf hairpins.',
      'Avoid dark oil slicks on exit apexes to keep maximum straightaway exit speed.',
    ],
  },
  sprint8: {
    id: 'sprint8',
    title: 'Sprint 8',
    year: 1977,
    publisher: 'Atari',
    accentTextClass: 'text-sky-400',
    accentButtonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    subtitle: '1977 · HD 1280×960 · 8-Car Simultaneous Pack · 6 Super-Wide Arena Circuits',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Thread traffic in an 8-car pack' },
      { key: 'Up / Space', desc: 'Throttle through 4-speed gearbox' },
      { key: 'Down / S', desc: 'Brake to avoid pack pileups' },
      { key: 'Shift / X', desc: 'Overtake Drift Boost' },
    ],
    tips: [
      'Launch from a staggered 4×2 8-car grid against 7 simultaneous color rivals on extra-wide arena roads!',
      'Use outside sweeping lanes on Grand Bowl and Twin Crossings to pass traffic cleanly without bumping.',
      'Conquer all 6 colossal 8-player circuits from Wide Speedway to 8-Car Gauntlet.',
    ],
  },
  supersprint: {
    id: 'supersprint',
    title: 'Super Sprint',
    year: 1986,
    publisher: 'Atari Games',
    accentTextClass: 'text-yellow-400',
    accentButtonClass: 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 focus-visible:ring-yellow-200',
    borderHoverClass: 'hover:border-yellow-400/50',
    subtitle: '1986 · HD 1280×960 System 2 · All 8 Arcade Circuits · Bridges · Pit Tune-Up · Heli',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Steer Indy car (and select Pit Shop upgrades)' },
      { key: 'Up / Space', desc: 'Accelerate / Confirm Pit Upgrade' },
      { key: 'Down / S', desc: 'Brake' },
      { key: 'Shift / X', desc: 'Turbo Drift Boost' },
    ],
    tips: [
      'Race all 8 authentic Atari System 2 circuits—from Track 1 Classic Oval to Track 8 Double Bridge Maze!',
      'Collect Golden Wrenches to unlock the Pit Tune-Up Shop between races—upgrade Top Speed, Turbo Accel, or Super Traction!',
      'Dodge roaming Mini-Tornadoes, cross elevated Overpass Bridges, and watch the Rescue Helicopter drop you back after crashes.',
    ],
  },
  champsprint: {
    id: 'champsprint',
    title: 'Championship Sprint',
    year: 1986,
    publisher: 'Atari Games',
    accentTextClass: 'text-green-400',
    accentButtonClass: 'bg-green-400 hover:bg-green-300 text-slate-950 focus-visible:ring-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    subtitle: '1986 · HD 1280×960 Pro Edition · All 8 Circuits · Pneumatic Shortcut Gates & Water',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Steer pro Indy racer / Pick Pit Upgrades' },
      { key: 'Up / Space', desc: 'Accelerate / Confirm Pit Upgrade' },
      { key: 'Down / S', desc: 'Brake' },
      { key: 'Shift / X', desc: 'Turbo Drift Boost' },
    ],
    tips: [
      'Master all 8 expanded Championship circuits featuring timed Pneumatic Shortcut Gates with amber close warnings!',
      'Water puddles cause hydroplane drag & spray, while oil triggers a clean momentum slide-spin.',
      'Spend Golden Wrenches in the between-race Pit Tune-Up Shop to conquer Pro Circuit 8.',
    ],
  },
  badlands: {
    id: 'badlands',
    title: 'Badlands',
    year: 1989,
    publisher: 'Atari Games',
    accentTextClass: 'text-red-400',
    accentButtonClass: 'bg-red-500 hover:bg-red-400 text-white focus-visible:ring-red-300',
    borderHoverClass: 'hover:border-red-400/50',
    subtitle: '1989 · HD 1280×960 Wasteland Combat Racer · Roof Plasma Cannon · Mines & Armory',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Steer armored battle buggy / Pick Armory upgrades' },
      { key: 'Up / W', desc: 'Accelerate throttle' },
      { key: 'Down / S', desc: 'Brake' },
      { key: 'Space / Shift / X', desc: 'Fire Roof Plasma Cannon (Spin rivals & detonate mines!)' },
    ],
    tips: [
      'Atari’s post-apocalyptic Super Sprint evolution—blast rival buggies with your roof cannon to spin them out (+300)!',
      'Shoot blinking Land Mines from a distance to clear safe lanes across all 6 scorched wasteland circuits.',
      'Spend Golden Wrenches in the Wasteland Armory to upgrade Cannon Firepower (Twin Cannons!), Top Speed, and Traction!',
    ],
  },
  superoffroad: {
    id: 'superoffroad',
    title: 'Super Off Road',
    year: 1989,
    publisher: 'Leland Corp',
    accentTextClass: 'text-amber-400',
    accentButtonClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950 focus-visible:ring-amber-200',
    borderHoverClass: 'hover:border-amber-400/50',
    subtitle: '1989 · HD 1280×960 Ironman Dirt Stadium · 8 Tracks · 3D Jump Ramps · Mud & N2O Nitro',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Steer 4×4 Stadium Truck / Pick Speed Shop upgrades' },
      { key: 'Up / Space', desc: 'Throttle across dirt & 3D jumps' },
      { key: 'Down / S', desc: 'Brake before mud pits' },
      { key: 'Shift / X', desc: 'Fire N2O Nitro Boost (Collect blue N2O bottles!)' },
    ],
    tips: [
      'Launch off sculpted 3D dirt tabletop jumps to soar cleanly over deep clay mud pits across 8 Ironman stadium tracks!',
      'Scoop up $1,000 cash stacks and blue N2O Nitro bottles right off the dirt to fuel explosive straightaway boosts!',
      'Visit the Leland Speed Shop between races to spend $1,500 on Engine, Nitro Accel, and Mud Tires.',
    ],
  },
  indyheat: {
    id: 'indyheat',
    title: 'Indy Heat',
    year: 1991,
    publisher: 'Leland Corp',
    accentTextClass: 'text-blue-400',
    accentButtonClass: 'bg-blue-500 hover:bg-blue-400 text-white focus-visible:ring-blue-300',
    borderHoverClass: 'hover:border-blue-400/50',
    subtitle: '1991 · HD 1280×960 North American IndyCar · 6 Tracks · Live Fuel, Engine Heat & Pit Lane',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Steer IndyCar / Select Indy Garage upgrades' },
      { key: 'Up / Space', desc: 'Accelerate throttle' },
      { key: 'Down / S', desc: 'Brake into chicanes' },
      { key: 'Shift / X', desc: 'Engage Turbo Boost (Watch Engine Heat gauge!)' },
    ],
    tips: [
      'Watch your live Fuel & Engine Heat bars—overusing Turbo overheats the engine, and running dry cuts your speed!',
      'Glide through the glowing green PIT LANE strip on the front straight to rapidly refuel and cool your turbocharger!',
      'Conquer 6 iconic circuits—Indianapolis Oval, Detroit Street, Trade Winds, Bay Area, Ontario, and Grand Finale.',
    ],
  },
  defender: {
    id: 'defender',
    title: 'Defender',
    year: 1981,
    publisher: 'Williams',
    accentTextClass: 'text-amber-400',
    accentButtonClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950 focus-visible:ring-amber-200',
    borderHoverClass: 'hover:border-amber-400/50',
    subtitle: '1981 · Crimson Frontier · Williams Scanner · Mid-Air Rescues & Hyperspace (R)',
    controls: [
      { key: 'Arrows / WASD / Tilt', desc: 'Precision-tuned thrust & vertical flight (55%/78%/100% Speed)' },
      { key: 'Space / Z', desc: 'Fire horizontal streaking Williams laser' },
      { key: 'Shift / X', desc: 'Detonate Smart Bomb (clears onscreen foes)' },
      { key: 'R', desc: 'Emergency Hyperspace Warp across planet' },
    ],
    tips: [
      'Watch the top Williams Scanner for red flashing abduction beams—shoot Landers, catch falling Humanoids (+500), and land gently (+500)!',
      'Tap R for authentic 1981 Hyperspace warp when cornered by Mutants, Bombers, or Swarmers.',
      'If all 10 Humanoids perish, the crimson mountain frontier explodes into relentless Mutant Space!',
    ],
  },
  defender2: {
    id: 'defender2',
    title: 'Defender II',
    year: 1981,
    publisher: 'Williams',
    accentTextClass: 'text-purple-400',
    accentButtonClass: 'bg-purple-500 hover:bg-purple-400 text-white focus-visible:ring-purple-300',
    borderHoverClass: 'hover:border-purple-400/50',
    subtitle: '1981 · Violet Nebula & Crystal Spires · Inviso Cloak Ram · Warp Gate & Space Mines',
    controls: [
      { key: 'Arrows / WASD / Tilt', desc: 'Precision Delta-Wing thrust & climb/dive' },
      { key: 'Space / Z', desc: 'Fire magenta plasma laser streaks' },
      { key: 'Shift / X', desc: 'Trigger Smart Bomb' },
      { key: 'R', desc: 'Toggle rechargeable Inviso Cloak (+250 Ram Kills!)' },
    ],
    tips: [
      'Engage Inviso Cloak (R) to turn translucent and ram directly through Firebombers and chasing Space Mines for +250 RAM bonuses!',
      'Fly into the glowing violet Warp Gate to instantly teleport right beside an abducted Humanoid.',
      'Use the top-bar Speed or Tilt control for fine dodging through dense nebula minefields.',
    ],
  },
  stargate: {
    id: 'stargate',
    title: 'Stargate',
    year: 1981,
    publisher: 'Williams',
    accentTextClass: 'text-sky-400',
    accentButtonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    subtitle: '1981 · Cyan Hyperspace Portal · 3D Warp Tunnel · Yllabian Hums, Dynamos & Munchies',
    controls: [
      { key: 'Arrows / WASD / Tilt', desc: 'Twin-Prong Starfighter precision thrust' },
      { key: 'Space / Z', desc: 'Fire cyan multi-band laser beam' },
      { key: 'Shift / X', desc: 'Detonate Prismatic Smart Bomb' },
      { key: 'R', desc: 'Activate Inviso Cloak shield' },
    ],
    tips: [
      'Fly into the cyan Stargate Vortex to rescue abducted Humanoids—or keep 4+ alive near wave end to enter the 3D Hyperspace Warp Tunnel (+2,000 & skip waves)!',
      'Watch spinning Yllabian Space Hums split into twin Dynamos, and stop ground-stalking Munchies from chomping Humanoids.',
      'Combine Inviso Cloak (R) with Prismatic Smart Bombs (Shift/X) to survive Swarmer surges.',
    ],
  },
  tempest: {
    id: 'tempest',
    title: 'Tempest',
    year: 1981,
    publisher: 'Atari',
    accentTextClass: 'text-blue-400',
    accentButtonClass: 'bg-blue-500 hover:bg-blue-400 text-white focus-visible:ring-blue-300',
    borderHoverClass: 'hover:border-blue-400/50',
    subtitle: '1981 · Pure Quadrascan Color Vector · 16 Atari Webs · Rail Fuseballs & Pulsars',
    controls: [
      { key: 'Left / Right / Mouse', desc: 'Slide Blaster Claw continuously across cell centers & side rails' },
      { key: 'Space / Click', desc: 'Fire down exact cell-space firing solution (center or rail!)' },
      { key: 'Shift / X', desc: 'Fire Superzapper (full clear, then 1× zap)' },
    ],
    tips: [
      'Slide your Claw inside a cell toward the left or right edge to fire straight down side rails at crackling Fuseballs!',
      'Avoid lanes electrified by magenta Pulsars, and chip away green Spikes before entering the 3D Warp.',
      '16 authentic Atari webs cycle through Blue, Red, Yellow, Cyan, and Stealth color tiers.',
    ],
  },
  tempest2000: {
    id: 'tempest2000',
    title: 'Tempest 2000',
    year: 1994,
    publisher: 'Atari / Llamasoft',
    accentTextClass: 'text-pink-400',
    accentButtonClass: 'bg-pink-500 hover:bg-pink-400 text-white focus-visible:ring-pink-300',
    borderHoverClass: 'hover:border-pink-400/50',
    subtitle: '1994 · Jaguar Melt-O-Vision · Gouraud 3D Webs · Jump · Demon Heads & Bonus Tunnel',
    controls: [
      { key: 'Left / Right / Mouse', desc: 'Glide 3D Wedge Claw smoothly across cells & rails' },
      { key: 'Space / Click', desc: 'Fire Particle Laser (usable while jumping!)' },
      { key: 'Up / W', desc: '3D Jump Thruster over Flippers & electrified Pulsars' },
      { key: 'Shift / X', desc: 'Trigger Superzapper (rechargeable via Z capsules)' },
    ],
    tips: [
      'Watch real-time Jaguar Melt-O-Vision pixel fountains drip & melt behind solid Gouraud-shaded 3D webs!',
      'Collect 3 rainbow Warp Tokens (W) to enter the psychedelic 3D Bonus Ring Tunnel and skip levels!',
      'Aim toward side rails for Fuseballs, and use Jump Thruster to leap cleanly over Pulsar surges.',
    ],
  },
  tempest3000: {
    id: 'tempest3000',
    title: 'Tempest 3000',
    year: 2000,
    publisher: 'Llamasoft / Nuon',
    accentTextClass: 'text-cyan-400',
    accentButtonClass: 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 focus-visible:ring-cyan-200',
    borderHoverClass: 'hover:border-cyan-400/50',
    subtitle: '2000 · Nuon VLM-2 Prism Melt-O-Vision · Morphing Glass Webs · Mirror Reflectors',
    controls: [
      { key: 'Left / Right / Mouse', desc: 'Glide Crystalline Cyber-Claw within cell space & rails' },
      { key: 'Space / Click', desc: 'Fire Prism Laser / Triple Harmonic Spread' },
      { key: 'Up / W (Hold)', desc: 'Jump + Zero-G Hover Glide across multiple cells' },
      { key: 'Shift / X', desc: 'Discharge Prism Superzapper' },
    ],
    tips: [
      'Chrome Mirror Reflectors bounce dead-center shots back—slide toward a side rail inside the cell to flank them!',
      'Hold Up at jump apex to Hover-Glide over Pulsars and Demon Overlords across translucent morphing glass webs.',
      'Collect 3 Prism Glyphs (G) to dive into the Nuon VLM-2 Kaleidoscope Tunnel Bonus Stage!',
    ],
  },
  mappy: {
    id: 'mappy',
    title: 'Mappy',
    year: 1983,
    publisher: 'Namco',
    accentTextClass: 'text-sky-400',
    accentButtonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    subtitle: '1983 · 4 Victorian Mansion Themes · Attic Bells · Balloon Bonus Round & Gosenzo Coin',
    controls: [
      { key: 'Left / Right / Tilt', desc: 'Precision run & time trampoline shaft exits' },
      { key: 'Space / Z / Shift', desc: 'Slam doors, trigger Microwave Waves & drop Attic Bells' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Watch for the flashing PAIR! halo to grab matching stolen items back-to-back for up to 6× bonuses—and catch Big Goro peeking behind loot for +1,000!',
      'On Round 2+, drop hanging Brass Attic Bells onto pursuing cats for +500 BELL KO stuns, and beware the golden Gosenzo Coin if HURRY UP triggers!',
      'Every 3rd round enters the iconic Namco Balloon Trampoline Bonus Stage—pop the Giant Goro Balloon for +2,000 and clear all 16 for +5,000!',
    ],
  },

  // --- 10 Classic Platformer Cabinets ---
  mariobros: {
    id: 'mariobros',
    title: 'Mario Bros.',
    year: 1983,
    publisher: 'Nintendo',
    accentTextClass: 'text-red-400',
    accentButtonClass: 'bg-red-500 hover:bg-red-400 text-white focus-visible:ring-red-300',
    borderHoverClass: 'hover:border-red-400/50',
    subtitle: '1983 · Arcade Sewer Arena · Bump & Kick · POW Block & Bonus Coins',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Run & wrap across sewer pipes' },
      { key: 'Space / Up', desc: 'Jump to bump brick floors & POW block' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Jump beneath Shellcreepers and Fighter Flies to flip them, then run up to kick them off!',
      'Angry orange Sidesteppers take two head-bumps to flip over.',
      'Hit the central POW block (3 charges) to flip every grounded enemy at once.',
    ],
  },
  dkong: {
    id: 'dkong',
    title: 'Donkey Kong',
    year: 1981,
    publisher: 'Nintendo',
    accentTextClass: 'text-orange-400',
    accentButtonClass: 'bg-orange-500 hover:bg-orange-400 text-slate-950 focus-visible:ring-orange-200',
    borderHoverClass: 'hover:border-orange-400/50',
    subtitle: '1981 · All 4 Authentic Stages · 25m Girders · 50m Pie Factory · 75m Elevators · 100m Rivets',
    controls: [
      { key: 'Arrows / WASD / Tilt', desc: 'Precision run girders, ride elevators & climb ladders' },
      { key: 'Space / Z', desc: 'Jump over barrels, cement pies & bouncing Jack Springs' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Conquer all 4 authentic 1981 stages: 25m Girders (with Oil-ignited Fireballs), 50m Pie Factory Conveyors, 75m Elevators & Springs, and 100m Rivets!',
      'Grab suspended Golden Hammers to smash Barrels, Pies & Fireballs (+300/+500), and scoop Pauline’s Umbrella, Hat & Purse for bonus points.',
      'Pull all 8 golden rivets on 100m to drop the steel tower and send Donkey Kong tumbling!',
    ],
  },
  dkongjr: {
    id: 'dkongjr',
    title: 'Donkey Kong Jr.',
    year: 1982,
    publisher: 'Nintendo',
    accentTextClass: 'text-green-400',
    accentButtonClass: 'bg-green-500 hover:bg-green-400 text-slate-950 focus-visible:ring-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    subtitle: '1982 · 3 Authentic Stages · Jungle Vines · Springboard Canopy · Mario’s Electric Hideout',
    controls: [
      { key: 'Arrows / WASD / Tilt', desc: 'Climb vines (2 vines = 2× fast up, 1 vine = fast slide)' },
      { key: 'Space / Z', desc: 'Leap across jungle vines, islands & Springboard' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Play all 3 authentic 1982 stages: Waterfall Jungle Vines, Springboard & Moving Islands (with Nitpicker Birds), and Mario’s Electric Hideout (6 Keys & Sparks)!',
      'Grip between two vines to climb upward nearly twice as fast, and drop hanging fruits onto Snapjaws for 400→800→1600 chain crushes.',
      'Unlock all golden keys beneath Papa Kong’s barred cage while Mario paces overhead!',
    ],
  },
  dkong3: {
    id: 'dkong3',
    title: 'Donkey Kong 3',
    year: 1983,
    publisher: 'Nintendo',
    accentTextClass: 'text-lime-400',
    accentButtonClass: 'bg-lime-400 hover:bg-lime-300 text-slate-950 focus-visible:ring-lime-200',
    borderHoverClass: 'hover:border-lime-400/50',
    subtitle: '1983 · 3 Conservatory Themes · Stanley’s Bug Spray · Super Can · Coconuts & 5 Flowers',
    controls: [
      { key: 'Arrows / WASD / Tilt', desc: 'Move Stanley across 3 sunlit greenhouse decks & ladders' },
      { key: 'Space / Z', desc: 'Blast upward Bug Spray & Golden Super Spray' },
      { key: 'Shift / X (or Up off ladder)', desc: 'Hop cleanly over Creepy caterpillars & DK Coconuts' },
    ],
    tips: [
      'Blast Donkey Kong straight up into the golden beehive while dodging falling Coconuts and intercepting flower-stealing Buzzbees & Beespies!',
      'Push DK halfway up to shake loose the flashing golden Super Spray Can for hyper-rapid blasts.',
      'Protect all 5 individually blooming potted flowers across Blue, Amber, and Crimson Conservatory halls!',
    ],
  },
  smb1: {
    id: 'smb1',
    title: 'Super Mario Bros.',
    year: 1985,
    publisher: 'Nintendo',
    accentTextClass: 'text-red-400',
    accentButtonClass: 'bg-red-500 hover:bg-red-400 text-white focus-visible:ring-red-300',
    borderHoverClass: 'hover:border-red-400/50',
    subtitle: '1985 · Mushroom Kingdom · Super Mushroom · Fire Flower & Bowser',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Run across Mushroom Kingdom' },
      { key: 'Space / Up', desc: 'Jump & stomp Goombas / Koopas' },
      { key: 'Shift / X', desc: 'Sprint faster & toss bouncing Fireballs' },
    ],
    tips: [
      'Bump golden ? blocks from below for Coins, Super Mushrooms, and Fire Flowers.',
      'Stomp a Koopa into its shell, then kick it to bowl down rows of enemies.',
      'Leap high onto the ending Flagpole for bigger course-clear bonuses!',
    ],
  },
  smb2: {
    id: 'smb2',
    title: 'Super Mario Bros. 2',
    year: 1988,
    publisher: 'Nintendo',
    accentTextClass: 'text-pink-400',
    accentButtonClass: 'bg-pink-500 hover:bg-pink-400 text-white focus-visible:ring-pink-300',
    borderHoverClass: 'hover:border-pink-400/50',
    subtitle: '1988 · Subcon Dreamland · Pluck & Throw Veggies · 4 Heroes & Birdo',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Run across Subcon' },
      { key: 'Space / Up', desc: 'Jump (Hold with Peach to float mid-air!)' },
      { key: 'Shift / X', desc: 'Pluck turnips, POW blocks, & eggs — press again to throw!' },
      { key: 'R', desc: 'Switch Hero (Mario, Luigi, Peach, Toad)' },
    ],
    tips: [
      'Stand over grass tufts and press Shift/X to pluck Turnips, then hurl them at Shy Guys & Birdo!',
      'Jump onto Birdo’s flying eggs to catch them and toss them right back at her (3 hits!).',
      'Press R anytime to swap between Luigi’s high jump, Peach’s float, and Toad’s speed.',
    ],
  },
  smb3: {
    id: 'smb3',
    title: 'Super Mario Bros. 3',
    year: 1988,
    publisher: 'Nintendo',
    accentTextClass: 'text-yellow-400',
    accentButtonClass: 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 focus-visible:ring-yellow-200',
    borderHoverClass: 'hover:border-yellow-400/50',
    subtitle: '1988 · Super Leaf Raccoon Flight · P-Speed Meter · Tail Spin & Note Blocks',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Run & build P-Speed meter' },
      { key: 'Space / Up', desc: 'Jump — tap repeatedly mid-air to flutter or fly!' },
      { key: 'Shift / X', desc: 'Sprint & Raccoon Tail Spin attack' },
    ],
    tips: [
      'Hold Shift/X while running to charge P-Speed to 100%, then tap Jump to soar into the sky!',
      'Tap Shift/X near enemies to whip them away with your Raccoon Tail Spin.',
      'Bounce off white ♪ Note Blocks to launch high into secret coin arcs.',
    ],
  },
  sonic1: {
    id: 'sonic1',
    title: 'Sonic the Hedgehog',
    year: 1991,
    publisher: 'SEGA',
    accentTextClass: 'text-blue-400',
    accentButtonClass: 'bg-blue-500 hover:bg-blue-400 text-white focus-visible:ring-blue-300',
    borderHoverClass: 'hover:border-blue-400/50',
    subtitle: '1991 · Green Hill 360° Loops · Golden Rings · Springs & Dr. Robotnik',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Build supersonic momentum' },
      { key: 'Space / Up', desc: 'Spin Jump into Badniks & Monitors' },
      { key: 'Down / Shift', desc: 'Crouch-Roll Spin Attack' },
    ],
    tips: [
      'Build top speed before entering a 360° Loop-de-Loop to rocket clean around the ring!',
      'Holding at least 1 Golden Ring protects you—if hit, quickly scoop up scattered Rings!',
      'Jump into Dr. Robotnik’s Eggmobile 5 times to clear each Zone Act.',
    ],
  },
  sonic2: {
    id: 'sonic2',
    title: 'Sonic the Hedgehog 2',
    year: 1992,
    publisher: 'SEGA',
    accentTextClass: 'text-sky-400',
    accentButtonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    subtitle: '1992 · Spin Dash · Tails Sidekick · Chemical Plant & Super Sonic',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Sprint through Emerald Hill & Chemical Plant' },
      { key: 'Space / Up', desc: 'Spin Jump (Tap mid-air at 50+ Rings for Super Sonic!)' },
      { key: 'Hold Down + Space/X', desc: 'Rev & launch Super Spin Dash' },
    ],
    tips: [
      'Hold Down and tap Space/Shift to rev your Spin Dash, then release Down to blast forward!',
      'Tails flies right behind you collecting extra Rings automatically.',
      'Collect 50+ Rings and double-tap Jump mid-air to transform into golden Super Sonic!',
    ],
  },
  sonic3: {
    id: 'sonic3',
    title: 'Sonic the Hedgehog 3',
    year: 1994,
    publisher: 'SEGA',
    accentTextClass: 'text-indigo-400',
    accentButtonClass: 'bg-indigo-500 hover:bg-indigo-400 text-white focus-visible:ring-indigo-300',
    borderHoverClass: 'hover:border-indigo-400/50',
    subtitle: '1994 · Elemental Shields · Insta-Shield · Switch Sonic / Tails / Knuckles',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'High-speed Angel Island run' },
      { key: 'Space / Up', desc: 'Jump — tap again mid-air for Elemental Shield / Insta-Shield!' },
      { key: 'Hold Down + Space/X', desc: 'Rev & launch Spin Dash' },
      { key: 'R', desc: 'Switch Hero (Sonic, Tails, Knuckles)' },
    ],
    tips: [
      'Smash Fire (Dash), Electric (Double-Jump + Ring Magnet), and Bubble (Bounce) Monitors!',
      'Without a shield, tap Jump mid-air for Sonic’s signature Insta-Shield burst.',
      'Press R anytime to swap between Sonic, flying Tails, and Knuckles.',
    ],
  },

  // --- 39 Newly Added Arcade & Console Classics ---
  superbreakout: {
    id: 'superbreakout',
    title: 'Super Breakout',
    year: 1978,
    publisher: 'Atari',
    accentTextClass: 'text-sky-400',
    accentButtonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    subtitle: '1978 · Atari Cellophane Bands · Cavity 3-Ball, Double Paddle & Progressive Wall',
    controls: [
      { key: 'Left / Right / Mouse', desc: 'Slide Atari precision paddle' },
      { key: 'Space / Click', desc: 'Serve pixel ball into the brick wall' },
      { key: 'R / Shift', desc: 'Cycle authentic modes (Cavity / Double / Progressive)' },
    ],
    tips: [
      'In Cavity mode, carve into the 2 enclosed brick pockets to free both trapped balls for 3-ball chaos!',
      'In Double mode, control twin stacked paddles with 2 live balls; in Progressive mode, survive the descending wall!',
      'Break through to the top amber ceiling to rack up rapid points—watch your paddle shrink to pro size!',
    ],
  },
  arkanoid: {
    id: 'arkanoid',
    title: 'Arkanoid',
    year: 1986,
    publisher: 'Taito',
    accentTextClass: 'text-blue-400',
    accentButtonClass: 'bg-blue-500 hover:bg-blue-400 text-white focus-visible:ring-blue-300',
    borderHoverClass: 'hover:border-blue-400/50',
    subtitle: '1986 · 7 Classic Taito Mazes + DOH Boss · 7 Capsules · Space Enemies & Warp Gate',
    controls: [
      { key: 'Left / Right / Mouse', desc: 'Steer the metallic Vaus craft' },
      { key: 'Space / Click', desc: 'Launch Energy Ball & fire Twin Lasers' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Conquer 7 authentic Taito architectural layouts (Rainbow Wedge, Twin Towers, Space Invader, Vaults) before facing DOH on Round 8!',
      'Catch spinning capsules: E (Expand), L (Laser), C (Catch), D (Disruption 3-Ball), S (Slow), B (Break Warp), P (1UP).',
      'Deflect roaming Harmful, Pyrad, Tri-Sphere, and Oppopo enemies emerging from the animated top hatch doors!',
    ],
  },
  arkanoid2: {
    id: 'arkanoid2',
    title: 'Arkanoid II: Revenge of DOH',
    year: 1987,
    publisher: 'Taito',
    accentTextClass: 'text-purple-400',
    accentButtonClass: 'bg-purple-500 hover:bg-purple-400 text-white focus-visible:ring-purple-300',
    borderHoverClass: 'hover:border-purple-400/50',
    subtitle: '1987 · 7 Cyber-Bio Mazes + Evolved DOH · Mega-Ball, Twin Vaus, Illusion & Sliding Gates',
    controls: [
      { key: 'Left / Right / Mouse', desc: 'Pilot Vaus-II, Twin Vaus & Illusion shadows' },
      { key: 'Space / Click', desc: 'Launch Energy / Mega-Ball & fire Lasers' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Grab M (Mega-Ball) to smash straight through every brick—including Gold blocks—without bouncing!',
      'Catch T (Twin Vaus), I (Illusion shadow paddle), N (8-Ball Disruption), and B to open BOTH Left & Right Warp Doors!',
      'Watch out for Sliding Gate bricks, Regenerating Silver blocks, and Green Slime Splitters across 7 unique zones!',
    ],
  },
  breakout2016evo: {
    id: 'breakout2016evo',
    title: 'Breakout 2016 Evo',
    year: 2016,
    publisher: 'Llamasoft / Evo',
    accentTextClass: 'text-pink-400',
    accentButtonClass: 'bg-pink-500 hover:bg-pink-400 text-white focus-visible:ring-pink-300',
    borderHoverClass: 'hover:border-pink-400/50',
    subtitle: '2016 · Melt-O-Vision Trails · Tempest Webs & Superzapper · Warlords Citadels · Arkanoid Capsules & DOH-Pulsar',
    controls: [
      { key: 'Mouse / Left / Right', desc: 'Steer curved Cyber-Vaus prism paddle' },
      { key: 'Hold Space / Click', desc: 'Warlords Catch & Fireball Sling / Fire Twin Lasers' },
      { key: 'Up / W', desc: 'Phase Parry Boost — power-spike incoming balls' },
      { key: 'Shift / X', desc: 'Tempest Superzapper lightning shockwave' },
    ],
    tips: [
      'Hold Space or Mouse Button as the ball lands to Catch it Warlords-style, charge a blazing piercing Fireball, and sling it right through castle walls!',
      'Breach the fortified Warlords Citadels—defeat rival AI shield paddles and shatter their crowned King Cores to collapse their entire castle!',
      'Grab 9 Evo Capsules: M (Melt-O-Multiball), D (Tempest A.I. Droid), L (Twin Laser), E (Expand), C (Mag-Catch), A (Armor Shield), Z (Zapper Recharge), S (Time-Slow), W (Hyper Warp).',
      'Trigger Shift/X for the Tempest Superzapper to vaporize Flippers, Fuseballs, and crack armored prism layers in a Melt-O-Vision surge!',
    ],
  },
  asteroidsdeluxe: {
    id: 'asteroidsdeluxe',
    title: 'Asteroids Deluxe',
    year: 1981,
    publisher: 'Atari',
    accentTextClass: 'text-sky-400',
    accentButtonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    subtitle: '1981 · Glowing Vector Shields · Killer Satellites & Precision Saucers',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Rotate vector interceptor' },
      { key: 'Up / W', desc: 'Fire main thruster' },
      { key: 'Space / Z', desc: 'Fire vector plasma bolts' },
      { key: 'Shift / X / Down', desc: 'Engage rechargeable Energy Shield' },
    ],
    tips: [
      'Hold Shift/X briefly to deflect incoming asteroids and saucer shots with your Shield.',
      'Killer Satellites split into chasing triangle pairs and pods—snipe them cleanly!',
      'Use momentum bursts rather than constant thrust to stay in command of the screen.',
    ],
  },
  spaceduel: {
    id: 'spaceduel',
    title: 'Space Duel',
    year: 1982,
    publisher: 'Atari',
    accentTextClass: 'text-purple-400',
    accentButtonClass: 'bg-purple-500 hover:bg-purple-400 text-white focus-visible:ring-purple-300',
    borderHoverClass: 'hover:border-purple-400/50',
    subtitle: '1982 · Vivid Color Vector Geometry · Tethered Wingman & Pinwheels',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Rotate vector ship' },
      { key: 'Up / W', desc: 'Thrust through geometric arena' },
      { key: 'Space / Z', desc: 'Fire neon vector bolts' },
      { key: 'Shift / X / R', desc: 'Toggle Energy Shield / Tether Wingman' },
    ],
    tips: [
      'Diamonds, Pinwheels, and Fuzzballs split into fast geometric shards when destroyed.',
      'Toggle your tethered Wingman ship for dual-turret firepower across the vector field.',
      'Watch for swirling bonus multipliers during wave transitions.',
    ],
  },
  starcastle: {
    id: 'starcastle',
    title: 'Star Castle',
    year: 1980,
    publisher: 'Cinematronics',
    accentTextClass: 'text-yellow-400',
    accentButtonClass: 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 focus-visible:ring-yellow-200',
    borderHoverClass: 'hover:border-yellow-400/50',
    subtitle: '1980 · 3 Counter-Rotating Shield Rings · Homing Spark Mines & Core',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Rotate starfighter' },
      { key: 'Up / W', desc: 'Orbit thrust' },
      { key: 'Space / Z', desc: 'Fire piercing vector cannon' },
    ],
    tips: [
      'Blast segments out of all three rotating color rings to open a clean line to the central Cannon.',
      'Destroying an entire ring causes it to regenerate—carve a narrow breach instead!',
      'Keep moving to outmaneuver homing Spark Mines and the Core’s sudden fireball.',
    ],
  },
  missilecommand: {
    id: 'missilecommand',
    title: 'Missile Command',
    year: 1980,
    publisher: 'Atari',
    accentTextClass: 'text-orange-400',
    accentButtonClass: 'bg-orange-500 hover:bg-orange-400 text-slate-950 focus-visible:ring-orange-200',
    borderHoverClass: 'hover:border-orange-400/50',
    subtitle: '1980 · 3 ABM Missile Bases · Chain Blast Intercepts · 6 Cities',
    controls: [
      { key: 'Mouse / Arrows', desc: 'Aim targeting crosshair' },
      { key: 'Click / Space', desc: 'Launch counter-missile from nearest base' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Lead incoming MIRVs slightly ahead of their trajectory so they fly right into your blast bloom.',
      'Chain-detonate clustered warheads and smart bombs with a single well-placed counter-missile.',
      'Surviving cities and unused ABMs award hefty bonus points after every wave.',
    ],
  },
  qix: {
    id: 'qix',
    title: 'Qix',
    year: 1981,
    publisher: 'Taito',
    accentTextClass: 'text-pink-400',
    accentButtonClass: 'bg-pink-500 hover:bg-pink-400 text-white focus-visible:ring-pink-300',
    borderHoverClass: 'hover:border-pink-400/50',
    subtitle: '1981 · Neon Ribbon Qix · Fast vs 2× Slow Draw · Twin Qix Split & Super Sparx',
    controls: [
      { key: 'Arrows / WASD', desc: 'Glide Marker along safe border' },
      { key: 'Hold Space + Dir', desc: 'Fast Draw Stix (1× cyan territory)' },
      { key: 'Hold Shift/X + Dir', desc: 'Slow Draw Stix (2× gold territory!)' },
    ],
    tips: [
      'Claim 75% or more of the playfield—every percentage point over 75% earns +1,000 bonus points!',
      'On Stage 3+, carve a Stix wall straight between the Twin Qix to split them and boost your permanent score multiplier!',
      'Never stall mid-draw or the burning Fuse will race up your Stix line—and watch Sparx evolve into Super Sparx.',
    ],
  },
  superqix: {
    id: 'superqix',
    title: 'Super Qix',
    year: 1987,
    publisher: 'Taito',
    accentTextClass: 'text-yellow-400',
    accentButtonClass: 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 focus-visible:ring-yellow-200',
    borderHoverClass: 'hover:border-yellow-400/50',
    subtitle: '1987 · Official Qix Sequel · Hidden 16-Bit Art Reveals · Enclose Power-Ups & Warp',
    controls: [
      { key: 'Arrows / WASD', desc: 'Glide Marker along revealed picture borders' },
      { key: 'Hold Space + Dir', desc: 'Fast Draw Stix to unveil hidden 16-bit artwork' },
      { key: 'Hold Shift/X + Dir', desc: 'Slow Draw for 2× gold scoring & precision traps' },
    ],
    tips: [
      'Enclose floating glowing capsules inside your claimed territory to trigger FREEZE, SHIELD, SPEED, +5,000 BONUS, or WARP!',
      'Unveil Golden Dragon, Samurai Citadel, Cyber Phoenix, Emerald Kraken, and Star Temple artwork beneath the curtain.',
      'Push past 90% coverage before clearing a board to claim the massive Master Reveal Bonus!',
    ],
  },
  galaxian: {
    id: 'galaxian',
    title: 'Galaxian',
    year: 1979,
    publisher: 'Namco',
    accentTextClass: 'text-yellow-400',
    accentButtonClass: 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 focus-visible:ring-yellow-200',
    borderHoverClass: 'hover:border-yellow-400/50',
    subtitle: '1979 · Authentic Pixel Sprites · Armed Galaxip · Swooping Flagships & Stage Flags',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Slide Galaxip starfighter' },
      { key: 'Space / Z / Up', desc: 'Fire 1-shot precision missile' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Destroy both Red Escorts and then the diving Golden Flagship for the iconic 800-point convoy bonus!',
      'Watch the yellow warhead on your Galaxip nose—only 1 shot can fly at a time, rewarding crisp timing.',
      'Diving Purple Chargers and Blue Drones bank smoothly into formation arcs for double points!',
    ],
  },
  galaga: {
    id: 'galaga',
    title: 'Galaga',
    year: 1981,
    publisher: 'Namco',
    accentTextClass: 'text-sky-400',
    accentButtonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    subtitle: '1981 · Boss Galaga, Goei & Zako Sprites · Harmonic Tractor Beam · Dual Fighter',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Pilot Galaga Starfighter' },
      { key: 'Space / Z / Up', desc: 'Twin-stream rapid plasma fire' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Let a Green Boss Galaga pull in a spare ship with its pulsing Tractor Beam, then destroy the Boss while diving to dock a Dual Fighter!',
      'Boss Galagas take 2 hits and shift from Green to Blue after the first strike.',
      'Every 3rd stage is a Challenging Stage featuring swooping Dragonfly bonus waves for 10,000 pts!',
    ],
  },
  phoenix: {
    id: 'phoenix',
    title: 'Phoenix',
    year: 1980,
    publisher: 'Amstar / Centuri',
    accentTextClass: 'text-orange-400',
    accentButtonClass: 'bg-orange-500 hover:bg-orange-400 text-slate-950 focus-visible:ring-orange-200',
    borderHoverClass: 'hover:border-orange-400/50',
    subtitle: '1980 · 5-Wave Firebird Cycle · Regenerating Wings · Conveyor Mothership & Shield',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Steer Amstar defense craft' },
      { key: 'Space / Z', desc: 'Fire vertical plasma bolts' },
      { key: 'Shift / X / Down', desc: 'Activate blazing Force Shield' },
    ],
    tips: [
      'Trigger your Force Shield right as diving Blue & Gold Firebirds swoop down to vaporize them on contact!',
      'On Waves 3–4, shoot the pulsing heart of hatched Giant Phoenix Birds—detached wings smoke and regrow!',
      'Carve through the scrolling cyan conveyor belt and armor blocks of the Wave 5 Mothership to hit the green Commander!',
    ],
  },
  gyruss: {
    id: 'gyruss',
    title: 'Gyruss',
    year: 1983,
    publisher: 'Konami',
    accentTextClass: 'text-cyan-400',
    accentButtonClass: 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 focus-visible:ring-cyan-200',
    borderHoverClass: 'hover:border-cyan-400/50',
    subtitle: '1983 · 3D Perspective Warp Tunnel · 6 Approaching Planets · 3-Satellite Double Laser',
    controls: [
      { key: 'Left / Right / Up / Down', desc: 'Orbit Konami starfighter 360° around rim' },
      { key: 'Space / Z', desc: 'Fire lasers toward the deep warp vanishing point' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Snipe the center Red Satellite in the orbiting 3-satellite trio to upgrade to Twin Gold Plasma Lasers!',
      'Warp across Neptune, Uranus, ringed Saturn, Jupiter, Mars, and Earth as each planet grows ahead!',
      'Dodge spinning 3D space asteroids and clear every 3rd wave Chance Stage for massive bonus points.',
    ],
  },
  scramble: {
    id: 'scramble',
    title: 'Scramble',
    year: 1981,
    publisher: 'Konami',
    accentTextClass: 'text-green-400',
    accentButtonClass: 'bg-green-500 hover:bg-green-400 text-slate-950 focus-visible:ring-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    subtitle: '1981 · Authentic 6-Sector Konami Cavern Run · Laser & Parabolic Bombs · FUEL & ? Bases',
    controls: [
      { key: 'Arrows / WASD / Tilt', desc: 'Pilot Jet through all 6 authentic Konami sectors' },
      { key: 'Space / Z', desc: 'Fire forward Twin Laser cannons (destroys UFOs & Rockets)' },
      { key: 'Shift / X', desc: 'Drop parabolic air-to-ground Bombs onto FUEL & Base Cores' },
    ],
    tips: [
      'Conquer all 6 Konami sectors in sequence: 1 Mountains, 2 Cavern + UFOs, 3 Fireballs, 4 City, 5 Tight Maze, and 6 Base Core (+800)!',
      'Bomb glowing FUEL depots (+150 & instant refill) and ? Mystery Targets (100/200/300 random bonus) before your gauge runs dry.',
      'Sector 3 Fireballs are indestructible—weave cleanly through their streaking lanes!',
    ],
  },
  moonpatrol: {
    id: 'moonpatrol',
    title: 'Moon Patrol',
    year: 1982,
    publisher: 'Irem / Williams',
    accentTextClass: 'text-pink-400',
    accentButtonClass: 'bg-pink-500 hover:bg-pink-400 text-white focus-visible:ring-pink-300',
    borderHoverClass: 'hover:border-pink-400/50',
    subtitle: '1982 · 6-Wheel Lunar Buggy · Parallax Mountains · Dual Turrets',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Brake or boost buggy speed' },
      { key: 'Up / W', desc: 'Jump over craters, rocks & landmines' },
      { key: 'Space / Z', desc: 'Fire forward & vertical anti-UFO guns together' },
    ],
    tips: [
      'Speed up before wide craters so your lunar buggy clears them with room to spare.',
      'Blast tumbling boulders with your forward gun while shooting down crater-bombing UFOs overhead.',
      'Reach Checkpoints E, J, O, T, and Z under par time for hefty time bonuses.',
    ],
  },
  timepilot: {
    id: 'timepilot',
    title: 'Time Pilot',
    year: 1982,
    publisher: 'Konami',
    accentTextClass: 'text-blue-400',
    accentButtonClass: 'bg-blue-500 hover:bg-blue-400 text-white focus-visible:ring-blue-300',
    borderHoverClass: 'hover:border-blue-400/50',
    subtitle: '1982 · 360° Free-Flight Dogfights · 1910 Blimp, 1940 B-25, 1970 CH-47, 1982 B-52 & 2001 UFO',
    controls: [
      { key: 'Arrows / WASD / Mouse', desc: 'Bank Konami Time Fighter smoothly in 360° open sky' },
      { key: 'Space / Z / Click', desc: 'Fire rapid nose autocannon' },
      { key: 'Shift / X', desc: 'Afterburner speed boost' },
    ],
    tips: [
      'Shoot down the required squadron count to summon each era’s giant Mothership boss and warp forward through time!',
      'Rescue floating parachutists for escalating 1,000 → 2,000 → 3,000 → 4,000 → 5,000 bonuses, and wipe V-formations for +2,000!',
      'Shoot down heat-seeking missiles in 1970 and 1982 before they curve into your tail.',
    ],
  },
  timepilot84: {
    id: 'timepilot84',
    title: 'Time Pilot ’84',
    year: 1984,
    publisher: 'Konami',
    accentTextClass: 'text-sky-400',
    accentButtonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    subtitle: '1984 · Metallic Overworld · Dual Vulcan + Auto Lock-On Homing Missiles & Ground Turrets',
    controls: [
      { key: 'Arrows / WASD / Mouse', desc: 'Steer 360° overscrolling metallic industrial overworld' },
      { key: 'Space / Z / Click', desc: 'Fire Dual Vulcan lasers at enemy air fighters' },
      { key: 'Shift / X', desc: 'Launch Lock-On Homing Missiles at armored ground turrets & Silver Bosses!' },
    ],
    tips: [
      'Authentic 1984 Konami mechanic: Vulcan shots shred air squadrons, while Lock-On Missiles (Shift/X) crack armored metallic ground structures & bosses!',
      'Keep your glowing green crosshair locked over flashing Silver/Gold Boss ships when launching missiles for massive damage.',
      'Weave past rotating turret spreads across the 3D-shaded industrial alloy overworld!',
    ],
  },
  timepilot2016evo: {
    id: 'timepilot2016evo',
    title: 'Time Pilot: 2016 Evo',
    year: 2016,
    publisher: 'Konami / Evo',
    accentTextClass: 'text-pink-400',
    accentButtonClass: 'bg-pink-500 hover:bg-pink-400 text-white focus-visible:ring-pink-300',
    borderHoverClass: 'hover:border-pink-400/50',
    subtitle: '2016 Evo · Melt-O-Vision Warp Trails · 4-Target Homing Salvos · Chain Lightning & Chrono Shift',
    controls: [
      { key: 'Arrows / WASD / Mouse', desc: '360° Chrono-Fighter dogfighting through Melt-O-Vision eras' },
      { key: 'Space / Z / Click', desc: 'Fire Overdrive Plasma + automatic Chain Lightning arcs' },
      { key: 'Shift / X', desc: 'Unleash 4-Target Homing Missile Salvo + Chrono Time-Dilation!' },
    ],
    tips: [
      'Build continuous kill combos to crank Melt-O-Vision warp trails, chromatic shockwaves, and multi-barrel Evo Plasma cannons!',
      'Press Shift/X to trigger Chrono Time-Dilation (slowing enemy bullets) while firing a 4-target homing missile salvo!',
      'Rescue luminous Chrono-Pilots to recharge your Warp Gauge and annihilate towering Era Dreadnoughts!',
    ],
  },
  ww1942: {
    id: 'ww1942',
    title: '1942',
    year: 1984,
    publisher: 'Capcom',
    accentTextClass: 'text-slate-100',
    accentButtonClass: 'bg-slate-200 hover:bg-white text-slate-950 focus-visible:ring-slate-300',
    borderHoverClass: 'hover:border-slate-300/50',
    subtitle: '1984 · USS Hornet Carrier Launch · 3D Loop-the-Loop · Twin Wingmen & Ayako Boss',
    controls: [
      { key: 'Arrows / WASD / Mouse', desc: 'Pilot silver P-38 Lightning across 4 Pacific theaters' },
      { key: 'Space / Z / Click', desc: 'Fire Twin or POW Quad-Guns (+ Wingmen escorts)' },
      { key: 'Shift / X', desc: 'Execute 3D Loop-the-Loop invulnerable roll (3/stage)' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Wipe out complete Red Fighter formations to drop iconic POWs: Quad Guns, Twin Wingmen, Screen Crash, Extra Roll, Yashichi, or 1-UP!',
      'Trigger a 3D Loop-the-Loop (Shift/X) to dodge dense spreads and land back on USS Hornet for Shoot-Down % & Roll bonuses.',
      'Focus Quad-Gun fire on the giant 4-engine Ayako Super-Bomber’s rotating turret and engines to push TO TOKYO!',
    ],
  },
  ww1943: {
    id: 'ww1943',
    title: '1943: The Battle of Midway',
    year: 1987,
    publisher: 'Capcom',
    accentTextClass: 'text-emerald-400',
    accentButtonClass: 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 focus-visible:ring-emerald-200',
    borderHoverClass: 'hover:border-emerald-400/50',
    subtitle: '1987 · Shoot-to-Cycle POW Arsenal · Energy Gauge · Lightning Mega-Crash · Yamato Fleet',
    controls: [
      { key: 'Arrows / WASD / Mouse', desc: 'Pilot emerald-trim P-38 over Midway naval armada' },
      { key: 'Space / Z / Click', desc: 'Fire Shotgun, 3-Way, Auto, Shell, or Laser & shoot POWs to cycle' },
      { key: 'Shift / X', desc: 'Unleash Lightning Mega-Crash (vaporizes bullets & shocks turrets)' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Shoot floating POW icons to cycle between SHOTGUN, 3-WAY, AUTO, SHELL, LASER, ENERGY fuel refills, and Armored Side Wingmen!',
      'Shotgun blasts erase incoming enemy bullets mid-air—vital when dismantling Cruiser Tone, Carrier Kaga, Ayako Mk-II, and Battleship Yamato.',
      'Watch your draining Energy/Fuel bar and crack every rotating warship turret to push Destruction % to 100% and sink the flagship!',
    ],
  },
  starwars: {
    id: 'starwars',
    title: 'Star Wars',
    year: 1983,
    publisher: 'Atari',
    accentTextClass: 'text-yellow-400',
    accentButtonClass: 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 focus-visible:ring-yellow-200',
    borderHoverClass: 'hover:border-yellow-400/50',
    subtitle: '1983 · Quadrascan 3D Color Vector · X-Wing Red Five · Vader TIE · Death Star Trench',
    controls: [
      { key: 'Mouse / Arrows / Joystick', desc: 'Aim quad-laser targeting reticle' },
      { key: 'Click / Space', desc: 'Fire quad X-Wing laser cannons & intercept fireballs' },
      { key: 'Shift / X', desc: 'Launch charged Proton Torpedo burst' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Shoot spinning orange TIE fireballs mid-air (+33 pts) and repel invulnerable Darth Vader for +2,000 pts!',
      'Phase 2: pop the glowing crowns off Death Star Surface Turbolaser Towers; Phase 3: weave through catwalk gaps!',
      'Hold fire through the Trench until the Exhaust Port opens for the iconic "USE THE FORCE" bonus + Vector Supernova!',
    ],
  },
  starwarsesb: {
    id: 'starwarsesb',
    title: 'Star Wars: Empire Strikes Back',
    year: 1985,
    publisher: 'Atari Games',
    accentTextClass: 'text-sky-400',
    accentButtonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    subtitle: '1985 · Hoth 3D Color Vector · Snowspeeder · Tow-Cable AT-ATs · Bombers & Asteroids',
    controls: [
      { key: 'Mouse / Arrows / Joystick', desc: 'Aim Snowspeeder / Falcon vector sight' },
      { key: 'Click / Space', desc: 'Fire dual blasters (snipe AT-AT flashing neck weakpoints)' },
      { key: 'Shift / X', desc: 'Launch Harpoon Tow-Cable at AT-AT legs / Ion Pulse in space' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Destroy Viper Probe Droids before they call reinforcements, and press Shift/X 3 times near an AT-AT to trip it with your Tow-Cable!',
      'In Hoth Orbit, watch twin-hull TIE Bombers dropping glowing Proximity Mines alongside dagger-winged TIE Interceptors.',
      'Spell J-E-D-I in the polyhedral Asteroid Field for Force Invulnerability + 2× score before assaulting the Star Destroyer Shield Domes!',
    ],
  },
  starwarsrotj: {
    id: 'starwarsrotj',
    title: 'Star Wars: Return of the Jedi',
    year: 1984,
    publisher: 'Atari Games',
    accentTextClass: 'text-green-400',
    accentButtonClass: 'bg-green-500 hover:bg-green-400 text-slate-950 focus-visible:ring-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    subtitle: '1984 · 2.5D Isometric Raster · Weave, Jump & Duck · Ewok Traps · Reversed-Camera DS-II Escape',
    controls: [
      { key: 'Mouse / Arrows / Joystick', desc: 'Weave Left/Right around Redwoods, Pylons & Rolling Logs' },
      { key: 'Click / Space', desc: 'Fire blasters, shoot rolling logs (+500) & trigger Ewok Traps' },
      { key: 'Shift / X', desc: 'JUMP / VAULT over fallen logs, ravines & low energy barriers (Afterburner climb in Falcon)' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Stage 1 (Leia): Weave Left/Right around Redwoods, press Shift/X to JUMP over fallen logs & creek ravines, stay LOW under overhead branches, and lure tailing Scouts into Ewok traps!',
      'Stage 2 (Chewbacca AT-ST): Shoot (+500) or Hydraulic-Hop (Shift/X) over rolling logs & mines, dodge catapulted rocks, and blow the flanking Power Conduits before shattering the Shield Dish!',
      'Stage 3 (Lando Falcon + X-Wing Escorts): Climb OVER low barriers, fly UNDER ceiling beams into the Reactor Core—then survive the authentic 1984 REVERSED-CAMERA Fireball Escape!',
    ],
  },
  berzerk: {
    id: 'berzerk',
    title: 'Berzerk',
    year: 1980,
    publisher: 'Stern',
    accentTextClass: 'text-green-400',
    accentButtonClass: 'bg-green-500 hover:bg-green-400 text-slate-950 focus-visible:ring-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    subtitle: '1980 · High-Voltage Stern Maze · 6 Robot Tiers · Crossfire & Invincible Evil Otto',
    controls: [
      { key: 'Arrows / WASD / Tilt', desc: 'Precision 8-way corridor movement (55%/78%/100% Speed)' },
      { key: 'Space / Click', desc: 'Fire 8-way or Mouse-aimed neon laser bolt' },
      { key: 'Shift / X (Hold)', desc: 'Plant feet to aim & fire without touching electric walls!' },
    ],
    tips: [
      'Hold Shift/X (or use 55% Fine Speed) to pivot and fire cleanly around crackling high-voltage corridors.',
      'Lure Cyclops robots into frying on electrified walls or shooting each other in crossfire!',
      'Clear every robot for a Room Clear Bonus—then sprint through a pulsing exit before bouncing Evil Otto catches you!',
    ],
  },
  robotron: {
    id: 'robotron',
    title: 'Robotron: 2084',
    year: 1982,
    publisher: 'Williams',
    accentTextClass: 'text-pink-400',
    accentButtonClass: 'bg-pink-500 hover:bg-pink-400 text-white focus-visible:ring-pink-300',
    borderHoverClass: 'hover:border-pink-400/50',
    subtitle: '1982 · Full Jarvis Cast · Grunts, Hulks, Spheroids, Quarks, Brains, Progs & Last Family',
    controls: [
      { key: 'WASD / Arrows', desc: 'Run 8 directions through neon battle grid' },
      { key: 'Mouse + Click / Space', desc: '360° twin-stick rapid plasma stream (auto-aims if no mouse)' },
      { key: 'Shift / X', desc: '8-way radial Panic Plasma Burst (short cooldown)' },
    ],
    tips: [
      'Rescue Mommy, Daddy, and Mikey in unbroken streaks for escalating 1,000 → 2,000 → 3,000 → 4,000 → 5,000 bonuses!',
      'Indestructible Hulks knock back under fire—prioritize Spheroids (Enforcers), Quarks (ricochet Tanks), and Wave 5+ Brains!',
      'Eliminate Brains quickly before they reprogram surviving humans into lethal chasing Progs.',
    ],
  },
  robotron2016evo: {
    id: 'robotron2016evo',
    title: 'Robotron: 2016 Evo',
    year: 2016,
    publisher: 'Williams / Evo',
    accentTextClass: 'text-rose-400',
    accentButtonClass: 'bg-rose-500 hover:bg-rose-400 text-white focus-visible:ring-rose-300',
    borderHoverClass: 'hover:border-rose-400/50',
    subtitle: '2016 Evo · Psychedelic Melt-O-Vision Feedback · Chromatic RGB · Overdrive & Melt-Nova',
    controls: [
      { key: 'WASD / Arrows / Tilt', desc: 'Weave through reactive warping Melt-O-Vision battle grids' },
      { key: 'Mouse + Click / Space', desc: '360° Twin-Stick Hyper-Plasma (auto-evolves through 4 Overdrive tiers!)' },
      { key: 'Shift / X', desc: 'Detonate MELT-NOVA Shockwave (vaporizes projectiles & melts hordes!)' },
    ],
    tips: [
      'Chain rapid kills & rescue Last Family survivors to surge your Overdrive Multiplier through Single → Twin → Triple Fan → Prism Rail!',
      'Fill your Melt-Nova meter and fire Shift/X to unleash a chromatic RGB shockwave that shreds Enforcers, Tanks & Brains!',
      'Every 5th wave summons a towering Overlord Motherbrain—dodge its radial plasma rings and shatter its core!',
    ],
  },
  frogger: {
    id: 'frogger',
    title: 'Frogger',
    year: 1981,
    publisher: 'Konami / Sega',
    accentTextClass: 'text-green-400',
    accentButtonClass: 'bg-green-500 hover:bg-green-400 text-slate-950 focus-visible:ring-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    subtitle: '1981 · 5-Lane Highway · Diving Turtles, Snapping Gators, Median Snakes & Lady Frog',
    controls: [
      { key: 'Arrows / WASD', desc: 'Hop one crisp lane in any direction' },
      { key: 'Space / Z', desc: 'Quick forward hop' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Watch red turtle pods carefully—they flash as a warning just before diving underwater!',
      'Ride the backs of Alligators safely, never their snapping jaws, and pick up pink Lady Frogs on logs for +200!',
      'Snatch buzzing Bonus Flies in empty lily pad alcoves while avoiding sneaking alcove alligators.',
    ],
  },
  frogger2: {
    id: 'frogger2',
    title: 'Frogger II: ThreeeDeep!',
    year: 1984,
    publisher: 'Parker Bros / Sega',
    accentTextClass: 'text-sky-400',
    accentButtonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    subtitle: '1984 · 3-Zone Vertical Odyssey · Underwater Reef → Surface Lagoon → Sky Kingdom',
    controls: [
      { key: 'Arrows / WASD', desc: 'Swim reef currents, hop surface rafts & leap clouds' },
      { key: 'Space / Z', desc: 'Quick upward hop / ascent' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Zone 1 (Underwater): dodge killer whales, sharks, subs & electric eels while riding glowing bubble rafts up to the surface!',
      'Zone 2 (Surface): hop across rafts, boats, and diving hippos—watch out for hippos submerging beneath your feet.',
      'Zone 3 (Sky Kingdom): leap across drifting clouds, biplanes, and balloons to claim all 3 rainbow Sky Island nests!',
    ],
  },
  joust: {
    id: 'joust',
    title: 'Joust',
    year: 1982,
    publisher: 'Williams',
    accentTextClass: 'text-amber-400',
    accentButtonClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950 focus-visible:ring-amber-200',
    borderHoverClass: 'hover:border-amber-400/50',
    subtitle: '1982 · Volcanic Colosseum · Bounders, Hunters & Shadow Lords · Lava Troll & Pterodactyl',
    controls: [
      { key: 'Left / Right / Tilt', desc: 'Precision gallop & aerial ostrich steering' },
      { key: 'Space / Up / W', desc: 'Flap ostrich wings (tap fast to escape Lava Troll!)' },
      { key: 'Shift / X / Down', desc: 'Skid Brake with sparks on stone ledges' },
    ],
    tips: [
      'Strike Buzzard Knights with your lance HIGHER than theirs—equal height triggers a sparking Lance Clash bounce!',
      'Snatch falling Eggs in MID-AIR (+500 bonus) before they hatch into tougher Hunters or Shadow Lords.',
      'Beware crumbling outer magma bridges—and level your lance directly into a swooping Pterodactyl’s open mouth for +1,000!',
    ],
  },
  pengo: {
    id: 'pengo',
    title: 'Pengo',
    year: 1982,
    publisher: 'Coreland / Sega',
    accentTextClass: 'text-sky-400',
    accentButtonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    subtitle: '1982 · 13×15 Polar Ice Maze · Multi-Squash Combos · Wall Shake & 3 Diamond Blocks',
    controls: [
      { key: 'Arrows / WASD', desc: 'Waddle Pengo through 5 color-coded Polar Acts' },
      { key: 'Space / Z', desc: 'Slide ice block, shatter backed cube, or electrify outer wall' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Crush 1, 2, 3, or 4 Sno-Bees in a single ice slide for 400 / 1,600 / 3,200 / 6,400 combo points!',
      'Align all 3 golden Diamond Blocks in a row (10,000 pts open field, 5,000 on wall) to freeze every Sno-Bee solid!',
      'Push any outer perimeter wall to ripple a shockwave that stuns edge Sno-Bees—then waddle over them to stomp (+100)!',
    ],
  },
  popeye: {
    id: 'popeye',
    title: 'Popeye',
    year: 1982,
    publisher: 'Nintendo',
    accentTextClass: 'text-blue-400',
    accentButtonClass: 'bg-blue-500 hover:bg-blue-400 text-white focus-visible:ring-blue-300',
    borderHoverClass: 'hover:border-blue-400/50',
    subtitle: '1982 · All 3 Authentic Stages · The Docks, Sweet Haven Seesaw & Pirate Ship',
    controls: [
      { key: 'Arrows / WASD', desc: 'Run decks, wrap sides & climb ladders/stairs' },
      { key: 'Space / Z', desc: 'Throw Popeye’s punch (shatters bottles, skulls & drops barrel!)' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Stage 1 (The Docks): punch the hanging Punching Bag to drop the barrel onto Brutus’s head for a hilarious stun!',
      'Stage 2 (Sweet Haven): bounce on Wimpy’s Teeter-Totter Seesaw to rocket up and rescue Swee’Pea for +1,500!',
      'Stage 3 (Pirate Ship): ride the moving deck elevator, dodge Bernard the Vulture, and grab Spinach to KO Brutus (+3,000)!',
    ],
  },
  mrdo: {
    id: 'mrdo',
    title: 'Mr. Do!',
    year: 1982,
    publisher: 'Universal',
    accentTextClass: 'text-red-400',
    accentButtonClass: 'bg-red-500 hover:bg-red-400 text-white focus-visible:ring-red-300',
    borderHoverClass: 'hover:border-red-400/50',
    subtitle: '1982 · 2.5D Orchard Tunneling · 8-Cherry Chains · Bouncing Powerball, Physics Apples & EXTRA',
    controls: [
      { key: 'Arrows / WASD / Tilt', desc: 'Tunnel through 2.5D orchard soil & push red Apples' },
      { key: 'Space / Z', desc: 'Launch bouncing Powerball along carved tunnels' },
      { key: 'Shift / X', desc: 'Instant quick-turn 180° inside narrow tunnels' },
    ],
    tips: [
      'Eat 8 cherries in quick succession for the +500 Cherry Chain burst & fanfare!',
      'Dig beneath giant Apples to drop them onto pursuing Red Monsters & Blue Diggers for 1,000→8,000 chains & rare 8,000-pt Diamonds!',
      'Grab the glowing Center Prize Treat to summon the E-X-T-R-A Alphamonster and light all 5 marquee letters for an Extra Life!',
    ],
  },
  mrdocastle: {
    id: 'mrdocastle',
    title: 'Mr. Do’s Castle',
    year: 1983,
    publisher: 'Universal',
    accentTextClass: 'text-amber-400',
    accentButtonClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950 focus-visible:ring-amber-200',
    borderHoverClass: 'hover:border-amber-400/50',
    subtitle: '1983 · 5-Tier Medieval Castle · Heavy Hammer · Tilting Ladders · Unicorns & 3-Key Crown EXTRA',
    controls: [
      { key: 'Arrows / WASD / Tilt', desc: 'Run castle floors & climb fixed or tilting ladders' },
      { key: 'Space / Z', desc: 'Swing Heavy Hammer to smash Cherry, Key & Stone blocks' },
      { key: 'Shift / X', desc: 'Manually flip a nearby blue tilting ladder' },
    ],
    tips: [
      'Smash floor blocks with Mr. Do’s Heavy Hammer to drop them straight onto pursuing Red, Green & Blue Unicorns below!',
      'Walking across the top of a blue tilting ladder flips its lean—use it to steer Unicorns away from you!',
      'Knock out all 3 Golden Key Blocks to unlock the top Crown Door, claim the Crown, and crush E-X-T-R-A Letter Unicorns!',
    ],
  },
  spyhunter: {
    id: 'spyhunter',
    title: 'Spy Hunter',
    year: 1983,
    publisher: 'Bally Midway',
    accentTextClass: 'text-slate-200',
    accentButtonClass: 'bg-slate-200 hover:bg-white text-slate-950 focus-visible:ring-slate-300',
    borderHoverClass: 'hover:border-slate-300/50',
    subtitle: '1983 · G-6155 Interceptor · Boat House River Transform · Weapons Van & Mad Bomber',
    controls: [
      { key: 'Arrows / WASD / Tilt', desc: 'Steer G-6155 Interceptor / Spy Boat & modulate speed' },
      { key: 'Space / Z', desc: 'Fire dual hood machine guns (never shoot civilian cars!)' },
      { key: 'Shift / X', desc: 'Deploy Oil Slick, Smoke Screen, or Surface-to-Air Missiles' },
    ],
    tips: [
      'Pull cleanly into the Red Weapons Van’s rear ramp to restock Oil Slicks, Smoke Screens, and Anti-Chopper SAM Missiles!',
      'Enter glowing BOAT HOUSE forks to transform your G-6155 into the armored Spy Boat across river stages with Doctor Torpedo!',
      'Knock wheel-slashing Switch Blades & armored Road Lords off the road while locking SAM Missiles onto the Mad Bomber chopper!',
    ],
  },
  spyhunter2: {
    id: 'spyhunter2',
    title: 'Spy Hunter II',
    year: 1987,
    publisher: 'Bally Midway',
    accentTextClass: 'text-yellow-400',
    accentButtonClass: 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 focus-visible:ring-yellow-200',
    borderHoverClass: 'hover:border-yellow-400/50',
    subtitle: '1987 · 3D Behind-the-Car Chase · G-8155 + Yellow Wingman · Seeker Missiles, Flames & Pyro Gyro',
    controls: [
      { key: 'Arrows / WASD / Tilt', desc: 'Steer G-8155 down 3D curving highways & snow passes' },
      { key: 'Space / Z', desc: 'Fire heavy cannon & track Seeker Missiles' },
      { key: 'Shift / X', desc: 'Trigger Weapons Van gadget (Oil, Smoke, Flame Jets, Seeker Missiles, Spikes)' },
    ],
    tips: [
      'Race alongside your AI Yellow Wingman Interceptor in authentic 1987 behind-the-car 3D chase perspective!',
      'Dock with the Red Weapons Van to cycle through Oil Slicks, Smoke Screens, Flame Jets, Spiked Tires & Seeker Missiles.',
      'Blast armored Road Lords, Switchblade bikes, Molotov Maniacs & overhead Pyro Gyro helicopters across 4 road zones!',
    ],
  },
  tapper: {
    id: 'tapper',
    title: 'Tapper',
    year: 1983,
    publisher: 'Bally Midway',
    accentTextClass: 'text-red-400',
    accentButtonClass: 'bg-red-500 hover:bg-red-400 text-white focus-visible:ring-red-300',
    borderHoverClass: 'hover:border-red-400/50',
    subtitle: '1983 · Authentic Budweiser Evolution · 4 Saloons · Can-Can Tip Show & Shaken Can Bonus',
    controls: [
      { key: 'Up / Down (W / S)', desc: 'Snap instantly between all 4 mahogany Budweiser bar taps' },
      { key: 'Left / Right (A / D)', desc: 'Sprint along the bar to scoop returning mugs & golden Tips' },
      { key: 'Space / Z', desc: 'Fill frothy draft from brass keg & slide down bar (or pick can in Bonus!)' },
    ],
    tips: [
      'Serve Cowboys, Jocks, Punk Rockers, and Aliens across all 4 authentic Bally Midway saloons—catch every sliding empty mug!',
      'Sprint down the counter to grab glowing Tips ($1,500) and trigger the authentic Can-Can Dancer show that distracts patrons!',
      'Between stages, track the unshaken can during the playable Bandit Shaken Can Bonus Round for +3,000 pts!',
    ],
  },
  roottapper: {
    id: 'roottapper',
    title: 'Root Beer Tapper',
    year: 1984,
    publisher: 'Bally Midway',
    accentTextClass: 'text-orange-400',
    accentButtonClass: 'bg-orange-500 hover:bg-orange-400 text-slate-950 focus-visible:ring-orange-200',
    borderHoverClass: 'hover:border-orange-400/50',
    subtitle: '1984 · Authentic Root Beer Evolution · Frothy Soda Kegs · 4 Saloons & Shaken Can Bonus',
    controls: [
      { key: 'Up / Down (W / S)', desc: 'Zip between all 4 frosty Root Beer fountain taps' },
      { key: 'Left / Right (A / D)', desc: 'Dash down the oak bar to catch empty mugs & glowing Tips' },
      { key: 'Space / Z', desc: 'Pour & slide creamy Root Beer mugs (and pick the unshaken can in Bonus!)' },
    ],
    tips: [
      'Authentic 1984 Bally Midway soda-fountain edition featuring oak barrel Root Beer kegs, creamy foam trails & 4 vibrant saloons!',
      'Grab Tips on the bar for +1,500 and a stage-wide Can-Can Dancer distraction whenever patrons surge!',
      'Keep your eyes locked on the untouched Root Beer can during the Bandit Shaken Can Bonus Round for +3,000!',
    ],
  },
  puzzlebobble: {
    id: 'puzzlebobble',
    title: 'Puzzle Bobble',
    year: 1994,
    publisher: 'Taito',
    accentTextClass: 'text-emerald-400',
    accentButtonClass: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 focus-visible:ring-emerald-200',
    borderHoverClass: 'hover:border-emerald-400/50',
    subtitle: '1994 · 2.5D Shimmer Edition · Animated Bub & Bob · Bank Shots & Avalanche Drops',
    controls: [
      { key: 'Left / Right / Mouse / Touch', desc: 'Crank Bub & Bob’s golden Bubble Launcher' },
      { key: 'Space / Click / Up', desc: 'Launch shimmering 2.5D jewel bubble' },
      { key: 'Shift / X / Down', desc: 'Quick-swap active orb with Bub’s basket' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Use the sparkling bank-shot preview line to bounce bubbles off crystal pillars into high anchor clusters!',
      'Popping a top anchor unleashes bouncing gravity avalanches for huge cascading bonus points.',
      'Watch Bub & Bob cheer on chains—and hurry when they start sweating near the warning rope!',
    ],
  },
  puzzlebobble2: {
    id: 'puzzlebobble2',
    title: 'Puzzle Bobble 2',
    year: 1995,
    publisher: 'Taito',
    accentTextClass: 'text-pink-400',
    accentButtonClass: 'bg-pink-500 hover:bg-pink-400 text-white focus-visible:ring-pink-300',
    borderHoverClass: 'hover:border-pink-400/50',
    subtitle: '1995 · Bust-A-Move Again 2.5D · Star Bubbles · Chack’n Fairy Rescue & Iron Balls',
    controls: [
      { key: 'Left / Right / Mouse / Touch', desc: 'Aim precision Bubble Launcher' },
      { key: 'Space / Click / Up', desc: 'Fire shimmering color or Star bubble' },
      { key: 'Shift / X / Down', desc: 'Swap active bubble with next basket orb' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Hit a sparkling Star Bubble with any color to instantly vaporize EVERY bubble of that color on screen!',
      'Clear every bubble touching a glowing Fairy Core to free the winged Chack’n sprite for a +2,500 rescue clear!',
      'Indestructible riveted Iron Balls can’t be matched—pop their top supports to drop them in an avalanche.',
    ],
  },
  puzzlebobble3: {
    id: 'puzzlebobble3',
    title: 'Puzzle Bobble Evo',
    year: 1998,
    publisher: 'Taito / Evo',
    accentTextClass: 'text-yellow-400',
    accentButtonClass: 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 focus-visible:ring-yellow-200',
    borderHoverClass: 'hover:border-yellow-400/50',
    subtitle: '2.5D Prism Evolution · Pulley Balance Scales · Rainbow, Bomb, Lightning & Crystal Boss',
    controls: [
      { key: 'Left / Right / Mouse / Touch', desc: 'Aim 2.5D Prism Cannon (Dual-Bank sight in Fever!)' },
      { key: 'Space / Click / Up', desc: 'Fire Rainbow Wildcards, Bombs, Lightning & Jewel Orbs' },
      { key: 'Shift / X / Down', desc: 'Swap loaded orb with reserve basket orb' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Drop left/right avalanches onto the Twin Pulley Balance Scales to trigger a Pulley Lift that pushes the ceiling back up!',
      'Chain consecutive matches to ignite Rainbow Fever ×2, unlocking dual-bank laser sights and extra special orbs.',
      'Crack diamond-shelled Prism Orbs with adjacent pops, zap rows with Lightning, and shatter the Stage 6 Crystal Boss Core!',
    ],
  },
  crystalcastles: {
    id: 'crystalcastles',
    title: 'Crystal Castles',
    year: 1983,
    publisher: 'Atari',
    accentTextClass: 'text-purple-400',
    accentButtonClass: 'bg-purple-500 hover:bg-purple-400 text-white focus-visible:ring-purple-300',
    borderHoverClass: 'hover:border-purple-400/50',
    subtitle: '1983 · 8 3D Castles · Sculpted Stairs & Elevators · Expressive Bentley Bear · Berthilda',
    controls: [
      { key: 'Arrows / WASD / Mouse / Tilt', desc: 'Precision isometric steering across stairs & crystal lifts' },
      { key: 'Space / Click', desc: 'Jump over ledges, moat gaps, Gem Eaters & Crystal Balls' },
      { key: 'Shift / X', desc: 'Bear Dash / Golden Magic Hat Dash burst' },
    ],
    tips: [
      'Climb sculpted 3D staircases and ride glowing moving Crystal Elevators up to high towers across 8 castles!',
      'Jump over Gem Eaters—or catch them while they flash gold munching a gem to knock them out (+1,000)!',
      'Don the starry Magic Hat to defeat Berthilda the Witch (+3,000), and jump onto cyan Warp Pads to skip ahead!',
    ],
  },
  rampage: {
    id: 'rampage',
    title: 'Rampage',
    year: 1986,
    publisher: 'Bally Midway',
    accentTextClass: 'text-green-400',
    accentButtonClass: 'bg-green-500 hover:bg-green-400 text-slate-950 focus-visible:ring-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    subtitle: '1986 · 6 Destructible Cities · George, Lizzie & Ralph · Structural Collapse & Choppers',
    controls: [
      { key: 'Arrows / WASD', desc: 'Stomp streets & climb skyscraper windows' },
      { key: 'Space / Z', desc: 'Smash facade, swat helicopters & devour window loot' },
      { key: 'Shift / X', desc: 'Leap across roofs (or stand still on street to swap monster)' },
      { key: 'R', desc: 'Instant swap: George (Ape) / Lizzie (Dino) / Ralph (Wolf)' },
    ],
    tips: [
      'Crack windows for juicy Roasts, Citizens, and Cash—watch out for shocking Toasters, green Poison, and Dynamite!',
      'Once a skyscraper hits 58% damage it cascades downward—leap to the next building before riding the rubble!',
      'Swat military Helicopters straight out of the sky and crush Tanks across Peoria, Chicago, NYC, SF, Tokyo & DC!',
    ],
  },
  dragonslair: {
    id: 'dragonslair',
    title: 'Dragon’s Lair',
    year: 1983,
    publisher: 'Cinematronics',
    accentTextClass: 'text-yellow-400',
    accentButtonClass: 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 focus-visible:ring-yellow-200',
    borderHoverClass: 'hover:border-yellow-400/50',
    subtitle: '1983 · Dirk the Daring · Animated Reflex Gauntlet · Rescue Daphne',
    controls: [
      { key: 'Arrows / WASD', desc: 'Execute directional dodge/leap cues' },
      { key: 'Space / Z', desc: 'Draw Sword & strike on golden sword cue!' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Watch each animated chamber closely—press the highlighted direction or Sword cue right as it flashes!',
      'Chain flawless reflexes across the Drawbridge, Tentacles, Fire Pit, and Lizard King.',
      'Reach the Dragon’s Lair to slay Singe and rescue Princess Daphne!',
    ],
  },
  smw1: {
    id: 'smw1',
    title: 'Super Mario World',
    year: 1990,
    publisher: 'Nintendo',
    accentTextClass: 'text-yellow-400',
    accentButtonClass: 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 focus-visible:ring-yellow-200',
    borderHoverClass: 'hover:border-yellow-400/50',
    subtitle: '1990 · Dinosaur Land · Ride Yoshi · Cape Feather Glide & Spin Jump',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Run across Yoshi’s Island & Donut Plains' },
      { key: 'Space / Up', desc: 'Jump (Hold while gliding with Cape Feather!)' },
      { key: 'Shift / X', desc: 'Sprint, Yoshi Tongue Gulp & Cape Spin Attack' },
    ],
    tips: [
      'Crack Yoshi Eggs to ride Yoshi—press Shift/X to extend Yoshi’s tongue and gulp Koopas!',
      'Grab the golden Cape Feather to spin-whip foes and glide smoothly over wide chasms.',
      'Collect all 5 giant Dragon Coins per stage and hit the moving Giant Gate tape high for bonus stars!',
    ],
  },
  smw2: {
    id: 'smw2',
    title: 'Yoshi’s Island (SMW 2)',
    year: 1995,
    publisher: 'Nintendo',
    accentTextClass: 'text-green-400',
    accentButtonClass: 'bg-green-500 hover:bg-green-400 text-slate-950 focus-visible:ring-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    subtitle: '1995 · Hand-Drawn Island · Flutter Jump · Egg Aiming & Baby Mario',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Run across pastel storybook hills' },
      { key: 'Space / Up', desc: 'Jump — hold mid-air for Yoshi’s Flutter Jump!' },
      { key: 'Shift / X / Down', desc: 'Gulp Shy Guys into Eggs & throw aimed Eggs' },
    ],
    tips: [
      'Hold Jump mid-air to Flutter-Kick higher and reach elevated Red Coins and Smiling Flowers!',
      'Swallow Shy Guys to build a trailing chain of up to 6 spotted Eggs, then launch them at winged clouds!',
      'If hit, quickly pop Baby Mario’s floating bubble before the star countdown reaches zero.',
    ],
  },
  ys1: {
    id: 'ys1',
    title: 'Ys Book I: Ancient Ys Vanished',
    year: 1987,
    publisher: 'Nihon Falcom · TurboGrafx-CD',
    accentTextClass: 'text-red-400',
    accentButtonClass: 'bg-red-500 hover:bg-red-400 text-white focus-visible:ring-red-300',
    borderHoverClass: 'hover:border-red-400/50',
    subtitle: 'TurboGrafx-CD · 4×-Scale 2.5D Exploration & Investigation RPG · Minea, Esteria, Shrine & Darm Tower',
    controls: [
      { key: 'Arrows / WASD / Tilt', desc: 'Explore 4×-scale 2.5D worlds, walk behind trees, & jump into shrubs' },
      { key: 'Space / Z / Enter', desc: 'Investigate signs/statues/shrubs, talk to NPCs, shop, or Sword Dash' },
      { key: 'Shift / X', desc: 'Toggle Full World Exploration Map & Quest Journal' },
    ],
    tips: [
      'Walk right into flowering shrubs & ferns (or press Space) to rustle them and uncover hidden Gold, Heal Herbs, Roda Seeds (+10 Max HP), and Sara’s Sapphire Crystal!',
      'Walk north behind tall trees and cottage roofs to slip underneath 2.5D canopies, and inspect Fountains, Statues, Signs, Crates & the Ancient Roda Tree.',
      'Pass through the wide glowing North Gate in Minea Town to enter Esteria Plains, raid the Shrine of Solomon (Jenocres), and ascend Darm Tower (Dark Fact)!',
    ],
  },
  ys2: {
    id: 'ys2',
    title: 'Ys Book II: The Final Chapter',
    year: 1988,
    publisher: 'Nihon Falcom · TurboGrafx-CD',
    accentTextClass: 'text-sky-400',
    accentButtonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    subtitle: 'TurboGrafx-CD · 4×-Scale 2.5D World RPG · Lance Village · Fire/Shield/Time Magic & Darm',
    controls: [
      { key: 'Arrows / WASD / Tilt', desc: 'Explore Floating Land of Ys, slip behind spires, & rustle shrubs' },
      { key: 'Space / Z / Enter', desc: 'Talk to Lilia / Dr. Flair / Shops, inspect shrines, or Sword Dash' },
      { key: 'Shift / X', desc: 'Cast blazing Fireball & Shield/Time Magic (uses MP)' },
    ],
    tips: [
      'Search the western Lance Village garden shrubs for the rare Celceta Blossom for Lilia, and inspect the Goddess Spring to fully restore HP & MP!',
      'Head through the wide North Gate into the sprawling Ruins of Moondoria, press Shift/X to blast enemies with Fire Magic, and unlock Shield & Time Magic Rings.',
      'Conquer Velagunder, cross the glacial spires of Ice Ridge of Noltia (Tyalmath), and vanquish Darm in the Solomon Core!',
    ],
  },
  mule: {
    id: 'mule',
    title: 'M.U.L.E.',
    year: 1983,
    publisher: 'Ozark / Electronic Arts',
    accentTextClass: 'text-amber-400',
    accentButtonClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950 focus-visible:ring-amber-200',
    borderHoverClass: 'hover:border-amber-400/50',
    subtitle: '1983 HD Remaster · 8 Illustrated Species · Walk-In Colony Store, Assay Office & Live Auctions',
    controls: [
      { key: 'Arrows / WASD', desc: 'Choose Species, claim plots, walk Irata & Store bays, trade' },
      { key: 'Space / Z / Click', desc: 'Claim plot, enter Irata Town Store, install M.U.L.E., Assay or Pub' },
      { key: 'Shift / X', desc: 'Cycle preferred M.U.L.E. outfit quick-preset' },
    ],
    tips: [
      'Walk into central Irata Town and press Space to enter the illustrated Colony Store, Assay Office & Pub corridor!',
      'Assay your owned plots to reveal hidden Crystite richness (LOW / MED / HIGH) before outfitting expensive Crystite M.U.L.E.s.',
      'Catch the animated Mountain Wampus for instant cash, watch out for runaway M.U.L.E.s, and beat rivals on the visual Auction bar chart!',
    ],
  },
  muleevo: {
    id: 'muleevo',
    title: 'M.U.L.E. Returns: Evolved',
    year: 2026,
    publisher: 'Evolution Edition',
    accentTextClass: 'text-cyan-400',
    accentButtonClass: 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 focus-visible:ring-cyan-200',
    borderHoverClass: 'hover:border-cyan-400/50',
    subtitle: 'Evolved Edition · Live 4-Colonist Spy-HUD · Synergy Conduits · Mk III Rigs · Jet-Dash & Geo-Scan',
    controls: [
      { key: 'Arrows / WASD', desc: 'Select Commander, claim sectors, walk Irata & Plaza bays, trade' },
      { key: 'Space / Z / Click', desc: 'Enter Megadome Plaza, install M.U.L.E./Shield, or Upgrade plot (Mk I→III)' },
      { key: 'Shift / X', desc: 'Jet-Dash Sprint on map · Accept Private Rival Deal in Exchange' },
    ],
    tips: [
      'Place matching outfits on adjacent owned plots to forge glowing Synergy Conduits (+1 yield per link)!',
      'Stand on any outfitted plot you own with empty tether and press Space to upgrade it to Mk II and Mk III machinery!',
      'Race live AI colonists for dropping Orbital Supply Pods and Golden Wampuses, time the Cantina 2× Jackpot bar, and accept high-margin Private Rival Deals!',
    ],
  },
};

export function createClassicArcadeGame(id: ClassicArcadeGameId): ArcadeGameInstance {
  switch (id) {
    case 'centipede':
      return new CentipedeGame();
    case 'millipede':
      return new MillipedeGame();
    case 'digdug':
      return new DigDugGame();
    case 'boulderdash':
      return new BoulderDashGame();
    case 'invaders':
      return new SpaceInvadersGame();
    case 'invaders2':
      return new SpaceInvaders2Game();
    case 'invadersdx':
      return new SpaceInvadersDxGame();
    case 'foodfight':
      return new FoodFightGame();
    case 'gauntlet':
      return new GauntletGame('gauntlet');
    case 'gauntlet2':
      return new GauntletGame('gauntlet2');
    case 'gauntletdl':
      return new GauntletDarkLegacyGame();
    case 'polepos':
      return new PolePositionGame('polepos');
    case 'polepos2':
      return new PolePositionGame('polepos2');
    case 'sprint1':
      return new SprintGame('sprint1');
    case 'sprint':
      return new SprintGame('sprint');
    case 'sprint4':
      return new SprintGame('sprint4');
    case 'sprint8':
      return new SprintGame('sprint8');
    case 'supersprint':
      return new SprintGame('supersprint');
    case 'champsprint':
      return new SprintGame('champsprint');
    case 'badlands':
      return new SprintGame('badlands');
    case 'superoffroad':
      return new SprintGame('superoffroad');
    case 'indyheat':
      return new SprintGame('indyheat');
    case 'defender':
      return new DefenderGame('defender');
    case 'defender2':
      return new DefenderGame('defender2');
    case 'stargate':
      return new DefenderGame('stargate');
    case 'tempest':
      return new Tempest1981Game();
    case 'tempest2000':
      return new Tempest2000Game();
    case 'tempest3000':
      return new Tempest3000Game();
    case 'mappy':
      return new MappyGame();
    case 'mariobros':
      return new MarioBrosGame();
    case 'dkong':
      return new DonkeyKongGame('dkong');
    case 'dkongjr':
      return new DonkeyKongGame('dkongjr');
    case 'dkong3':
      return new DonkeyKongGame('dkong3');
    case 'smb1':
      return new SuperMarioGame('smb1');
    case 'smb2':
      return new SuperMarioGame('smb2');
    case 'smb3':
      return new SuperMarioGame('smb3');
    case 'sonic1':
      return new SonicGame('sonic1');
    case 'sonic2':
      return new SonicGame('sonic2');
    case 'sonic3':
      return new SonicGame('sonic3');
    case 'superbreakout':
      return new BreakerArcadeGame('superbreakout');
    case 'arkanoid':
      return new BreakerArcadeGame('arkanoid');
    case 'arkanoid2':
      return new BreakerArcadeGame('arkanoid2');
    case 'breakout2016evo':
      return new Breakout2016EvoGame();
    case 'asteroidsdeluxe':
      return new VectorSpaceGame('asteroidsdeluxe');
    case 'spaceduel':
      return new VectorSpaceGame('spaceduel');
    case 'starcastle':
      return new VectorSpaceGame('starcastle');
    case 'missilecommand':
      return new MissileCommandGame();
    case 'qix':
      return new QixArcadeGame('qix');
    case 'superqix':
      return new QixArcadeGame('superqix');
    case 'galaxian':
      return new GalaxianShooterGame('galaxian');
    case 'galaga':
      return new GalaxianShooterGame('galaga');
    case 'phoenix':
      return new GalaxianShooterGame('phoenix');
    case 'gyruss':
      return new GalaxianShooterGame('gyruss');
    case 'scramble':
      return new ScrambleArcadeGame();
    case 'moonpatrol':
      return new ScrollingShooterGame('moonpatrol');
    case 'timepilot':
      return new TimePilotArcadeGame('timepilot');
    case 'timepilot84':
      return new TimePilotArcadeGame('timepilot84');
    case 'timepilot2016evo':
      return new TimePilotArcadeGame('timepilot2016evo');
    case 'ww1942':
      return new Ww1942Game();
    case 'ww1943':
      return new Ww1943Game();
    case 'starwars':
      return new StarWars1983Game();
    case 'starwarsesb':
      return new StarWarsEsbGame();
    case 'starwarsrotj':
      return new StarWarsRotjGame();
    case 'berzerk':
      return new BerzerkGame();
    case 'robotron':
      return new RobotronArcadeGame();
    case 'robotron2016evo':
      return new RobotronEvoGame();
    case 'frogger':
      return new FroggerArcadeGame('frogger');
    case 'frogger2':
      return new FroggerArcadeGame('frogger2');
    case 'joust':
      return new JoustGame();
    case 'pengo':
      return new PengoArcadeGame();
    case 'popeye':
      return new PopeyeArcadeGame();
    case 'mrdo':
      return new MrDoArcadeGame();
    case 'mrdocastle':
      return new MrDosCastleGame();
    case 'spyhunter':
      return new SpyHunterArcadeGame();
    case 'spyhunter2':
      return new SpyHunter2ArcadeGame();
    case 'tapper':
      return new TapperArcadeGame(false);
    case 'roottapper':
      return new TapperArcadeGame(true);
    case 'puzzlebobble':
      return new PuzzleBobbleGame('puzzlebobble');
    case 'puzzlebobble2':
      return new PuzzleBobbleGame('puzzlebobble2');
    case 'puzzlebobble3':
      return new PuzzleBobbleGame('puzzlebobble3');
    case 'crystalcastles':
      return new CrystalCastlesGame();
    case 'rampage':
      return new RampageArcadeGame();
    case 'dragonslair':
      return new DragonsLairArcadeGame();
    case 'smw1':
      return new MarioWorldGame('smw1');
    case 'smw2':
      return new MarioWorldGame('smw2');
    case 'ys1':
      return new YsBookRpgGame('ys1');
    case 'ys2':
      return new YsBookRpgGame('ys2');
    case 'mule':
      return new MuleArcadeGame();
    case 'muleevo':
      return new MuleEvoArcadeGame();
  }
}

export function isClassicArcadeGameId(id: string): id is ClassicArcadeGameId {
  return id in CLASSIC_CABINET_SPECS;
}
