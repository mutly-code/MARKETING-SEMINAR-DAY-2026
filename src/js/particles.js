import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import anime from 'animejs';
import { createNoise3D, createNoise4D } from 'simplex-noise';

let scene, camera, renderer, controls, clock, composer, bloomPass;
let particlesGeometry, particlesMaterial, particleSystem;
let currentPositions, sourcePositions, targetPositions, swarmPositions;
let particleSizes, particleOpacities, particleEffectStrengths;
let noise3D, noise4D;
let morphTimeline = null;
let isInitialized = false;
let isMorphing = false;

const CONFIG = {
    particleCount: 10000,
    shapeSize: 12,
    swarmDistanceFactor: 1.4,
    swirlFactor: 3.5,
    noiseFrequency: 0.08,
    noiseTimeScale: 0.03,
    noiseMaxStrength: 2.5,
    colorScheme: 'fire',
    morphDuration: 3500,
    particleSizeRange: [0.06, 0.2],
    starCount: 12000,
    bloomStrength: 1.2,
    bloomRadius: 0.4,
    bloomThreshold: 0.1,
    idleFlowStrength: 0.2,
    idleFlowSpeed: 0.06,
    idleRotationSpeed: 0.015,
    morphSizeFactor: 0.4,
    morphBrightnessFactor: 0.5
};

const SHAPES = [
    { name: 'DNA Helix', generator: generateDNAHelix },
    { name: 'Torus', generator: generateTorus },
    { name: 'Heart', generator: generateHeart },
    { name: 'Infinity', generator: generateInfinity },
    { name: 'Spiral', generator: generateSpiral },
    { name: 'Crystal', generator: generateCrystal }
];
let currentShapeIndex = 0;

const morphState = { progress: 0.0 };

const COLOR_SCHEMES = {
    fire: { startHue: 0, endHue: 50, saturation: 0.9, lightness: 0.65 },
    neon: { startHue: 290, endHue: 190, saturation: 1.0, lightness: 0.7 },
    nature: { startHue: 85, endHue: 165, saturation: 0.8, lightness: 0.6 },
    rainbow: { startHue: 0, endHue: 360, saturation: 0.85, lightness: 0.65 }
};

const tempVec = new THREE.Vector3();
const sourceVec = new THREE.Vector3();
const targetVec = new THREE.Vector3();
const swarmVec = new THREE.Vector3();
const noiseOffset = new THREE.Vector3();
const flowVec = new THREE.Vector3();
const bezPos = new THREE.Vector3();
const swirlAxis = new THREE.Vector3();
const currentVec = new THREE.Vector3();

function generateDNAHelix(count, size) {
    const points = new Float32Array(count * 3);
    const radius = size * 0.4;
    const height = size * 1.2;
    const turns = 2;
    const helixRadius = size * 0.15;
    
    for (let i = 0; i < count; i++) {
        const t = (i / count) * Math.PI * 2 * turns;
        const y = (i / count - 0.5) * height;
        const strand = Math.floor(Math.random() * 2);
        const phase = strand * Math.PI;
        
        points[i * 3] = Math.cos(t + phase) * radius;
        points[i * 3 + 1] = y;
        points[i * 3 + 2] = Math.sin(t + phase) * radius;
        
        if (Math.random() < 0.2) {
            const connectionPhase = Math.random() * Math.PI * 2;
            points[i * 3] += Math.cos(connectionPhase) * helixRadius;
            points[i * 3 + 2] += Math.sin(connectionPhase) * helixRadius;
        }
    }
    return points;
}

function generateTorus(count, size) {
    const points = new Float32Array(count * 3);
    const R = size * 0.7;
    const r = size * 0.3;
    for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 2;
        points[i * 3] = (R + r * Math.cos(phi)) * Math.cos(theta);
        points[i * 3 + 1] = r * Math.sin(phi);
        points[i * 3 + 2] = (R + r * Math.cos(phi)) * Math.sin(theta);
    }
    return points;
}

