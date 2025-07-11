/*

OverflowFieldSolver should work as a drop in replacement for FieldSolver.
The JS arrays in the marching cubes code were overflowing, so OverflowFieldSolver 
is meant to handle larger models. when n x n x n and n > 50.

FieldSolver should still be faster for smaller n x n x n models.

*/


export class OverflowFieldSolver {
    constructor() {
        this.progressCallback = null;
        this.fieldData = null;
        this.gridSize = 45;
        this.batchSize = 1000;
        this.processBatchSize = 100000;
        this.delayMs = 2;
    }

    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    updateProgress(current, total, message) {
        if (this.progressCallback) {
            const percent = (current / total) * 100;
            this.progressCallback(percent, message);
        }
    }

    async solveField() {
        throw new Error("solveField method must be implemented by subclass");
    }

    setGridSize(size) {
        this.gridSize = size;
    }

    setBatchSize(size) {
        this.batchSize = size;
    }

    setProcessBatchSize(size) {
        this.processBatchSize = size;
    }

    setDelay(ms) {
        this.delayMs = ms;
    }

    async delay(ms = null) {
        return new Promise(resolve => setTimeout(resolve, ms || this.delayMs));
    }

    createGrid(bounds) {
        const x = [];
        const y = [];
        const z = [];
        
        for (let i = 0; i < this.gridSize; i++) {
            x.push(bounds.x[0] + (bounds.x[1] - bounds.x[0]) * i / (this.gridSize - 1));
            y.push(bounds.y[0] + (bounds.y[1] - bounds.y[0]) * i / (this.gridSize - 1));
            z.push(bounds.z[0] + (bounds.z[1] - bounds.z[0]) * i / (this.gridSize - 1));
        }
        
        return { x, y, z };
    }

    // *generateGridPoints(grid) {
    //     for (let i = 0; i < this.gridSize; i++) {
    //         for (let j = 0; j < this.gridSize; j++) {
    //             for (let k = 0; k < this.gridSize; k++) {
    //                 yield {
    //                     pos: [grid.x[i], grid.y[j], grid.z[k]],
    //                     indices: [i, j, k]
    //                 };
    //             }
    //         }
    //     }
    // }
    // nout sure why x and z are switched?
    *generateGridPoints(grid) {
        for (let i = 0; i < this.gridSize; i++) {
            for (let j = 0; j < this.gridSize; j++) {
                for (let k = 0; k < this.gridSize; k++) {
                    yield {
                        pos: [grid.z[k], grid.y[j], grid.x[i]],
                        indices: [k, j, i]
                    };
                }
            }
        }
    }

    async calculateFieldAtPoints(grid, fieldCalculator) {
        const totalPoints = this.gridSize * this.gridSize * this.gridSize;
        console.log(`Total points to calculate: ${totalPoints}`);
        
        const results = {
            X: [],
            Y: [],
            Z: [],
            fieldComponents: [],
            scalars: []
        };

        let pointIndex = 0;
        this.updateProgress(10, 100, "Calculating field...");

        const gridPointGenerator = this.generateGridPoints(grid);
        let batch = [];
        let done = false;
        let componentsInitialized = false;
        let scalarsInitialized = false;

        while (!done) {
            batch = [];
            for (let i = 0; i < this.batchSize; i++) {
                const result = gridPointGenerator.next();
                if (result.done) {
                    done = true;
                    break;
                }
                batch.push(result.value);
            }

            if (batch.length > 0) {
                for (const point of batch) {
                    const fieldResult = fieldCalculator(point.pos);
                    
                    results.X.push(point.pos[0]);
                    results.Y.push(point.pos[1]);
                    results.Z.push(point.pos[2]);
                    
                    if (!componentsInitialized && fieldResult.field) {
                        results.fieldComponents = [[], [], []];
                        componentsInitialized = true;
                    }
                    
                    if (!scalarsInitialized && fieldResult.scalars) {
                        results.scalars = fieldResult.scalars.map(() => []);
                        scalarsInitialized = true;
                    }
                    
                    if (fieldResult.field) {
                        results.fieldComponents[0].push(fieldResult.field[0]);
                        results.fieldComponents[1].push(fieldResult.field[1]);
                        results.fieldComponents[2].push(fieldResult.field[2]);
                    }
                    
                    if (fieldResult.scalars) {
                        fieldResult.scalars.forEach((scalar, idx) => {
                            results.scalars[idx].push(scalar);
                        });
                    }
                    
                    pointIndex++;
                }
                
                const progress = 10 + (pointIndex / totalPoints) * 80;
                this.updateProgress(progress, 100, `Calculated ${pointIndex}/${totalPoints} points`);
                
                await this.delay();
            }
        }

        return results;
    }

