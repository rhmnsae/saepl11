from datetime import datetime
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from app import db, login_manager
import json

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    histories = db.relationship('AnalysisHistory', backref='user', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<User {self.username}>'
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class AnalysisHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    file_path = db.Column(db.String(256), nullable=True)
    result_file_path = db.Column(db.String(256), nullable=True)
    total_tweets = db.Column(db.Integer, default=0)
    positive_count = db.Column(db.Integer, default=0)
    neutral_count = db.Column(db.Integer, default=0)
    negative_count = db.Column(db.Integer, default=0)
    positive_percent = db.Column(db.Float, default=0)
    neutral_percent = db.Column(db.Float, default=0)
    negative_percent = db.Column(db.Float, default=0)
    top_hashtags = db.Column(db.Text, nullable=True)  # Stored as JSON
    top_topics = db.Column(db.Text, nullable=True)    # Stored as JSON
    sentiment_plot = db.Column(db.Text, nullable=True)  # Base64 encoded image
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    def __repr__(self):
        return f'<AnalysisHistory {self.title}>'
    
    @property
    def hashtags_list(self):
        if not self.top_hashtags:
            return []
            
        try:
            return json.loads(self.top_hashtags)
        except (json.JSONDecodeError, TypeError) as e:
            print(f"Error parsing hashtags for history {self.id}: {str(e)}")
            if isinstance(self.top_hashtags, list):
                return self.top_hashtags
            return []
    
    @property
    def topics_list(self):
        if not self.top_topics:
            return []
            
        try:
            return json.loads(self.top_topics)
        except (json.JSONDecodeError, TypeError) as e:
            print(f"Error parsing topics for history {self.id}: {str(e)}")
            if isinstance(self.top_topics, list):
                return self.top_topics
            return []
    
    def to_dict(self):
        """Convert model to dictionary with proper type handling"""
        try:
            return {
                'id': self.id,
                'title': self.title,
                'description': self.description or "",
                'created_at': self.created_at.strftime('%d-%m-%Y %H:%M') if self.created_at else "",
                'total_tweets': self.total_tweets or 0,
                'positive_count': self.positive_count or 0,
                'neutral_count': self.neutral_count or 0,
                'negative_count': self.negative_count or 0,
                'positive_percent': float(self.positive_percent or 0),
                'neutral_percent': float(self.neutral_percent or 0),
                'negative_percent': float(self.negative_percent or 0),
                'top_hashtags': self.hashtags_list,
                'top_topics': self.topics_list,
                'file_path': self.file_path or "",
                'result_file_path': self.result_file_path or ""
            }
        except Exception as e:
            import traceback
            traceback.print_exc()
            # Return minimal dictionary in case of error
            return {
                'id': self.id,
                'title': self.title,
                'error': str(e)
            }