function generateHeart(count, size) {
    const points = new Float32Array(count * 3);
    const scale = size * 0.8;
    for (let i = 0; i < count; i++) {
        const t = Math.random() * Math.PI * 2;
        const r = Math.random();
        const x = r * 16 * Math.pow(Math.sin(t), 3);
        const y = r * (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
        const z = (Math.random() - 0.5) * size * 0.3;
        points[i * 3] = x * scale * 0.05;
        points[i * 3 + 1] = y * scale * 0.05;
        points[i * 3 + 2] = z;
    }
    return points;
}

function generateInfinity(count, size) {
    const points = new Float32Array(count * 3);
    const scale = size * 0.5;
    for (let i = 0; i < count; i++) {
        const t = Math.random() * Math.PI * 2;
        const thickness = (Math.random() - 0.5) * size * 0.1;
        const x = scale * Math.cos(t) / (1 + Math.sin(t) * Math.sin(t));
        const y = thickness;
        const z = scale * Math.sin(t) * Math.cos(t) / (1 + Math.sin(t) * Math.sin(t));
        points[i * 3] = x;
        points[i * 3 + 1] = y;
        points[i * 3 + 2] = z;
    }
    return points;
}

function generateSpiral(count, size) {
    const points = new Float32Array(count * 3);
    const turns = 5;
    const heightScale = size * 0.3;
    for (let i = 0; i < count; i++) {
        const t = (i / count) * Math.PI * 2 * turns;
        const r = (t / (Math.PI * 2 * turns)) * size;
        const thickness = Math.random() * size * 0.1;
        const angle = t + Math.random() * 0.2;
        points[i * 3] = (r * Math.cos(angle)) + (Math.random() - 0.5) * thickness;
        points[i * 3 + 1] = (i / count - 0.5) * heightScale;
        points[i * 3 + 2] = (r * Math.sin(angle)) + (Math.random() - 0.5) * thickness;
    }
    return points;
}

function generateCrystal(count, size) {
    const points = new Float32Array(count * 3);
    const hexRadius = size * 0.6;
    const height = size * 1.2;
    const layers = 6;
    for (let i = 0; i < count; i++) {
        const layer = Math.floor(Math.random() * layers);
        const layerHeight = (layer / (layers - 1) - 0.5) * height;
        const layerFactor = 1 - Math.pow(2 * Math.abs(layer / (layers - 1) - 0.5), 2);
        const currentRadius = hexRadius * layerFactor;
        
        let angle;
        if (Math.random() < 0.5) {
            angle = (Math.floor(Math.random() * 6) * Math.PI / 3) + (Math.random() - 0.5) * 0.2;
        } else {
            angle = (Math.floor(Math.random() * 6) * Math.PI / 3) + (Math.PI / 6) + (Math.random() - 0.5) * 0.2;
        }
        
        const radiusNoise = (Math.random() - 0.5) * size * 0.1;
        const finalRadius = currentRadius + radiusNoise;
        
        points[i * 3] = Math.cos(angle) * finalRadius;
        points[i * 3 + 1] = layerHeight + (Math.random() - 0.5) * size * 0.05;
        points[i * 3 + 2] = Math.sin(angle) * finalRadius;
        
        if (Math.random() < 0.2) {
            const innerRadius = finalRadius * Math.random() * 0.8;
            points[i * 3] = Math.cos(angle) * innerRadius;
            points[i * 3 + 2] = Math.sin(angle) * innerRadius;
        }
    }
    return points;
}

function init() {
    let progress = 0;
    const progressBar = document.getElementById('particles-progress');
    const loadingScreen = document.getElementById('particles-loading');
    
    function updateProgress(increment) {
        progress += increment;
        if (progressBar) progressBar.style.width = `${Math.min(100, progress)}%`;
        if (progress >= 100 && loadingScreen) {
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                setTimeout(() => { loadingScreen.style.display = 'none'; }, 800);
            }, 300);
        }
    }

    clock = new THREE.Clock();
    noise3D = createNoise3D(() => Math.random());
    noise4D = createNoise4D(() => Math.random());
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000308, 0.025);
    updateProgress(10);

    const container = document.getElementById('particles-container');
    const width = container ? container.clientWidth : window.innerWidth;
    const height = container ? container.clientHeight : window.innerHeight;

    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    // Move the initial camera a bit closer so the particles fill the hero screen perfectly
    camera.position.set(0, 2, 20);
    camera.lookAt(scene.position);
    updateProgress(10);

    const canvas = document.getElementById('webglCanvas');
    if (!canvas) {
        console.error("WebGL canvas not found.");
        return;
    }
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    updateProgress(15);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 4;
    controls.maxDistance = 70;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
    controls.enableZoom = false; // Disable zooming, don't want to interfere with page scrolling
    controls.enablePan = false;
    updateProgress(10);

    scene.add(new THREE.AmbientLight(0x505070));
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.7);
    dirLight1.position.set(10, 15, 10);
    scene.add(dirLight1);
    const dirLight2 = new THREE.DirectionalLight(0x99bbff, 1.0);
    dirLight2.position.set(-10, -8, -10);
    scene.add(dirLight2);
    updateProgress(15);

    setupPostProcessing(width, height);
    updateProgress(10);
    createStarfield();
    updateProgress(15);
    setupParticleSystem();
    updateProgress(20);

    window.addEventListener('resize', () => {
        const w = container ? container.clientWidth : window.innerWidth;
        const h = container ? container.clientHeight : window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        composer.setSize(w, h);
    });
    
    // Canvas click directly triggers morph instead of document
    canvas.addEventListener('click', triggerMorph);
    
    const shapeBtn = document.getElementById('shape-btn');
    if (shapeBtn) shapeBtn.addEventListener('click', triggerMorph);

    document.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', (e) => {
            document.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
            e.target.classList.add('active');
            CONFIG.colorScheme = e.target.dataset.scheme;
            updateColors();
        });
    });

    const activeOption = document.querySelector(`.color-option[data-scheme="${CONFIG.colorScheme}"]`);
    if (activeOption) activeOption.classList.add('active');
    
    updateProgress(15);
    isInitialized = true;
    animate();
}

