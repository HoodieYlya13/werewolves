/**
 * The game master's soundtrack, composed live with the Web Audio API: no audio
 * files to load or license. A scene loops until the next one cross-fades in;
 * stingers (a bell, a fanfare) play over it once.
 */

export type Scene = "prologue" | "day" | "night" | "wolves" | "witch" | "seer" | "love" | "piper" | "vote";
export type Stinger = { kind: "deaths"; count: number } | { kind: "win"; team: "village" | "wolves" | "other" };

const SOUND_KEY = "ww:sound";
const VOLUME = 0.8;
/** Seconds for one scene to hand over to the next. */
const FADE = 2.5;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let current: { scene: Scene; stop: () => void } | null = null;
let leaving: ReturnType<typeof setTimeout> | undefined;
let muted = readMuted();
const listeners = new Set<() => void>();

function readMuted() {
  try {
    return localStorage.getItem(SOUND_KEY) === "off";
  } catch {
    return false;
  }
}

/** The audio graph, made on first use. Browsers keep it silent until a tap, so any tap resumes it. */
function audio() {
  if (ctx && master) return { ctx, master };
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : VOLUME;
  const limiter = ctx.createDynamicsCompressor();
  master.connect(limiter).connect(ctx.destination);
  const resume = () => {
    if (ctx?.state === "suspended" && !muted) void ctx.resume();
  };
  addEventListener("pointerdown", resume);
  addEventListener("keydown", resume);
  return { ctx, master };
}

// --- muting ---

export const isMuted = () => muted;

export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    if (value) localStorage.setItem(SOUND_KEY, "off");
    else localStorage.removeItem(SOUND_KEY);
  } catch {}
  if (ctx && master) {
    master.gain.setTargetAtTime(value ? 0 : VOLUME, ctx.currentTime, 0.2);
    // Suspended, the scenes stop scheduling notes too.
    if (value) setTimeout(() => muted && void ctx?.suspend(), 600);
    else void ctx.resume();
  }
  listeners.forEach((l) => l());
}

// --- scenes ---

/** Plays a scene (null: silence), cross-fading from the one playing. */
export function setScene(scene: Scene | null) {
  clearTimeout(leaving);
  if (scene === current?.scene) return;
  current?.stop();
  current = scene ? { scene, stop: scenes[scene](kit()) } : null;
}

/**
 * Silence after a moment, unless a scene starts again meanwhile: a game screen
 * that remounts (switching language) keeps its music going.
 */
export function leaveScene() {
  clearTimeout(leaving);
  leaving = setTimeout(() => setScene(null), 500);
}