    async calculateFieldMagnitudeInBatches(fieldComponents) {
        const magnitude = [];
        
        for (let i = 0; i < fieldComponents[0].length; i += this.processBatchSize) {
            const endIdx = Math.min(i + this.processBatchSize, fieldComponents[0].length);
            
            for (let j = i; j < endIdx; j++) {
                const fx = fieldComponents[0][j];
                const fy = fieldComponents[1][j];
                const fz = fieldComponents[2][j];
                magnitude.push(Math.sqrt(fx * fx + fy * fy + fz * fz));
            }
            
            if (i % (this.processBatchSize * 10) === 0) {
                await this.delay(1);
            }
        }
        
        return magnitude;
    }

    async normalizeArrayInBatches(array) {
        const normalized = [];
        let max = 0;
        
        for (let i = 0; i < array.length; i += this.processBatchSize) {
            const endIdx = Math.min(i + this.processBatchSize, array.length);
            
            for (let j = i; j < endIdx; j++) {
                const absVal = Math.abs(array[j]);
                if (absVal > max) {
                    max = absVal;
                }
            }
            
            if (i % (this.processBatchSize * 10) === 0) {
                await this.delay(1);
            }
        }
        
        if (max === 0) max = 1;
        
        for (let i = 0; i < array.length; i += this.processBatchSize) {
            const endIdx = Math.min(i + this.processBatchSize, array.length);
            
            for (let j = i; j < endIdx; j++) {
                normalized.push(Math.abs(array[j]) / max);
            }
            
            if (i % (this.processBatchSize * 10) === 0) {
                await this.delay(1);
            }
        }
        
        return normalized;
    }


    async createRawFieldData(results, primaryScalarIndex = 0) {
        const bounds = {
            x: [Infinity, -Infinity],
            y: [Infinity, -Infinity],
            z: [Infinity, -Infinity],
            values: [Infinity, -Infinity]
        };

        // Calculate field magnitude if field components exist (without normalization)
        let fieldMagnitude = null;
        if (results.fieldComponents && results.fieldComponents.length > 0) {
            fieldMagnitude = [];
            for (let i = 0; i < results.fieldComponents[0].length; i += this.processBatchSize) {
                const endIdx = Math.min(i + this.processBatchSize, results.fieldComponents[0].length);
                
                for (let j = i; j < endIdx; j++) {
                    const fx = results.fieldComponents[0][j];
                    const fy = results.fieldComponents[1][j];
                    const fz = results.fieldComponents[2][j];
                    fieldMagnitude.push(Math.sqrt(fx * fx + fy * fy + fz * fz));
                }
                
                if (i % (this.processBatchSize * 10) === 0) {
                    await this.delay(1);
                }
            }
        }

        // Calculate bounds
        const primaryValues = results.scalars && results.scalars[primaryScalarIndex] ? 
            results.scalars[primaryScalarIndex] : fieldMagnitude;

        for (let i = 0; i < results.X.length; i += this.processBatchSize) {
            const endIdx = Math.min(i + this.processBatchSize, results.X.length);
            
            for (let j = i; j < endIdx; j++) {
                bounds.x[0] = Math.min(bounds.x[0], results.X[j]);
                bounds.x[1] = Math.max(bounds.x[1], results.X[j]);
                bounds.y[0] = Math.min(bounds.y[0], results.Y[j]);
                bounds.y[1] = Math.max(bounds.y[1], results.Y[j]);
                bounds.z[0] = Math.min(bounds.z[0], results.Z[j]);
                bounds.z[1] = Math.max(bounds.z[1], results.Z[j]);
                
                if (primaryValues && j < primaryValues.length) {
                    bounds.values[0] = Math.min(bounds.values[0], primaryValues[j]);
                    bounds.values[1] = Math.max(bounds.values[1], primaryValues[j]);
                }
            }
            
            if (i % (this.processBatchSize * 10) === 0) {
                await this.delay(1);
            }
        }

        this.fieldData = {
            x: results.X,
            y: results.Y,
            z: results.Z,
            values: primaryValues,
            fieldMagnitude: fieldMagnitude,
            dimensions: [this.gridSize, this.gridSize, this.gridSize],
            bounds: bounds
        };

        if (results.fieldComponents && results.fieldComponents.length > 0) {
            this.fieldData.fieldComponents = results.fieldComponents;
        }

        if (results.scalars && results.scalars.length > 0) {
            this.fieldData.scalars = results.scalars;
        }

        return this.fieldData;
    }

