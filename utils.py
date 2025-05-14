from youtube_transcript_api import YouTubeTranscriptApi
from google import genai

from config import GEMINI_API_KEY

ytt_api = YouTubeTranscriptApi()
genai_client = genai.Client(api_key=GEMINI_API_KEY)

def get_video_transcription(video_id):
    fetched_transcript = ytt_api.fetch(video_id, languages=['en'])
    return "".join(snippet.text for snippet in fetched_transcript)

def summarize_video(transcript):
    prompt = f"Please summarize the given text in 5 bullet points: {transcript}"
    response = genai_client.models.generate_content(
        model="gemini-2.0-flash", contents=prompt
    )
    return response.text