export function playStinger(stinger: Stinger) {
  const k = kit(false);
  // Every stinger is over well before this: let its nodes go.
  setTimeout(k.stop, 10_000);
  if (stinger.kind === "deaths") {
    // One toll per death: the village hears how many, never how.
    for (let i = 0; i < Math.min(stinger.count, 3); i++) bell(k, 196, i * 2.4);
  } else if (stinger.team === "village") {
    [60, 64, 67, 72].forEach((n, i) => k.note(n, { type: "triangle", gain: 0.09, decay: 1.2, at: i * 0.18 }));
    [60, 64, 67, 72, 76].forEach((n) => k.note(n, { type: "triangle", gain: 0.06, attack: 0.05, decay: 3.5, at: 0.8 }));
  } else if (stinger.team === "wolves") {
    howl(k, 0);
    [45, 48, 52].forEach((n) => k.note(n, { type: "sawtooth", gain: 0.05, attack: 0.4, decay: 4.5, at: 1.6, cutoff: 700 }));
  } else {
    [62, 65, 69, 73].forEach((n, i) => k.note(n, { type: "sine", gain: 0.07, attack: 0.1, decay: 4, at: i * 0.12 }));
  }
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const between = (min: number, max: number) => min + Math.random() * (max - min);

type NoteOptions = {
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  decay?: number;
  /** Seconds from now. */
  at?: number;
  /** Vibrato depth in cents. */
  vibrato?: number;
  /** Frequency ratios to slide through over the note, e.g. [1, 1.8, 1.5]. */
  glide?: number[];
  cutoff?: number;
};

type Kit = ReturnType<typeof kit>;

/**
 * The instruments a scene plays on, all wired to its own bus so the scene
 * fades in and out as one. `fade: false` plays straight into the master.
 */
function kit(fade = true) {
  const { ctx, master } = audio();
  const bus = ctx.createGain();
  bus.connect(master);
  bus.gain.setValueAtTime(fade ? 0 : 1, ctx.currentTime);
  if (fade) bus.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE);
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const loops: AudioScheduledSourceNode[] = [];
  const running = () => ctx.state === "running";

  const k = {
    /** A note by MIDI number (60 is middle C); `tone` takes Hz. */
    note(midi: number, o: NoteOptions = {}) {
      k.tone(hz(midi), o);
    },
    tone(freq: number, { type = "sine", gain = 0.06, attack = 0.01, decay = 1.5, at = 0, vibrato = 0, glide, cutoff }: NoteOptions = {}) {
      const t = ctx.currentTime + at;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      glide?.forEach((ratio, i) => osc.frequency.linearRampToValueAtTime(freq * ratio, t + ((i + 1) * decay) / glide.length));
      if (vibrato) {
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = 5.5;
        depth.gain.value = vibrato;
        lfo.connect(depth).connect(osc.detune);
        lfo.start(t);
        lfo.stop(t + attack + decay + 0.1);
      }
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(gain, t + attack);
      env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
      let out: AudioNode = env;
      if (cutoff) {
        const filter = ctx.createBiquadFilter();
        filter.frequency.value = cutoff;
        env.connect(filter);
        out = filter;
      }
      osc.connect(env);
      out.connect(bus);
      osc.start(t);
      osc.stop(t + attack + decay + 0.1);
    },
    /** A held chord, softly filtered, breathing with a slow sweep. */
    drone(midis: number[], { type = "sine" as OscillatorType, gain = 0.03, cutoff = 1200, sweep = 0.3 } = {}) {
      const filter = ctx.createBiquadFilter();
      filter.frequency.value = cutoff;
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 0.07;
      depth.gain.value = cutoff * sweep;
      lfo.connect(depth).connect(filter.frequency);
      const level = ctx.createGain();
      level.gain.value = gain;
      filter.connect(level).connect(bus);
      for (const midi of midis) {
        for (const detune of [-6, 6]) {
          const osc = ctx.createOscillator();
          osc.type = type;
          osc.frequency.value = hz(midi);
          osc.detune.value = detune;
          osc.connect(filter);
          osc.start();
          loops.push(osc);
        }
      }
      lfo.start();
      loops.push(lfo);
    },
    /** Filtered noise: wind, or a cauldron's hiss. */
    noise({ gain = 0.03, cutoff = 500, q = 0.8, sweep = 0.6 } = {}) {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = cutoff;
      filter.Q.value = q;
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 0.05;
      depth.gain.value = cutoff * sweep;
      lfo.connect(depth).connect(filter.frequency);
      const level = ctx.createGain();
      level.gain.value = gain;
      src.connect(filter).connect(level).connect(bus);
      src.start();
      lfo.start();
      loops.push(src, lfo);
    },
    /** Calls `play` again and again, `min` to `max` seconds apart, while sound is on. */
    every(min: number, max: number, play: () => void) {
      const next = () => {
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (running()) play();
          next();
        }, between(min, max) * 1000);
        timers.add(timer);
      };
      next();
    },
    /** Steps through a melody, one note per call, looping. */
    sequence(notes: number[], seconds: number, play: (midi: number) => void) {
      let i = 0;
      k.every(seconds, seconds, () => play(notes[i++ % notes.length]));
    },
    /** Fades the scene out, then lets everything go. */
    stop() {
      timers.forEach(clearTimeout);
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
      bus.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE);
      setTimeout(() => {
        loops.forEach((n) => n.stop());
        bus.disconnect();
      }, FADE * 1000 + 100);
    },
  };
  return k;
}

function bell(k: Kit, base: number, at: number) {
  [
    [1, 0.12, 4.5],
    [2, 0.05, 3],
    [2.76, 0.05, 2.5],
    [5.4, 0.025, 1.5],
  ].forEach(([ratio, gain, decay]) => k.tone(base * ratio, { gain, decay, at }));
}

function howl(k: Kit, at: number) {
  k.tone(300, { type: "sawtooth", gain: 0.035, attack: 0.6, decay: 3, at, vibrato: 25, glide: [1.75, 1.6, 1.45], cutoff: 1100 });
}