    async calculateBoundsInBatches(results, normalizedScalars, fieldMagnitude, primaryScalarIndex) {
        const bounds = {
            x: [Infinity, -Infinity],
            y: [Infinity, -Infinity],
            z: [Infinity, -Infinity],
            values: [Infinity, -Infinity]
        };
        
        const primaryValues = normalizedScalars[primaryScalarIndex] || fieldMagnitude;
        
        for (let i = 0; i < results.X.length; i += this.processBatchSize) {
            const endIdx = Math.min(i + this.processBatchSize, results.X.length);
            
            for (let j = i; j < endIdx; j++) {
                bounds.x[0] = Math.min(bounds.x[0], results.X[j]);
                bounds.x[1] = Math.max(bounds.x[1], results.X[j]);
                bounds.y[0] = Math.min(bounds.y[0], results.Y[j]);
                bounds.y[1] = Math.max(bounds.y[1], results.Y[j]);
                bounds.z[0] = Math.min(bounds.z[0], results.Z[j]);
                bounds.z[1] = Math.max(bounds.z[1], results.Z[j]);
                
                if (primaryValues && j < primaryValues.length) {
                    bounds.values[0] = Math.min(bounds.values[0], primaryValues[j]);
                    bounds.values[1] = Math.max(bounds.values[1], primaryValues[j]);
                }
            }
            
            if (i % (this.processBatchSize * 10) === 0) {
                await this.delay(1);
            }
        }
        
        return bounds;
    }

    async normalizeAndCreateFieldData(results, primaryScalarIndex = 0) {
        let fieldMagnitude = null;
        if (results.fieldComponents && results.fieldComponents.length > 0) {
            fieldMagnitude = await this.calculateFieldMagnitudeInBatches(results.fieldComponents);
            fieldMagnitude = await this.normalizeArrayInBatches(fieldMagnitude);
        }

        const normalizedScalars = [];
        if (results.scalars) {
            for (let i = 0; i < results.scalars.length; i++) {
                normalizedScalars[i] = await this.normalizeArrayInBatches(results.scalars[i]);
            }
        }

        const bounds = await this.calculateBoundsInBatches(results, normalizedScalars, fieldMagnitude, primaryScalarIndex);

        this.fieldData = {
            x: results.X,
            y: results.Y,
            z: results.Z,
            values: normalizedScalars[primaryScalarIndex] || fieldMagnitude,
            fieldMagnitude: fieldMagnitude,
            dimensions: [this.gridSize, this.gridSize, this.gridSize],
            bounds: bounds
        };

        if (results.fieldComponents && results.fieldComponents.length > 0) {
            this.fieldData.fieldComponents = results.fieldComponents;
        }

        if (normalizedScalars.length > 0) {
            this.fieldData.scalars = normalizedScalars;
        }

        return this.fieldData;
    }
}


