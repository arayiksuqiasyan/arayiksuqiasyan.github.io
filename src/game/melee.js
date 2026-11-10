// Melee weapon models (sword, battle axe, energy katana) and their attack chains.
// Model space: 1 unit ≈ 0.62 × hero height, the weapon points along +Y, the grip sits around y = 0…0.25.
// Mixed into GameEngine.prototype — `this` is the engine.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

// real models (Quaternius Fantasy Props, CC0): node name, rotation to point along +Y, total length in weapon units
const REAL = {
    sword: {node: 'Sword_Bronze', length: 1.2},
    axe: {node: 'Axe_Bronze', length: 1.2},
    pickaxe: {node: 'Pickaxe_Bronze', length: 1.2},
    torch: {node: 'Torch_Metal', length: 0.95, rot: [-0.95, 0, 0]},
    knife: {node: 'Table_Knife', length: 0.62, rot: [-Math.PI / 2, 0, 0]},
}
export const MELEE_LENGTH = {sword: 1.15, axe: 1.1, katana: 1.25, hammer: 0.95, scythe: 1.3, pickaxe: 1.1, torch: 0.9, knife: 0.6, mug: 0.35}

// one press = one swing: a combo clip with several swings is cut into separate attacks
// (each plays only its own part of the clip: from…end, as fractions of the clip)
const cut = (clip, ts, hits, bounds) => hits.map((h, i) => ({
    clip, ts, from: bounds[i], end: bounds[i + 1], hits: [h], chain: 0.8,
}))

// clip, playback speed, hit moments (fractions of the clip), chain point (fraction of the attack)
export const MELEE_ATTACKS = {
    sword: [
        {clip: 'attack4', ts: 2.0, hits: [0.32], chain: 0.5},
        {clip: 'attack2', ts: 2.2, hits: [0.38], chain: 0.55},
        {clip: 'attack3', ts: 2.3, hits: [0.36], chain: 0.55},
        {clip: 'attack1', ts: 2.8, hits: [0.42], chain: 0.6},
    ],
    // heavy two-handed swings: slower, but every hit lands hard
    axe: [
        {clip: 'axe1', ts: 1.45, hits: [0.42], chain: 0.62},
        {clip: 'axe2', ts: 1.5, hits: [0.45], chain: 0.62},
        ...cut('axe3', 2.0, [0.28, 0.5, 0.72], [0, 0.4, 0.62, 1]),
    ],
    // the hammer and the scythe use the heavy two-handed moves
    // the hammer: a heavy two-handed club combo, then an overhead smash
    hammer: [
        ...cut('club2', 3.2, [0.34, 0.55, 0.74], [0, 0.45, 0.65, 1]),
        {clip: 'axe1', ts: 1.25, hits: [0.45], chain: 0.66},
    ],
    scythe: [
        ...cut('axe3', 1.9, [0.26, 0.48, 0.7], [0, 0.38, 0.6, 1]),
        {clip: 'axe2', ts: 1.6, hits: [0.45], chain: 0.62},
    ],
    pickaxe: [
        {clip: 'axe1', ts: 1.6, hits: [0.42], chain: 0.6},
        {clip: 'axe2', ts: 1.6, hits: [0.45], chain: 0.6},
    ],
    // the torch: real torch swings and a forward jab
    torch: [
        {clip: 'torch1', ts: 2.2, hits: [0.36], chain: 0.55},
        {clip: 'torch2', ts: 2.3, hits: [0.31], chain: 0.5},
    ],
    // the knife: quick rear-hand stabs
    knife: [
        {clip: 'knife1', ts: 3.0, hits: [0.47], chain: 0.6},
        ...cut('knife2', 3.4, [0.33, 0.54], [0, 0.44, 1]),
    ],
    // the mug: a one-handed bar-brawl combo
    mug: [
        // slower, heavier swings (its damage is raised to match)
        ...cut('club1', 1.5, [0.35, 0.58, 0.75], [0, 0.47, 0.67, 1]).map(a => ({...a, chain: 0.86})),
    ],
    // quick one-handed slashes and a lunge
    katana: [
        {clip: 'kat2', ts: 2.4, hits: [0.42], chain: 0.55},
        {clip: 'kat3', ts: 2.4, hits: [0.42], chain: 0.55},
        {clip: 'kat1', ts: 2.6, hits: [0.38, 0.6], chain: 0.7},
    ],
}

