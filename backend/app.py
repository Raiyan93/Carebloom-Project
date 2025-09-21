from flask import Flask, request, jsonify
from flask_cors import CORS
import sys

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    print("Received register data:", data)
    sys.stdout.flush()
    return jsonify({"message": "Registered successfully! (mock response)"})

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    print("Received login data:", data)
    sys.stdout.flush()
    return jsonify({"message": "Logged in successfully! (mock response)"})

@app.route('/create_profile', methods=['POST'])
def create_profile():
    data = request.json
    print("Received profile data:", data)
    sys.stdout.flush()
    return jsonify({"message": "Profile created! (mock response)"})

@app.route('/donate', methods=['POST'])
def donate():
    data = request.json
    print("Received donation data:", data)
    sys.stdout.flush()
    return jsonify({"message": "Donation received! (mock response)"})

if __name__ == "__main__":
    app.run(debug=True)




