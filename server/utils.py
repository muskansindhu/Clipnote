from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound, VideoUnavailable
from google import genai
from urllib.parse import urlparse, parse_qs

from config import GEMINI_API_KEY

ytt_api = YouTubeTranscriptApi()
genai_client = genai.Client(api_key=GEMINI_API_KEY)

def get_video_transcription(video_id):
    try:
        fetched_transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['en'])
        compiled_transcript = " ".join(snippet['text'] for snippet in fetched_transcript)
        return compiled_transcript
    except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable) as e:
        print(f"[Transcript Error] {e}")
        return "Transcript not available for this video."
    except Exception as e:
        print(f"[Unexpected Error] {e}")
        return "An unexpected error occurred while fetching the transcript."

def summarize_video(transcript):
    prompt = f"Please summarize the given text in 5 bullet points and do not add any extra line other than the summary content: {transcript}"
    response = genai_client.models.generate_content(
        model="gemini-2.0-flash", contents=prompt
    )
    return response.text

def extract_video_id(url: str) -> str | None:
    parsed = urlparse(url)
    query_params = parse_qs(parsed.query)
    return query_params.get("v", [None])[0]