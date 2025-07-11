import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { IsosurfaceVisualizerDirect } from './isosurface.js';
import { OverflowFieldSolver, FieldSolver } from './fieldSolver.js';


// class CalculateChargePlateElectricField extends FieldSolver {
class CalculateChargePlateElectricField extends OverflowFieldSolver{ 
    constructor() {
        super();
        this.k = 8.99e9;
        this.epsilon0 = 8.854e-12;
        this.gridSize = 80;
        this.plates = [
            {
                position: [0, 0.15, 0],
                normal: [0, -1, 0],
                width: 2.0,
                height: 2.0,
                charge: 1e-6,
                voltage: 100
            },
            {
                position: [0, -0.15, 0],
                normal: [0, 1, 0],
                width: 2.0,
                height: 2.0,
                charge: -1e-6,
                voltage: -100
            }
        ];
        this.surfaceCharges = [];
        this.generateSurfaceCharges();
    }
    setPlates(plates) {
        this.plates = plates;
        this.generateSurfaceCharges();
    }
    generateSurfaceCharges() {
        this.surfaceCharges = [];
        const chargesPerPlate = 1000;
        const chargesPerSide = Math.sqrt(chargesPerPlate);
        
        for (const plate of this.plates) {
            const chargePerPoint = plate.charge / chargesPerPlate;
            
            for (let i = 0; i < chargesPerSide; i++) {
                for (let j = 0; j < chargesPerSide; j++) {
                    const u = (i / (chargesPerSide - 1) - 0.5) * plate.width;
                    const v = (j / (chargesPerSide - 1) - 0.5) * plate.height;
                    
                    let x, y, z;
                    if (Math.abs(plate.normal[1]) > 0.5) {
                        x = plate.position[0] + u;
                        y = plate.position[1];
                        z = plate.position[2] + v;
                    } else if (Math.abs(plate.normal[0]) > 0.5) {
                        x = plate.position[0];
                        y = plate.position[1] + u;
                        z = plate.position[2] + v;
                    } else {
                        x = plate.position[0] + u;
                        y = plate.position[1] + v;
                        z = plate.position[2];
                    }
                    
                    this.surfaceCharges.push({
                        position: [x, y, z],
                        charge: chargePerPoint
                    });
                }
            }
        }
    }

    calculateElectricField(r) {
        let Ex = 0, Ey = 0, Ez = 0;
        
        for (const charge of this.surfaceCharges) {
            const rx = r[0] - charge.position[0];
            const ry = r[1] - charge.position[1];
            const rz = r[2] - charge.position[2];
            const distance = Math.sqrt(rx * rx + ry * ry + rz * rz);
            
            if (distance < 0.01) continue;
            
            const fieldMagnitude = (this.k * Math.abs(charge.charge)) / (distance * distance * distance);
            const sign = charge.charge > 0 ? 1 : -1;
            Ex += sign * fieldMagnitude * rx;
            Ey += sign * fieldMagnitude * ry;
            Ez += sign * fieldMagnitude * rz;
        }
        
        return [Ex, Ey, Ez];
    }

    calculateElectricPotential(r) {
        let potential = 0;
        
        for (const charge of this.surfaceCharges) {
            const rx = r[0] - charge.position[0];
            const ry = r[1] - charge.position[1];
            const rz = r[2] - charge.position[2];
            const distance = Math.sqrt(rx * rx + ry * ry + rz * rz);
            
            if (distance < 0.01) {
                potential += this.k * charge.charge / 0.01;
            } else {
                potential += this.k * charge.charge / distance;
            }
        }
        
        return potential;
    }

    async solveField() {
        this.updateProgress(0, 100, "Setting up electric field calculation...");
        
        const grid = this.createGrid({
            x: [-4.1, 4.1],
            y: [-3.1, 3.1],
            z: [-4.1, 4.1]
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
        await this.createRawFieldData(results, 0); // Use potential as primary scalar

        this.updateProgress(100, 100, "Electric field calculation complete!");
        return this.fieldData;
    }

    getPlatesGeometry() {
        return this.plates.map(plate => ({
            position: new THREE.Vector3(plate.position[0], plate.position[1], plate.position[2]),
            normal: new THREE.Vector3(plate.normal[0], plate.normal[1], plate.normal[2]),
            width: plate.width,
            height: plate.height,
            charge: plate.charge,
            voltage: plate.voltage
        }));
    }

    getWireGeometry() {
        const points = [];
        
        for (const plate of this.plates) {
            const hw = plate.width / 2;
            const hh = plate.height / 2;
            
            if (Math.abs(plate.normal[1]) > 0.5) {
                const y = plate.position[1];
                const cx = plate.position[0];
                const cz = plate.position[2];
                
                points.push(new THREE.Vector3(cx - hw, y, cz - hh));
                points.push(new THREE.Vector3(cx + hw, y, cz - hh));
                points.push(new THREE.Vector3(cx + hw, y, cz + hh));
                points.push(new THREE.Vector3(cx - hw, y, cz + hh));
                points.push(new THREE.Vector3(cx - hw, y, cz - hh));
            }
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

    const solver = new CalculateChargePlateElectricField();
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


    // plates
    ///////////////////////////////////////////////////////////////
    const geoPlate = new THREE.PlaneGeometry( 
        solver.plates[0].width, 
        solver.plates[0].height 
    );
    const plate1 = new THREE.Mesh( 
        geoPlate, 
        new THREE.MeshBasicMaterial( {color: 0xff0000, side: THREE.DoubleSide} ) );
    scene.add( plate1 );
    plate1.rotation.x = Math.PI/2;
    plate1.position.y += 0.15

    const plate2 = new THREE.Mesh( 
        geoPlate, 
        new THREE.MeshBasicMaterial( {color: 0x0000ff, side: THREE.DoubleSide} ) );
    scene.add( plate2 );
    plate2.rotation.x = Math.PI/2;
    plate2.position.y -= 0.15


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