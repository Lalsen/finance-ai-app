import pandas as pd
import joblib
import re

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score


# Load dataset
df = pd.read_csv("dataset.csv", on_bad_lines="skip")


# Clean dataset
df["category"] = df["category"].astype(str).str.strip()
df["clean_text"] = df["clean_text"].astype(str).str.lower().str.strip()


# Shuffle dataset
df = df.sample(frac=1, random_state=42).reset_index(drop=True)


# Text cleaning
def clean_text(text):

    text = re.sub(r'\d+', ' ', text)
    text = re.sub(r'[^a-zA-Z ]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()

    return text


df["clean_text"] = df["clean_text"].apply(clean_text)


# Features
X = df["clean_text"]
y = df["category"]


# Train test split
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)


# Pipeline
model = Pipeline([
    ("tfidf", TfidfVectorizer(
        analyzer="char_wb",
        ngram_range=(2,5),
        max_features=20000
    )),
    ("classifier", LinearSVC())
])


# Train
model.fit(X_train, y_train)


# Predict
predictions = model.predict(X_test)


# Accuracy
accuracy = accuracy_score(y_test, predictions)

print("Accuracy:", round(accuracy * 100, 2), "%")


# Save model
joblib.dump(model, "category_model.pkl")

print("Model saved as category_model.pkl")