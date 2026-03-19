import joblib

model = joblib.load("category_model.pkl")

print(model.predict(["swiggy order"]))
print(model.predict(["zepto payment"]))
print(model.predict(["kmrl metro card"]))
print(model.predict(["SWIGGY LIMITED"]))
print(model.predict(["UPI/SWIGGY/12345"]))
print(model.predict(["POS AMAZON INDIA"]))
print(model.predict(["UPI-ZEPTO-MARKETPLACE"]))
print(model.predict(["CARD PAYMENT UBER"]))
print(model.predict(["UPI TRANSFER RAHUL"]))
print(model.predict(["IRCRC railway"]))
