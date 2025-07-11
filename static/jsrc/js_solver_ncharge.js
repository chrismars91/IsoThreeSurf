import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { IsosurfaceVisualizerDirect } from './isosurface.js';
import { OverflowFieldSolver, FieldSolver } from './fieldSolver.js';


function getRandom() {
    return (Math.random() * 2 - 1);
}

class CalculateNBodyElectricField extends OverflowFieldSolver {
    constructor() {
        super();
        this.k = 8.99e9;
        this.gridSize = 150;
        this.charges = [
            {
                charge: 2e-6,
                position: [-0.5, 0, 0],
                radius: 0.1
            },
            {
                charge: -1.5e-6,
                position: [0.7, 0, 0],
                radius: 0.08
            }
        ];
        for(let i = 0; i < 20; i += 1) {
            const chargeSign = Math.random() > 0.5 ? 1 : -1;
            const chargeMagnitude = Math.random() * 3e-6 + 1e-6; // Between 1 and 4
            this.charges.push({
                charge: chargeSign * chargeMagnitude,
                position: [getRandom() * 3.0, getRandom() * 3.0, getRandom() * 3.0],
                radius: Math.abs(chargeMagnitude) * 2e4 + 0.03
            });
        }
    }

    setCharges(charges) {
        this.charges = charges;
    }

    calculateElectricField(r) {
        let Ex = 0, Ey = 0, Ez = 0;
        
        for (const charge of this.charges) {
            const rx = r[0] - charge.position[0];
            const ry = r[1] - charge.position[1];
            const rz = r[2] - charge.position[2];
            const distance = Math.sqrt(rx * rx + ry * ry + rz * rz);
            
            if (distance < charge.radius) continue;
            // Electric field magnitude: E = k * |q| / r²
            // Field direction: away from positive charges, toward negative charges
            const fieldMagnitude = (this.k * Math.abs(charge.charge)) / (distance * distance * distance);
            const chargeSign = Math.sign(charge.charge);
            Ex += chargeSign * fieldMagnitude * rx;
            Ey += chargeSign * fieldMagnitude * ry;
            Ez += chargeSign * fieldMagnitude * rz;
        }
        
        return [Ex, Ey, Ez];
    }

    calculateElectricPotential(r) {
        let potential = 0;
        
        for (const charge of this.charges) {
            const rx = r[0] - charge.position[0];
            const ry = r[1] - charge.position[1];
            const rz = r[2] - charge.position[2];
            const distance = Math.sqrt(rx * rx + ry * ry + rz * rz);
            
            if (distance < charge.radius) {
                // Inside the charge, use constant potential
                potential += this.k * charge.charge / charge.radius;
            } else {
                // Outside the charge: V = k * q / r
                potential += this.k * charge.charge / distance;
            }
        }
        
        return potential;
    }

    async solveField() {
        this.updateProgress(0, 100, "Setting up electric field calculation...");
        const grid = this.createGrid({
            x: [-7.1, 7.1],
            y: [-7.1, 7.1],
            z: [-7.1, 7.1]
        });
        
        const fieldCalculator = (r) => {
            const E = this.calculateElectricField(r);
            const potential = this.calculateElectricPotential(r);
            return {
                field: E,
                scalars: [potential]
            };
        };
        
        const results = await this.calculateFieldAtPoints(grid, fieldCalculator);
        this.updateProgress(90, 100, "Processing field data...");
        // await this.normalizeAndCreateFieldData(results, 0); // Use potential as primary scalar
        await this.createRawFieldData(results, 0);
        this.updateProgress(100, 100, "Electric field calculation complete!");
        return this.fieldData;
    }

    getChargesGeometry() {
        return this.charges.map(charge => ({
            position: new THREE.Vector3(charge.position[0], charge.position[1], charge.position[2]),
            radius: charge.radius,
            charge: charge.charge,
            isPositive: charge.charge > 0
        }));
    }
}


async function init() {
    // field solver
    ///////////////////////////////////////////////////////////////
    const loadingScreen = document.getElementById('loadingScreen');
    const progressFill = document.getElementById('progressFill');
    const progressDetails = document.getElementById('progressDetails');

    function updateProgress(percent, message) {
        progressFill.style.width = `${percent}%`;
        progressDetails.textContent = message;
    }

    const solver = new CalculateNBodyElectricField();
    solver.setProgressCallback(updateProgress);
    const fieldData = await solver.solveField();

    loadingScreen.style.display = 'none';
    document.getElementById('controls').style.display = 'block';
    
    // basics
    ///////////////////////////////////////////////////////////////
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.001, 100);
    camera.position.set(4, 3, 4);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    const clock = new THREE.Clock();
    const stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);

    // charges
    ///////////////////////////////////////////////////////////////
    const chargeGeometry = solver.getChargesGeometry();
    chargeGeometry.forEach(charge => {
        const geometry = new THREE.SphereGeometry(charge.radius, 32, 32);
        const material = new THREE.MeshPhongMaterial({
            color: charge.isPositive ? 0xff4444 : 0x4444ff,
            transparent: true,
            opacity: 0.8
        });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(charge.position);
        scene.add(sphere);
    });
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // visualizer
    ///////////////////////////////////////////////////////////////
    const visualizer = new IsosurfaceVisualizerDirect(fieldData); 
    visualizer.opacity = parseFloat(document.getElementById('opacity').value);
    visualizer.numSurfaces = parseInt(document.getElementById('numSurfaces').value);
    visualizer.createIsosurfaces(scene);

    // UI
    setupControls(visualizer, scene);  
    
    // animation
    ///////////////////////////////////////////////////////////////
    function animate() {
        const deltaTime = clock.getDelta();
        controls.update();
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
        stats.update();
    }

    // window resize
    ///////////////////////////////////////////////////////////////
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

function setupControls(visualizer, scene) {
    const numSurfacesSlider = document.getElementById('numSurfaces');
    const numSurfacesValue = document.getElementById('numSurfacesValue');
    numSurfacesSlider.addEventListener('input', (e) => {
        visualizer.numSurfaces = parseInt(e.target.value);
        numSurfacesValue.textContent = e.target.value;
        visualizer.createIsosurfaces(scene);
    });
    
    const opacitySlider = document.getElementById('opacity');
    const opacityValue = document.getElementById('opacityValue');
    opacitySlider.addEventListener('input', (e) => {
        const opacity = parseFloat(e.target.value);
        opacityValue.textContent = opacity.toFixed(2);
        visualizer.updateOpacity(opacity);
    });
    
    const surfaceBtn = document.getElementById('surfaceMode');
    const wireframeBtn = document.getElementById('wireframeMode');
    surfaceBtn.addEventListener('click', () => {
        visualizer.updateWireframe(false);
        surfaceBtn.classList.add('active');
        wireframeBtn.classList.remove('active');
    });
    
    wireframeBtn.addEventListener('click', () => {
        visualizer.updateWireframe(true);
        wireframeBtn.classList.add('active');
        surfaceBtn.classList.remove('active');
    });
}

init();