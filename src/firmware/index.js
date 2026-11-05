// Firmware registry: detection and the per-device view of a profile.
// To add a firmware, write a profile in ./profiles and list it here (see docs/ADDING_A_FIRMWARE.md).

import sloop from "./profiles/sloop.js";
import felucca from "./profiles/felucca.js";
import skiff from "./profiles/skiff.js";
import jiant from "./profiles/jiant.js";
import x0x from "./profiles/x0x.js";
import echofield from "./profiles/echofield.js";
import { flGeneric, official, generic } from "./profiles/generic.js";

/** Order matters for detection: the first profile whose pattern matches wins. */
export const PROFILES = [sloop, skiff, jiant, felucca, x0x, echofield, flGeneric, official, generic];
const BY_ID = Object.fromEntries(PROFILES.map((p) => [p.id, p]));

export const getProfile = (id) => BY_ID[id] || generic;

/** Choose a profile from what the device told us: its INFO version string first, then its port name. */
export function detectProfile({ portName = "", info = null } = {}) {
  if (info?.version) {
    const hit = PROFILES.find((p) => p.detect.info?.test(info.version));
    if (hit) return hit.id;
  }
  const byPort = PROFILES.find((p) => p.detect.port?.test(portName));
  if (byPort) return byPort.id;
  return info ? "fl" : null;
}

/** Track layout for a device: a profile may build it from INFO (track count) or list it. */
export function tracksFor(profile, info) {
  const list = typeof profile.tracks === "function" ? profile.tracks(info) : profile.tracks;
  return list.map((t) => ({ ...t, drum: !!t.lanes }));
}

/** Protocol extension level the device supports: SLOOP appends its protocol version to INFO. */
export function protoLevel(profileId, info) {
  if (!info) return 0;
  if (profileId === "sloop" && info.tail.length) return info.tail[0];
  return info.ntrk > 1 ? 3 : 1;
}