/** Each scene starts playing on its kit and returns how to stop. */
const scenes: Record<Scene, (k: Kit) => () => void> = {
  // A music box over a low hum, while the story is told.
  prologue: (k) => {
    k.drone([50, 57], { gain: 0.025 });
    k.sequence([74, 77, 81, 79, 77, 76, 74, 72, 74, 69, 70, 72], 0.6, (n) => {
      k.note(n, { gain: 0.05, decay: 1.4 });
      k.note(n + 12, { gain: 0.012, decay: 0.8 });
    });
    return k.stop;
  },
  // Warm and open: a village going about its day, birds now and then.
  day: (k) => {
    k.drone([48, 55, 64], { type: "triangle", gain: 0.022, cutoff: 1500 });
    k.every(0.7, 1.6, () => k.note(pick([72, 74, 76, 79, 81, 84]), { type: "triangle", gain: 0.045, decay: 1.8 }));
    k.every(6, 14, () => {
      for (let i = 0; i < 3; i++) k.tone(between(2500, 3800), { gain: 0.015, decay: 0.12, at: i * 0.16, glide: [1.3] });
    });
    return k.stop;
  },
  // Low, dark and still, with the wind outside.
  night: (k) => {
    k.drone([33, 40, 48], { type: "sawtooth", gain: 0.016, cutoff: 350 });
    k.noise({ gain: 0.025, cutoff: 500 });
    k.every(2.5, 5, () => k.note(pick([45, 48, 52, 55, 57, 60]), { gain: 0.06, decay: 4 }));
    return k.stop;
  },
  // A heartbeat in the dark, and a howl from the woods.
  wolves: (k) => {
    k.drone([33, 40], { type: "sawtooth", gain: 0.016, cutoff: 280 });
    k.noise({ gain: 0.02, cutoff: 400 });
    k.every(0.85, 0.85, () => {
      k.tone(60, { gain: 0.25, decay: 0.25, glide: [0.66] });
      k.tone(60, { gain: 0.16, decay: 0.25, at: 0.22, glide: [0.66] });
    });
    k.every(9, 15, () => howl(k, 0));
    return k.stop;
  },
  // A bubbling cauldron and a crooked, whole-tone spell.
  witch: (k) => {
    k.drone([38, 45], { gain: 0.03, cutoff: 600 });
    k.noise({ gain: 0.012, cutoff: 900, q: 2 });
    k.sequence([62, 64, 66, 68, 70, 72, 70, 68, 66, 64], 0.32, (n) =>
      k.note(n, { type: "triangle", gain: 0.035, decay: 0.8, vibrato: 18 }),
    );
    k.every(0.15, 0.5, () => k.tone(between(300, 900), { gain: 0.025, decay: 0.08, glide: [1.5] }));
    return k.stop;
  },
  // Shimmering chimes: something is about to be revealed.
  seer: (k) => {
    k.drone([52, 59, 64], { gain: 0.025, cutoff: 2000 });
    k.every(0.8, 2, () => {
      const n = pick([76, 78, 80, 83, 85, 88]);
      k.note(n, { gain: 0.035, decay: 3.5 });
      k.tone(hz(n) * 2.4, { gain: 0.008, decay: 2 });
    });
    return k.stop;
  },
  // A harp over a soft major chord, for Cupid and the lovers.
  love: (k) => {
    k.drone([41, 53, 57, 60], { type: "triangle", gain: 0.02, cutoff: 1400 });
    k.sequence([65, 69, 72, 77, 81, 84, 81, 77, 72, 69], 0.28, (n) => k.note(n, { type: "triangle", gain: 0.04, decay: 1.6 }));
    return k.stop;
  },
  // The Piper's flute, a little too sweet.
  piper: (k) => {
    k.drone([38, 45], { gain: 0.03 });
    k.sequence([74, 76, 77, 79, 81, 79, 77, 76, 74, 72, 74, 74], 0.45, (n) =>
      k.note(n, { gain: 0.05, attack: 0.08, decay: 0.5, vibrato: 20 }),
    );
    return k.stop;
  },
  // A slow drum and a pulsing low string while the village decides.
  vote: (k) => {
    k.drone([45, 52], { type: "triangle", gain: 0.018, cutoff: 900 });
    k.every(0.857, 0.857, () => {
      k.tone(110, { gain: 0.2, decay: 0.35, glide: [0.55] });
      k.note(45, { type: "sawtooth", gain: 0.025, decay: 0.5, cutoff: 600 });
      k.tone(4000, { type: "square", gain: 0.006, decay: 0.03, at: 0.43 });
    });
    return k.stop;
  },
};