function axeHeadShape() {
    const s = new THREE.Shape()
    s.moveTo(0.02, 0.075)
    s.quadraticCurveTo(0.15, 0.1, 0.27, 0.22)
    s.quadraticCurveTo(0.39, 0.02, 0.31, -0.22)
    s.quadraticCurveTo(0.17, -0.11, 0.02, -0.075)
    s.lineTo(0.02, 0.075)
    // back spike
    const b = new THREE.Shape()
    b.moveTo(-0.02, 0.05)
    b.lineTo(-0.17, 0)
    b.lineTo(-0.02, -0.05)
    b.lineTo(-0.02, 0.05)
    return [s, b]
}

function scytheShape() {
    const s = new THREE.Shape()
    s.moveTo(0, 0.04)
    s.quadraticCurveTo(0.32, 0.12, 0.62, -0.14)
    s.quadraticCurveTo(0.4, -0.02, 0.02, -0.04)
    s.lineTo(0, 0.04)
    return s
}

function katanaShape() {
    const s = new THREE.Shape()
    s.moveTo(-0.016, 0)
    s.lineTo(0.019, 0)
    s.quadraticCurveTo(0.05, 0.6, 0.085, 1.0)
    s.lineTo(0.058, 1.07)
    s.quadraticCurveTo(0.012, 0.6, -0.016, 0)
    return s
}

