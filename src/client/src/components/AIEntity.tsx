import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type EntityState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'CRISIS' | 'DISCONNECTED' | string;

interface AIEntityProps {
  state?: EntityState;
  audioActive?: boolean;
  amplitude?: number;
  interactive?: boolean;
}

// ─── Ultra-Smooth Organic Volumetric Entity Shaders ───
const vertexShader = `
  uniform float uTime;
  uniform float uNoiseFreq;
  uniform float uNoiseAmp;
  uniform float uAudioAmp;
  uniform float uSpeed;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying float vDisplacement;

  // Ultra-Smooth 3D Periodic Simplex Noise
  vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  // Smooth displacement function
  float getDisplacement(vec3 p, float t) {
    float n1 = snoise(p * uNoiseFreq + vec3(0.0, t * 0.35, t * 0.15));
    float n2 = snoise(p * (uNoiseFreq * 1.5) - vec3(t * 0.2, 0.0, t * 0.3)) * 0.35;
    return (n1 + n2) * (uNoiseAmp + uAudioAmp * 0.22);
  }

  void main() {
    vPosition = position;
    float t = uTime * uSpeed;

    float disp = getDisplacement(position, t);
    vDisplacement = disp;

    // Normal calculation via finite differences for silky smooth lighting
    float e = 0.02;
    vec3 p = position;
    float dx = getDisplacement(p + vec3(e, 0.0, 0.0), t) - disp;
    float dy = getDisplacement(p + vec3(0.0, e, 0.0), t) - disp;
    float dz = getDisplacement(p + vec3(0.0, 0.0, e), t) - disp;
    vec3 computedNormal = normalize(normal - vec3(dx, dy, dz) / e);

    vNormal = normalize(normalMatrix * computedNormal);

    vec3 newPosition = position + normal * disp;
    vWorldPosition = (modelMatrix * vec4(newPosition, 1.0)).xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 uColorCore;
  uniform vec3 uColorAura;
  uniform vec3 uColorRim;
  uniform float uRoughness;
  uniform float uFresnelPower;
  uniform float uTime;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying float vDisplacement;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 normal = normalize(vNormal);

    // Smooth organic fresnel rim
    float fresnel = pow(1.0 - max(0.0, dot(viewDir, normal)), uFresnelPower);

    // Warm diffused core lighting
    vec3 lightDir1 = normalize(vec3(0.6, 1.0, 0.8));
    vec3 lightDir2 = normalize(vec3(-0.6, -0.8, -0.5));
    float diff1 = max(0.0, dot(normal, lightDir1)) * 0.6 + 0.4;
    float diff2 = max(0.0, dot(normal, lightDir2)) * 0.3;

    // Blend harmonious core, aura and displacement
    vec3 baseColor = mix(uColorCore, uColorAura, clamp(vDisplacement * 1.8 + 0.35, 0.0, 1.0));
    vec3 illuminated = baseColor * (diff1 + diff2);
    
    // Vivid pearlescent rim glow
    vec3 finalColor = mix(illuminated, uColorRim, fresnel * 0.9);
    finalColor += uColorRim * pow(fresnel, 3.0) * 0.5;

    gl_FragColor = vec4(finalColor, 0.95);
  }
`;

interface StatePreset {
  core: [number, number, number];
  aura: [number, number, number];
  rim: [number, number, number];
  noiseFreq: number;
  noiseAmp: number;
  speed: number;
  fresnelPower: number;
}

const PRESETS: Record<string, StatePreset> = {
  IDLE: {
    core: [0.06, 0.24, 0.48],      // Deep oceanic sapphire
    aura: [0.12, 0.48, 0.52],      // Gentle turquoise sage
    rim: [0.75, 0.92, 1.0],        // Crisp alabaster/cyan rim
    noiseFreq: 0.75,
    noiseAmp: 0.08,
    speed: 0.5,
    fresnelPower: 2.2,
  },
  LISTENING: {
    core: [0.04, 0.38, 0.65],      // Vibrant electric cyan
    aura: [0.18, 0.62, 0.78],
    rim: [0.9, 0.98, 1.0],
    noiseFreq: 0.9,
    noiseAmp: 0.12,
    speed: 1.1,
    fresnelPower: 1.8,
  },
  THINKING: {
    core: [0.26, 0.18, 0.56],      // Reflective ethereal violet/indigo
    aura: [0.16, 0.42, 0.68],
    rim: [0.92, 0.85, 1.0],
    noiseFreq: 1.0,
    noiseAmp: 0.11,
    speed: 1.4,
    fresnelPower: 2.0,
  },
  SPEAKING: {
    core: [0.08, 0.36, 0.68],      // Warm harmonic emerald/sapphire
    aura: [0.16, 0.65, 0.55],
    rim: [0.92, 0.98, 1.0],
    noiseFreq: 0.85,
    noiseAmp: 0.14,
    speed: 1.3,
    fresnelPower: 1.7,
  },
  CRISIS: {
    core: [0.65, 0.18, 0.18],      // Grounding terracotta amber
    aura: [0.75, 0.45, 0.15],
    rim: [1.0, 0.88, 0.85],
    noiseFreq: 0.6,
    noiseAmp: 0.06,
    speed: 0.4,
    fresnelPower: 2.6,
  },
  DISCONNECTED: {
    core: [0.22, 0.25, 0.28],      // Slate graphite
    aura: [0.32, 0.35, 0.38],
    rim: [0.65, 0.68, 0.72],
    noiseFreq: 0.4,
    noiseAmp: 0.04,
    speed: 0.2,
    fresnelPower: 3.0,
  }
};

