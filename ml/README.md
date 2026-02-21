# Machine Learning Models for Keystroke Biometric Authentication

## Setup

### 1. Install Python 3.10+
Download from: https://www.python.org/downloads/

### 2. Create Virtual Environment (Recommended)
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Mac/Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

## Directory Structure

```
ml/
├── requirements.txt          # Python dependencies
├── data_preprocessing.py     # Feature extraction and normalization
├── models/
│   ├── random_forest.py      # Random Forest classifier
│   ├── lstm.py               # LSTM neural network
│   ├── one_class_svm.py      # One-Class SVM for anomaly detection
│   └── ensemble.py           # Ensemble voting system
├── evaluation.py             # FAR/FRR/EER metrics calculation
├── train.py                  # Training script
├── predict.py                # Prediction/inference script
└── utils.py                  # Helper functions
```

## Models

### 1. Random Forest Classifier
- **Purpose**: Binary classification (authentic vs. impostor)
- **Input**: Statistical features (dwell time, flight time, etc.)
- **Output**: Probability score (0-1)
- **Advantages**: Handles non-linear relationships, feature importance

### 2. LSTM Neural Network
- **Purpose**: Temporal sequence modeling
- **Input**: Keystroke timing sequences
- **Output**: Anomaly score
- **Advantages**: Captures typing rhythm over time

### 3. One-Class SVM
- **Purpose**: Anomaly detection (learn "normal" behavior)
- **Input**: Feature vectors
- **Output**: Decision score (positive = normal, negative = anomaly)
- **Advantages**: Works with limited authentic user data

### 4. Ensemble
- **Purpose**: Combine all models for robustness
- **Method**: Weighted voting
- **Advantages**: More accurate than any single model

## Usage

### Training
```python
from ml.train import train_models

# Train all models on user data
models = train_models(user_id='12345')
```

### Prediction
```python
from ml.predict import authenticate

# Verify a keystroke sample
result = authenticate(
    user_id='12345',
    keystroke_data=[...],
    models=models
)

print(f"Authenticated: {result['authenticated']}")
print(f"Confidence: {result['confidence']}")
print(f"Anomaly Score: {result['anomaly_score']}")
```

## Performance Metrics

- **FAR (False Acceptance Rate)**: % of impostors incorrectly accepted
- **FRR (False Rejection Rate)**: % of authentic users incorrectly rejected
- **EER (Equal Error Rate)**: Point where FAR = FRR (lower is better)
- **AUC (Area Under Curve)**: Overall model performance (higher is better)

**Target**: EER < 5%, AUC > 0.95

## 100% Free
All libraries are open-source and free to use!
