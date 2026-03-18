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

app = Flask(__name__)
CORS(app)

# ==============================
# Environment Variables (SECURE)
# ==============================

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
DB_PASSWORD = os.getenv("DB_PASSWORD")

if not GROQ_API_KEY:
    raise ValueError("❌ GROQ_API_KEY not set in environment variables")

if not DB_PASSWORD:
    raise ValueError("❌ DB_PASSWORD not set in environment variables")

groq_client = Groq(api_key=GROQ_API_KEY)

# ==============================
# Load ML Model
# ==============================
model = joblib.load("category_model.pkl")

# ==============================
# Database Config (SECURE)
# ==============================
DB_CONFIG = {
    "dbname": "finance_app_db",
    "user": "postgres",
    "password": DB_PASSWORD,
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
# DB Context for AI Chatbot
# ==============================
def get_financial_context():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        # Total spending
        cur.execute("SELECT COALESCE(SUM(amount),0) FROM transactions")
        total = cur.fetchone()[0]

        # Category-wise breakdown
        cur.execute("""
            SELECT category, SUM(amount) as total
            FROM transactions
            GROUP BY category
            ORDER BY total DESC
        """)
        categories = cur.fetchall()

        # Recent transactions (LIMIT 10 - SAFE)
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
# AI Chatbot Endpoint
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

        financial_context = get_financial_context()

        system_prompt = (
            "You are a smart personal finance assistant.\n"
            "Use the user's financial data if relevant.\n\n"
            f"{financial_context}\n\n"
            f"User question: {user_message}"
        )

        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": system_prompt}]
        )

        reply = response.choices[0].message.content

        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
            "message": "Stored",
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
        today = datetime.now().date()

        if range_type == "this_week":
            start = today - timedelta(days=today.weekday())
            end = start + timedelta(days=7)
        elif range_type == "last_week":
            end = today - timedelta(days=today.weekday())
            start = end - timedelta(days=7)
        else:
            start, end = None, None

        conn = get_db_connection()
        cur = conn.cursor()

        if start:
            cur.execute("""
                SELECT COALESCE(SUM(amount),0)
                FROM transactions
                WHERE date >= %s AND date < %s
            """, (start, end))
        else:
            cur.execute("SELECT COALESCE(SUM(amount),0) FROM transactions")

        total = cur.fetchone()[0]

        cur.execute("SELECT category, SUM(amount) FROM transactions GROUP BY category")
        category_data = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify({
            "total_spending": total,
            "category_breakdown": [
                {"category": r[0], "amount": r[1]} for r in category_data
            ]
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
            GROUP BY 1
            ORDER BY 1
        """)

        rows = cur.fetchall()

        cur.close()
        conn.close()

        if len(rows) < 3:
            return jsonify({"error": "Not enough data"}), 400

        totals = [r[1] for r in rows]

        prediction = (
            0.5 * totals[-1] +
            0.3 * totals[-2] +
            0.2 * totals[-3]
        )

        return jsonify({
            "predicted_spending": round(float(prediction), 2)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==============================
# Run
# ==============================
if __name__ == "__main__":
    app.run(debug=True)