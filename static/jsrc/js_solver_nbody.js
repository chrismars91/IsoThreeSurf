import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { IsosurfaceVisualizerDirect } from './isosurface.js';
import { OverflowFieldSolver, FieldSolver } from './fieldSolver.js';


function getRandom() {
    return (Math.random()* 2 - 1);
}

class CalculateNBodyGravitationalField extends OverflowFieldSolver {

    constructor() {
        super();
        this.G = 6.67430e-11;
        this.gridSize = 100;
        this.bodies = [
            {
                mass: 1e7,
                position: [-0.5, 0, 0],
                radius: 0.1
            },
            {
                mass: 8e6,
                position: [0.7, 0, 0],
                radius: 0.08
            }
        ];
        for(let i=0; i<6; i+=1){
            this.bodies.push(
                {
                    mass: getRandom() * 5e6 + 1e7,
                    position: [getRandom() * 3.0, getRandom() * 3.0, getRandom() * 3.0],
                    radius: getRandom() * .03 + .05
                }
            )
        }
    }

    setBodies(bodies) {
        this.bodies = bodies;
    }

    calculateGravitationalField(r) {
        let gx = 0, gy = 0, gz = 0;
        
        for (const body of this.bodies) {
            const rx = r[0] - body.position[0];
            const ry = r[1] - body.position[1];
            const rz = r[2] - body.position[2];
            const distance = Math.sqrt(rx * rx + ry * ry + rz * rz);
            if (distance < body.radius) continue;
            const forceMagnitude = (this.G * body.mass) / (distance * distance * distance);
            gx -= forceMagnitude * rx;
            gy -= forceMagnitude * ry;
            gz -= forceMagnitude * rz;
        }
        
        return [gx, gy, gz];
    }

    calculateGravitationalPotential(r) {
        let potential = 0;
        for (const body of this.bodies) {
            const rx = r[0] - body.position[0];
            const ry = r[1] - body.position[1];
            const rz = r[2] - body.position[2];
            const distance = Math.sqrt(rx * rx + ry * ry + rz * rz);
            if (distance < body.radius) {
                potential += -this.G * body.mass / body.radius;
            } else {
                potential += -this.G * body.mass / distance;
            }
        }
        return potential;
    }
    async solveField() {
        this.updateProgress(0, 100, "Setting up gravitational field calculation...");
        const grid = this.createGrid({
            x: [-7.1, 7.1],
            y: [-7.1, 7.1],
            z: [-7.1, 7.1]
        });
        const fieldCalculator = (r) => {
            const g = this.calculateGravitationalField(r);
            const potential = this.calculateGravitationalPotential(r);
            return {
                field: g,
                scalars: [potential]
            };
        };
        const results = await this.calculateFieldAtPoints(grid, fieldCalculator);
        this.updateProgress(90, 100, "Processing field data...");
        await this.normalizeAndCreateFieldData(results, 0); // Use potential as primary scalar
        // await this.createRawFieldData(results, 0);
        this.updateProgress(100, 100, "Gravitational field calculation complete!");
        return this.fieldData;
    }
    getBodiesGeometry() {
        return this.bodies.map(body => ({
            position: new THREE.Vector3(body.position[0], body.position[1], body.position[2]),
            radius: body.radius,
            mass: body.mass
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

    const solver = new CalculateNBodyGravitationalField();
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