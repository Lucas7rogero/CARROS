# config.py

import os

# Define o caminho absoluto para a pasta de uploads
# Usamos os.path.dirname(__file__) para garantir que o caminho seja relativo
# ao local deste script (config.py)
UPLOAD_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), 'static/uploads'))

# Define as extensões de arquivo permitidas
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf'}