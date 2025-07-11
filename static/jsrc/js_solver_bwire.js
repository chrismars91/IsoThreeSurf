import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { IsosurfaceVisualizerDirect } from './isosurface.js';
import { OverflowFieldSolver, FieldSolver } from './fieldSolver.js';


class CalculateWireBField extends OverflowFieldSolver {
// class CalculateWireBField extends FieldSolver {
    constructor() {
        super();
        this.μ = 1;
        this.I = 10;
        this.FourPi = Math.PI * 4;
        this.wireLength = 5000;
        this.gridSize = 100;
        this.wire = [];
        this.ds = [];
    }

    generateWire() {
        this.wire = [];
        this.ds = [];
        for (let i = 0; i < this.wireLength; i++) {
            const t = i / this.wireLength;
            const x = Math.cos(2 * Math.PI * t);
            const y = 0;
            const z = Math.sin(2 * Math.PI * t);
            this.wire.push([x, y, z]);
        }
        for (let i = 0; i < this.wireLength; i++) {
            const prev = (i - 1 + this.wireLength) % this.wireLength;
            const next = (i + 1) % this.wireLength;
            const dx = (this.wire[next][0] - this.wire[prev][0]) / 2;
            const dy = (this.wire[next][1] - this.wire[prev][1]) / 2;
            const dz = (this.wire[next][2] - this.wire[prev][2]) / 2;
            this.ds.push([dx, dy, dz]);
        }
    }

    calculateBField(r) {
        let Bx = 0, By = 0, Bz = 0;
        for (let i = 0; i < this.wireLength; i++) {
            const wirePos = this.wire[i];
            const dL = this.ds[i];
            const rx = r[0] - wirePos[0];
            const ry = r[1] - wirePos[1];
            const rz = r[2] - wirePos[2];
            const rmag = Math.sqrt(rx * rx + ry * ry + rz * rz);
            if (rmag < 1e-12) continue;
            const crossX = dL[1] * rz - dL[2] * ry;
            const crossY = dL[2] * rx - dL[0] * rz;
            const crossZ = dL[0] * ry - dL[1] * rx;
            const factor = (this.μ * this.I) / (this.FourPi * Math.pow(rmag, 3));
            Bx += factor * crossX;
            By += factor * crossY;
            Bz += factor * crossZ;
        }
        return [Bx, By, Bz];
    }

    async solveField() {
        this.updateProgress(0, 100, "Generating wire geometry...");
        this.generateWire();
        
        const grid = this.createGrid({
            x: [-2, 2],
            y: [-4, 4],
            z: [-2, 2]
        });

        const fieldCalculator = (r) => {
            const B = this.calculateBField(r);
            const ByFlux = Math.abs(B[1]); // Y-component magnitude
            return {
                field: B,
                scalars: [ByFlux]
            };
        };

        const results = await this.calculateFieldAtPoints(grid, fieldCalculator);
        
        this.updateProgress(90, 100, "Processing field data...");

        // await this.normalizeAndCreateFieldData(results, 0); // Use ByFlux as primary scalar
        await this.createRawFieldData(results, 0); // Use ByFlux as primary scalar

        this.updateProgress(100, 100, "Magnetic field calculation complete!");
        return this.fieldData;
    }

    getWireGeometry() {
        const points = [];
        for (let i = 0; i < this.wire.length; i++) {
            points.push(new THREE.Vector3(this.wire[i][0], this.wire[i][1], this.wire[i][2]));
        }
        return points;
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

    const solver = new CalculateWireBField();
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

    // visualizer
    ///////////////////////////////////////////////////////////////
    const visualizer = new IsosurfaceVisualizerDirect(fieldData); 
    visualizer.opacity = parseFloat(document.getElementById('opacity').value);
    visualizer.numSurfaces = parseInt(document.getElementById('numSurfaces').value);
    visualizer.createIsosurfaces(scene);


    // wire
    ///////////////////////////////////////////////////////////////
    const geometry = new THREE.TorusGeometry( 1, .05, 16, 100 ); 
    const material = new THREE.MeshBasicMaterial( { color: 0xB87333 } ); 
    const torus = new THREE.Mesh( geometry, material ); 
    scene.add( torus );
    torus.rotation.x = Math.PI/2;

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