export class FieldSolver {
    constructor() {
        this.progressCallback = null;
        this.fieldData = null;
        this.gridSize = 45;
    }

    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    updateProgress(current, total, message) {
        if (this.progressCallback) {
            const percent = (current / total) * 100;
            this.progressCallback(percent, message);
        }
    }

    async solveField() {
        throw new Error("solveField method must be implemented by subclass");
    }

    setGridSize(size) {
        this.gridSize = size;
    }

    createGrid(bounds) {
        const x = [];
        const y = [];
        const z = [];
        
        for (let i = 0; i < this.gridSize; i++) {
            x.push(bounds.x[0] + (bounds.x[1] - bounds.x[0]) * i / (this.gridSize - 1));
            y.push(bounds.y[0] + (bounds.y[1] - bounds.y[0]) * i / (this.gridSize - 1));
            z.push(bounds.z[0] + (bounds.z[1] - bounds.z[0]) * i / (this.gridSize - 1));
        }
        
        return { x, y, z };
    }

    async calculateFieldAtPoints(grid, fieldCalculator) {
        const totalPoints = this.gridSize * this.gridSize * this.gridSize;
        const results = {
            X: new Array(totalPoints),
            Y: new Array(totalPoints),
            Z: new Array(totalPoints),
            fieldComponents: [],
            scalars: []
        };

        let pointIndex = 0;
        this.updateProgress(10, 100, "Calculating field...");

        for (let i = 0; i < this.gridSize; i++) {
            for (let j = 0; j < this.gridSize; j++) {
                for (let k = 0; k < this.gridSize; k++) {


                    // nout sure why x and z are switched?

                    // const r = [grid.x[i], grid.y[j], grid.z[k]];
                    // const fieldResult = fieldCalculator(r);
                    
                    // results.X[pointIndex] = grid.x[i];
                    // results.Y[pointIndex] = grid.y[j];
                    // results.Z[pointIndex] = grid.z[k];
                    

                    const r = [grid.z[k], grid.y[j], grid.x[i]];
                    const fieldResult = fieldCalculator(r);
                    
                    results.X[pointIndex] = grid.z[k];
                    results.Y[pointIndex] = grid.y[j];
                    results.Z[pointIndex] = grid.x[i];


                    // Store field components and scalars
                    if (pointIndex === 0) {
                        // Initialize arrays based on first result
                        if (fieldResult.field) {
                            results.fieldComponents = [
                                new Array(totalPoints),
                                new Array(totalPoints),
                                new Array(totalPoints)
                            ];
                        }
                        if (fieldResult.scalars) {
                            results.scalars = fieldResult.scalars.map(() => new Array(totalPoints));
                        }
                    }
                    
                    if (fieldResult.field) {
                        results.fieldComponents[0][pointIndex] = fieldResult.field[0];
                        results.fieldComponents[1][pointIndex] = fieldResult.field[1];
                        results.fieldComponents[2][pointIndex] = fieldResult.field[2];
                    }
                    
                    if (fieldResult.scalars) {
                        fieldResult.scalars.forEach((scalar, idx) => {
                            results.scalars[idx][pointIndex] = scalar;
                        });
                    }
                    
                    pointIndex++;
                    
                    if (pointIndex % 1000 === 0) {
                        const progress = 10 + (pointIndex / totalPoints) * 80;
                        this.updateProgress(progress, 100, `Calculated ${pointIndex}/${totalPoints} points`);
                        await new Promise(resolve => setTimeout(resolve, 1));
                    }
                }
            }
        }

        return results;
    }


