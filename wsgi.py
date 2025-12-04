# WSGI configuration file for PythonAnywhere
# This file tells PythonAnywhere how to run your Flask app

import sys
import os

# Add the project directory to the Python path
project_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_dir)

# Import the Flask app
from app import app, socketio

# For PythonAnywhere, we need to use the app directly
application = app

# Note: PythonAnywhere doesn't support WebSocket (Socket.IO) directly on the free tier
# If you need real-time functionality, consider upgrading to a paid plan or using a different hosting service
