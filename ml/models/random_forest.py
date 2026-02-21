"""
Random Forest Classifier for Keystroke Biometric Authentication

Random Forest is an ensemble learning method that creates multiple decision trees
and combines their predictions. It's excellent for keystroke dynamics because:
- Handles non-linear relationships between features
- Provides feature importance rankings
- Resistant to overfitting
- Fast training and prediction
"""

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score
import joblib
import os


class RandomForestAuth:
    """
    Random Forest model for keystroke authentication
    """

    def __init__(self, n_estimators=100, max_depth=10, random_state=42):
        """
        Initialize Random Forest classifier

        Args:
            n_estimators: Number of trees in the forest
            max_depth: Maximum depth of each tree
            random_state: Random seed for reproducibility
        """
        self.model = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=random_state,
            class_weight='balanced',  # Handle imbalanced data (more authentic than impostor samples)
            n_jobs=-1  # Use all CPU cores
        )
        self.is_trained = False
        self.feature_importance = None

    def train(self, X_train, y_train):
        """
        Train the Random Forest model

        Args:
            X_train: Training features (n_samples, n_features)
            y_train: Training labels (1 = authentic, 0 = impostor)

        Returns:
            Training accuracy
        """
        if len(X_train) < 10:
            raise ValueError("Need at least 10 samples for training")

        # Train the model
        self.model.fit(X_train, y_train)
        self.is_trained = True

        # Store feature importance
        self.feature_importance = self.model.feature_importances_

        # Calculate training accuracy
        train_accuracy = self.model.score(X_train, y_train)

        return train_accuracy

    def predict(self, X_test):
        """
        Predict authentication result

        Args:
            X_test: Test features (n_samples, n_features) or single sample (n_features,)

        Returns:
            Dictionary with prediction results
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before prediction")

        # Handle single sample
        if X_test.ndim == 1:
            X_test = X_test.reshape(1, -1)

        # Get probability predictions
        proba = self.model.predict_proba(X_test)

        # Get class predictions
        predictions = self.model.predict(X_test)

        results = []
        for i in range(len(X_test)):
            # Probability of being authentic (class 1)
            auth_probability = proba[i][1] if len(proba[i]) > 1 else 0.0

            # Convert to anomaly score (0 = authentic, 1 = impostor)
            anomaly_score = 1.0 - auth_probability

            results.append({
                'authenticated': bool(predictions[i]),
                'confidence': float(auth_probability * 100),
                'anomaly_score': float(anomaly_score),
                'method': 'random_forest'
            })

        return results[0] if len(results) == 1 else results

    def cross_validate(self, X, y, cv=5):
        """
        Perform cross-validation to assess model performance

        Args:
            X: Features
            y: Labels
            cv: Number of cross-validation folds

        Returns:
            Mean accuracy and standard deviation
        """
        scores = cross_val_score(self.model, X, y, cv=cv)
        return {
            'mean_accuracy': np.mean(scores),
            'std_accuracy': np.std(scores),
            'scores': scores.tolist()
        }

    def get_feature_importance(self, feature_names=None):
        """
        Get feature importance rankings

        Args:
            feature_names: Optional list of feature names

        Returns:
            Dictionary of feature importance scores
        """
        if not self.is_trained:
            raise ValueError("Model must be trained first")

        importance = self.feature_importance

        if feature_names:
            # Sort features by importance
            indices = np.argsort(importance)[::-1]
            return {
                feature_names[i]: float(importance[i])
                for i in indices[:20]  # Top 20 features
            }
        else:
            return {
                f'feature_{i}': float(importance[i])
                for i in range(len(importance))
            }

    def save(self, filepath):
        """
        Save model to disk

        Args:
            filepath: Path to save the model
        """
        if not self.is_trained:
            raise ValueError("Cannot save untrained model")

        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        joblib.dump({
            'model': self.model,
            'feature_importance': self.feature_importance,
            'is_trained': self.is_trained
        }, filepath)

    def load(self, filepath):
        """
        Load model from disk

        Args:
            filepath: Path to the saved model
        """
        data = joblib.load(filepath)
        self.model = data['model']
        self.feature_importance = data['feature_importance']
        self.is_trained = data['is_trained']


# Utility functions

def train_for_user(user_id, authentic_samples, impostor_samples=None):
    """
    Train a Random Forest model for a specific user

    Args:
        user_id: User identifier
        authentic_samples: List of authentic keystroke samples
        impostor_samples: List of impostor samples (optional)

    Returns:
        Trained RandomForestAuth instance
    """
    from data_preprocessing import KeystrokePreprocessor

    preprocessor = KeystrokePreprocessor()

    # Prepare training data
    X_train, y_train = preprocessor.prepare_training_data(
        authentic_samples,
        impostor_samples
    )

    # Normalize features
    X_train = preprocessor.normalize_features(X_train, fit=True)

    # Train model
    rf_model = RandomForestAuth()
    accuracy = rf_model.train(X_train, y_train)

    print(f"Random Forest trained for user {user_id}")
    print(f"Training accuracy: {accuracy:.2%}")

    # Save model
    model_path = f'ml/saved_models/rf_{user_id}.pkl'
    rf_model.save(model_path)

    return rf_model


if __name__ == "__main__":
    # Example usage
    print("Random Forest Keystroke Authentication Model")
    print("=" * 50)

    # Generate synthetic data for demonstration
    np.random.seed(42)

    # Simulate authentic user samples (22 features)
    n_features = 22
    n_authentic = 50
    n_impostor = 30

    # Authentic samples: clustered around certain values
    X_authentic = np.random.normal(loc=150, scale=30, size=(n_authentic, n_features))

    # Impostor samples: different distribution
    X_impostor = np.random.normal(loc=200, scale=40, size=(n_impostor, n_features))

    # Combine data
    X = np.vstack([X_authentic, X_impostor])
    y = np.array([1] * n_authentic + [0] * n_impostor)

    # Train model
    rf_model = RandomForestAuth(n_estimators=100)
    accuracy = rf_model.train(X, y)

    print(f"\nTraining completed")
    print(f"Accuracy: {accuracy:.2%}")

    # Test prediction
    test_sample = np.random.normal(loc=150, scale=30, size=(1, n_features))
    result = rf_model.predict(test_sample)

    print(f"\nTest Prediction:")
    print(f"  Authenticated: {result['authenticated']}")
    print(f"  Confidence: {result['confidence']:.1f}%")
    print(f"  Anomaly Score: {result['anomaly_score']:.3f}")

    # Cross-validation
    cv_results = rf_model.cross_validate(X, y, cv=5)
    print(f"\nCross-validation (5-fold):")
    print(f"  Mean Accuracy: {cv_results['mean_accuracy']:.2%}")
    print(f"  Std Dev: {cv_results['std_accuracy']:.3f}")
