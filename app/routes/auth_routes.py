from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_user, logout_user, current_user, login_required
from werkzeug.urls import url_parse
from app import db
from app.models.database import User, AnalysisHistory
from app.forms.auth_forms import LoginForm, RegistrationForm

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    # Redirect ke halaman utama dengan view=login
    if request.method == 'GET':
        return redirect(url_for('main.index', view='login'))
    
    # Handle POST request untuk login
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user is None or not user.check_password(form.password.data):
            flash('Username atau password salah', 'danger')
            return redirect(url_for('main.index', view='login'))
        
        login_user(user, remember=form.remember_me.data)
        next_page = request.args.get('next')
        if not next_page or url_parse(next_page).netloc != '':
            next_page = url_for('main.index')
        flash(f'Selamat datang kembali, {user.username}!', 'success')
        return redirect(next_page)
    
    # Jika ada validasi error, kembali ke halaman login
    for field, errors in form.errors.items():
        for error in errors:
            flash(f'{getattr(form, field).label.text}: {error}', 'danger')
    return redirect(url_for('main.index', view='login'))

@auth_bp.route('/logout')
def logout():
    logout_user()
    flash('Anda berhasil logout', 'info')
    return redirect(url_for('main.index'))

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    # Redirect ke halaman utama dengan view=register
    if request.method == 'GET':
        return redirect(url_for('main.index', view='register'))
    
    # Handle POST request untuk register
    form = RegistrationForm()
    if form.validate_on_submit():
        user = User(username=form.username.data, email=form.email.data)
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        flash('Selamat! Akun Anda berhasil dibuat.', 'success')
        return redirect(url_for('main.index', view='login'))
    
    # Jika ada validasi error, kembali ke halaman register
    for field, errors in form.errors.items():
        for error in errors:
            flash(f'{getattr(form, field).label.text}: {error}', 'danger')
    return redirect(url_for('main.index', view='register'))

@auth_bp.route('/profile')
@login_required
def profile():
    # Redirect ke halaman utama dengan view=profile
    return redirect(url_for('main.index', view='profile'))