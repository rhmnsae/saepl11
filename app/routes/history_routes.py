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
import traceback

history_bp = Blueprint('history', __name__)

@history_bp.route('/history')
@login_required
def index():
    # Redirect ke halaman utama dengan view=history
    return redirect(url_for('main.index', view='history'))

@history_bp.route('/history/show/<int:id>')
@login_required
def show(id):
    try:
        # Ambil data riwayat dari database
        history = AnalysisHistory.query.filter_by(id=id, user_id=current_user.id).first_or_404()
        
        # Log untuk debugging
        print(f"Loading history ID {id} - Title: {history.title}, Path: {history.result_file_path}")
        
        # Periksa apakah result_file_path ada
        if not history.result_file_path:
            flash('Data file hasil analisis tidak tersedia. Riwayat ini mungkin tidak lengkap.', 'error')
            return redirect(url_for('main.index', view='history'))
        
        # Periksa apakah file ada
        result_file_exists = os.path.exists(history.result_file_path)
        original_file_exists = False
        if history.file_path:
            original_file_exists = os.path.exists(history.file_path)
            
        # Jika file hasil tidak ditemukan, coba beberapa alternatif path
        if not result_file_exists:
            alternative_paths = [
                # Coba dengan nama file langsung
                os.path.join(current_app.config['UPLOAD_FOLDER'], os.path.basename(history.result_file_path)),
                # Coba dengan prefix 'analyzed_'
                os.path.join(current_app.config['UPLOAD_FOLDER'], 'analyzed_' + os.path.basename(history.result_file_path)),
                # Coba tanpa prefix 'analyzed_'
                os.path.join(current_app.config['UPLOAD_FOLDER'], os.path.basename(history.result_file_path).replace('analyzed_', ''))
            ]
            
            # Cek alternatif path
            for alt_path in alternative_paths:
                if os.path.exists(alt_path):
                    print(f"Found alternative path: {alt_path}")
                    history.result_file_path = alt_path
                    db.session.commit()
                    result_file_exists = True
                    break
            
            # Jika masih tidak ketemu
            if not result_file_exists:
                flash('File hasil analisis tidak ditemukan. File mungkin telah dihapus atau dipindahkan.', 'error')
                return redirect(url_for('main.index', view='history'))
        
        try:
            # Load data hasil analisis
            result_df = pd.read_csv(history.result_file_path)
            
            # Validasi bahwa file memiliki kolom yang diperlukan
            required_cols = ['predicted_sentiment']
            
            # Normalisasi nama kolom untuk antisipasi inconsistensi
            result_df.columns = [col.strip().lower() for col in result_df.columns]
            
            # Cek dengan nama kolom yang sudah dinormalisasi
            missing_cols = [col for col in required_cols if col.lower() not in result_df.columns]
            
            if missing_cols:
                # Coba melakukan konversi kolom-kolom lama ke nama kolom baru
                if 'prediction' in result_df.columns and 'predicted_sentiment' not in result_df.columns:
                    result_df['predicted_sentiment'] = result_df['prediction']
                    missing_cols.remove('predicted_sentiment')
            
            # Cek lagi setelah konversi
            if missing_cols:
                flash(f'File hasil analisis tidak valid. Kolom yang diperlukan tidak ditemukan: {", ".join(missing_cols)}', 'error')
                return redirect(url_for('main.index', view='history'))
            
            # Simpan jalur file di session untuk digunakan kembali
            session['analysis_file'] = history.result_file_path
            session['original_file'] = history.file_path if original_file_exists else None
            
            # Pastikan semua field yang diperlukan ada dan memiliki tipe data yang benar
            # Konversi data dari database ke format yang diharapkan
            try:
                top_hashtags = history.hashtags_list if history.hashtags_list else []
                # Jika hashtags_list bukan list, coba parse sebagai JSON
                if isinstance(top_hashtags, str):
                    try:
                        top_hashtags = json.loads(top_hashtags)
                    except:
                        top_hashtags = []
                
                top_topics = history.topics_list if history.topics_list else []
                # Jika topics_list bukan list, coba parse sebagai JSON
                if isinstance(top_topics, str):
                    try:
                        top_topics = json.loads(top_topics)
                    except:
                        top_topics = []
            except Exception as e:
                print(f"Error parsing hashtags/topics: {str(e)}")
                top_hashtags = []
                top_topics = []
            
            # Siapkan konteks untuk chatbot dengan validasi tipe data
            session['analysis_context'] = {
                'title': str(history.title) if history.title else 'Analisis Tanpa Judul',
                'description': str(history.description) if history.description else '',
                'total_tweets': int(history.total_tweets) if history.total_tweets else 0,
                'positive_count': int(history.positive_count) if history.positive_count else 0,
                'neutral_count': int(history.neutral_count) if history.neutral_count else 0, 
                'negative_count': int(history.negative_count) if history.negative_count else 0,
                'positive_percent': float(history.positive_percent) if history.positive_percent else 0.0,
                'neutral_percent': float(history.neutral_percent) if history.neutral_percent else 0.0,
                'negative_percent': float(history.negative_percent) if history.negative_percent else 0.0,
                'top_hashtags': top_hashtags,
                'top_topics': top_topics
            }
            
            # Paksa session untuk disimpan
            session.modified = True
            
            # Kembali ke halaman hasil dengan data yang telah dimuat
            flash('Analisis berhasil dimuat dari riwayat', 'success')
            return redirect(url_for('main.index', view='results'))
        except Exception as e:
            # Log error untuk debugging
            print(f"Error loading analysis data: {str(e)}")
            traceback.print_exc()
            flash(f'Terjadi kesalahan saat memuat data: {str(e)}', 'error')
            return redirect(url_for('main.index', view='history'))
    except Exception as e:
        # Log error untuk debugging
        print(f"Error in history.show: {str(e)}")
        traceback.print_exc()
        flash(f'Terjadi kesalahan: {str(e)}', 'error')
        return redirect(url_for('main.index', view='history'))

