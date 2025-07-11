import numpy as np
from tqdm import tqdm

'''

need some field example
will use Biot-Savart Law to solve magnetic fields from current sources

'''


# class to compute magnetic field B at a given point r using the Biot–Savart law
class WireField:
    def __init__(self, n):
        self.R = np.array([
            np.ones(n),
            np.ones(n),
            np.ones(n)]).T
        self.fourPi = np.pi * 4

        self.μ = 1  # magnetic constant
        self.I = 10  # current [amps]
        self.wire_length = n  # set the model up with a fine dL or high resolution
        self.t = np.linspace(0, 1, self.wire_length)  # parameterize
        self.dt = self.t[1] - self.t[0]  # dt

        # 3D wire, radius 1, lying in the XZ-plane and centered at the origin
        self.wire = np.array([np.cos(2 * np.pi * self.t), self.t * 0, np.sin(2 * np.pi * self.t)]).T

        # solve dS, I think you can wrap around the whole array since the loop smoothly closes on itself
        # I think you normally would have to drop the last of first value and len(dS) would equal wire_length-1
        self.ds_numerical = np.array([
            (np.roll(self.wire[:, 0], -1) - np.roll(self.wire[:, 0], 1)) / 2,
            (np.roll(self.wire[:, 1], -1) - np.roll(self.wire[:, 1], 1)) / 2,
            (np.roll(self.wire[:, 2], -1) - np.roll(self.wire[:, 2], 1)) / 2]).T

        # ## Normalized Tangent vector of wire (analytical)
        # ds_analytical = np.array([
        #     -2 * np.pi * np.sin(2 * np.pi * t),
        #     np.zeros(wire_length),
        #     2 * np.pi * np.cos(2 * np.pi * t)
        # ]).T
        # ds_analytical /= (wire_length - 1)

    def b(self, _r):
        # Set all elements of R to _r
        self.R *= 0
        self.R += 1
        self.R *= _r
        dL = self.ds_numerical
        r = self.wire - self.R  # vector from wire element to observation point
        rmag = np.linalg.norm(r, axis=1)  # Distance magnitude from wire to point
        # compute differential magnetic field contributions using Biot–Savart law
        dB = self.μ * self.I * np.cross(dL, r) / (self.fourPi * rmag[:, np.newaxis] ** 3)
        return np.sum(dB, axis=0)  # Sum contributions to get total B-field at point


def y_flux_volume(xspan=4, yspan=8, zspan=4, grid_size=40):
    # create 3D grid volume to store solved fields
    x = np.linspace(-xspan / 2, xspan / 2, grid_size)
    y = np.linspace(-yspan / 2, yspan / 2, grid_size)
    z = np.linspace(-zspan / 2, zspan / 2, grid_size)
    X, Y, Z = np.meshgrid(x, y, z, indexing='ij')
    Bx = np.zeros((grid_size, grid_size, grid_size))
    By = np.zeros((grid_size, grid_size, grid_size))
    Bz = np.zeros((grid_size, grid_size, grid_size))
    wfs = WireField(1000)

    # Fill grid using nested loops
    for i in tqdm(range(grid_size)):
        for j in range(grid_size):
            for k in range(grid_size):
                r = np.array([x[i], y[j], z[k]])
                B = wfs.b(r)
                Bx[i, j, k] = B[0]
                By[i, j, k] = B[1]
                Bz[i, j, k] = B[2]

    # Bmag = np.sqrt(Bx ** 2 + By ** 2 + Bz ** 2)
    # isosurface requires a scalar value at every (x, y, z) point in space.
    # Only the y-component of the magnetic field vector is the magnetic flux density in the y-direction (By).
    return X, Y, Z, np.abs(By)


if __name__ == "__main__":
    import matplotlib.pyplot as plt

    # there is an analytical solution the the magnetic field from a loop of wire down the y axis (x=0, z=0)
    # so check the model
    y_test = np.zeros(shape=(501, 3))
    y_test[:, 1] += np.linspace(0, 10, 501)
    sb = WireField(1000)
    y_vaules = np.array([sb.b(i) for i in tqdm(y_test)])


    def analyticalBWireLoop(_μ, _r, _i, _x):
        """
        :param _r: radius
        :param _i: current
        :param _x: values along line centered in the loop and parallel to its surface
        """
        return (_μ / 2) * _r ** 2 * _i / (_x ** 2 + _r ** 2) ** (3 / 2)


    plt.plot(np.linspace(0, 10, 501), y_vaules[:, 1], ".")
    plt.plot(np.linspace(0, 10, 501), analyticalBWireLoop(sb.μ, 1, sb.I, y_test[:, 1]))
    plt.show()