function setupPostProcessing(width, height) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), CONFIG.bloomStrength, CONFIG.bloomRadius, CONFIG.bloomThreshold);
    composer.addPass(bloomPass);
}

function createStarfield() {
    const starGeometry = new THREE.BufferGeometry();
    const starVertices = new Float32Array(CONFIG.starCount * 3);
    const starSizes = new Float32Array(CONFIG.starCount);
    const starColors = new Float32Array(CONFIG.starCount * 3);
    for (let i = 0; i < CONFIG.starCount; i++) {
        tempVec.set(
            THREE.MathUtils.randFloatSpread(500),
            THREE.MathUtils.randFloatSpread(500),
            THREE.MathUtils.randFloatSpread(500)
        );
        if (tempVec.length() < 120) tempVec.setLength(120 + Math.random() * 250);
        starVertices[i * 3] = tempVec.x;
        starVertices[i * 3 + 1] = tempVec.y;
        starVertices[i * 3 + 2] = tempVec.z;
        starSizes[i] = Math.random() * 0.12 + 0.04;
        const color = new THREE.Color();
        color.setHSL(Math.random() < 0.15 ? Math.random() : 0.65, 0.6, 0.75 + Math.random() * 0.25);
        starColors[i * 3] = color.r;
        starColors[i * 3 + 1] = color.g;
        starColors[i * 3 + 2] = color.b;
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
    starGeometry.setAttribute('size', new THREE.Float32BufferAttribute(starSizes, 1));
    const starMaterial = new THREE.ShaderMaterial({
        uniforms: { pointTexture: { value: createStarTexture() } },
        vertexShader: `
            attribute float size;
            varying vec3 vColor;
            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (450.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }`,
        fragmentShader: `
            uniform sampler2D pointTexture;
            varying vec3 vColor;
            void main() {
                float alpha = texture2D(pointTexture, gl_PointCoord).a;
                if (alpha < 0.1) discard;
                gl_FragColor = vec4(vColor, alpha * 0.85);
            }`,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        vertexColors: true
    });
    scene.add(new THREE.Points(starGeometry, starMaterial));
}

function createStarTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.25, 'rgba(255,255,255,0.7)');
    gradient.addColorStop(0.6, 'rgba(255,255,255,0.2)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
}

