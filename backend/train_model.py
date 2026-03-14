import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score


# Load dataset
df = pd.read_csv("dataset.csv", on_bad_lines="skip")

X = df["clean_text"]
y = df["category"]


# Split dataset
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)


# ML Pipeline
model = Pipeline([
    ("tfidf", TfidfVectorizer()),
    ("classifier", LogisticRegression())
])


# Train model
model.fit(X_train, y_train)


# Test model
predictions = model.predict(X_test)

print("Accuracy:", accuracy_score(y_test, predictions))


# Save model
joblib.dump(model, "category_model.pkl")

print("Model saved as category_model.pkl")