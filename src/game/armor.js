// Energy armor: starts at 50% and is always active while it lasts — a hit costs 20% armor instead of a heart;
// at 0% it breaks. Armor plates (+20%) can be found on the floor.
// Mixed into GameEngine.prototype — `this` is the engine.
import * as THREE from 'three';
import {clamp} from './util';
import {toughMul} from './loadout';

export const ARMOR_START = 50
export const ARMOR_HIT = 20
export const ARMOR_PLATE = 20

const vert = `
varying vec3 vN;
varying vec3 vP;
void main() {
    vN = normalize(normalMatrix * normal);
    vP = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const frag = `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
varying vec3 vN;
varying vec3 vP;
void main() {
    float rim = pow(1.0 - abs(vN.z), 2.2);
    float scan = 0.55 + 0.45 * sin(vP.y * 18.0 - uTime * 5.0);
    float hex = 0.75 + 0.25 * sin(vP.x * 40.0) * sin(vP.y * 40.0);
    float a = clamp((rim * 0.95 + 0.07) * scan * hex * uIntensity, 0.0, 1.0);
    gl_FragColor = vec4(uColor, a);
}`

export const armorMethods = {
    buildArmorAura() {
        const mat = new THREE.ShaderMaterial({
            vertexShader: vert,
            fragmentShader: frag,
            uniforms: {
                uColor: {value: new THREE.Color(0x38e8ff)},
                uIntensity: {value: 0},
                uTime: {value: 0},
            },
            transparent: true,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        })
        const aura = new THREE.Mesh(this.geo.sphere, mat)
        aura.scale.set(this.playerH * 0.36, this.playerH * 0.6, this.playerH * 0.3)
        aura.position.y = this.playerH * 0.5
        aura.renderOrder = 13
        this.playerRoot.add(aura)
        this.aura = aura
        this.auraFlash = 0
    },

    toggleArmor() {
        const s = this.stats
        if (!this.player || this.player.dead) return
        if (s.armor <= 0) {
            this.floatText(this.player.x, this.player.y - this.playerH - 16, 'NO ARMOR', 'warn')
            return
        }
        s.armorOn = !s.armorOn
        this.auraFlash = s.armorOn ? 0.5 : 0
        this.floatText(this.player.x, this.player.y - this.playerH - 16, s.armorOn ? 'ARMOR ON' : 'ARMOR OFF', 'armor')
        this.emitHud(true)
    },

    // returns true when the armor took the hit
    absorbHit() {
        const s = this.stats
        if (s.armor <= 0) return false
        const p = this.player
        // the Knight (guardian) wears his armor down half as fast
        const cost = this.heroTrait && this.heroTrait() === 'guardian' ? ARMOR_HIT / 2 : ARMOR_HIT
        const wear = cost * ((this.diff && this.diff.armor) || 1) * toughMul(this.progress.stats.tough)
        s.armor = Math.max(0, s.armor - wear)
        this.auraFlash = 1
        this.burst(p.x, p.y - this.playerH * 0.5, 22, 0x38e8ff, 320)
        if (s.armor <= 0) {
            s.armorOn = false
            this.burst(p.x, p.y - this.playerH * 0.5, 60, 0x9ff3ff, 620)
            this.toast('ARMOR BROKEN', 'boss')
            this.shake = Math.max(this.shake, 18)
        }
        return true
    },

    addArmor(v) {
        const s = this.stats
        const before = s.armor
        s.armor = Math.min(100, s.armor + v)
        if (before <= 0 && s.armor > 0) s.armorOn = true
        this.auraFlash = 0.6
        return s.armor - before
    },

    updateArmor(dt) {
        if (!this.aura) return
        this.auraFlash = Math.max(0, this.auraFlash - dt * 2.2)
        // the shield is not shown all the time any more — it only flashes up when the armor takes a hit
        const base = 0
        const u = this.aura.material.uniforms
        u.uTime.value = this.time
        u.uIntensity.value = clamp(base + this.auraFlash * 2.2, 0, 3)
        u.uColor.value.setHex(this.auraFlash > 0.6 ? 0xc8fbff : 0x38e8ff)
        this.aura.visible = u.uIntensity.value > 0.01
        const pulse = 1 + Math.sin(this.time * 4) * 0.02 + this.auraFlash * 0.12
        this.aura.scale.set(this.playerH * 0.36 * pulse, this.playerH * 0.6 * pulse, this.playerH * 0.3 * pulse)
    },
}
