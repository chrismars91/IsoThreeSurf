## Isosurfaces using Three.js (graphics and marching cubes). Solve the field using Python or JavaScript models.

## 1.

In the JS versions, you can use:

- `createRawFieldData`
- `normalizeAndCreateFieldData`

###

`normalizeAndCreateFieldData` normalizes the field magnitude and scalar values before calculating bounds.

## 2.

Inside the `FieldSolvers`, create a grid here:

```js
this.gridSize = 80;
//...
const grid = this.createGrid({
    x: [-4.1, 4.1],
    y: [-3.1, 3.1],
    z: [-4.1, 4.1]
});
```

<p align="center">
  <img width="931" height="706" src="https://github.com/user-attachments/assets/33f0a476-9558-4b58-926a-0719344ea285" alt="Example Screenshot" />
  <br />
  <em>python b field</em>
</p>

<p align="center">
  <img width="928" height="709" alt="Screen Shot 2025-07-11 at 11 55 27 AM" src="https://github.com/user-attachments/assets/4328fb0e-f511-4f5d-972b-f9b000a6a79d" />
  <br />
  <em>capacitor</em>
</p>

<p align="center">
  <img width="928" height="709" alt="image" src="https://github.com/user-attachments/assets/38bc3730-d306-4c56-a61c-3e95b73d77bb" />
  <br />
  <em>gravity n bodies</em>
</p>

<p align="center">
  <img width="930" height="711" alt="image" src="https://github.com/user-attachments/assets/ef92374d-68a1-4adc-b71a-5a944aee0717" />
  <br />
  <em>js b field, 1,000,000 field points</em>
</p>

<p align="center">
  <img width="924" height="704" alt="image" src="https://github.com/user-attachments/assets/01379f23-de67-4abf-9813-b76b70184b8b" />
  <br />
  <em>point charges</em>
</p>




