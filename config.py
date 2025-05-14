import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_CONNECTION_STRING = os.getenv("SUPABASE_CONNECTION_STRING")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")