@history_bp.route('/history/delete/<int:id>', methods=['POST'])
@login_required
def delete(id):
    try:
        history = AnalysisHistory.query.filter_by(id=id, user_id=current_user.id).first_or_404()
        
        # Delete associated files
        if history.file_path and os.path.exists(history.file_path):
            try:
                os.remove(history.file_path)
            except Exception as e:
                print(f"Warning: Could not delete file {history.file_path}: {str(e)}")
        
        if history.result_file_path and os.path.exists(history.result_file_path):
            try:
                os.remove(history.result_file_path)
            except Exception as e:
                print(f"Warning: Could not delete file {history.result_file_path}: {str(e)}")
        
        # Delete from database
        db.session.delete(history)
        db.session.commit()
        
        flash('Riwayat analisis berhasil dihapus', 'success')
        return redirect(url_for('main.index', view='history'))
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting history: {str(e)}")
        traceback.print_exc()
        flash(f'Terjadi kesalahan saat menghapus: {str(e)}', 'error')
        return redirect(url_for('main.index', view='history'))

@history_bp.route('/history/save', methods=['POST'])
@login_required
def save_analysis():
    # Check if there's an active analysis
    if 'analysis_file' not in session or 'analysis_context' not in session:
        flash('Tidak ada data analisis yang aktif', 'warning')
        return redirect(url_for('main.index'))
    
    try:
        # Get data from session
        analysis_file = session['analysis_file']
        context = session['analysis_context']
        
        # Check if the file exists
        if not os.path.exists(analysis_file):
            flash('File hasil analisis tidak ditemukan', 'error')
            return redirect(url_for('main.index'))
        
        # Convert top_hashtags and top_topics to proper format for storage
        top_hashtags = context.get('top_hashtags', [])
        if not isinstance(top_hashtags, str):
            # If it's not a string, it should be a list, convert to JSON
            top_hashtags = json.dumps(top_hashtags)
        
        top_topics = context.get('top_topics', [])
        if not isinstance(top_topics, str):
            # If it's not a string, it should be a list, convert to JSON
            top_topics = json.dumps(top_topics)
        
        # Check if analysis with the same title already exists for this user
        existing_analysis = AnalysisHistory.query.filter_by(
            user_id=current_user.id, 
            title=context.get('title', '')
        ).first()
        
        if existing_analysis:
            # Update existing record instead of creating a new one
            existing_analysis.description = context.get('description', '')
            existing_analysis.file_path = session.get('original_file', '')
            existing_analysis.result_file_path = analysis_file
            existing_analysis.total_tweets = context.get('total_tweets', 0)
            existing_analysis.positive_count = context.get('positive_count', 0)
            existing_analysis.neutral_count = context.get('neutral_count', 0)
            existing_analysis.negative_count = context.get('negative_count', 0)
            existing_analysis.positive_percent = context.get('positive_percent', 0)
            existing_analysis.neutral_percent = context.get('neutral_percent', 0)
            existing_analysis.negative_percent = context.get('negative_percent', 0)
            existing_analysis.top_hashtags = top_hashtags
            existing_analysis.top_topics = top_topics
            existing_analysis.sentiment_plot = request.form.get('sentiment_plot', '')
            existing_analysis.created_at = datetime.utcnow()  # Update the timestamp
            
            db.session.commit()
            flash('Analisis berhasil diperbarui di riwayat', 'success')
        else:
            # Create new history record
            history = AnalysisHistory(
                title=context.get('title', ''),
                description=context.get('description', ''),
                file_path=session.get('original_file', ''),
                result_file_path=analysis_file,
                total_tweets=context.get('total_tweets', 0),
                positive_count=context.get('positive_count', 0),
                neutral_count=context.get('neutral_count', 0),
                negative_count=context.get('negative_count', 0),
                positive_percent=context.get('positive_percent', 0),
                neutral_percent=context.get('neutral_percent', 0),
                negative_percent=context.get('negative_percent', 0),
                top_hashtags=top_hashtags,
                top_topics=top_topics,
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
        return redirect(url_for('main.index', view='history'))
    except Exception as e:
        db.session.rollback()
        print(f"Error saving analysis: {str(e)}")
        traceback.print_exc()
        
        # If this was an AJAX request, return a JSON response
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': False, 'message': f'Error: {str(e)}'})
        
        flash(f'Terjadi kesalahan saat menyimpan: {str(e)}', 'error')
        return redirect(url_for('main.index'))

# API endpoint untuk mendapatkan detail riwayat
@history_bp.route('/api/history/<int:id>', methods=['GET'])
@login_required
def get_history_details(id):
    try:
        history = AnalysisHistory.query.filter_by(id=id, user_id=current_user.id).first_or_404()
        return jsonify({
            'success': True,
            'history': history.to_dict()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })