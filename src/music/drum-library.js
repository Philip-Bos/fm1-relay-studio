// Drum beat library: 10 genres × 10 beats, each generated as 16 bars with fills.
// Layers are "LANE:pattern" (16 steps, | is ignored). x=hit X=accent m=medium g=ghost.
// Lanes: K kick, B kick 2, S snare, C clap, H hat, O open hat, P pedal, R rim, N snare 2, L low tom, T hi tom, A crash, D ride, E shaker, G conga, W cowbell
export const LN = { K: 36, B: 35, S: 38, C: 39, H: 42, O: 46, P: 44, R: 37, N: 40, L: 43, T: 48, A: 49, D: 51, E: 70, G: 63, W: 56 };
export const VEL = { x: 100, X: 127, m: 70, g: 38 };
export const DRUMSETS = {
  "HOUSE": { sw: 0, crash: 1, ghost: 0, list: [
    ["Classic House", 124, "K:x...|x...|x...|x... C:....|x...|....|x... O:..x.|..x.|..x.|..x. H:x.x.|x.x.|x.x.|x.x."],
    ["Chicago Jack", 122, "K:x...|x...|x...|x... S:....|x...|....|x..x C:....|x...|....|x... H:mxmx|mxmx|mxmx|mxmx"],
    ["Deep House", 120, "K:x...|x...|x...|x..x C:....|x...|....|x... O:..x.|..x.|..x.|..x. R:.x..|..x.|.x..|..x. E:x.x.|x.x.|x.x.|x.xx"],
    ["Piano House", 126, "K:x...|x...|x...|x... C:....|x...|....|x... H:..x.|..x.|..x.|..x. G:...x|..x.|...x|.x.."],
    ["Disco House", 124, "K:x...|x...|x...|x... C:....|x...|....|x... H:mxmx|mxmx|mxmx|mxmx O:..x.|..x.|..x.|..x. W:...x|....|...x|...."],
    ["Tech House", 126, "K:x...|x...|x...|x... C:....|x...|....|x... R:..x.|...x|..x.|.x.. H:.x.x|.x.x|.x.x|.xxx"],
    ["Garage 2-Step", 130, "K:x...|.x..|..x.|.... S:....|x...|....|x... H:x.x.|x.x.|x.x.|x.xx"],
    ["Afro House", 122, "K:x...|x...|x...|x... C:....|x...|....|x... G:x..x|..x.|x..x|.x.. E:x.xx|x.xx|x.xx|x.xx O:..x.|..x.|..x.|..x."],
    ["Progressive", 128, "K:x...|x...|x...|x... C:....|x...|....|x... H:..x.|..x.|..x.|..x. E:mxmx|mxmx|mxmx|mxmx"],
    ["French Filter", 123, "K:x...|x...|x...|x... S:....|x...|....|x... H:xmxm|xmxm|xmxm|xmxm O:..x.|..x.|..x.|..x."]] },
  "TECHNO": { sw: 0, crash: 1, ghost: 0, list: [
    ["Warehouse", 132, "K:x...|x...|x...|x... H:..x.|..x.|..x.|..x. C:....|x...|....|x..."],
    ["Berlin Driver", 135, "K:x...|x...|x...|x... O:..x.|..x.|..x.|..x. H:.x.x|.x.x|.x.x|.x.x R:...x|..x.|...x|x..."],
    ["Rolling Rumble", 138, "K:x...|x...|x...|x... B:.xx.|.xx.|.xx.|.xxx C:....|x...|....|x... H:mxmx|mxmx|mxmx|mxmx"],
    ["Industrial", 140, "K:x...|x...|x...|x..x S:....|x...|....|x... H:x.x.|x.x.|x.x.|x.xx N:....|....|..x.|...."],
    ["Minimal", 128, "K:x...|x...|x...|x... R:..x.|...x|.x..|..x. H:.x..|.x..|.x..|.x.. E:x.x.|..xx|x.x.|.xx."],
    ["Acid Floor", 130, "K:x...|x...|x...|x... H:..x.|..x.|..x.|..x. O:...x|....|...x|.... C:....|x...|....|x..."],
    ["Peak Time", 134, "K:x...|x...|x...|x... C:....|x...|....|x... O:..x.|..x.|..x.|..x. H:xmxm|xmxm|xmxm|xmxm"],
    ["Dub Techno", 124, "K:x...|x...|x...|x... R:....|..x.|....|.x.. H:..x.|..x.|..x.|..x. E:.x..|..x.|.x..|...x"],
    ["Hard Techno", 145, "K:x...|x...|x...|x... B:..x.|..x.|..x.|..x. C:....|x...|....|x... H:x.x.|x.x.|x.x.|x.x."],
    ["Broken Techno", 132, "K:x...|..x.|x...|...x S:....|x...|....|x... H:x.xx|x.x.|x.xx|x.x. R:..x.|....|..x.|..x."]] },
  "HIP HOP": { sw: 35, crash: 0, ghost: 1, list: [
    ["Boom Bap", 90, "K:x...|..x.|.x..|..x. S:....|x...|....|x... H:x.x.|x.x.|x.x.|x.x."],
    ["Dilla Slump", 88, "K:x...|..gx|..x.|.g.. S:....|x...|....|x..g H:x.x.|x.x.|x.x.|x.xx"],
    ["East Coast", 94, "K:x...|...x|x...|..x. S:....|x...|....|x... H:x.xx|x.x.|x.xx|x.x."],
    ["West Coast", 92, "K:x...|....|..x.|.... S:....|x...|....|x... C:....|x...|....|x... H:x.x.|x.x.|x.x.|x.x. E:..x.|....|..x.|..x."],
    ["Lazy Soul", 82, "K:x...|...x|..x.|.... S:....|x...|....|x... R:.x..|....|.x..|.... H:x.x.|x.x.|x.x.|x.x."],
    ["Jazzy Hop", 86, "K:x...|..x.|...x|..x. S:....|x..g|....|x... D:x..x|..x.|x..x|..x."],
    ["Chopped", 90, "K:x..x|..x.|x...|..x. S:....|x...|....|x..x H:x.x.|x.xx|x.x.|x.xx"],
    ["Cloud Rap", 78, "K:x...|....|..x.|..x. C:....|x...|....|x... H:x.xx|x.x.|x.xx|x.xx O:...x|....|...x|...."],
    ["Memphis", 85, "K:x...|....|x...|..x. S:....|x...|....|x... H:mxmx|mxmx|mxmx|mxmx L:....|....|....|.x.."],
    ["Old School", 96, "K:x...|..x.|x...|..x. S:....|x...|....|x... H:x.x.|x.x.|x.x.|x.x. O:....|..x.|....|..x."]] },
  "TRAP": { sw: 0, crash: 0, ghost: 0, list: [
    ["Atlanta", 140, "K:x...|..x.|..x.|.... C:....|....|x...|.... H:x.x.|x.x.|x.x.|x.xx O:...x|....|....|...."],
    ["Drill", 142, "K:x...|..x.|...x|..x. C:....|....|x...|.... H:x.xx|x.xx|x.xx|x.x. R:....|...x|....|..x."],
    ["Rage", 150, "K:x..x|..x.|x..x|..x. C:....|....|x...|.... H:mxmx|mxmx|mxmx|mxmx"],
    ["Melodic Trap", 135, "K:x...|....|x...|..x. C:....|....|x...|.... H:x.x.|x.x.|x.x.|xxxx"],
    ["Phonk", 130, "K:x...|..x.|x...|.x.. C:....|....|x...|.... W:x.x.|..x.|x.x.|..x. H:x.x.|x.x.|x.x.|x.x."],
    ["Southern Bounce", 138, "K:x...|.x..|..x.|..x. C:....|....|x...|.... H:x.xx|x.xx|x.xx|x.xx"],
    ["Dark Trap", 145, "K:x...|....|..x.|...x C:....|....|x...|.... H:x.x.|x.x.|xxxx|x.x. O:....|...x|....|...x"],
    ["Pluggnb", 140, "K:x...|..x.|....|..x. C:....|....|x...|.... H:x.x.|xxxx|x.x.|xxxx"],
    ["Hyper Trap", 150, "K:x.x.|..x.|x...|..x. C:....|....|x...|.... H:xxxx|xxxx|xxxx|xxxx"],
    ["Half-Time Bounce", 136, "K:x...|..x.|.x..|.... S:....|....|x...|.... H:x.x.|x.x.|x.x.|x.x. R:..x.|....|..x.|...."]] },
  "DRUM & BASS": { sw: 0, crash: 1, ghost: 0, list: [
    ["Two-Step", 174, "K:x...|....|..x.|.... S:....|x...|....|x... H:x.x.|x.x.|x.x.|x.x."],
    ["Liquid", 172, "K:x...|....|..x.|..x. S:....|x...|....|x... H:x.x.|x.xx|x.x.|x.xx O:..x.|....|..x.|...."],
    ["Neurofunk", 174, "K:x...|....|.x..|x... S:....|x...|....|x..g H:x.x.|x.x.|x.x.|xxx."],
    ["Jump Up", 175, "K:x...|...x|..x.|.... S:....|x...|....|x... H:x.xx|x.x.|x.xx|x.x. O:..x.|....|..x.|...."],
    ["Roller", 172, "K:x...|....|..x.|..x. S:....|x...|....|x... H:mxmx|mxmx|mxmx|mxmx R:...g|....|...g|...."],
    ["Jungle", 165, "K:x...|..x.|.x..|.... S:....|x..g|.g..|x... H:x.x.|x.xx|x.x.|x.xx"],
    ["Darkstep", 174, "K:x...|....|.x..|.... S:....|x...|....|x... H:x...|x...|x...|x... O:..x.|..x.|..x.|..x."],
    ["Halftime DnB", 87, "K:x...|....|....|..x. S:....|....|x...|.... H:x.x.|x.x.|x.x.|x.x."],
    ["Techstep", 174, "K:x...|....|..x.|...x S:....|x...|....|x... H:x.x.|x.x.|x.x.|x.x. N:....|....|.g..|...."],
    ["Footwork", 160, "K:x..x|..x.|x..x|..x. C:....|x...|....|x... H:x.x.|x.x.|x.x.|x.xx"]] },
  "BREAKBEAT": { sw: 0, crash: 1, ghost: 1, list: [
    ["Big Beat", 128, "K:x...|..x.|.x..|..x. S:....|x...|....|x... H:x.x.|x.x.|x.x.|x.x. O:....|....|....|...x"],
    ["Amen Break", 136, "K:x.x.|....|..x.|.x.. S:....|x..x|.x..|x... D:x.x.|x.x.|x.x.|x.x."],
    ["Think Break", 120, "K:x.x.|....|..x.|.... S:....|x...|....|x..g H:x.x.|x.x.|x.x.|x.x."],
    ["Rave Break", 140, "K:x...|..x.|x...|..x. S:....|x...|....|x... C:...x|....|...x|.... H:x.xx|x.x.|x.xx|x.x."],
    ["Nu Skool", 130, "K:x...|.x..|..x.|.... S:....|x...|....|x..x H:x.xx|x.x.|x.xx|x.x."],
    ["Funky Break", 110, "K:x...|..x.|.x..|..x. S:....|x..g|....|x... H:x.x.|x.x.|x.x.|x.xx O:....|....|..x.|...."],
    ["Trip Break", 98, "K:x...|....|x..x|.... S:....|x...|....|x... H:x.x.|x.x.|x.x.|x.x."],
    ["Electro Break", 125, "K:x...|....|x...|..x. S:....|x...|....|x... C:....|x...|....|x... E:mxmx|mxmx|mxmx|mxmx"],
    ["Florida Breaks", 130, "K:x...|..x.|x...|..x. S:....|x...|....|x... H:.x.x|.x.x|.x.x|.x.x O:x...|....|x...|...."],
    ["Chemical Break", 124, "K:x...|.x..|x...|.x.. S:....|x...|....|x... H:x.x.|x.x.|x.x.|x.x. R:...x|....|...x|...."]] },
  "REGGAETON": { sw: 0, crash: 0, ghost: 0, list: [
    ["Dembow Classic", 95, "K:x...|x...|x...|x... S:...x|..x.|...x|..x. H:x.x.|x.x.|x.x.|x.x."],
    ["Perreo", 98, "K:x...|x...|x...|x... S:...x|..x.|...x|..x. H:mxmx|mxmx|mxmx|mxmx C:....|x...|....|x..."],
    ["Reggaeton Latino", 92, "K:x...|x...|x...|x... S:...x|..x.|...x|..x. R:x...|..x.|x...|..x. O:..x.|....|..x.|...."],
    ["Moombahton", 108, "K:x...|x...|x...|x... S:...x|..x.|...x|..x. O:..x.|..x.|..x.|..x."],
    ["Dancehall", 100, "K:x..x|..x.|x..x|..x. S:...x|..x.|...x|..x. H:x.x.|x.x.|x.x.|x.x."],
    ["Trapeton", 90, "K:x...|x...|x...|x... C:...x|..x.|...x|..x. H:x.xx|x.x.|x.xx|x.x."],
    ["Latin Pop", 96, "K:x...|x...|x...|x... S:...x|..x.|...x|..x. G:x.x.|..x.|x.x.|..x."],
    ["Neoperreo", 94, "K:x...|..x.|x...|..x. S:...x|..x.|...x|..x. H:x.x.|x.x.|x.x.|xxxx"],
    ["Soca", 110, "K:x...|x...|x...|x... S:..x.|x..x|..x.|x..x E:x.xx|x.xx|x.xx|x.xx"],
    ["Cumbia Beat", 90, "K:x...|..x.|x...|..x. S:....|x...|....|x... G:x.x.|x.x.|x.x.|x.x. W:..x.|....|..x.|...."]] },
  "DISCO FUNK": { sw: 20, crash: 1, ghost: 1, list: [
    ["Disco Classic", 118, "K:x...|x...|x...|x... S:....|x...|....|x... O:..x.|..x.|..x.|..x. H:x.x.|x.x.|x.x.|x.x."],
    ["Funky Drummer", 100, "K:x.x.|..x.|.x..|..x. S:....|x..g|.g.g|x..g H:mxmx|mxmx|mxmx|mxmx"],
    ["Motown", 112, "K:x...|..x.|x...|..x. S:....|x...|....|x... H:x.x.|x.x.|x.x.|x.x. E:.x.x|.x.x|.x.x|.x.x"],
    ["Nu Disco", 120, "K:x...|x...|x...|x... C:....|x...|....|x... O:..x.|..x.|..x.|..x. W:...x|..x.|...x|..x."],
    ["P-Funk", 108, "K:x..x|..x.|x...|.x.. S:....|x...|....|x..g H:x.x.|x.x.|x.xx|x.x."],
    ["Boogie", 114, "K:x...|x...|x..x|x... S:....|x...|....|x... C:....|x...|....|x... H:xmxm|xmxm|xmxm|xmxm"],
    ["Soul Groove", 96, "K:x...|..x.|x...|...x S:....|x...|....|x... D:..x.|..x.|..x.|..x."],
    ["Philly", 116, "K:x...|x...|x...|x... S:....|x...|....|x... O:x...|..x.|x...|..x. H:..x.|..x.|..x.|..x."],
    ["Chic Groove", 112, "K:x..x|...x|x..x|...x S:....|x...|....|x... H:x.xx|x.xx|x.xx|x.xx O:..x.|....|..x.|...."],
    ["Afrobeat", 105, "K:x...|..x.|.x..|x... S:....|..x.|....|x... G:x.x.|x.x.|x.x.|x.x. W:x...|..x.|x...|..x. O:..x.|....|..x.|...."]] },
  "ROCK": { sw: 0, crash: 1, ghost: 1, list: [
    ["Straight Rock", 120, "K:x...|....|x...|..x. S:....|x...|....|x... H:x.x.|x.x.|x.x.|x.x."],
    ["Four-Quarter Pop", 110, "K:x...|x...|x...|x... S:....|x...|....|x... H:x.x.|x.x.|x.x.|x.x. O:..x.|..x.|..x.|..x."],
    ["Punk", 170, "K:x.x.|x.x.|x.x.|x.x. S:....|x...|....|x... H:x.x.|x.x.|x.x.|x.x."],
    ["Indie Drive", 128, "K:x...|..x.|x...|..x. S:....|x...|....|x... H:x.x.|x.x.|x.x.|x.x. T:....|....|....|..x."],
    ["Half-Time Rock", 80, "K:x...|....|..x.|.... S:....|....|x...|.... H:x.x.|x.x.|x.x.|x.x."],
    ["Shuffle", 96, "K:x...|..x.|x...|..x. S:....|x...|....|x... H:x.xx|x.xx|x.xx|x.xx"],
    ["Motorik", 130, "K:x...|x...|x...|x... S:....|x...|....|x... H:mxmx|mxmx|mxmx|mxmx"],
    ["Funk Rock", 108, "K:x..x|..x.|x...|..x. S:....|x..g|....|x... H:x.xx|x.x.|x.xx|x.x."],
    ["Stadium", 92, "K:x...|x...|x...|x... S:....|x...|....|x... C:....|x...|....|x... L:...x|....|...x|...."],
    ["Garage Rock", 140, "K:x...|x...|x...|x..x S:....|x...|....|x... O:x.x.|x.x.|x.x.|x.x."]] },
  "LO-FI": { sw: 55, crash: 0, ghost: 1, list: [
    ["Study Beats", 78, "K:x...|..x.|.x..|.... S:....|x...|....|x... H:x.x.|x.x.|x.x.|x.x. R:...x|....|...x|...."],
    ["Rainy Day", 72, "K:x...|....|..x.|.x.. S:....|x...|....|x..g H:x.x.|x.x.|x.x.|x.xx"],
    ["Sunday Jazz", 85, "K:x...|..x.|...x|.... S:....|x...|....|x... D:x.x.|x.x.|x.x.|x.x."],
    ["Tape Loop", 80, "K:x..x|....|x...|..x. S:....|x...|....|x... H:.x.x|.x.x|.x.x|.x.x"],
    ["Dusty Vinyl", 84, "K:x...|.g.x|..x.|.... S:....|x...|....|x... H:x.x.|x.x.|x.x.|x.x. E:..x.|....|..x.|...."],
    ["Night Drive", 90, "K:x...|x...|x...|x... S:....|x...|....|x... H:..x.|..x.|..x.|..x. O:...x|....|...x|...."],
    ["Bossa Chill", 88, "K:x..x|..x.|x..x|..x. R:x..x|..x.|..x.|x... H:x.x.|x.x.|x.x.|x.x."],
    ["Coffee Shop", 76, "K:x...|..x.|.x..|..x. S:....|x...|....|x... H:x.xx|x.xx|x.xx|x.xx"],
    ["Slow Dance", 68, "K:x...|....|..x.|.... S:....|x...|....|x... H:x...|x...|x...|x... O:..x.|..x.|..x.|..x."],
    ["Ambient Pulse", 82, "K:x...|....|x...|.... C:....|x...|....|x... E:x.x.|x.x.|x.x.|x.x. H:..x.|....|..x.|...."]] },
};
export const parseLay = (str) => { const lay = {}; str.split(/\s+/).forEach((tk) => (lay[tk[0]] = tk.slice(2).replace(/[|_]/g, ""))); return lay; };

