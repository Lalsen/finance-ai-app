import psycopg2
from flask import Flask, request, jsonify, g
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
import hashlib
import secrets
import jwt as pyjwt
from functools import wraps

load_dotenv()

app = Flask(__name__)
CORS(app)

# ==============================
# Environment Variables
# ==============================

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET = os.getenv("JWT_SECRET", "supersecretkey_change_in_production")

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
# Initialize Tables
# ==============================
def init_db():
    conn = get_db_connection()
    cur = conn.cursor()

    # Create users table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Add user_id column to transactions if it doesn't exist
    cur.execute("""
        ALTER TABLE transactions
        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)
    """)

    conn.commit()
    cur.close()
    conn.close()
    print("✅ Database initialized")

try:
    init_db()
except Exception as e:
    print(f"⚠️ DB init warning: {e}")

# ==============================
# Load ML Model
# ==============================
model = joblib.load("category_model.pkl")

# ==============================
# Auth Helpers
# ==============================
def hash_password(password: str, salt: str) -> str:
    return hashlib.sha256((password + salt).encode()).hexdigest()

def generate_token(user_id: int, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now() + timedelta(days=30)
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            return jsonify({"error": "Token missing"}), 401
        try:
            data = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            g.user_id = data["user_id"]
            g.user_email = data["email"]
        except pyjwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except pyjwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated

# ==============================
# Register
# ==============================
@app.route("/register", methods=["POST"])
def register():
    try:
        data = request.get_json()
        name = data.get("name", "").strip()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")

        if not name or not email or not password:
            return jsonify({"error": "Name, email and password are required"}), 400

        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters"}), 400

        salt = secrets.token_hex(16)
        password_hash = hash_password(password, salt)

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            "INSERT INTO users (name, email, password_hash, salt) VALUES (%s, %s, %s, %s) RETURNING id",
            (name, email, password_hash, salt)
        )
        user_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()

        token = generate_token(user_id, email)
        return jsonify({"token": token, "user_id": user_id, "name": name, "email": email}), 201

    except psycopg2.errors.UniqueViolation:
        return jsonify({"error": "Email already registered"}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==============================
# Login
# ==============================
@app.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        cur.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        cur.close()
        conn.close()

        if not user:
            return jsonify({"error": "Invalid email or password"}), 401

        expected_hash = hash_password(password, user["salt"])
        if expected_hash != user["password_hash"]:
            return jsonify({"error": "Invalid email or password"}), 401

        token = generate_token(user["id"], user["email"])
        return jsonify({
            "token": token,
            "user_id": user["id"],
            "name": user["name"],
            "email": user["email"]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
# Financial Context for Chatbot (user-scoped)
# ==============================
def get_financial_context(user_id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        cur.execute("SELECT SUM(amount) FROM transactions WHERE user_id = %s", (user_id,))
        total = cur.fetchone()[0] or 0

        cur.execute("""
            SELECT category, SUM(amount) as total
            FROM transactions
            WHERE user_id = %s
            GROUP BY category
            ORDER BY total DESC
        """, (user_id,))
        categories = cur.fetchall()

        cur.execute("""
            SELECT merchant, amount, category, date
            FROM transactions
            WHERE user_id = %s
            ORDER BY date DESC
            LIMIT 10
        """, (user_id,))
        recent = cur.fetchall()

        cur.close()
        conn.close()

        context = "User's Financial Summary:\n"
        context += f"- Total spending: ₹{float(total):.2f}\n"

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
@token_required
def chat():
    try:
        data = request.get_json()

        if not data or "message" not in data:
            return jsonify({"error": "Missing message"}), 400

        user_message = data["message"].strip()

        if not user_message:
            return jsonify({"error": "Empty message"}), 400

        context = get_financial_context(g.user_id)

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

    if range_type == "this_month":
        start = today.replace(day=1)
        end = today + timedelta(days=1)   # inclusive of today

    elif range_type == "all":
        start = None
        end = None

    else:
        # week ranges handled by DATE_TRUNC in SQL
        start = None
        end = None

    return start, end

# ==============================
# Home
# ==============================
@app.route("/")
def home():
    return "Backend Running ✅"

# ==============================
# Process SMS
# ==============================
@app.route("/process-sms", methods=["POST"])
@token_required
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

        # Explicitly set date = CURRENT_TIMESTAMP so date filters always work
        cur.execute("""
            INSERT INTO transactions (amount, merchant, category, user_id, date)
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
        """, (amount, merchant, category, g.user_id))

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
@token_required
def get_transactions():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, amount, merchant, category, date
            FROM transactions
            WHERE user_id = %s
            ORDER BY date DESC
        """, (g.user_id,))

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify([
            {
                "id": r[0],
                "amount": float(r[1]),
                "merchant": r[2],
                "category": r[3],
                "date": str(r[4])
            } for r in rows
        ])

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==============================
# Spending Summary
# ==============================
@app.route("/spending-summary", methods=["GET"])
@token_required
def spending_summary():
    try:
        range_type = request.args.get("range", "last_week")

        conn = get_db_connection()
        cur = conn.cursor()

        # Use DATE_TRUNC for week ranges — consistent with weekly_analysis
        # This avoids Python date vs DB timestamp timezone mismatches
        if range_type == "this_week":
            cur.execute("""
                SELECT COALESCE(SUM(amount), 0)
                FROM transactions
                WHERE user_id = %s
                AND DATE_TRUNC('week', date::timestamp) = DATE_TRUNC('week', CURRENT_TIMESTAMP)
            """, (g.user_id,))
            total = cur.fetchone()[0]

            cur.execute("""
                SELECT category, COALESCE(SUM(amount), 0)
                FROM transactions
                WHERE user_id = %s
                AND DATE_TRUNC('week', date::timestamp) = DATE_TRUNC('week', CURRENT_TIMESTAMP)
                GROUP BY category
                ORDER BY SUM(amount) DESC
            """, (g.user_id,))

        elif range_type == "last_week":
            cur.execute("""
                SELECT COALESCE(SUM(amount), 0)
                FROM transactions
                WHERE user_id = %s
                AND DATE_TRUNC('week', date::timestamp) =
                    DATE_TRUNC('week', CURRENT_TIMESTAMP - INTERVAL '1 week')
            """, (g.user_id,))
            total = cur.fetchone()[0]

            cur.execute("""
                SELECT category, COALESCE(SUM(amount), 0)
                FROM transactions
                WHERE user_id = %s
                AND DATE_TRUNC('week', date::timestamp) =
                    DATE_TRUNC('week', CURRENT_TIMESTAMP - INTERVAL '1 week')
                GROUP BY category
                ORDER BY SUM(amount) DESC
            """, (g.user_id,))

        elif range_type == "this_month":
            cur.execute("""
                SELECT COALESCE(SUM(amount), 0)
                FROM transactions
                WHERE user_id = %s
                AND DATE_TRUNC('month', date::timestamp) = DATE_TRUNC('month', CURRENT_TIMESTAMP)
            """, (g.user_id,))
            total = cur.fetchone()[0]

            cur.execute("""
                SELECT category, COALESCE(SUM(amount), 0)
                FROM transactions
                WHERE user_id = %s
                AND DATE_TRUNC('month', date::timestamp) = DATE_TRUNC('month', CURRENT_TIMESTAMP)
                GROUP BY category
                ORDER BY SUM(amount) DESC
            """, (g.user_id,))

        else:  # "all"
            cur.execute(
                "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = %s",
                (g.user_id,)
            )
            total = cur.fetchone()[0]

            cur.execute("""
                SELECT category, COALESCE(SUM(amount), 0)
                FROM transactions
                WHERE user_id = %s
                GROUP BY category
                ORDER BY SUM(amount) DESC
            """, (g.user_id,))

        data = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify({
            "range": range_type,
            "total_spending": float(total),
            "category_breakdown": [
                {"category": r[0], "amount": float(r[1])} for r in data
            ]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==============================
# Weekly Analysis
# ==============================
@app.route("/weekly-analysis", methods=["GET"])
@token_required
def weekly_analysis():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        # Current week spending per category
        cur.execute("""
            SELECT category, SUM(amount) as total
            FROM transactions
            WHERE user_id = %s
            AND DATE_TRUNC('week', date::timestamp) = DATE_TRUNC('week', CURRENT_TIMESTAMP)
            GROUP BY category
        """, (g.user_id,))
        current_week = {row["category"]: float(row["total"]) for row in cur.fetchall()}

        # Last week spending per category
        cur.execute("""
            SELECT category, SUM(amount) as total
            FROM transactions
            WHERE user_id = %s
            AND DATE_TRUNC('week', date::timestamp) =
                DATE_TRUNC('week', CURRENT_TIMESTAMP - INTERVAL '1 week')
            GROUP BY category
        """, (g.user_id,))
        last_week = {row["category"]: float(row["total"]) for row in cur.fetchall()}

        # Current week total
        cur.execute("""
            SELECT COALESCE(SUM(amount), 0)
            FROM transactions
            WHERE user_id = %s
            AND DATE_TRUNC('week', date::timestamp) = DATE_TRUNC('week', CURRENT_TIMESTAMP)
        """, (g.user_id,))
        current_total = float(cur.fetchone()[0])

        # Last week total
        cur.execute("""
            SELECT COALESCE(SUM(amount), 0)
            FROM transactions
            WHERE user_id = %s
            AND DATE_TRUNC('week', date::timestamp) =
                DATE_TRUNC('week', CURRENT_TIMESTAMP - INTERVAL '1 week')
        """, (g.user_id,))
        last_total = float(cur.fetchone()[0])

        cur.close()
        conn.close()

        nudges = []
        all_categories = set(list(current_week.keys()) + list(last_week.keys()))
        for category in all_categories:
            current_value = current_week.get(category, 0)
            last_value = last_week.get(category, 0)

            if last_value > 0 and current_value > 0:
                change_percent = ((current_value - last_value) / last_value) * 100
                if change_percent > 10:
                    nudges.append(
                        f"\u26a0\ufe0f Your {category} spending increased by {change_percent:.1f}% this week."
                    )
                elif change_percent < -10:
                    nudges.append(
                        f"\u2705 Great! Your {category} spending decreased by {abs(change_percent):.1f}% this week."
                    )
            elif last_value == 0 and current_value > 0:
                nudges.append(
                    f"\U0001f195 New spending in {category} this week: \u20b9{current_value:.1f}."
                )

        # Overall week-over-week change nudge
        if last_total > 0 and current_total > 0:
            overall_change = ((current_total - last_total) / last_total) * 100
            if overall_change > 10:
                nudges.insert(0,
                    f"\u26a0\ufe0f Overall spending up {overall_change:.1f}% vs last week."
                )
            elif overall_change < -10:
                nudges.insert(0,
                    f"\u2705 Overall spending down {abs(overall_change):.1f}% vs last week!"
                )

        return jsonify({
            "current_week": current_week,
            "last_week": last_week,
            "current_total": current_total,
            "last_total": last_total,
            "nudges": nudges
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==============================
# Debug — check transaction dates
# ==============================
@app.route("/debug-transactions", methods=["GET"])
@token_required
def debug_transactions():
    """Temporary debug endpoint — shows recent transactions with their dates."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        cur.execute("""
            SELECT id, amount, merchant, category,
                   date,
                   DATE_TRUNC('week', date::timestamp) as week_start,
                   DATE_TRUNC('week', CURRENT_TIMESTAMP) as current_week_start
            FROM transactions
            WHERE user_id = %s
            ORDER BY date DESC NULLS LAST
            LIMIT 20
        """, (g.user_id,))

        rows = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify([
            {
                "id": row["id"],
                "amount": float(row["amount"]),
                "merchant": row["merchant"],
                "category": row["category"],
                "date": str(row["date"]),
                "week_start": str(row["week_start"]),
                "current_week_start": str(row["current_week_start"]),
                "in_current_week": str(row["week_start"]) == str(row["current_week_start"])
            } for row in rows
        ])

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==============================
# Prediction
# ==============================
@app.route("/predict-next-week", methods=["GET"])
@token_required
def predict_next_week():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT DATE_TRUNC('week', date), SUM(amount)
            FROM transactions
            WHERE user_id = %s
            GROUP BY 1 ORDER BY 1
        """, (g.user_id,))

        rows = cur.fetchall()
        cur.close()
        conn.close()

        if len(rows) < 3:
            return jsonify({"error": "Not enough data"}), 400

        totals = [float(r[1]) for r in rows]
        pred = 0.5 * totals[-1] + 0.3 * totals[-2] + 0.2 * totals[-3]

        return jsonify({"prediction": float(f"{pred:.2f}")})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==============================
# Run
# ==============================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)