function setupParticleSystem() {
    targetPositions = SHAPES.map(shape => shape.generator(CONFIG.particleCount, CONFIG.shapeSize));
    particlesGeometry = new THREE.BufferGeometry();
    currentPositions = new Float32Array(targetPositions[0]);
    sourcePositions = new Float32Array(targetPositions[0]);
    swarmPositions = new Float32Array(CONFIG.particleCount * 3);
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));

    particleSizes = new Float32Array(CONFIG.particleCount);
    particleOpacities = new Float32Array(CONFIG.particleCount);
    particleEffectStrengths = new Float32Array(CONFIG.particleCount);
    for (let i = 0; i < CONFIG.particleCount; i++) {
        particleSizes[i] = THREE.MathUtils.randFloat(CONFIG.particleSizeRange[0], CONFIG.particleSizeRange[1]);
        particleOpacities[i] = 0.9;
        particleEffectStrengths[i] = 0.0;
    }
    particlesGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    particlesGeometry.setAttribute('opacity', new THREE.BufferAttribute(particleOpacities, 1));
    particlesGeometry.setAttribute('aEffectStrength', new THREE.BufferAttribute(particleEffectStrengths, 1));

    const colors = new Float32Array(CONFIG.particleCount * 3);
    updateColorArray(colors, currentPositions);
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    particlesMaterial = new THREE.ShaderMaterial({
        uniforms: { pointTexture: { value: createStarTexture() } },
        vertexShader: `
            attribute float size;
            attribute float opacity;
            attribute float aEffectStrength;
            varying vec3 vColor;
            varying float vOpacity;
            varying float vEffectStrength;
            void main() {
                vColor = color;
                vOpacity = opacity;
                vEffectStrength = aEffectStrength;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                float sizeScale = 1.0 - vEffectStrength * ${CONFIG.morphSizeFactor.toFixed(2)};
                gl_PointSize = size * sizeScale * (450.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }`,
        fragmentShader: `
            uniform sampler2D pointTexture;
            varying vec3 vColor;
            varying float vOpacity;
            varying float vEffectStrength;
            void main() {
                float alpha = texture2D(pointTexture, gl_PointCoord).a;
                if (alpha < 0.05) discard;
                vec3 finalColor = vColor * (1.0 + vEffectStrength * ${CONFIG.morphBrightnessFactor.toFixed(2)});
                gl_FragColor = vec4(finalColor, alpha * vOpacity);
            }`,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        transparent: true,
        vertexColors: true
    });

    particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particleSystem);
}

function updateColorArray(colors, positionsArray) {
    const colorScheme = COLOR_SCHEMES[CONFIG.colorScheme];
    const center = new THREE.Vector3(0, 0, 0);
    const maxRadius = CONFIG.shapeSize * 1.2;
    for (let i = 0; i < CONFIG.particleCount; i++) {
        const i3 = i * 3;
        tempVec.fromArray(positionsArray, i3);
        const dist = tempVec.distanceTo(center);
        let hue = CONFIG.colorScheme === 'rainbow'
            ? ((tempVec.x / maxRadius + 1) / 2 * 120 + (tempVec.y / maxRadius + 1) / 2 * 120 + (tempVec.z / maxRadius + 1) / 2 * 120) % 360
            : THREE.MathUtils.mapLinear(dist, 0, maxRadius, colorScheme.startHue, colorScheme.endHue);
        const noiseValue = (noise3D(tempVec.x * 0.15, tempVec.y * 0.15, tempVec.z * 0.15) + 1) * 0.5;
        const saturation = THREE.MathUtils.clamp(colorScheme.saturation * (0.85 + noiseValue * 0.25), 0, 1);
        const lightness = THREE.MathUtils.clamp(colorScheme.lightness * (0.9 + noiseValue * 0.2), 0.1, 0.9);
        new THREE.Color().setHSL(hue / 360, saturation, lightness).toArray(colors, i3);
    }
}

