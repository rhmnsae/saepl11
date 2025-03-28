import os
import nltk
from flask import Flask
from flask_session import Session
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager

# Inisialisasi ekstensi
db = SQLAlchemy()
login_manager = LoginManager()
login_manager.login_view = 'auth.login'
login_manager.login_message = 'Silakan login untuk mengakses halaman ini.'
login_manager.login_message_category = 'info'

def create_app(config_file=None):
    # Inisialisasi aplikasi Flask
    app = Flask(__name__)
    
    # Konfigurasi dari file
    if config_file:
        app.config.from_pyfile(config_file)
    else:
        app.config.from_object('config.Config')
    
    # Pastikan direktori yang diperlukan ada
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['SESSION_FILE_DIR'], exist_ok=True)
    os.makedirs(app.config['MODEL_FOLDER'], exist_ok=True)
    
    # Setup session
    Session(app)
    
    # Initialize database
    db.init_app(app)
    
    # Initialize login manager
    login_manager.init_app(app)
    
    # Download NLTK resources
    try:
        nltk.data.find('corpora/stopwords')
    except LookupError:
        nltk.download('stopwords')

    try:
        nltk.data.find('tokenizers/punkt')
    except LookupError:
        nltk.download('punkt')
    
    # Import dan register blueprint
    from app.routes.main_routes import main_bp
    from app.routes.analysis_routes import analysis_bp
    from app.routes.chatbot_routes import chatbot_bp
    from app.routes.auth_routes import auth_bp
    from app.routes.history_routes import history_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(analysis_bp)
    app.register_blueprint(chatbot_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(history_bp)
    
    # Create database tables
    with app.app_context():
        db.create_all()
    
    return app