    createRawFieldData(results, primaryScalarIndex = 0) {
        const totalPoints = results.X.length;
        
        // Calculate field magnitude if field components exist (without normalization)
        let fieldMagnitude = null;
        if (results.fieldComponents && results.fieldComponents.length > 0) {
            fieldMagnitude = new Array(totalPoints);
            
            for (let i = 0; i < totalPoints; i++) {
                const fx = results.fieldComponents[0][i];
                const fy = results.fieldComponents[1][i];
                const fz = results.fieldComponents[2][i];
                fieldMagnitude[i] = Math.sqrt(fx * fx + fy * fy + fz * fz);
            }
        }

        // Create field data structure with raw values
        this.fieldData = {
            x: results.X,
            y: results.Y,
            z: results.Z,
            values: results.scalars && results.scalars[primaryScalarIndex] ? 
                results.scalars[primaryScalarIndex] : fieldMagnitude,
            fieldMagnitude: fieldMagnitude,
            dimensions: [this.gridSize, this.gridSize, this.gridSize],
            bounds: {
                x: [Math.min(...results.X), Math.max(...results.X)],
                y: [Math.min(...results.Y), Math.max(...results.Y)],
                z: [Math.min(...results.Z), Math.max(...results.Z)],
                values: results.scalars && results.scalars[primaryScalarIndex] ? 
                    [Math.min(...results.scalars[primaryScalarIndex]), Math.max(...results.scalars[primaryScalarIndex])] :
                    [Math.min(...fieldMagnitude), Math.max(...fieldMagnitude)]
            }
        };

        // Add field components if they exist
        if (results.fieldComponents && results.fieldComponents.length > 0) {
            this.fieldData.fieldComponents = results.fieldComponents;
        }

        // Add raw scalars (no normalization)
        if (results.scalars && results.scalars.length > 0) {
            this.fieldData.scalars = results.scalars;
        }

        return this.fieldData;
    }


    normalizeAndCreateFieldData(results, primaryScalarIndex = 0) {
        const totalPoints = results.X.length;
        
        // Calculate field magnitude if field components exist
        let fieldMagnitude = null;
        if (results.fieldComponents.length > 0) {
            fieldMagnitude = new Array(totalPoints);
            let maxFieldMagnitude = 0;
            
            for (let i = 0; i < totalPoints; i++) {
                const fx = results.fieldComponents[0][i];
                const fy = results.fieldComponents[1][i];
                const fz = results.fieldComponents[2][i];
                fieldMagnitude[i] = Math.sqrt(fx * fx + fy * fy + fz * fz);
                if (fieldMagnitude[i] > maxFieldMagnitude) {
                    maxFieldMagnitude = fieldMagnitude[i];
                }
            }
            
            // Normalize field magnitude
            for (let i = 0; i < totalPoints; i++) {
                fieldMagnitude[i] /= maxFieldMagnitude;
            }
        }

        // Normalize scalars
        const normalizedScalars = results.scalars.map(scalar => {
            const normalized = new Array(totalPoints);
            let max = Math.max(...scalar.map(Math.abs));
            if (max === 0) max = 1; // Avoid division by zero
            
            for (let i = 0; i < totalPoints; i++) {
                normalized[i] = Math.abs(scalar[i]) / max;
            }
            return normalized;
        });

        // Create field data structure
        this.fieldData = {
            x: results.X,
            y: results.Y,
            z: results.Z,
            values: normalizedScalars[primaryScalarIndex] || fieldMagnitude,
            fieldMagnitude: fieldMagnitude,
            dimensions: [this.gridSize, this.gridSize, this.gridSize],
            bounds: {
                x: [Math.min(...results.X), Math.max(...results.X)],
                y: [Math.min(...results.Y), Math.max(...results.Y)],
                z: [Math.min(...results.Z), Math.max(...results.Z)],
                values: normalizedScalars[primaryScalarIndex] ? 
                    [Math.min(...normalizedScalars[primaryScalarIndex]), Math.max(...normalizedScalars[primaryScalarIndex])] :
                    [Math.min(...fieldMagnitude), Math.max(...fieldMagnitude)]
            }
        };

        // Add field components if they exist
        if (results.fieldComponents.length > 0) {
            this.fieldData.fieldComponents = results.fieldComponents;
        }

        // Add normalized scalars
        if (normalizedScalars.length > 0) {
            this.fieldData.scalars = normalizedScalars;
        }

        return this.fieldData;
    }
}