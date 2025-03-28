import os
from flask import Blueprint, current_app, render_template, flash, redirect, url_for, request
from flask_login import login_required, current_user
from app.services.sentiment_analysis import load_sentiment_model
from app.models.database import AnalysisHistory

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    # Cek apakah model terlatih ada
    model_path = current_app.config['MODEL_PATH']
    if not os.path.exists(model_path):
        flash("PERINGATAN: Model terlatih tidak ditemukan di path models/indobert_sentiment_best.pt. Aplikasi mungkin tidak berfungsi dengan benar.", "warning")
    
    # Menentukan view mana yang akan ditampilkan
    view = request.args.get('view', 'input')
    
    # Jika view adalah history, profile, atau login, dan memerlukan autentikasi, 
    # tetapi user belum login, redirect ke login
    if view in ['history', 'profile'] and not current_user.is_authenticated:
        flash('Anda harus login terlebih dahulu untuk mengakses halaman ini.', 'warning')
        return redirect(url_for('main.index', view='login'))
    
    # Jika view adalah page tertentu, render template khusus page tersebut
    if view == 'history':
        # Logic untuk halaman riwayat
        page = request.args.get('page', 1, type=int)
        histories = AnalysisHistory.query.filter_by(user_id=current_user.id).order_by(
            AnalysisHistory.created_at.desc()).paginate(page=page, per_page=10)
        
        return render_template('history/index.html', title='Riwayat Analisis', 
                              histories=histories, view=view)
    
    elif view == 'profile':
        # Logic untuk halaman profil
        # Ambil analisis terakhir dari user
        last_analysis = None
        if current_user.is_authenticated and current_user.histories.count() > 0:
            last_analysis = current_user.histories.order_by(AnalysisHistory.created_at.desc()).first()
        
        return render_template('auth/profile.html', title='Profil', 
                              last_analysis=last_analysis, view=view)
    
    elif view == 'login':
        # Jika user sudah login, redirect ke halaman utama
        if current_user.is_authenticated:
            return redirect(url_for('main.index'))
            
        # Import form di sini untuk menghindari circular import
        from app.forms.auth_forms import LoginForm
        form = LoginForm()
        return render_template('auth/login.html', title='Login', form=form, view=view)
        
    elif view == 'register':
        # Jika user sudah login, redirect ke halaman utama
        if current_user.is_authenticated:
            return redirect(url_for('main.index'))
            
        # Import form di sini untuk menghindari circular import
        from app.forms.auth_forms import RegistrationForm
        form = RegistrationForm()
        return render_template('auth/register.html', title='Register', form=form, view=view)
    
    # Untuk view standard (input, results, evaluation) atau default view
    return render_template('index.html', view=view)