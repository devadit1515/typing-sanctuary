"""
Data Preprocessing for Keystroke Biometrics
Extracts and normalizes features from keystroke samples
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple
from scipy import stats


class KeystrokePreprocessor:
    """
    Preprocesses keystroke data into machine learning features
    """

    def __init__(self):
        self.feature_names = []
        self.scaler_params = {}  # For normalization

    def extract_features(self, keystroke_data: List[Dict]) -> np.ndarray:
        """
        Extract statistical features from raw keystroke data

        Args:
            keystroke_data: List of keystroke events with timing info

        Returns:
            Feature vector as numpy array
        """
        if not keystroke_data or len(keystroke_data) < 10:
            return None

        features = []

        # Extract dwell times (how long each key is held)
        dwell_times = [k['dwellTime'] for k in keystroke_data
                       if k.get('dwellTime') is not None and k['dwellTime'] > 0]

        # Extract flight times (time between keystrokes)
        flight_times = [k['flightTime'] for k in keystroke_data
                        if k.get('flightTime') is not None and k['flightTime'] > 0]

        if len(dwell_times) < 5 or len(flight_times) < 5:
            return None

        # Dwell time features
        features.extend(self._compute_timing_features(dwell_times, 'dwell'))

        # Flight time features
        features.extend(self._compute_timing_features(flight_times, 'flight'))

        # Rhythm features
        features.extend(self._compute_rhythm_features(flight_times))

        # Error features
        features.extend(self._compute_error_features(keystroke_data))

        # Digraph features (key pair timings)
        features.extend(self._compute_digraph_features(keystroke_data))

        return np.array(features)

    def _compute_timing_features(self, timings: List[float], prefix: str) -> List[float]:
        """Compute statistical features from timing data"""
        if not timings:
            return [0] * 6

        timings = np.array(timings)

        return [
            np.mean(timings),           # Mean
            np.std(timings),            # Standard deviation
            np.median(timings),         # Median
            np.min(timings),            # Min
            np.max(timings),            # Max
            stats.iqr(timings)          # Interquartile range
        ]

    def _compute_rhythm_features(self, flight_times: List[float]) -> List[float]:
        """Compute typing rhythm features"""
        if len(flight_times) < 10:
            return [0] * 4

        flight_times = np.array(flight_times)

        # Define pause threshold (500ms)
        pause_threshold = 500

        # Burst speed (fast typing intervals)
        bursts = flight_times[flight_times < pause_threshold]
        burst_speed = np.mean(bursts) if len(bursts) > 0 else 0

        # Pause frequency
        pauses = flight_times[flight_times >= pause_threshold]
        pause_frequency = len(pauses) / len(flight_times)

        # Pause duration
        pause_duration = np.mean(pauses) if len(pauses) > 0 else 0

        # Typing consistency (coefficient of variation)
        consistency = np.std(flight_times) / np.mean(flight_times) if np.mean(flight_times) > 0 else 0

        return [burst_speed, pause_frequency, pause_duration, consistency]

    def _compute_error_features(self, keystroke_data: List[Dict]) -> List[float]:
        """Compute error pattern features"""
        total = len(keystroke_data)
        if total == 0:
            return [0, 0]

        # Error rate
        errors = sum(1 for k in keystroke_data if not k.get('isCorrect', True))
        error_rate = errors / total

        # Error timing (do errors happen faster or slower?)
        error_timings = [k.get('dwellTime', 0) for k in keystroke_data if not k.get('isCorrect', True)]
        correct_timings = [k.get('dwellTime', 0) for k in keystroke_data if k.get('isCorrect', True)]

        avg_error_timing = np.mean(error_timings) if error_timings else 0
        avg_correct_timing = np.mean(correct_timings) if correct_timings else 0

        timing_diff = avg_error_timing - avg_correct_timing if avg_correct_timing > 0 else 0

        return [error_rate, timing_diff]

    def _compute_digraph_features(self, keystroke_data: List[Dict]) -> List[float]:
        """Compute features for common key pairs (digraphs)"""
        # Extract digraph timings
        digraphs = {}

        for i in range(1, len(keystroke_data)):
            prev_char = keystroke_data[i-1].get('char', '')
            curr_char = keystroke_data[i].get('char', '')
            flight_time = keystroke_data[i].get('flightTime')

            if prev_char and curr_char and flight_time is not None:
                digraph = (prev_char + curr_char).lower()
                if digraph not in digraphs:
                    digraphs[digraph] = []
                digraphs[digraph].append(flight_time)

        # Compute mean timing for most common digraphs
        common_digraphs = ['th', 'he', 'in', 'er', 'an', 'ed', 'to', 'it', 'ou', 'ea']
        digraph_features = []

        for dg in common_digraphs:
            if dg in digraphs and len(digraphs[dg]) > 0:
                digraph_features.append(np.mean(digraphs[dg]))
            else:
                digraph_features.append(0)

        return digraph_features

    def normalize_features(self, features: np.ndarray, fit: bool = False) -> np.ndarray:
        """
        Normalize features using z-score normalization

        Args:
            features: Feature matrix (n_samples, n_features)
            fit: If True, compute normalization parameters

        Returns:
            Normalized features
        """
        if fit:
            # Compute mean and std for each feature
            self.scaler_params['mean'] = np.mean(features, axis=0)
            self.scaler_params['std'] = np.std(features, axis=0) + 1e-8  # Add epsilon to avoid division by zero

        # Apply normalization
        if 'mean' in self.scaler_params and 'std' in self.scaler_params:
            normalized = (features - self.scaler_params['mean']) / self.scaler_params['std']
            return normalized

        return features

    def create_sequences(self, keystroke_data: List[Dict], sequence_length: int = 50) -> np.ndarray:
        """
        Create sequences for LSTM model

        Args:
            keystroke_data: Raw keystroke events
            sequence_length: Length of each sequence

        Returns:
            3D array (n_sequences, sequence_length, n_features)
        """
        sequences = []

        for i in range(0, len(keystroke_data) - sequence_length + 1, sequence_length // 2):
            sequence_data = keystroke_data[i:i + sequence_length]

            # Extract simple features for each keystroke in sequence
            sequence_features = []
            for k in sequence_data:
                features = [
                    k.get('dwellTime', 0),
                    k.get('flightTime', 0),
                    1.0 if k.get('isCorrect', True) else 0.0
                ]
                sequence_features.append(features)

            sequences.append(sequence_features)

        return np.array(sequences)

    def prepare_training_data(self, authentic_samples: List[List[Dict]],
                              impostor_samples: List[List[Dict]] = None) -> Tuple[np.ndarray, np.ndarray]:
        """
        Prepare training data from authentic and impostor samples

        Args:
            authentic_samples: List of keystroke samples from authentic user
            impostor_samples: List of keystroke samples from impostors (optional)

        Returns:
            X (features), y (labels)
        """
        X = []
        y = []

        # Process authentic samples (label = 1)
        for sample in authentic_samples:
            features = self.extract_features(sample)
            if features is not None:
                X.append(features)
                y.append(1)

        # Process impostor samples (label = 0)
        if impostor_samples:
            for sample in impostor_samples:
                features = self.extract_features(sample)
                if features is not None:
                    X.append(features)
                    y.append(0)

        return np.array(X), np.array(y)


def load_data_from_mongodb(user_id: str):
    """
    Load keystroke samples from MongoDB (to be called from Node.js or directly)

    This is a placeholder - actual implementation would connect to MongoDB
    """
    # TODO: Implement MongoDB connection
    # from pymongo import MongoClient
    # client = MongoClient(mongodb_uri)
    # db = client['your_database']
    # biometric = db.keystroke_biometrics.find_one({'userId': user_id})
    # return biometric['samples']
    pass


if __name__ == "__main__":
    # Example usage
    preprocessor = KeystrokePreprocessor()

    # Example keystroke data
    sample_data = [
        {'char': 't', 'dwellTime': 82, 'flightTime': 145, 'isCorrect': True},
        {'char': 'h', 'dwellTime': 91, 'flightTime': 123, 'isCorrect': True},
        {'char': 'e', 'dwellTime': 78, 'flightTime': 156, 'isCorrect': True},
        # ... more keystrokes
    ]

    # Extract features
    features = preprocessor.extract_features(sample_data * 10)  # Simulate longer sample

    if features is not None:
        print(f"Extracted {len(features)} features")
        print(f"Feature vector: {features[:10]}...")  # Show first 10 features
