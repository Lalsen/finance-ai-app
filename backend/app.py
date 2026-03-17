import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import timedelta, datetime
import psycopg2.extras
import joblib
import re

app = Flask(__name__)
CORS(app)

# ==============================
# Load ML Model
# ==============================
model = joblib.load("category_model.pkl")

# ==============================
# Database Config
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
# Extract Merchant
# ==============================
def extract_merchant(sms_text):
    sms_text = sms_text.lower()
    match = re.search(r"to\s([a-zA-Z\s]+)", sms_text)

    merchant = match.group(1) if match else "unknown"
    merchant = re.sub(r'[^a-z ]', '', merchant)

    return merchant.strip()

# ==============================
# Clean SMS Text
# ==============================
def clean_sms_text(text):
    text = text.lower()
    text = re.sub(r'\d+', '', text)
    text = re.sub(r'[^a-z ]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

# ==============================
# Get Date Range Function
# ==============================
def get_date_range(range_type):
    today = datetime.now().date()

    if range_type == "this_week":
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=7)

    elif range_type == "last_week":
        end = today - timedelta(days=today.weekday())
        start = end - timedelta(days=7)

    elif range_type == "this_month":
        start = today.replace(day=1)
        end = today

    elif range_type == "all":
        start = None
        end = None

    else:
        end = today - timedelta(days=today.weekday())
        start = end - timedelta(days=7)

    return start, end

# ==============================
# Home
# ==============================
@app.route("/")
def home():
    return "Backend Running"

# ==============================
# Process SMS
# ==============================
@app.route("/process-sms", methods=["POST"])
def process_sms():
    try:
        data = request.json
        amount = data.get("amount")
        sms_text = data.get("sms_text")

        if not amount or not sms_text:
            return jsonify({"error": "Invalid data"}), 400

        cleaned_text = clean_sms_text(sms_text)
        category = model.predict([cleaned_text])[0].lower()
        merchant = extract_merchant(sms_text)

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO transactions (amount, merchant, category)
            VALUES (%s, %s, %s)
        """, (amount, merchant, category))

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
# Get Transactions
# ==============================
@app.route("/get-transactions", methods=["GET"])
def get_transactions():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, amount, merchant, category, date
            FROM transactions
            ORDER BY date DESC
        """)

        rows = cur.fetchall()

        transactions = [
            {
                "id": row[0],
                "amount": row[1],
                "merchant": row[2],
                "category": row[3],
                "date": row[4]
            }
            for row in rows
        ]

        cur.close()
        conn.close()

        return jsonify(transactions)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==============================
# Spending Summary (SAFE + FLEXIBLE)
# ==============================
@app.route("/spending-summary", methods=["GET"])
def spending_summary():
    try:
        range_type = request.args.get("range", "last_week")

        start_date, end_date = get_date_range(range_type)

        conn = get_db_connection()
        cur = conn.cursor()

        if start_date and end_date:
            cur.execute("""
                SELECT COALESCE(SUM(amount), 0)
                FROM transactions
                WHERE date >= %s AND date < %s
            """, (start_date, end_date))

            total = cur.fetchone()[0]

            cur.execute("""
                SELECT category, SUM(amount)
                FROM transactions
                WHERE date >= %s AND date < %s
                GROUP BY category
            """, (start_date, end_date))

        else:
            cur.execute("SELECT COALESCE(SUM(amount), 0) FROM transactions")
            total = cur.fetchone()[0]

            cur.execute("""
                SELECT category, SUM(amount)
                FROM transactions
                GROUP BY category
            """)

        category_data = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify({
            "range": range_type,
            "total_spending": total,
            "category_breakdown": [
                {"category": row[0], "amount": row[1]}
                for row in category_data
            ]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==============================
# Prediction (unchanged)
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
            WHERE date < DATE_TRUNC('week', CURRENT_DATE)
            GROUP BY week
            ORDER BY week
        """)

        rows = cur.fetchall()
        cur.close()
        conn.close()

        if len(rows) < 3:
            return jsonify({"error": "Not enough data"}), 400

        totals = [row[1] for row in rows]

        prediction = (0.5 * totals[-1]) + (0.3 * totals[-2]) + (0.2 * totals[-3])

        next_week_date = rows[-1][0] + timedelta(days=7)

        return jsonify({
            "prediction_week": next_week_date.strftime("%Y-%m-%d"),
            "predicted_next_week_spending": round(float(prediction), 2)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==============================
# Run
# ==============================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)