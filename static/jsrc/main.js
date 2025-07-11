import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { IsosurfaceVisualizerDirect } from './isosurface.js';

console.log(py_data);

function init() {

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
    const visualizer = new IsosurfaceVisualizerDirect(py_data); 
    visualizer.opacity = parseFloat(document.getElementById('opacity').value);
    visualizer.numSurfaces = parseInt(document.getElementById('numSurfaces').value);
    visualizer.createIsosurfaces(scene);

    // wire
    ///////////////////////////////////////////////////////////////
    const geometry = new THREE.TorusGeometry( 1, .025, 16, 100 ); 
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