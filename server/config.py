import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_CONNECTION_STRING = os.getenv("SUPABASE_CONNECTION_STRING")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
APIFY_TOKEN = os.getenv("APIFY_TOKEN")
S3_BUCKET = os.getenv("S3_BUCKET")