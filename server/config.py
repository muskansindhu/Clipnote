import os
from dotenv import load_dotenv

load_dotenv()

ENVIRONMENT = os.getenv("FLASK_ENV", "development")

if ENVIRONMENT.lower() == "production":
    SUPABASE_CONNECTION_STRING = os.getenv("IPv4_SUPABASE_CONNECTION_STRING")
else:
    SUPABASE_CONNECTION_STRING = os.getenv("IPv6_SUPABASE_CONNECTION_STRING")

if not SUPABASE_CONNECTION_STRING:
    SUPABASE_CONNECTION_STRING = os.getenv("SUPABASE_CONNECTION_STRING")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_DISCOVERY_URL = os.getenv(
    "GOOGLE_DISCOVERY_URL",
    "https://accounts.google.com/.well-known/openid-configuration",
)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
APIFY_TOKEN = os.getenv("APIFY_TOKEN")
S3_BUCKET = os.getenv("S3_BUCKET")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
JWT_SECRET = os.getenv("JWT_SECRET")
ACCESS_KEY = os.getenv("ACCESS_KEY")
SECRET_KEY = os.getenv("SECRET_KEY")
OPENAI_MODEL = "gpt-4o-mini"
