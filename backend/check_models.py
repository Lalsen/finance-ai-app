import google.generativeai as genai

# paste your Gemini API key here
genai.configure(api_key="AIzaSyBuvmr9pks2iMM3kyFLK2LEo9Cz_an-8qc")

for model in genai.list_models():
    if "generateContent" in model.supported_generation_methods:
        print(model.name)