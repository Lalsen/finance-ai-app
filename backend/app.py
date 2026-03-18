import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import timedelta, datetime
import psycopg2.extras
import joblib
import re
import numpy as np
from groq import Groq
import os
from dotenv import load_dotenv
import urllib.parse as urlparse

load_dotenv()

app = Flask(__name__)
CORS(app)

# ==============================
# Environment Variables
# ==============================

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

if not GROQ_API_KEY:
    raise ValueError("❌ GROQ_API_KEY not set")

if not DATABASE_URL:
    raise ValueError("❌ DATABASE_URL not set")

groq_client = Groq(api_key=GROQ_API_KEY)

# ==============================
# Parse Neon DB URL
# ==============================

url = urlparse.urlparse(DATABASE_URL)

DB_CONFIG = {
    "dbname": url.path[1:],
    "user": url.username,
    "password": url.password,
    "host": url.hostname,
    "port": url.port,
    "sslmode": "require"
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

# ==============================
# Load ML Model
# ==============================
model = joblib.load("category_model.pkl")

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
# Financial Context for Chatbot
# ==============================
def get_financial_context():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        cur.execute("SELECT SUM(amount) FROM transactions")
        total = cur.fetchone()[0] or 0

        cur.execute("""
            SELECT category, SUM(amount) as total
            FROM transactions
            GROUP BY category
            ORDER BY total DESC
        """)
        categories = cur.fetchall()

        cur.execute("""
            SELECT merchant, amount, category, date
            FROM transactions
            ORDER BY date DESC
            LIMIT 10
        """)
        recent = cur.fetchall()

        cur.close()
        conn.close()

        context = f"User's Financial Summary:\n"
        context += f"- Total spending: ₹{total:.2f}\n"

        context += "\nSpending by Category:\n"
        for row in categories:
            context += f"  - {row['category']}: ₹{float(row['total']):.2f}\n"

        context += "\nRecent Transactions:\n"
        for row in recent:
            context += f"  - {row['merchant']}: ₹{float(row['amount']):.2f} ({row['category']}) on {row['date']}\n"

        return context

    except Exception as e:
        return f"(Error fetching data: {str(e)})"

# ==============================
# Chatbot Endpoint
# ==============================
@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()

        if not data or "message" not in data:
            return jsonify({"error": "Missing message"}), 400

        user_message = data["message"].strip()

        if not user_message:
            return jsonify({"error": "Empty message"}), 400

        context = get_financial_context()

        prompt = f"""
        You are a helpful finance assistant.

        {context}

        User question: {user_message}
        """

        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}]
        )

        return jsonify({"reply": response.choices[0].message.content})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==============================
# Clean SMS
# ==============================
def clean_sms_text(text):
    text = text.lower()
    text = re.sub(r'\d+', '', text)
    text = re.sub(r'[^a-z ]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

# ==============================
# Date Range
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

        cleaned = clean_sms_text(sms_text)
        category = model.predict([cleaned])[0].lower()
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

        cur.close()
        conn.close()

        return jsonify([
            {
                "id": r[0],
                "amount": r[1],
                "merchant": r[2],
                "category": r[3],
                "date": r[4]
            } for r in rows
        ])

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==============================
# Spending Summary
# ==============================
@app.route("/spending-summary", methods=["GET"])
def spending_summary():
    try:
        range_type = request.args.get("range", "last_week")

        start, end = get_date_range(range_type)

        conn = get_db_connection()
        cur = conn.cursor()

        if start and end:
            cur.execute("""
                SELECT COALESCE(SUM(amount), 0)
                FROM transactions
                WHERE date >= %s AND date < %s
            """, (start, end))
            total = cur.fetchone()[0]

            cur.execute("""
                SELECT category, SUM(amount)
                FROM transactions
                WHERE date >= %s AND date < %s
                GROUP BY category
            """, (start, end))
        else:
            cur.execute("SELECT COALESCE(SUM(amount), 0) FROM transactions")
            total = cur.fetchone()[0]

            cur.execute("""
                SELECT category, SUM(amount)
                FROM transactions
                GROUP BY category
            """)

        data = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify({
            "range": range_type,
            "total_spending": total,
            "category_breakdown": [
                {"category": r[0], "amount": r[1]} for r in data
            ]
        })

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

        cur.execute("""
            SELECT category, SUM(amount) as total
            FROM transactions
            WHERE DATE_TRUNC('week', date) = DATE_TRUNC('week', CURRENT_DATE)
            GROUP BY category
        """)

        current_week = {row["category"]: row["total"] for row in cur.fetchall()}

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
# Prediction
# ==============================
@app.route("/predict-next-week", methods=["GET"])
def predict_next_week():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT DATE_TRUNC('week', date), SUM(amount)
            FROM transactions
            GROUP BY 1 ORDER BY 1
        """)

        rows = cur.fetchall()
        cur.close()
        conn.close()

        if len(rows) < 3:
            return jsonify({"error": "Not enough data"}), 400

        totals = [r[1] for r in rows]
        pred = 0.5 * totals[-1] + 0.3 * totals[-2] + 0.2 * totals[-3]

        return jsonify({"prediction": round(float(pred), 2)})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==============================
# Run
# ==============================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)