import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

export class IsosurfaceVisualizerDirect {
    constructor( data ) {
        this.fieldData = data;
        this.isosurfaces = [];
        this.numSurfaces = 21;
        this.opacity = 0.3;
        this.resolution = data.dimensions[0]; // Match python grid_size
        // grid has to be n=nx=ny=nz
        this.wireframeMode = false;
    }
    createIsosurfaces(scene) {
        if (!this.fieldData) return;

        // just for interactive use
        this.clearIsosurfaces(scene);

        this.isosurfaces = [];
        const minIso = this.fieldData.bounds.values[0];
        const maxIso = this.fieldData.bounds.values[1];
        // Generate evenly spaced values
        const isolationValues = [];
        for (let i = 0; i < this.numSurfaces; i++) {
            const ratio = (i + 1) / (this.numSurfaces + 1);
            const value = minIso + (maxIso - minIso) * ratio;
            isolationValues.push(value);
        }
        isolationValues.forEach((isolation, i) => {
            const colorRatio = i / (this.numSurfaces - 1 || 1);
            const surface = this.createSingleIsosurface(
                this.resolution, 
                isolation, 
                colorRatio, 
                this.opacity
            );
            // console.log(`Surface ${i + 1}: isolation=${isolation.toFixed(4)}, triangles=${surface.count}`);
            if (surface) {
                scene.add(surface);
                this.isosurfaces.push(surface);
            }
        });
    }

    clearIsosurfaces(scene) {
        this.isosurfaces.forEach(surface => {
            scene.remove(surface);
            if (surface.geometry) surface.geometry.dispose();
            if (surface.material) surface.material.dispose();
        });
        this.isosurfaces = [];
    }

    createSingleIsosurface(resolution, isolation, colorRatio, opacity) {
        const color = this.getColorFromScale(colorRatio);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            side: THREE.DoubleSide,
            depthWrite: false,
        });

        const marchingCubes = new MarchingCubes(resolution, material, true, true, 99000);
        marchingCubes.isolation = isolation;
        this.populateFieldDataDirect(marchingCubes, resolution);
        return marchingCubes;
    }

    populateFieldDataDirect(marchingCubes, resolution) {
        if (!this.fieldData) return;
        const { values, dimensions, bounds } = this.fieldData;
        const [nx, ny, nz] = dimensions; // Should be [n, n, n]
        // Verify original resolution
        if (resolution !== nx || resolution !== ny || resolution !== nz) {
            console.warn(`Resolution mismatch: using ${resolution} but data is ${nx}×${ny}×${nz}`);
        }
        const size = resolution;
        const size2 = size * size;
        const size3 = size * size * size;
        marchingCubes.field = new Float32Array(size3);
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                for (let k = 0; k < size; k++) {
                    const marchingCubesIndex = i * size2 + j * size + k;
                    const originalIndex = i * ny * nz + j * nz + k;
                    marchingCubes.field[marchingCubesIndex] = values[originalIndex] || 0;
                }
            }
        }
        
        // not sure how to set scale to original coord system
        const scaleX = (bounds.x[1] - bounds.x[0])/2;
        const scaleY = (bounds.y[1] - bounds.y[0])/2;
        const scaleZ = (bounds.z[1] - bounds.z[0])/2;
        marchingCubes.scale.set(scaleX, scaleY, scaleZ);
        const centerX = (bounds.x[0] + bounds.x[1]) / 2;
        const centerY = (bounds.y[0] + bounds.y[1]) / 2;
        const centerZ = (bounds.z[0] + bounds.z[1]) / 2;
        marchingCubes.position.set(
            centerX + scaleX/this.resolution, 
            centerY + scaleY/this.resolution, 
            centerZ + scaleZ/this.resolution
        );
        // i think the cubes are not cnetered at 0,0,0, so add small offset 
        marchingCubes.update();
    }

    getColorFromScale(ratio) {
        const colors = [
            new THREE.Color(0x0d0887), // Purple
            new THREE.Color(0x46039f), // Blue
            new THREE.Color(0x7201a8), // Blue-Purple
            new THREE.Color(0x9c179e), // Purple-Pink
            new THREE.Color(0xbd3786), // Pink
            new THREE.Color(0xd8576b), // Red-Pink
            new THREE.Color(0xed7953), // Orange-Red
            new THREE.Color(0xfb9f3a), // Orange
            new THREE.Color(0xfdca26), // Yellow-Orange
            new THREE.Color(0xf0f921)  // Yellow
        ];
        const scaledRatio = ratio * (colors.length - 1);
        const index = Math.floor(scaledRatio);
        const t = scaledRatio - index;
        if (index >= colors.length - 1) {return colors[colors.length - 1];}
        const color1 = colors[index];
        const color2 = colors[index + 1];
        return new THREE.Color().lerpColors(color1, color2, t);
    }

    updateOpacity(newOpacity) {
        this.opacity = newOpacity;
        this.isosurfaces.forEach(surface => {
            if (surface.material) {
                surface.material.opacity = newOpacity;
            }
        });
    }

    updateWireframe(wireframe) {
        this.wireframeMode = wireframe;
        this.isosurfaces.forEach(surface => {
            if (surface.material) {
                surface.material.wireframe = wireframe;
            }
        });
    }
}