// Expand one 1-bar groove into 16 bars: fills every 4th bar, a bigger fill in bar 16, crashes on bars 1 and 9, ghost kicks on odd bars
export function genDrums(p, seed, G) {
  const lay = parseLay(p[2]), notes = [], add = (b, st, l, v, d = 12) => notes.push({ t: b * 384 + st * 24, d, p: LN[l], v });
  const sn = lay.S ? "S" : "C";
  for (let b = 0; b < 16; b++) {
    const from = b === 15 ? 8 : b % 4 === 3 ? 12 : 16, type = (seed + b) % 4;
    for (const [l, pt] of Object.entries(lay)) for (let i = 0; i < 16; i++) if (VEL[pt[i]] && !(i >= from && "SCN".includes(l))) add(b, i, l, VEL[pt[i]]);
    for (let i = from; i < 16; i++) {
      const v = Math.round(60 + (67 * (i - from)) / (16 - from));
      if (b === 15 || type === 0) add(b, i, sn, v);
      else if (type === 1) add(b, i, i < 14 ? "L" : "T", 100);
      else if (type === 2) add(b, i, i === 13 ? "K" : sn, 100);
      else if (i % 2 === 0) add(b, i, sn, 110);
    }
    if (G.crash && (b === 0 || b === 8)) add(b, 0, "A", 110, 96);
    if (G.ghost && lay.K && b % 2 === 1 && from === 16) { const st = (seed + b) % 2 ? 7 : 15; if (!VEL[lay.K[st]]) add(b, st, "K", 45); }
  }
  return notes;
}

