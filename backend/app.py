import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import psycopg2.extras
from sklearn.linear_model import LinearRegression
import numpy as np
import joblib
import re


app = Flask(__name__)
CORS(app)

# ==============================
# Load ML Categorization Model
# ==============================

model = joblib.load("category_model.pkl")


# ==============================
# Database Configuration
# ==============================

DB_CONFIG = {
    "dbname": "finance_app_db",
    "user": "postgres",
    "password": "lalsen1234",
    "host": "localhost",
    "port": "5432"
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)


# ==============================
# Extract Merchant From SMS
# ==============================

def extract_merchant(sms_text):

    sms_text = sms_text.lower()

    # Try extracting merchant after "to"
    match = re.search(r"to\s([a-zA-Z\s]+)", sms_text)

    if match:
        merchant = match.group(1)
    else:
        merchant = "unknown"

    merchant = re.sub(r'[^a-z ]', '', merchant)

    return merchant.strip()


# ==============================
# Clean SMS Text For ML
# ==============================

def clean_sms_text(text):

    text = text.lower()

    text = re.sub(r'\d+', '', text)
    text = re.sub(r'[^a-z ]', ' ', text)
    text = re.sub(r'\s+', ' ', text)

    return text.strip()


# ==============================
# Home Route
# ==============================

@app.route("/")
def home():
    return "Backend Running"


# ==============================
# Process SMS (ML Categorization)
# ==============================

@app.route("/process-sms", methods=["POST"])
def process_sms():

    try:

        data = request.json

        amount = data.get("amount")
        sms_text = data.get("sms_text")

        if not amount or not sms_text:
            return jsonify({"error": "Invalid data"}), 400

        # Clean text for ML
        cleaned_text = clean_sms_text(sms_text)

        # Predict category
        category = model.predict([cleaned_text])[0]

        # Extract merchant
        merchant = extract_merchant(sms_text)

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO transactions (amount, merchant, category)
            VALUES (%s, %s, %s)
            """,
            (amount, merchant, category)
        )

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "message": "Transaction stored",
            "merchant": merchant,
            "category": category
        })

    except Exception as e:

        return jsonify({"error": str(e)}), 500


# ==============================
# Get All Transactions
# ==============================

@app.route("/get-transactions", methods=["GET"])
def get_transactions():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT * FROM transactions ORDER BY date DESC")
        rows = cur.fetchall()

        transactions = []
        for row in rows:
            transactions.append({
                "id": row[0],
                "amount": row[1],
                "merchant": row[2],
                "category": row[3],
                "date": row[4]
            })

        cur.close()
        conn.close()

        return jsonify(transactions)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==============================
# Weekly Analysis
# ==============================

@app.route("/weekly-analysis", methods=["GET"])
def weekly_analysis():

    try:

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        # Current week
        cur.execute("""
            SELECT category, SUM(amount) as total
            FROM transactions
            WHERE DATE_TRUNC('week', date) = DATE_TRUNC('week', CURRENT_DATE)
            GROUP BY category
        """)

        current_week = {row["category"]: row["total"] for row in cur.fetchall()}

        # Last week
        cur.execute("""
            SELECT category, SUM(amount) as total
            FROM transactions
            WHERE DATE_TRUNC('week', date) =
                  DATE_TRUNC('week', CURRENT_DATE - INTERVAL '1 week')
            GROUP BY category
        """)

        last_week = {row["category"]: row["total"] for row in cur.fetchall()}

        cur.close()
        conn.close()

        nudges = []

        for category in current_week:

            current_value = current_week.get(category, 0)
            last_value = last_week.get(category, 0)

            if last_value > 0:

                change_percent = ((current_value - last_value) / last_value) * 100

                if change_percent > 20:
                    nudges.append(
                        f"⚠️ Your {category} spending increased by {round(change_percent,1)}% this week."
                    )

                elif change_percent < -20:
                    nudges.append(
                        f"✅ Great! Your {category} spending decreased by {round(abs(change_percent),1)}% this week."
                    )

        return jsonify({
            "current_week": current_week,
            "last_week": last_week,
            "nudges": nudges
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==============================
# ML Prediction API
# ==============================

@app.route("/predict-next-week", methods=["GET"])
def predict_next_week():

    try:

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT DATE_TRUNC('week', date) as week,
                   SUM(amount) as total
            FROM transactions
            GROUP BY week
            ORDER BY week
        """)

        rows = cur.fetchall()

        cur.close()
        conn.close()

        if len(rows) < 3:
            return jsonify({"error": "Not enough data"}), 400

        totals = [row[1] for row in rows]

        X = []
        y = []

        for i in range(2, len(totals)):

            prev_week = totals[i-1]
            prev2_week = totals[i-2]

            rolling_avg = (prev_week + prev2_week) / 2

            X.append([i, prev_week, rolling_avg])
            y.append(totals[i])

        X = np.array(X)
        y = np.array(y)

        model_lr = LinearRegression()
        model_lr.fit(X, y)

        last_week = totals[-1]
        second_last_week = totals[-2]

        rolling_avg = (last_week + second_last_week) / 2
        next_index = len(totals)

        next_features = np.array([[next_index, last_week, rolling_avg]])

        prediction = model_lr.predict(next_features)[0]

        return jsonify({
            "weekly_totals": totals,
            "predicted_next_week_spending": round(float(prediction), 2)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==============================
# Spending Summary
# ==============================

@app.route("/spending-summary", methods=["GET"])
def spending_summary():

    try:

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT SUM(amount) FROM transactions")
        total = cur.fetchone()[0] or 0

        cur.execute("""
            SELECT category, SUM(amount)
            FROM transactions
            GROUP BY category
        """)

        category_data = cur.fetchall()

        summary = {
            "total_spending": total,
            "category_breakdown": [
                {"category": row[0], "amount": row[1]}
                for row in category_data
            ]
        }

        cur.close()
        conn.close()

        return jsonify(summary)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==============================
# Run App
# ==============================

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)