function updateColors() {
    const colors = particlesGeometry.attributes.color.array;
    updateColorArray(colors, particlesGeometry.attributes.position.array);
    particlesGeometry.attributes.color.needsUpdate = true;
}

function triggerMorph() {
    if (isMorphing) return;
    isMorphing = true;
    controls.autoRotate = false;
    
    const infoEl = document.getElementById('particles-info');
    if (infoEl) {
        infoEl.innerText = `Morphing...`;
        infoEl.style.textShadow = '0 0 8px rgba(255, 150, 50, 0.9)';
    }

    sourcePositions.set(currentPositions);
    const nextShapeIndex = (currentShapeIndex + 1) % SHAPES.length;
    const nextTargetPositions = targetPositions[nextShapeIndex];
    const centerOffsetAmount = CONFIG.shapeSize * CONFIG.swarmDistanceFactor;
    
    for (let i = 0; i < CONFIG.particleCount; i++) {
        const i3 = i * 3;
        sourceVec.fromArray(sourcePositions, i3);
        targetVec.fromArray(nextTargetPositions, i3);
        swarmVec.lerpVectors(sourceVec, targetVec, 0.5);
        const offsetDir = tempVec.set(
            noise3D(i * 0.04, 10, 10),
            noise3D(20, i * 0.04, 20),
            noise3D(30, 30, i * 0.04)
        ).normalize();
        const distFactor = sourceVec.distanceTo(targetVec) * 0.08 + centerOffsetAmount;
        swarmVec.addScaledVector(offsetDir, distFactor * (0.6 + Math.random() * 0.7));
        swarmPositions[i3] = swarmVec.x;
        swarmPositions[i3 + 1] = swarmVec.y;
        swarmPositions[i3 + 2] = swarmVec.z;
    }
    
    currentShapeIndex = nextShapeIndex;
    morphState.progress = 0;
    
    if (morphTimeline) morphTimeline.pause();
    morphTimeline = anime({
        targets: morphState,
        progress: 1,
        duration: CONFIG.morphDuration,
        easing: 'cubicBezier(0.33, 0, 0.66, 1)',
        complete: () => {
            if (infoEl) {
                infoEl.innerText = `Shape: ${SHAPES[currentShapeIndex].name} (Click to morph)`;
                infoEl.style.textShadow = '0 0 6px rgba(0, 128, 255, 0.9)';
            }
            currentPositions.set(targetPositions[currentShapeIndex]);
            particlesGeometry.attributes.position.needsUpdate = true;
            particleEffectStrengths.fill(0.0);
            particlesGeometry.attributes.aEffectStrength.needsUpdate = true;
            sourcePositions.set(targetPositions[currentShapeIndex]);
            updateColors();
            isMorphing = false;
            controls.autoRotate = true;
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    if (!isInitialized) return;
    const elapsedTime = clock.getElapsedTime();
    const deltaTime = clock.getDelta();
    controls.update();
    const positions = particlesGeometry.attributes.position.array;
    const effectStrengths = particlesGeometry.attributes.aEffectStrength.array;

    if (isMorphing) {
        updateMorphAnimation(positions, effectStrengths, elapsedTime, deltaTime);
    } else {
        updateIdleAnimation(positions, effectStrengths, elapsedTime, deltaTime);
    }
    particlesGeometry.attributes.position.needsUpdate = true;
    if (isMorphing || particlesGeometry.attributes.aEffectStrength.needsUpdate) {
        particlesGeometry.attributes.aEffectStrength.needsUpdate = true;
    }
    composer.render(deltaTime);
}

function updateMorphAnimation(positions, effectStrengths, elapsedTime, deltaTime) {
    const t = morphState.progress;
    const targets = targetPositions[currentShapeIndex];
    const effectStrength = Math.sin(t * Math.PI);
    const currentSwirl = effectStrength * CONFIG.swirlFactor * deltaTime * 40;
    const currentNoise = effectStrength * CONFIG.noiseMaxStrength;

    for (let i = 0; i < CONFIG.particleCount; i++) {
        const i3 = i * 3;
        sourceVec.fromArray(sourcePositions, i3);
        swarmVec.fromArray(swarmPositions, i3);
        targetVec.fromArray(targets, i3);

        const t_inv = 1.0 - t;
        const t_inv_sq = t_inv * t_inv;
        const t_sq = t * t;
        bezPos.copy(sourceVec).multiplyScalar(t_inv_sq);
        bezPos.addScaledVector(swarmVec, 2.0 * t_inv * t);
        bezPos.addScaledVector(targetVec, t_sq);

        if (currentSwirl > 0.01) {
            tempVec.subVectors(bezPos, sourceVec);
            swirlAxis.set(
                noise3D(i * 0.015, elapsedTime * 0.08, 0),
                noise3D(0, i * 0.015, elapsedTime * 0.08 + 4),
                noise3D(elapsedTime * 0.08 + 8, 0, i * 0.015)
            ).normalize();
            tempVec.applyAxisAngle(swirlAxis, currentSwirl * (0.6 + Math.random() * 0.4));
            bezPos.copy(sourceVec).add(tempVec);
        }

        if (currentNoise > 0.01) {
            const noiseTime = elapsedTime * CONFIG.noiseTimeScale;
            noiseOffset.set(
                noise4D(bezPos.x * CONFIG.noiseFrequency, bezPos.y * CONFIG.noiseFrequency, bezPos.z * CONFIG.noiseFrequency, noiseTime),
                noise4D(bezPos.x * CONFIG.noiseFrequency + 100, bezPos.y * CONFIG.noiseFrequency + 100, bezPos.z * CONFIG.noiseFrequency + 100, noiseTime),
                noise4D(bezPos.x * CONFIG.noiseFrequency + 200, bezPos.y * CONFIG.noiseFrequency + 200, bezPos.z * CONFIG.noiseFrequency + 200, noiseTime)
            );
            bezPos.addScaledVector(noiseOffset, currentNoise);
        }

        positions[i3] = bezPos.x;
        positions[i3 + 1] = bezPos.y;
        positions[i3 + 2] = bezPos.z;
        effectStrengths[i] = effectStrength;
    }
}

function updateIdleAnimation(positions, effectStrengths, elapsedTime, deltaTime) {
    const breathScale = 1.0 + Math.sin(elapsedTime * 0.4) * 0.01;
    const timeScaled = elapsedTime * CONFIG.idleFlowSpeed;
    const freq = 0.08;
    let needsEffectStrengthReset = false;

    for (let i = 0; i < CONFIG.particleCount; i++) {
        const i3 = i * 3;
        sourceVec.fromArray(sourcePositions, i3);
        tempVec.copy(sourceVec).multiplyScalar(breathScale);
        flowVec.set(
            noise4D(tempVec.x * freq, tempVec.y * freq, tempVec.z * freq, timeScaled),
            noise4D(tempVec.x * freq + 10, tempVec.y * freq + 10, tempVec.z * freq + 10, timeScaled),
            noise4D(tempVec.x * freq + 20, tempVec.y * freq + 20, tempVec.z * freq + 20, timeScaled)
        );
        tempVec.addScaledVector(flowVec, CONFIG.idleFlowStrength);
        currentVec.fromArray(positions, i3);
        currentVec.lerp(tempVec, 0.06);
        positions[i3] = currentVec.x;
        positions[i3 + 1] = currentVec.y;
        positions[i3 + 2] = currentVec.z;

        if (effectStrengths[i] !== 0.0) {
            effectStrengths[i] = 0.0;
            needsEffectStrengthReset = true;
        }
    }
}

// Make init accessible globally to be called from index.html if needed or call it immediately
document.addEventListener('DOMContentLoaded', () => {
    // Only init if we're on the landing page
    if (document.getElementById('particles-container')) {
        init();
    }
});
