import joblib

model = joblib.load("category_model.pkl")

print(model.predict(["swiggy order"]))
print(model.predict(["zepto payment"]))
print(model.predict(["kmrl metro card"]))
print(model.predict(["SWIGGY LIMITED"]))
