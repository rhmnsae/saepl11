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
    
    # Setup session dengan konfigurasi keamanan yang lebih baik
    session = Session()
    app.config['SESSION_PERMANENT'] = True  # Set sessions to be permanent
    app.config['PERMANENT_SESSION_LIFETIME'] = app.config.get('PERMANENT_SESSION_LIFETIME', 86400)  # Default to 24 hours
    app.config['SESSION_USE_SIGNER'] = True  # Sign the session cookie for security
    app.config['SESSION_FILE_THRESHOLD'] = 500  # Limit number of session files
    session.init_app(app)
    
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
    
    # Tambahkan error handler untuk sesi yang habis
    @app.errorhandler(500)
    def internal_server_error(e):
        from flask import session, redirect, url_for, flash
        import traceback
        
        # Log error untuk debugging
        print(f"Internal Server Error: {str(e)}")
        traceback.print_exc()
        
        # Cek apakah error disebabkan oleh sesi yang habis
        if 'session expired' in str(e).lower() or 'session not found' in str(e).lower():
            # Reset session
            session.clear()
            flash('Sesi Anda telah habis. Silakan login kembali.', 'warning')
            return redirect(url_for('auth.login'))
        # Tampilkan halaman error default
        return "Internal Server Error: " + str(e), 500
    
    # Tambahkan debug endpoint
    @app.route('/debug-session')
    def debug_session():
        from flask import session, jsonify
        
        # Hanya aktif di mode debug
        if not app.debug:
            return jsonify({"error": "Debug mode is disabled"}), 403
            
        # Return session data for debugging
        return jsonify({
            "session_data": {k: str(v) for k, v in session.items()},
            "session_file_dir": app.config['SESSION_FILE_DIR'],
            "session_type": app.config['SESSION_TYPE'],
            "session_lifetime": str(app.config['PERMANENT_SESSION_LIFETIME']),
            "session_permanent": app.config['SESSION_PERMANENT']
        })
    
    return app