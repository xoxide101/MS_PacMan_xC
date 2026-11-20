import { ClassicArcadeGameId } from './arcadeTypes';
import { BoulderDashGame } from './boulderdashGame';
import { CentipedeGame } from './centipedeGame';
import { ArcadeGameInstance } from './classicArcadeInterface';
import { DefenderGame } from './defenderGame';
import { DigDugGame } from './digdugGame';
import { DonkeyKongGame } from './donkeyKongGame';
import { FoodFightGame } from './foodfightGame';
import { GauntletGame } from './gauntletGame';
import { SpaceInvaders2Game } from './invaders2Game';
import { SpaceInvadersGame } from './invadersGame';
import { MappyGame } from './mappyGame';
import { MarioBrosGame } from './marioBrosGame';
import { MillipedeGame } from './millipedeGame';
import { PolePositionGame } from './polePositionGame';
import { SonicGame } from './sonicGame';
import { SprintGame } from './sprintGame';
import { SuperMarioGame } from './superMarioGame';
import { TempestGame } from './tempestGame';

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
    subtitle: '1981 · Splitting Chains · Spiders, Fleas & Poisoning Scorpions',
    controls: [
      { key: 'Arrows / WASD / Mouse', desc: 'Move blaster in lower zone' },
      { key: 'Space / Click', desc: 'Rapid-fire plasma shots' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Shoot a middle segment to split the centipede and turn it into a mushroom.',
      'Poisoned magenta mushrooms make centipedes dive straight down—clear them fast.',
      'Hit the bouncing spider up close for 900 points.',
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
    subtitle: '1982 · DDT Bomb Blasts · Inchworm Slow-Mo · Beetles & Mosquitoes',
    controls: [
      { key: 'Arrows / WASD / Mouse', desc: 'Move blaster freely' },
      { key: 'Space / Click', desc: 'Fire plasma bolts' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Shoot red DDT canisters when bugs cluster nearby for massive 3× blast points.',
      'Blast the green Inchworm to trigger temporary slow-motion across all bugs.',
      'Watch out for Beetles—they turn mushrooms into diving-trigger flowers.',
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
    subtitle: '1982 · Tunnel Digging · Air Pump Harpoon · Falling Boulders',
    controls: [
      { key: 'Arrows / WASD', desc: 'Dig & navigate underground tunnels' },
      { key: 'Space / Z', desc: 'Fire harpoon & tap rapidly to inflate' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Tap Space 4 times while tethered to pop Pooka or Fygar (2× for side-pumping Fygar).',
      'Dig beneath rocks and lure chasing monsters into the shaft for 1,000–4,000 pt crushes.',
      'Drop two boulders in a round to spawn a bonus center vegetable.',
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
    subtitle: '1984 · 5 Underground Caves · Rolling Rock Physics · Butterflies',
    controls: [
      { key: 'Arrows / WASD', desc: 'Dig earth, collect gems & push rocks' },
      { key: 'Hold Space + Dir', desc: 'Snap-dig adjacent tile without moving' },
      { key: 'R', desc: 'Restart cave if trapped' },
    ],
    tips: [
      'Collect the required diamonds to unlock the glowing green exit door.',
      'Drop boulders onto blue Butterflies to turn them into a 3×3 burst of 9 diamonds.',
      'Boulders roll off rounded rocks and brick walls—plan escape lanes first.',
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
    subtitle: '1978 · 55-Alien Formation · Destructible Bunkers · Mystery Red UFO',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Slide laser cannon' },
      { key: 'Space / Up', desc: 'Fire laser bolt' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'The fewer invaders remain, the faster their march and bass heartbeat become.',
      'Carve thin sniping slots through your green bunkers for safer cover.',
      'Track your shots to nail the Red Mystery UFO for the 300-point jackpot.',
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
    subtitle: '1979 · Splitting Command Invaders · Dropship UFO · Rainbow Bonus',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Slide plasma cannon' },
      { key: 'Space / Up', desc: 'Fire laser bolt' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Top-row crimson Command Invaders split into two fast mini-divers when hit.',
      'Destroy the golden Dropship UFO quickly before it drops reinforcement invaders.',
      'Leave a bottom-row Octopus for last to score the 500-point Rainbow Bonus.',
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
    subtitle: '1983 · Race For The Melting Cone · 4 Chefs · 7 Food Piles',
    controls: [
      { key: 'Arrows / WASD', desc: 'Run Charley Chuck across the plaza' },
      { key: 'Space / Z', desc: 'Grab & hurl food from nearby piles' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Step near any glowing food pile and tap Space to hurl pies, melons, and tomatoes.',
      'Watch the black chef holes—Oscar, Angelo, Jacques, and Zorba emerge fast.',
      'Reach the Giant Ice Cream Cone on the right before it melts completely.',
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
    subtitle: '1985 · 4 Hero Classes · Monster Generators · Potions & Death',
    controls: [
      { key: 'Arrows / WASD', desc: '8-way dungeon movement' },
      { key: 'Space / Z', desc: 'Throw weapon / cast magic bolt' },
      { key: 'Shift / X', desc: 'Drink Magic Potion (destroys onscreen foes & Death)' },
      { key: 'R', desc: 'Cycle hero class (Warrior, Valkyrie, Wizard, Elf)' },
    ],
    tips: [
      'Health drains continuously—grab roast food, and avoid shooting food piles!',
      'Destroy bone and stone Monster Generators first to stop endless swarms.',
      'Save a Magic Potion for Death—regular weapons cannot harm him.',
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
    subtitle: '1986 · Fire-Breathing Dragons · Acid Puddles · Reflective Ricochet Shots',
    controls: [
      { key: 'Arrows / WASD', desc: '8-way dungeon movement' },
      { key: 'Space / Z', desc: 'Fire ricocheting weapons off stone walls' },
      { key: 'Shift / X', desc: 'Unleash Magic Potion screen blast' },
      { key: 'R', desc: 'Switch Hero Class anytime' },
    ],
    tips: [
      'Your projectiles bounce off dungeon walls—bank shots safely around corners!',
      'Steer clear of glowing green Acid Puddles that rapidly drain health.',
      'Watch for the Fire-Breathing Dragon boss guarding deeper treasure vaults.',
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
  sprint: {
    id: 'sprint',
    title: 'Sprint 2',
    year: 1976,
    publisher: 'Atari / Kee Games',
    accentTextClass: 'text-slate-200',
    accentButtonClass: 'bg-slate-200 hover:bg-white text-slate-950 focus-visible:ring-slate-300',
    borderHoverClass: 'hover:border-slate-300/50',
    subtitle: '1976 · Monochrome Phosphor Overhead Racer · Drift Physics & Oil Slicks',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Rotate & drift stock car' },
      { key: 'Up / Space', desc: 'Throttle accelerator' },
      { key: 'Down / S', desc: 'Brake / reverse' },
    ],
    tips: [
      'Feather the steering into hairpins to carry speed through the apex.',
      'Avoid dark oil slicks—they trigger a brief spinout that costs precious seconds.',
      'Finish 1st across 3 laps to advance to the next circuit layout.',
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
    subtitle: '1986 · Golden Wrenches · Auto-Upgrades · Mini-Tornadoes & 3 AI Rivals',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Steer Indy car smoothly' },
      { key: 'Up / Space', desc: 'Accelerate' },
      { key: 'Down / S', desc: 'Brake' },
    ],
    tips: [
      'Collect glowing golden Wrenches on the track—every 2 wrenches upgrade Speed, Turbo, or Traction!',
      'Dodge the roaming mini-tornadoes that swirl across the asphalt.',
      'Beat the Red, Yellow, and Green rivals across 3 laps to take the checkered flag.',
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
    subtitle: '1986 · Timed Shortcut Gates · Pro Circuits · Water & Oil Hazards',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Steer pro racer' },
      { key: 'Up / Space', desc: 'Accelerate' },
      { key: 'Down / S', desc: 'Brake' },
    ],
    tips: [
      'Watch the glowing shortcut gate on the inner wall—dash through while open to shave seconds!',
      'Steer around blue water puddles and black oil slicks to keep maximum grip.',
      'Snag bonus wrenches to boost acceleration and cornering grip for later circuits.',
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
    subtitle: '1981 · Wrap-Around Scanner Radar · Mid-Air Humanoid Rescues · Smart Bombs',
    controls: [
      { key: 'Arrows / WASD', desc: 'Thrust left/right & climb/dive' },
      { key: 'Space / Z', desc: 'Fire horizontal streaking laser' },
      { key: 'Shift / X', desc: 'Detonate Smart Bomb (clears screen)' },
    ],
    tips: [
      'Watch the top Williams Scanner to spot Landers abducting Humanoids across the planet.',
      'Shoot an abducting Lander mid-air, catch the falling Humanoid (+500), and land gently (+500)!',
      'If all 10 Humanoids perish, the planet explodes into relentless Mutant Space.',
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
    subtitle: '1981 · Inviso Cloak Shield · Warp Gate Rescue · Firebombers & Mutants',
    controls: [
      { key: 'Arrows / WASD', desc: 'Thrust & reverse instantly' },
      { key: 'Space / Z', desc: 'Fire streaking plasma laser' },
      { key: 'Shift / X', desc: 'Trigger Smart Bomb' },
      { key: 'R', desc: 'Toggle rechargeable Inviso Cloak' },
    ],
    tips: [
      'Tap R to engage your Inviso Cloak—you become invulnerable and can ram enemies!',
      'Fly into the glowing central Warp Gate to teleport directly to an endangered Humanoid.',
      'Keep an eye on Firebombers whose drifting mines track your altitude.',
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
    subtitle: '1981 · Stargate Hyperspace Portal · Inviso Cloak · Smart Bombs & Swarmers',
    controls: [
      { key: 'Arrows / WASD', desc: 'High-speed fighter thrust' },
      { key: 'Space / Z', desc: 'Fire neon laser beam' },
      { key: 'Shift / X', desc: 'Detonate Smart Bomb' },
      { key: 'R', desc: 'Activate Inviso Cloak' },
    ],
    tips: [
      'Fly into the cyan Stargate to warp directly to any Lander kidnapping a Humanoid.',
      'Keep 4+ Humanoids alive and enter the Stargate near wave end for a 2,000-pt Wave Warp!',
      'Combine Inviso Cloak (R) with Smart Bombs (Shift/X) to survive dense Swarmer pods.',
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
    subtitle: '1981 · 8 Geometric 3D Vector Tubes · Superzapper · Flippers & Spikers',
    controls: [
      { key: 'Left / Right / Mouse', desc: 'Spin Blaster Claw around tube rim' },
      { key: 'Space / Click', desc: 'Rapid-fire down active lane' },
      { key: 'Shift / X', desc: 'Fire Superzapper (full clear, then 1× zap)' },
    ],
    tips: [
      'Move your mouse around the rim for authentic arcade spinner precision, or use Left/Right.',
      'Shoot down emerald Spikes before clearing the wave so your 3D Warp Flight stays clear!',
      'Tankers split into two Flippers—clear them early before they reach the rim.',
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
    subtitle: '1994 · Psychedelic Vector Webs · Jump Thruster · Particle Laser & AI Droid',
    controls: [
      { key: 'Left / Right / Mouse', desc: 'Spin Blaster Claw around rim' },
      { key: 'Space / Click', desc: 'Fire Particle Laser' },
      { key: 'Up / W', desc: 'Jump off rim over Flippers (after pickup)' },
      { key: 'Shift / X', desc: 'Trigger Superzapper' },
    ],
    tips: [
      'Catch glowing Power-Up Capsules (L, J, D) sliding up the lanes to upgrade your Claw.',
      'Once Jump Thruster is unlocked, tap Up to hop above rim-crawling Flippers!',
      'Unlock the pink AI Droid for an orbiting automated wingman.',
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
    subtitle: '2000 · Translucent Prism-Glass Tubes · Triple Laser · Dual AI Droids',
    controls: [
      { key: 'Left / Right / Mouse', desc: 'Spin Blaster Claw around prism web' },
      { key: 'Space / Click', desc: 'Fire Triple-Stream Prism Laser' },
      { key: 'Up / W', desc: 'Jump Thruster leap off rim' },
      { key: 'Shift / X', desc: 'Discharge Superzapper' },
    ],
    tips: [
      'Starts equipped with Triple Prism Laser and Jump Thruster right from Level 1!',
      'Collect two Droid capsules to orbit Dual AI Droids blasting enemies simultaneously.',
      'Hold Fire during Hyper-Tube Warp to vaporize leftover lane spikes.',
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
    subtitle: '1983 · 6-Story Mansion · 4-Bounce Trampolines · Paired Loot & Microwave Doors',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Run floors & exit trampoline shafts' },
      { key: 'Space / Z', desc: 'Slam doors & trigger Microwave Beams' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Mappy is completely safe from cats while airborne in a trampoline shaft!',
      'Trampolines turn Green → Blue → Yellow → Red → SNAP on 4 straight bounces—land on a floor to reset!',
      'Collect matching treasure pairs back-to-back for 2×–6× bonus multipliers, and slam glowing doors to sweep cats!',
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
    subtitle: '1981 · Slanted Girders & Rivets · Rolling Barrels & Golden Hammer',
    controls: [
      { key: 'Arrows / WASD', desc: 'Run girders & climb blue ladders' },
      { key: 'Space / Z', desc: 'Jump over rolling barrels (+100)' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Grab a suspended Hammer to smash rolling barrels for 300–500 points each.',
      'Reach Pauline on the top girder to clear 25m, or pull all 8 yellow rivets to collapse 100m!',
      'Jump cleanly over approaching barrels for quick 100-point leap bonuses.',
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
    subtitle: '1982 · Dual-Vine Climbing · Falling Jungle Fruit · Rescue Papa Kong',
    controls: [
      { key: 'Arrows / WASD', desc: 'Climb vines (2 vines = fast up, 1 vine = fast down)' },
      { key: 'Space / Z', desc: 'Leap across jungle vines & gaps' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Hold between two adjacent vines to climb upward nearly twice as fast!',
      'Touch suspended tropical fruits to drop them onto Snapjaws climbing below (+800).',
      'Collect all 3 golden keys at the top deck to unlock Papa Kong’s cage.',
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
    subtitle: '1983 · Stanley’s Greenhouse · Bug Spray · Super Spray & 5 Flowers',
    controls: [
      { key: 'Arrows / WASD', desc: 'Move Stanley across 3 greenhouse decks' },
      { key: 'Space / Z', desc: 'Blast upward Bug Spray at DK & insects' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Spray Donkey Kong upward until his head hits the golden beehive at the top!',
      'Push DK halfway up to shake loose the flashing Super Spray can for hyper-rapid blasts.',
      'Intercept Buzzbees and Beespies before they steal your 5 potted flowers.',
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
    case 'foodfight':
      return new FoodFightGame();
    case 'gauntlet':
      return new GauntletGame('gauntlet');
    case 'gauntlet2':
      return new GauntletGame('gauntlet2');
    case 'polepos':
      return new PolePositionGame('polepos');
    case 'polepos2':
      return new PolePositionGame('polepos2');
    case 'sprint':
      return new SprintGame('sprint');
    case 'supersprint':
      return new SprintGame('supersprint');
    case 'champsprint':
      return new SprintGame('champsprint');
    case 'defender':
      return new DefenderGame('defender');
    case 'defender2':
      return new DefenderGame('defender2');
    case 'stargate':
      return new DefenderGame('stargate');
    case 'tempest':
      return new TempestGame('tempest');
    case 'tempest2000':
      return new TempestGame('tempest2000');
    case 'tempest3000':
      return new TempestGame('tempest3000');
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
  }
}

export function isClassicArcadeGameId(id: string): id is ClassicArcadeGameId {
  return id in CLASSIC_CABINET_SPECS;
}