export function AIEntity({ 
  state = 'IDLE', 
  audioActive = false, 
  amplitude = 0 
}: AIEntityProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameId = useRef<number>(0);
  const smoothedAudio = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ─── Scene, Camera, Renderer Setup ───
    const scene = new THREE.Scene();
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 300;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.z = 3.5;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // ─── High-Density Smooth Sphere Geometry ───
    const geometry = new THREE.SphereGeometry(1.0, 128, 128);
    const initialPreset = PRESETS[state] || PRESETS.IDLE;

    const uniforms = {
      uTime: { value: 0 },
      uSpeed: { value: initialPreset.speed },
      uNoiseFreq: { value: initialPreset.noiseFreq },
      uNoiseAmp: { value: initialPreset.noiseAmp },
      uAudioAmp: { value: 0 },
      uColorCore: { value: new THREE.Color(...initialPreset.core) },
      uColorAura: { value: new THREE.Color(...initialPreset.aura) },
      uColorRim: { value: new THREE.Color(...initialPreset.rim) },
      uFresnelPower: { value: initialPreset.fresnelPower },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthWrite: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Soft Ambient Glow Sprite
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      grad.addColorStop(0.35, 'rgba(38, 160, 230, 0.16)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const glowTexture = new THREE.CanvasTexture(canvas);
    const glowMat = new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.45,
    });
    const glowSprite = new THREE.Sprite(glowMat);
    glowSprite.scale.set(3.6, 3.6, 1);
    scene.add(glowSprite);

    // ─── Smooth Animation Loop with Organic Damping ───
    let lastTime = performance.now();
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      animFrameId.current = requestAnimationFrame(animate);
      const delta = Math.min((currentTime - lastTime) * 0.001, 0.1);
      lastTime = currentTime;
      const elapsed = (currentTime - startTime) * 0.001;

      // Silky Smooth Audio Amplitude Damping
      const targetAudio = audioActive ? Math.min(amplitude, 1.0) : 0;
      smoothedAudio.current += (targetAudio - smoothedAudio.current) * 0.15;

      // Preset Target & Smooth Lerp
      const targetPreset = PRESETS[state] || PRESETS.IDLE;
      const lerpSpeed = delta * 2.8;

      uniforms.uTime.value = elapsed;
      uniforms.uSpeed.value = THREE.MathUtils.lerp(uniforms.uSpeed.value, targetPreset.speed, lerpSpeed);
      uniforms.uNoiseFreq.value = THREE.MathUtils.lerp(uniforms.uNoiseFreq.value, targetPreset.noiseFreq, lerpSpeed);
      uniforms.uNoiseAmp.value = THREE.MathUtils.lerp(uniforms.uNoiseAmp.value, targetPreset.noiseAmp, lerpSpeed);
      uniforms.uAudioAmp.value = smoothedAudio.current;
      uniforms.uFresnelPower.value = THREE.MathUtils.lerp(uniforms.uFresnelPower.value, targetPreset.fresnelPower, lerpSpeed);

      const targetCore = new THREE.Color(...targetPreset.core);
      const targetAura = new THREE.Color(...targetPreset.aura);
      const targetRim = new THREE.Color(...targetPreset.rim);

      uniforms.uColorCore.value.lerp(targetCore, lerpSpeed);
      uniforms.uColorAura.value.lerp(targetAura, lerpSpeed);
      uniforms.uColorRim.value.lerp(targetRim, lerpSpeed);

      // Gentle smooth axial float
      mesh.rotation.y = elapsed * 0.12;
      mesh.rotation.x = Math.sin(elapsed * 0.15) * 0.08;

      renderer.render(scene, camera);
    };

    animFrameId.current = requestAnimationFrame(animate);

    // Responsive Canvas
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      resizeObserver.disconnect();
      geometry.dispose();
      material.dispose();
      glowTexture.dispose();
      glowMat.dispose();
      renderer.dispose();
    };
  }, [state, audioActive, amplitude]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}
      aria-label="MindCare Living 3D Volumetric Presence"
    />
  );
}
