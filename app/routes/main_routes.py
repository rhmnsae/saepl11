import os
from flask import Blueprint, current_app, render_template, flash, redirect, url_for, request
from flask_login import login_required, current_user
from app.services.sentiment_analysis import load_sentiment_model

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    # Cek apakah model terlatih ada
    model_path = current_app.config['MODEL_PATH']
    if not os.path.exists(model_path):
        flash("PERINGATAN: Model terlatih tidak ditemukan di path models/indobert_sentiment_best.pt. Aplikasi mungkin tidak berfungsi dengan benar.", "warning")
    
    # Menentukan view mana yang akan ditampilkan
    view = request.args.get('view', 'input')
    
    return render_template('index.html', view=view)