import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ==============================
# Database Configuration
# ==============================

DB_CONFIG = {
    "dbname": "finance_app_db",
    "user": "postgres",
    "password": "lalsen1234",   # change if needed
    "host": "localhost",
    "port": "5432"
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

# ==============================
# Auto Categorization Function
# ==============================

def categorize_transaction(merchant):
    merchant = merchant.lower()

    if "swiggy" in merchant or "zomato" in merchant:
        return "Food"
    elif "uber" in merchant or "ola" in merchant:
        return "Transport"
    elif "amazon" in merchant or "flipkart" in merchant:
        return "Shopping"
    elif "netflix" in merchant:
        return "Entertainment"
    elif "electricity" in merchant or "water" in merchant:
        return "Utilities"
    else:
        return "Others"

# ==============================
# Home Route
# ==============================

@app.route("/")
def home():
    return "Backend Running"

# ==============================
# Add Transaction (AUTO CATEGORY)
# ==============================

@app.route("/add-transaction", methods=["POST"], strict_slashes=False)
def add_transaction():
    try:
        data = request.json

        amount = data.get("amount")
        merchant = data.get("merchant")

        if not all([amount, merchant]):
            return jsonify({"error": "Missing required fields"}), 400

        # 🔥 Automatic category detection
        category = categorize_transaction(merchant)

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
            "message": "Transaction added successfully",
            "category_detected": category
        }), 201

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
# Spending Summary
# ==============================

@app.route("/spending-summary", methods=["GET"])
def spending_summary():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Total spending
        cur.execute("SELECT SUM(amount) FROM transactions")
        total = cur.fetchone()[0] or 0

        # Category-wise spending
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
