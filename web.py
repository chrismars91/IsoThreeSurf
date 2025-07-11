from flask import Flask, render_template
from magnetic_field_wire_loop import y_flux_volume

app = Flask(__name__)


def prepare_scalar_field_data(X, Y, Z, Scalar, normalize=True):
    if normalize:
        Scalar /= Scalar.max()
    return {
        'x': X.flatten().tolist(),
        'y': Y.flatten().tolist(),
        'z': Z.flatten().tolist(),
        'values': Scalar.flatten().tolist(),
        'dimensions': X.shape,  # Assuming these are the original grid dimensions
        'bounds': {
            'x': [float(X.min()), float(X.max())],
            'y': [float(Y.min()), float(Y.max())],
            'z': [float(Z.min()), float(Z.max())],
            'values': [float(Scalar.min()), float(Scalar.max())]
        }
    }


@app.route('/')
def index():
    return render_template(
        'index.html',
        py_data=prepare_scalar_field_data(*y_flux_volume()))


@app.route('/capacitor')
def capacitor():
    return render_template('capacitor.html')


@app.route('/nbody')
def nbody():
    return render_template('nbody.html')


@app.route('/bwire')
def bwire():
    return render_template('bwire.html')


@app.route('/ncharge')
def ncharge():
    return render_template('ncharge.html')


if __name__ == '__main__':
    app.run()
