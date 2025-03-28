import os
import json
from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify, session, current_app
from flask_login import login_required, current_user
from app import db
from app.models.database import AnalysisHistory
from app.services.sentiment_analysis import predict_sentiments
import pandas as pd
from werkzeug.utils import secure_filename
from datetime import datetime

history_bp = Blueprint('history', __name__)

@history_bp.route('/history')
@login_required
def index():
    page = request.args.get('page', 1, type=int)
    histories = AnalysisHistory.query.filter_by(user_id=current_user.id).order_by(
        AnalysisHistory.created_at.desc()).paginate(page=page, per_page=10)
    
    return render_template('history/index.html', title='Riwayat Analisis', histories=histories)

@history_bp.route('/history/show/<int:id>')
@login_required
def show(id):
    history = AnalysisHistory.query.filter_by(id=id, user_id=current_user.id).first_or_404()
    
    # Load result data
    if history.result_file_path and os.path.exists(history.result_file_path):
        result_df = pd.read_csv(history.result_file_path)
        
        # Store result path in session for reuse
        session['analysis_file'] = history.result_file_path
        session['original_file'] = history.file_path
        
        # Prepare context for chatbot
        session['analysis_context'] = {
            'title': history.title,
            'description': history.description,
            'total_tweets': history.total_tweets,
            'positive_count': history.positive_count,
            'neutral_count': history.neutral_count,
            'negative_count': history.negative_count,
            'positive_percent': history.positive_percent,
            'neutral_percent': history.neutral_percent,
            'negative_percent': history.negative_percent,
            'top_hashtags': history.hashtags_list,
            'top_topics': history.topics_list
        }
        
        # Forces the session to be saved
        session.modified = True
        
        # Return to results page with loaded data
        flash('Analisis berhasil dimuat dari riwayat', 'success')
        return redirect(url_for('main.index', view='results'))
    else:
        flash('File hasil analisis tidak ditemukan', 'error')
        return redirect(url_for('history.index'))

@history_bp.route('/history/delete/<int:id>', methods=['POST'])
@login_required
def delete(id):
    history = AnalysisHistory.query.filter_by(id=id, user_id=current_user.id).first_or_404()
    
    # Delete associated files
    if history.file_path and os.path.exists(history.file_path):
        try:
            os.remove(history.file_path)
        except:
            pass
    
    if history.result_file_path and os.path.exists(history.result_file_path):
        try:
            os.remove(history.result_file_path)
        except:
            pass
    
    # Delete from database
    db.session.delete(history)
    db.session.commit()
    
    flash('Riwayat analisis berhasil dihapus', 'success')
    return redirect(url_for('history.index'))

@history_bp.route('/history/save', methods=['POST'])
@login_required
def save_analysis():
    # Check if there's an active analysis
    if 'analysis_file' not in session or 'analysis_context' not in session:
        flash('Tidak ada data analisis yang aktif', 'warning')
        return redirect(url_for('main.index'))
    
    # Get data from session
    analysis_file = session['analysis_file']
    context = session['analysis_context']
    
    # Check if the file exists
    if not os.path.exists(analysis_file):
        flash('File hasil analisis tidak ditemukan', 'error')
        return redirect(url_for('main.index'))
    
    # Check if analysis with the same title already exists for this user
    existing_analysis = AnalysisHistory.query.filter_by(
        user_id=current_user.id, 
        title=context['title']
    ).first()
    
    if existing_analysis:
        # Update existing record instead of creating a new one
        existing_analysis.description = context.get('description', '')
        existing_analysis.file_path = session.get('original_file', '')
        existing_analysis.result_file_path = analysis_file
        existing_analysis.total_tweets = context['total_tweets']
        existing_analysis.positive_count = context['positive_count']
        existing_analysis.neutral_count = context['neutral_count']
        existing_analysis.negative_count = context['negative_count']
        existing_analysis.positive_percent = context['positive_percent']
        existing_analysis.neutral_percent = context['neutral_percent']
        existing_analysis.negative_percent = context['negative_percent']
        existing_analysis.top_hashtags = json.dumps(context['top_hashtags'])
        existing_analysis.top_topics = json.dumps(context['top_topics'])
        existing_analysis.sentiment_plot = request.form.get('sentiment_plot', '')
        existing_analysis.created_at = datetime.utcnow()  # Update the timestamp
        
        db.session.commit()
        flash('Analisis berhasil diperbarui di riwayat', 'success')
    else:
        # Create new history record
        history = AnalysisHistory(
            title=context['title'],
            description=context.get('description', ''),
            file_path=session.get('original_file', ''),
            result_file_path=analysis_file,
            total_tweets=context['total_tweets'],
            positive_count=context['positive_count'],
            neutral_count=context['neutral_count'],
            negative_count=context['negative_count'],
            positive_percent=context['positive_percent'],
            neutral_percent=context['neutral_percent'],
            negative_percent=context['negative_percent'],
            top_hashtags=json.dumps(context['top_hashtags']),
            top_topics=json.dumps(context['top_topics']),
            sentiment_plot=request.form.get('sentiment_plot', ''),
            user_id=current_user.id
        )
        
        db.session.add(history)
        db.session.commit()
        flash('Analisis berhasil disimpan ke riwayat', 'success')
    
    # If this was an AJAX request, return a JSON response
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({'success': True, 'message': 'Analisis berhasil disimpan ke riwayat'})
    
    # Otherwise redirect to history page
    return redirect(url_for('history.index'))