export const meleeMethods = {
    buildMeleeKit() {
        const ext = (shapes, depth, bevel) => {
            const g = new THREE.ExtrudeGeometry(shapes, {
                depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 18,
            })
            g.translate(0, 0, -depth / 2)
            return g
        }
        this.meleeGeo = {
            axeHead: ext(axeHeadShape(), 0.03, 0.012),
            axeEdge: new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
                new THREE.Vector3(0.27, 0.22, 0), new THREE.Vector3(0.4, 0.02, 0), new THREE.Vector3(0.31, -0.22, 0),
            ), 24, 0.009, 6),
            katana: ext(katanaShape(), 0.006, 0.004),
            scythe: ext(scytheShape(), 0.012, 0.006),
        }
        this.meleeMats = {
            steel: new THREE.MeshStandardMaterial({color: 0xe8fff4, metalness: 0.85, roughness: 0.18, emissive: 0x14e956, emissiveIntensity: 0.45}),
            axeSteel: new THREE.MeshStandardMaterial({color: 0xaab4c0, metalness: 0.9, roughness: 0.28}),
            dark: new THREE.MeshStandardMaterial({color: 0x1b1f24, roughness: 0.6, metalness: 0.4}),
            gold: new THREE.MeshStandardMaterial({color: 0xc9a227, roughness: 0.35, metalness: 0.9}),
            wood: new THREE.MeshStandardMaterial({color: 0x6b3f1f, roughness: 0.75}),
            leather: new THREE.MeshStandardMaterial({color: 0x2a1a10, roughness: 0.9}),
            fire: new THREE.MeshBasicMaterial({color: 0xff8a2a, toneMapped: false}),
            plasma: new THREE.MeshStandardMaterial({color: 0xe0fbff, metalness: 0.9, roughness: 0.1, emissive: 0x22d3ee, emissiveIntensity: 1.1}),
            plasmaGlow: new THREE.MeshBasicMaterial({
                color: 0x22d3ee, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
            }),
            wrap: new THREE.MeshStandardMaterial({color: 0x0f172a, roughness: 0.8}),
            silk: new THREE.MeshStandardMaterial({color: 0xe2e8f0, roughness: 0.6}),
            hammerHead: new THREE.MeshStandardMaterial({color: 0x475569, metalness: 0.9, roughness: 0.35}),
            rune: new THREE.MeshBasicMaterial({color: 0x60a5fa, toneMapped: false}),
            bone: new THREE.MeshStandardMaterial({color: 0x1e1b2e, roughness: 0.6, metalness: 0.3}),
            reaper: new THREE.MeshStandardMaterial({color: 0xd8b4fe, metalness: 0.9, roughness: 0.15, emissive: 0xa855f7, emissiveIntensity: 0.8}),
            // the coffee mug: glossy white ceramic, dark coffee, a neon band
            ceramic: new THREE.MeshStandardMaterial({color: 0xf8fafc, roughness: 0.28, metalness: 0.05, side: THREE.DoubleSide}),
            coffee: new THREE.MeshStandardMaterial({color: 0x3b1f0e, roughness: 0.25, metalness: 0.1}),
            mugBand: new THREE.MeshStandardMaterial({color: 0x14e956, roughness: 0.4, emissive: 0x14e956, emissiveIntensity: 0.35}),
        }
        this.meleeGeo = this.meleeGeo || {}
        // a slightly tapered cup wall, open at the top
        this.meleeGeo.mugWall = new THREE.CylinderGeometry(0.11, 0.095, 0.24, 28, 1, true)
        this.meleeGeo.mugBottom = new THREE.CircleGeometry(0.095, 28).rotateX(Math.PI / 2)
        this.meleeGeo.mugCoffee = new THREE.CircleGeometry(0.104, 28).rotateX(-Math.PI / 2)
        this.meleeGeo.mugRim = new THREE.TorusGeometry(0.11, 0.008, 6, 28).rotateX(Math.PI / 2)
        this.meleeGeo.mugBand = new THREE.CylinderGeometry(0.1065, 0.1035, 0.05, 28, 1, true)
        this.meleeGeo.mugHandle = new THREE.TorusGeometry(0.06, 0.017, 8, 18, Math.PI * 1.15)
    },

    async loadWeaponModels(url) {
        try {
            const gltf = await new GLTFLoader().loadAsync(url)
            this.weaponScene = gltf.scene
        } catch (err) {
            console.warn('weapon models failed', err)
        }
    },

    // the real 3D model of a melee weapon, oriented along +Y with the handle end in the fist
    realMeleeModel(id) {
        const cfg = REAL[id]
        const src = cfg && this.weaponScene && this.weaponScene.getObjectByName(cfg.node)
        if (!src) return null
        const model = src.clone(true)
        model.position.set(0, 0, 0)
        const pivot = new THREE.Group()
        if (cfg.rot) pivot.rotation.set(...cfg.rot)
        pivot.add(model)
        const holder = new THREE.Group()
        holder.add(pivot)
        holder.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(holder)
        const k = cfg.length / Math.max(0.001, box.max.y - box.min.y)
        holder.scale.setScalar(k)
        holder.position.y = -box.min.y * k - 0.06
        holder.position.x = -((box.min.x + box.max.x) / 2) * k * (id === 'sword' ? 1 : 0)
        const g = new THREE.Group()
        g.add(holder)
        return g
    },

    buildMeleeModel(id) {
        const real = this.realMeleeModel(id)
        if (real) return real
        const G = this.geo
        const M = this.meleeMats
        const g = new THREE.Group()
        const mesh = (geo, mat, sx, sy, sz, x, y, z = 0) => {
            const m = new THREE.Mesh(geo, mat)
            m.scale.set(sx, sy, sz)
            m.position.set(x, y, z)
            g.add(m)
            return m
        }
        if (id === 'mug') {
            // a proper coffee mug (not a tankard): body along +Y, handle on the side
            const MG = this.meleeGeo
            const add = (geo, mat, y = 0) => {
                const m = new THREE.Mesh(geo, mat)
                m.position.y = y
                g.add(m)
                return m
            }
            const base = 0.16
            add(MG.mugWall, M.ceramic, base)
            add(MG.mugBottom, M.ceramic, base - 0.12)
            add(MG.mugCoffee, M.coffee, base + 0.09)
            add(MG.mugRim, M.ceramic, base + 0.12)
            add(MG.mugBand, M.mugBand, base - 0.02)
            const handle = add(MG.mugHandle, M.ceramic, base)
            handle.position.x = 0.1
            handle.rotation.z = -Math.PI * 0.575
            return g
        }
        if (id === 'hammer') {
            mesh(G.cyl, M.wood, 0.03, 0.95, 0.03, 0, 0.4)                  // haft
            for (const y of [0.0, 0.1]) mesh(G.cyl, M.leather, 0.036, 0.05, 0.036, 0, y)
            mesh(G.box, M.hammerHead, 0.36, 0.2, 0.2, 0, 0.86)             // head
            mesh(G.box, M.dark, 0.38, 0.04, 0.22, 0, 0.86)                 // band
            for (const x of [-0.181, 0.181]) mesh(G.box, M.rune, 0.004, 0.12, 0.12, x, 0.86) // glowing faces
            mesh(G.box, M.rune, 0.3, 0.012, 0.205, 0, 0.93)                // rune line
            mesh(this.geo.cone, M.hammerHead, 0.035, 0.1, 0.035, 0, 0.96)  // top spike
        } else if (id === 'scythe') {
            mesh(G.cyl, M.bone, 0.024, 1.35, 0.024, 0, 0.55)               // long snath
            for (const y of [0.05, 0.6]) mesh(G.cyl, M.silk, 0.03, 0.04, 0.03, 0, y)
            mesh(G.sphere, M.reaper, 0.04, 0.04, 0.04, 0, 1.24)
            const blade = new THREE.Mesh(this.meleeGeo.scythe, M.reaper)
            blade.position.y = 1.18
            g.add(blade)
        } else if (id === 'axe') {
            mesh(G.cyl, M.wood, 0.028, 1.0, 0.028, 0, 0.42)               // haft
            for (const y of [0.0, 0.1, 0.62]) mesh(G.cyl, M.leather, 0.034, 0.05, 0.034, 0, y)
            mesh(G.cyl, M.dark, 0.042, 0.17, 0.042, 0, 0.83)               // socket
            const head = new THREE.Mesh(this.meleeGeo.axeHead, M.axeSteel)
            head.position.y = 0.83
            const edge = new THREE.Mesh(this.meleeGeo.axeEdge, M.fire)
            edge.position.y = 0.83
            const spike = mesh(this.geo.cone, M.axeSteel, 0.03, 0.12, 0.03, 0, 0.91)
            spike.userData.keep = true
            g.add(head, edge)
            mesh(G.sphere, M.dark, 0.036, 0.036, 0.036, 0, -0.09)         // butt cap
        } else if (id === 'katana') {
            mesh(G.cyl, M.wrap, 0.025, 0.27, 0.025, 0, 0.08)                // tsuka
            for (const y of [-0.02, 0.04, 0.1, 0.16]) mesh(G.cyl, M.silk, 0.027, 0.012, 0.027, 0, y)
            mesh(G.sphere, M.gold, 0.03, 0.02, 0.03, 0, -0.06)              // kashira
            mesh(G.cyl, M.gold, 0.07, 0.016, 0.07, 0, 0.225)                // tsuba
            mesh(G.box, M.gold, 0.04, 0.035, 0.02, 0.002, 0.25)             // habaki
            const blade = new THREE.Mesh(this.meleeGeo.katana, M.plasma)
            blade.position.y = 0.24
            const glow = new THREE.Mesh(this.meleeGeo.katana, M.plasmaGlow)
            glow.position.set(0.004, 0.235, 0)
            glow.scale.set(2.3, 1.02, 4)
            g.add(blade, glow)
        } else {
            const blade = new THREE.Mesh(G.blade, M.steel)
            blade.position.y = 0.2
            g.add(blade)
            mesh(G.box, M.gold, 0.26, 0.035, 0.06, 0, 0.19)                // guard
            mesh(G.cyl, M.dark, 0.026, 0.2, 0.026, 0, 0.08)                 // grip
            mesh(G.sphere, M.gold, 0.04, 0.04, 0.04, 0, -0.03)              // pommel
        }
        return g
    },

    attackChain() {
        const id = this.progress ? this.progress.melee : 'sword'
        const chain = MELEE_ATTACKS[id] || MELEE_ATTACKS.sword
        // use whatever moves are in the animation file; the sword moves are the fallback
        const ok = chain.filter(a => this.actions[a.clip])
        return ok.length ? ok : MELEE_ATTACKS.sword
    },
}
