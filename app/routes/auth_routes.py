from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_user, logout_user, current_user, login_required
from werkzeug.urls import url_parse
from app import db
from app.models.database import User, AnalysisHistory
from app.forms.auth_forms import LoginForm, RegistrationForm

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user is None or not user.check_password(form.password.data):
            flash('Username atau password salah', 'danger')
            return redirect(url_for('auth.login'))
        
        login_user(user, remember=form.remember_me.data)
        next_page = request.args.get('next')
        if not next_page or url_parse(next_page).netloc != '':
            next_page = url_for('main.index')
        flash(f'Selamat datang kembali, {user.username}!', 'success')
        return redirect(next_page)
    
    return render_template('auth/login.html', title='Login', form=form)

@auth_bp.route('/logout')
def logout():
    logout_user()
    flash('Anda berhasil logout', 'info')
    return redirect(url_for('main.index'))

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    
    form = RegistrationForm()
    if form.validate_on_submit():
        user = User(username=form.username.data, email=form.email.data)
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        flash('Selamat! Akun Anda berhasil dibuat.', 'success')
        return redirect(url_for('auth.login'))
    
    return render_template('auth/register.html', title='Register', form=form)

@auth_bp.route('/profile')
@login_required
def profile():
    # Ambil analisis terakhir dari user
    last_analysis = None
    if current_user.histories.count() > 0:
        last_analysis = current_user.histories.order_by(AnalysisHistory.created_at.desc()).first()
    
    return render_template('auth/profile.html', title='Profil', last_analysis=last_analysis)